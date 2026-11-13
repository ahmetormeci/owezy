import { act, render, screen } from "@testing-library/react-native";
import { emitRefreshSignal } from "../../lib/refresh-signal";
import GroupScreen from "../../app/groups/[groupId]";

/**
 * BU DOSYA NEYI KORUYOR: grup ekraninin tazelenirken AYLARI BOSALTMAMASINI.
 *
 * Onceden geri donuste setMonths({}) vardi: acik ay bir an spinner'a
 * dusuyor, kullanicinin actigi eski aylar kapaniyordu. Asagi cekip yenileme
 * ve one gelince tazeleme eklenince bu, listenin parmagin altindan
 * kaybolmasi olurdu. Kullanici karari: geri donme, one gelme ve asagi cekme
 * AYNI fonksiyonu cagirsin ve aylar YERINDE tazelensin.
 *
 * Bu davranis sessizce geri donebilir: setMonths({}) tek satir, derlenir ve
 * sonunda dogru veri yine gelir. Fark yalnizca CEVAP BEKLENIRKEN gorunuyor;
 * test de tam o ani olcuyor.
 *
 * DIKKAT - @testing-library/react-native 14'te render, fireEvent VE act
 * ASENKRON; hepsi beklenmeli (foreground-refresh.test.tsx).
 */

const mockGet = jest.fn();
const mockRefresh = jest.fn(async () => {});

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ groupId: "g1" }),
    // Odaklanma efekti baglaninca calisiyor: one gelme aboneligi kurulsun.
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
    Link: () => null,
    Stack: { Screen: () => null },
  };
});

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: { kind: "ok", data: mockDataFor(path) },
    reload: jest.fn(),
    refresh: mockRefresh,
    refreshError: null,
  }),
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "token", signOut: jest.fn() }),
}));

const ME = "u-me";

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") return { user: { id: ME } };
  if (path?.endsWith("/summary")) {
    return {
      currency: "TRY",
      byCategory: [],
      byMonth: [{ month: "2026-11", amount: 150000, count: 2 }],
      expenseCount: 2,
      totalAmount: 150000,
      myShare: 150000,
      myPaid: 150000,
      myBalance: 0,
    };
  }
  if (path?.endsWith("/members")) {
    return { members: [{ userId: ME, displayName: "Ben", role: "OWNER", isGuest: false }] };
  }
  if (path?.endsWith("/balances")) {
    return { currency: "TRY", balances: [], suggestedTransfers: [], reminders: [] };
  }
  return { group: { id: "g1", name: "Ev", role: "OWNER" } };
}

function expense(id: string, description: string, expenseDate: string) {
  return {
    id,
    description,
    amount: 50000,
    category: "OTHER",
    splitType: "EQUAL",
    expenseDate,
    paidById: ME,
    participants: [{ userId: ME, shareAmount: 50000 }],
    deletedAt: null,
    receipt: null,
    commentCount: 0,
  };
}

const MARKET = expense("e1", "Haftalik market", "2026-11-03");
// Zamanlanmis gorevin urettigi kayit - kullanicinin bildirdigi gecikmenin konusu.
const KIRA = expense("e2", "Kira (otomatik)", "2026-11-05");

function page(...expenses: ReturnType<typeof expense>[]) {
  return { ok: true, data: { expenses, nextCursor: null, matches: null } };
}

/** Elle cozulen bir cevap: "cevap gelmeden once" ani olculebilsin diye. */
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Ay sayfasi isteklerini verilen cevaba, digerlerini bos listeye yonlendirir. */
function serveMonth(answer: unknown) {
  mockGet.mockImplementation(async (path: string) =>
    path.includes("/recurring-expenses") ? { ok: true, data: { recurring: [] } } : answer,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockRefresh.mockClear();
});

it("one gelince acik ayin satirlari SILINMEDEN tazeleniyor", async () => {
  serveMonth(page(MARKET));
  await render(<GroupScreen />);
  expect(await screen.findByText("Haftalik market")).toBeTruthy();

  const pending = deferred();
  serveMonth(pending.promise);
  await act(async () => {
    emitRefreshSignal();
  });

  // CEVAP GELMEDEN eski satir ekranda. setMonths({}) geri gelirse burada
  // ay bosalmis ve spinner'a dusmus olurdu.
  expect(screen.getByText("Haftalik market")).toBeTruthy();
  // Ozet, grup, uyeler, bakiyeler - dordu de tazelendi.
  expect(mockRefresh).toHaveBeenCalledTimes(4);
  expect(mockGet).toHaveBeenCalledWith(
    "/api/v1/groups/g1/expenses?limit=20&month=2026-11",
  );

  await act(async () => {
    pending.resolve(page(KIRA, MARKET));
  });

  expect(await screen.findByText("Kira (otomatik)")).toBeTruthy();
  expect(screen.getByText("Haftalik market")).toBeTruthy();
});

it("tazeleme BASARISIZ olursa ayin satirlari kaliyor", async () => {
  serveMonth(page(MARKET));
  await render(<GroupScreen />);
  await screen.findByText("Haftalik market");

  serveMonth({ ok: false, status: 0, code: "server.offline" });
  await act(async () => {
    emitRefreshSignal();
  });

  expect(screen.getByText("Haftalik market")).toBeTruthy();
  // Ayin kendi "Tekrar dene"si CIKMIYOR: ilk yuklemenin hatasi degil bu,
  // ve uyariyi ekranin ustundeki satir zaten veriyor.
  expect(screen.queryByText("Tekrar dene")).toBeNull();
});
