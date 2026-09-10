import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import GroupScreen from "../../app/groups/[groupId]";

/**
 * BU DOSYA NEYI KORUYOR: hatirlatmanin YANLIS SATIRDA CIKMAMASINI (ADR-050).
 *
 * Sunucu yonu zaten uyguluyor (lib/reminders.ts: yalnizca odesme planinda
 * BANA odemesi gereken kisiye hatirlatilabiliyor). Ekran bu kurali
 * AYNALIYOR - reddedilecek bir dokunusun hic cizilmemesi icin. Aynalama
 * sessizce bozulabilecek turden: kosulun tersine donmesi derlenir, testler
 * gecer, ve sonucu kullaniciya "borcunu hatirlat" derken kendi borcunu
 * gostermektir.
 *
 * IKINCI KORUDUGU SEY: satirin GONDERILDIKTEN SONRA kapanmasi - hem basari
 * hem 409 dalinda. 409 "cok erken" demek, yani gonderilmis bir hatirlatma
 * VAR (baska bir cihazdan); satiri acik birakmak kullaniciyi ayni duvara
 * tekrar surerdi.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  useFocusEffect: () => undefined,
  Link: () => null,
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: { kind: "ok", data: mockDataFor(path) },
    reload: jest.fn(),
  }),
}));

jest.mock("../../lib/auth", () => ({
  useSession: () => ({ getToken: async () => "token", signOut: jest.fn() }),
}));

const ME = "u-me";
const DEBTOR = "u-debtor";
const CREDITOR = "u-creditor";

/** Testin degistirdigi dunya: plan ve daha once gonderilen hatirlatmalar. */
let mockTransfers: { fromUserId: string; toUserId: string; amount: number }[] = [];
let mockReminders: { toUserId: string; amount: number; sentAt: string }[] = [];

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") return { user: { id: ME } };
  if (path?.endsWith("/summary")) {
    return {
      currency: "TRY",
      byCategory: [],
      byMonth: [{ month: "2026-09", amount: 50000, count: 1 }],
      expenseCount: 1,
      totalAmount: 50000,
      myShare: 25000,
      myPaid: 50000,
    };
  }
  if (path?.endsWith("/members")) {
    return {
      members: [
        { userId: ME, displayName: "Ben", role: "OWNER" },
        { userId: DEBTOR, displayName: "Borclu Kisi", role: "MEMBER" },
        { userId: CREDITOR, displayName: "Alacakli Kisi", role: "MEMBER" },
      ],
    };
  }
  if (path?.endsWith("/balances")) {
    return {
      currency: "TRY",
      balances: [{ userId: ME, amount: 25000, displayName: "Ben", hasLeft: false }],
      suggestedTransfers: mockTransfers,
      reminders: mockReminders,
    };
  }
  return { group: { id: "g1", name: "Ev", role: "OWNER" } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransfers = [{ fromUserId: DEBTOR, toUserId: ME, amount: 25000 }];
  mockReminders = [];
  /**
   * GET yola gore cevap veriyor. Tek bir govde donduren bir taklit,
   * ekrandaki BASKA bir bolumu (tekrarlayan harcamalar) beklemedigi bir
   * sekille besliyor ve o bolum cokuyordu - bu test dosyasi tam olarak
   * bunu ortaya cikardi.
   */
  mockGet.mockImplementation(async (path: string) =>
    path.includes("/recurring-expenses")
      ? { ok: true, data: { recurring: [] } }
      : { ok: true, data: { expenses: [], nextCursor: null, matches: null } },
  );
  mockPost.mockResolvedValue({ ok: true, data: { reminder: { toUserId: DEBTOR } } });
});

describe("hatirlatma hangi satirda cikiyor", () => {
  it("BANA ODEYECEK kisinin satirinda cikiyor", async () => {
    await render(<GroupScreen />);
    expect(screen.getByText("Hatırlat")).toBeTruthy();
  });

  it("BENIM ODEYECEGIM satirda CIKMIYOR", async () => {
    // NEGATIF KONTROL: kosul tersine donerse kullaniciya kendi borcunu
    // "hatirlat" diye gosteririz.
    mockTransfers = [{ fromUserId: ME, toUserId: CREDITOR, amount: 25000 }];

    await render(<GroupScreen />);
    expect(screen.queryByText("Hatırlat")).toBeNull();
  });

  it("iki satir varsa YALNIZCA alacakli olduğum satirda cikiyor", async () => {
    mockTransfers = [
      { fromUserId: ME, toUserId: CREDITOR, amount: 10000 },
      { fromUserId: DEBTOR, toUserId: ME, amount: 25000 },
    ];

    await render(<GroupScreen />);
    expect(screen.getAllByText("Hatırlat")).toHaveLength(1);
  });

  it("sunucu ONCEDEN hatirlatildigini soyluyorsa satir KAPALI geliyor", async () => {
    mockReminders = [
      { toUserId: DEBTOR, amount: 25000, sentAt: new Date().toISOString() },
    ];

    await render(<GroupScreen />);
    expect(screen.queryByText("Hatırlat")).toBeNull();
    expect(screen.getByText("Hatırlatıldı")).toBeTruthy();
  });
});

describe("gonderim", () => {
  it("dogru uca ve dogru kisiyle gidiyor - tutar GONDERILMIYOR", async () => {
    // Tutari istemci gonderseydi "sana 9.999 TL borcun var" diyen bir
    // hatirlatma kurulabilirdi; sunucu tutari her zaman kendi plani'ndan
    // okuyor (ADR-050).
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("Hatırlat"));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups/g1/reminders", {
      toUserId: DEBTOR,
    });
  });

  it("basarili gonderimden sonra satir KAPANIYOR", async () => {
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("Hatırlat"));

    await waitFor(() => expect(screen.getByText("Hatırlatıldı")).toBeTruthy());
    expect(screen.queryByText("Hatırlat")).toBeNull();
  });

  it("409 (cok erken) da satiri KAPATIYOR ve sebebi yaziyor", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      status: 409,
      code: "reminder.too_soon",
      params: { hours: 24 },
    });

    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("Hatırlat"));

    await waitFor(() => expect(screen.getByText("Hatırlatıldı")).toBeTruthy());
    expect(screen.getByText("Aynı kişiye 24 saatte bir hatırlatabilirsin")).toBeTruthy();
  });

  it("baska bir hata satiri ACIK birakiyor", async () => {
    // 409 disindaki hatada gonderilmis bir hatirlatma YOK: kullanici tekrar
    // deneyebilmeli.
    mockPost.mockResolvedValue({
      ok: false,
      status: 500,
      code: "server.unexpected",
      params: undefined,
    });

    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("Hatırlat"));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(screen.getByText("Hatırlat")).toBeTruthy();
    expect(screen.queryByText("Hatırlatıldı")).toBeNull();
  });
});
