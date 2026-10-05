import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import AccountScreen from "../../app/account";
import GroupScreen from "../../app/groups/[groupId]";
import SettlementsScreen from "../../app/groups/[groupId]/settlements";
import { ThemeProvider } from "../../lib/theme";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const clipboard = require("../expo-clipboard.mock") as typeof import("../expo-clipboard.mock");

/**
 * BU DOSYA NEYI KORUYOR: IBAN'in mobil tarafini (ADR-059, Faz 52b).
 *
 *   - Hesap ekrani: ekleme, YANLIS IBAN'in sunucuya gitmemesi, kaldirma,
 *     ayni IBAN'i yeniden kaydetmenin istek atmamasi.
 *   - Grup ekrani: kopyalama YALNIZCA BORCLU OLDUGUM satirda (yon ters
 *     donerse kullaniciya borclusunun IBAN'ini gosteririz); panoya giden
 *     BOSLUKSUZ kayit; "son 7 gunde degisti" uyarisi; "IBAN ekle" ipucu.
 *   - Odeme ekrani: alicinin IBAN'i YALNIZCA giden odemede.
 *
 * Ornek IBAN SWIFT kaydindaki TR ornegi; gercek bir hesap degil.
 */

const IBAN = "TR330006100519786457841326";
const IBAN_SPACED = "TR33 0006 1005 1978 6457 8413 26";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockReload = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = { groupId: "g1" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
  Link: () => null,
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok", signOut: jest.fn() }),
}));

jest.mock("../../lib/push", () => ({ disablePush: jest.fn(async () => {}) }));

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: jest.fn(),
    patch: mockPatch,
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: { kind: "ok", data: mockDataFor(path) },
    reload: mockReload,
  }),
}));

const ME = "u-me";
const CREDITOR = "u-creditor";
const DEBTOR = "u-debtor";

/** Testin degistirdigi dunya. */
let mockMyIban: string | null = null;
let mockIbanOf: Record<string, { iban: string; ibanUpdatedAt: string } | undefined> = {};
let mockTransfers: { fromUserId: string; toUserId: string; amount: number }[] = [];

const LONG_AGO = "2026-01-01T00:00:00.000Z";

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") {
    return { user: { id: ME, displayName: "Ben", email: "ben@example.com", iban: mockMyIban } };
  }
  if (path?.endsWith("/summary")) {
    return {
      currency: "TRY",
      byCategory: [],
      byMonth: [{ month: "2026-09", amount: 50000, count: 1 }],
      expenseCount: 1,
      totalAmount: 50000,
      myShare: 25000,
      myPaid: 25000,
    };
  }
  if (path?.endsWith("/members")) {
    return {
      members: [
        { userId: ME, displayName: "Ben", role: "OWNER" },
        { userId: CREDITOR, displayName: "Alacakli Kisi", role: "MEMBER" },
        { userId: DEBTOR, displayName: "Borclu Kisi", role: "MEMBER" },
      ].map((member) => ({
        ...member,
        isGuest: false,
        iban: member.userId === ME ? mockMyIban : (mockIbanOf[member.userId]?.iban ?? null),
        ibanUpdatedAt:
          member.userId === ME
            ? mockMyIban
              ? LONG_AGO
              : null
            : (mockIbanOf[member.userId]?.ibanUpdatedAt ?? null),
      })),
    };
  }
  if (path?.endsWith("/balances")) {
    return {
      currency: "TRY",
      balances: [{ userId: ME, amount: -25000, displayName: "Ben", hasLeft: false }],
      suggestedTransfers: mockTransfers,
      reminders: [],
    };
  }
  if (path?.endsWith("/settlements")) return { settlements: [], nextCursor: null };
  return { group: { id: "g1", name: "Ev", role: "OWNER", currency: "TRY" } };
}

beforeEach(() => {
  jest.clearAllMocks();
  clipboard.__reset();
  mockParams = { groupId: "g1" };
  mockMyIban = null;
  mockIbanOf = { [CREDITOR]: { iban: IBAN, ibanUpdatedAt: LONG_AGO } };
  mockTransfers = [{ fromUserId: ME, toUserId: CREDITOR, amount: 25000 }];
  mockGet.mockImplementation(async (path: string) =>
    path.includes("/recurring-expenses")
      ? { ok: true, data: { recurring: [] } }
      : { ok: true, data: { expenses: [], nextCursor: null, matches: null } },
  );
  mockPatch.mockResolvedValue({ ok: true, data: { user: {} } });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

/** Hesap ekrani tema SECIMINI de okuyor (useThemeChoice) - saglayici sart. */
async function renderAccount() {
  await render(
    <ThemeProvider>
      <AccountScreen />
    </ThemeProvider>,
  );
}

describe("hesap ekrani", () => {
  it("IBAN yoksa 'IBAN ekle' ve kimin gorecegini soyleyen ipucu var", async () => {
    await renderAccount();
    expect(screen.getByText("IBAN ekle")).toBeTruthy();
    expect(screen.getByText(/Gruplarındaki üyeler sana ödeme yaparken görür/)).toBeTruthy();
  });

  it("kontrol hanesi tutmayan IBAN SUNUCUYA GITMIYOR ve sebebi yaziyor", async () => {
    await renderAccount();
    await fireEvent.press(screen.getByText("IBAN ekle"));
    await fireEvent.changeText(screen.getByTestId("iban-input"), "TR33 0006 1005 1978 6457 8413 27");
    await fireEvent.press(screen.getByText("Kaydet"));

    expect(screen.getByText(/Bu geçerli bir IBAN değil/)).toBeTruthy();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("hata mesaji yazi degisince kalkiyor", async () => {
    await renderAccount();
    await fireEvent.press(screen.getByText("IBAN ekle"));
    await fireEvent.changeText(screen.getByTestId("iban-input"), "TR33 0006 1005 1978 6457 8413 27");
    await fireEvent.press(screen.getByText("Kaydet"));
    expect(screen.getByText(/Bu geçerli bir IBAN değil/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("iban-input"), "TR33 0006 1005 1978 6457 8413 2");
    expect(screen.queryByText(/Bu geçerli bir IBAN değil/)).toBeNull();
  });

  it("bosluklu ve kucuk harfli IBAN normalize edilip gidiyor, ekran tazeleniyor", async () => {
    await renderAccount();
    await fireEvent.press(screen.getByText("IBAN ekle"));
    await fireEvent.changeText(screen.getByTestId("iban-input"), IBAN_SPACED.toLowerCase());
    await fireEvent.press(screen.getByText("Kaydet"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/me", { iban: IBAN });
    expect(mockReload).toHaveBeenCalled();
  });

  it("kayitli IBAN 4'erli gorunuyor ve kaldirma null gonderiyor", async () => {
    mockMyIban = IBAN;
    await renderAccount();

    expect(screen.getByText(IBAN_SPACED)).toBeTruthy();
    await fireEvent.press(screen.getByText("IBAN'ı kaldır"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("/api/v1/me", { iban: null }));
  });

  it("ayni IBAN yeniden kaydedilirse istek ATILMIYOR", async () => {
    // Sunucu zaten yazmazdi; ama istek atmak sahibine bosuna "IBAN'in
    // degisti" postasi gonderilip gonderilmeyecegini sunucuya birakmak olurdu.
    mockMyIban = IBAN;
    await renderAccount();
    await fireEvent.press(screen.getByText("Düzenle"));
    await fireEvent.press(screen.getByText("Kaydet"));

    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe("grup ekrani - bakiye karti", () => {
  it("BORCLU OLDUGUM satirda kopyalaniyor; panoya BOSLUKSUZ kayit gidiyor", async () => {
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("IBAN'ı kopyala"));

    await waitFor(() => expect(clipboard.__last()).toBe(IBAN));
    expect(screen.getByText("IBAN kopyalandı")).toBeTruthy();
    // Eski IBAN: uyari yok.
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("alacaklinin IBAN'i yoksa kopyalama YOK - satir yine orada", async () => {
    mockIbanOf = {};
    await render(<GroupScreen />);

    expect(screen.getByText("Alacakli Kisi")).toBeTruthy();
    expect(screen.queryByText("IBAN'ı kopyala")).toBeNull();
  });

  it("BANA BORCLU olanin satirinda kopyalama YOK - onun IBAN'i olsa bile", async () => {
    // NEGATIF KONTROL: yon ters donerse kullaniciya borclusunun IBAN'ini
    // gostermis oluruz.
    mockTransfers = [{ fromUserId: DEBTOR, toUserId: ME, amount: 25000 }];
    mockIbanOf = { [DEBTOR]: { iban: IBAN, ibanUpdatedAt: LONG_AGO } };
    mockMyIban = IBAN;
    await render(<GroupScreen />);

    expect(screen.getByText("Borclu Kisi")).toBeTruthy();
    expect(screen.queryByText("IBAN'ı kopyala")).toBeNull();
  });

  it("son 7 gunde degismis IBAN kopyalaninca UYARI cikiyor", async () => {
    mockIbanOf = { [CREDITOR]: { iban: IBAN, ibanUpdatedAt: new Date().toISOString() } };
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("IBAN'ı kopyala"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "IBAN kopyalandı",
        expect.stringContaining("son 7 gün içinde değişti"),
      ),
    );
  });

  it("pano yazilamazsa IBAN ekranda gosteriliyor - elle yazilabilsin", async () => {
    clipboard.__failNext();
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByText("IBAN'ı kopyala"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(expect.stringContaining(IBAN_SPACED)),
    );
  });

  it("bana odenecek var ve IBAN'im yoksa 'IBAN ekle' ipucu cikiyor, hesaba goturuyor", async () => {
    mockTransfers = [{ fromUserId: DEBTOR, toUserId: ME, amount: 25000 }];
    await render(<GroupScreen />);

    await fireEvent.press(screen.getByText(/IBAN'ını eklersen/));
    expect(mockPush).toHaveBeenCalledWith("/account");
  });

  it("IBAN'im varsa ipucu CIKMIYOR", async () => {
    mockTransfers = [{ fromUserId: DEBTOR, toUserId: ME, amount: 25000 }];
    mockMyIban = IBAN;
    await render(<GroupScreen />);

    expect(screen.getByText("Borclu Kisi")).toBeTruthy();
    expect(screen.queryByText(/IBAN'ını eklersen/)).toBeNull();
  });
});

describe("odeme ekrani", () => {
  it("giden odemede alicinin IBAN'i gorunuyor; gelen odemede GORUNMUYOR", async () => {
    mockParams = { groupId: "g1", to: CREDITOR, amount: "25000" };
    await render(<SettlementsScreen />);

    expect(screen.getByText(IBAN_SPACED)).toBeTruthy();
    await fireEvent.press(screen.getByText("Bana ödendi"));
    expect(screen.queryByText(IBAN_SPACED)).toBeNull();
  });

  it("gelen odemede alan basligi 'Kim ödedi?' oluyor - 'Kime ödedin?' celisirdi", async () => {
    mockParams = { groupId: "g1", to: CREDITOR, amount: "25000" };
    await render(<SettlementsScreen />);

    // Baslik ekranda BUYUK HARFLE ciziliyor; secim alaninin erisilebilirlik
    // etiketi ise metni oldugu gibi tasiyor ("<baslik>: <secili kisi>").
    expect(screen.getByLabelText(/^Kime ödedin\?:/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Bana ödendi"));
    expect(screen.queryByLabelText(/^Kime ödedin\?:/)).toBeNull();
    expect(screen.getByLabelText(/^Kim ödedi\?:/)).toBeTruthy();
  });

  it("son 7 gunde degismisse kalici uyari satiri var", async () => {
    mockIbanOf = { [CREDITOR]: { iban: IBAN, ibanUpdatedAt: new Date().toISOString() } };
    mockParams = { groupId: "g1", to: CREDITOR, amount: "25000" };
    await render(<SettlementsScreen />);

    expect(screen.getByText(/son 7 gün içinde değişti/)).toBeTruthy();
  });
});
