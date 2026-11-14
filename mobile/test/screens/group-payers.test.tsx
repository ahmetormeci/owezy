import { render, screen } from "@testing-library/react-native";
import GroupScreen from "../../app/groups/[groupId]";

/**
 * BU DOSYA NEYI KORUYOR: grup listesinde BIRDEN FAZLA ODEYEN (ADR-067).
 *
 *   1. ALT SATIR: "Veli ve Ben odedi", ucuncusunden sonrasi sayi. Cumle
 *      web'le ayni yerden (src/lib/payers.ts payerLine) kuruluyor.
 *   2. PAYIN RENGI NET DURUMA bakiyor (odedigim - payim), "ben mi odedim"e
 *      degil. Odeyenlerden biri olup payindan AZ odeyen kisi BORCLU
 *      gorunmeli; eski kural onu alacakli boyardi.
 *   3. ALT SATIR IKI SATIRA SARABILIYOR. Tek satirken uzun adlar ikinci
 *      odeyeni ve bolusum turunu kesiyordu (14 Kasim, simulator).
 *
 * Renkler LIGHT temadan (lib/theme.tsx): testte saglayici yok, useTheme
 * sistem ayarina - jest'te aciga - dusuyor.
 *
 * DIKKAT - @testing-library/react-native 14'te render ASENKRON.
 */

const CREDIT = "#1c5c4c";
const DEBT = "#a8503f";
const MUTED = "#6b6459";

const mockGet = jest.fn();
// SABIT olmali: her cagrida yeni fonksiyon donerse refreshAll'un bagimliligi
// degisir, odak efekti yeniden kosar ve sonsuz donguye girer.
const mockRefresh = jest.fn(async () => {});

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ groupId: "g1" }),
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
const VELI = "u-veli";
const AYSE = "u-ayse";

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") return { user: { id: ME } };
  if (path?.endsWith("/summary")) {
    return {
      currency: "TRY",
      byCategory: [],
      byMonth: [{ month: "2026-11", amount: 40000, count: 4 }],
      expenseCount: 4,
      totalAmount: 40000,
      myShare: 20000,
      myPaid: 20000,
      myBalance: 0,
    };
  }
  if (path?.endsWith("/members")) {
    return {
      members: [
        { userId: ME, displayName: "Ben", role: "OWNER", isGuest: false },
        { userId: VELI, displayName: "Veli", role: "MEMBER", isGuest: false },
        { userId: AYSE, displayName: "Ayşe", role: "MEMBER", isGuest: false },
      ],
    };
  }
  if (path?.endsWith("/balances")) {
    return { currency: "TRY", balances: [], suggestedTransfers: [], reminders: [] };
  }
  return { group: { id: "g1", name: "Ev", role: "OWNER" } };
}

/** 100 TL'lik bir harcama; payim `myShare`, kalani Veli'nin. */
function expense(
  id: string,
  description: string,
  payers: { userId: string; amount: number }[],
  myShare: number,
) {
  const paidById = [...payers].sort((a, b) => b.amount - a.amount)[0].userId;
  return {
    id,
    description,
    amount: 10000,
    category: "OTHER",
    splitType: "EXACT",
    expenseDate: `2026-11-0${id.slice(1)}`,
    paidById,
    payers,
    participants: [
      { userId: ME, shareAmount: myShare },
      { userId: VELI, shareAmount: 10000 - myShare },
    ],
    deletedAt: null,
    receipt: null,
    commentCount: 0,
  };
}

const EXPENSES = [
  // Iki odeyen; ben 30 odedim, payim 51 -> borcluyum (-21).
  expense(
    "e1",
    "Aksam yemegi",
    [
      { userId: VELI, amount: 7000 },
      { userId: ME, amount: 3000 },
    ],
    5100,
  ),
  // Uc odeyen; ben 60 odedim, payim 52 -> alacakliyim (+8).
  expense(
    "e2",
    "Tatil evi",
    [
      { userId: ME, amount: 6000 },
      { userId: VELI, amount: 2500 },
      { userId: AYSE, amount: 1500 },
    ],
    5200,
  ),
  // Tam payim kadar odedim -> net sifir, renk yok.
  expense(
    "e3",
    "Market",
    [
      { userId: VELI, amount: 4700 },
      { userId: ME, amount: 5300 },
    ],
    5300,
  ),
];

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(async (path: string) =>
    path.includes("/recurring-expenses")
      ? { ok: true, data: { recurring: [] } }
      : { ok: true, data: { expenses: EXPENSES, nextCursor: null, matches: null } },
  );
});

it("alt satir odeyenleri sayiyor: iki ad, ucuncusunden sonrasi sayi", async () => {
  await render(<GroupScreen />);
  expect(await screen.findByText("Aksam yemegi")).toBeTruthy();

  expect(screen.getByText(/Veli ve Ben ödedi/)).toBeTruthy();
  expect(screen.getByText(/Ben ve 2 kişi ödedi/)).toBeTruthy();
});

it("payin rengi NET duruma bakiyor: odeyenlerden biri olsam da az odediysem borc", async () => {
  await render(<GroupScreen />);
  expect(await screen.findByText("Aksam yemegi")).toBeTruthy();

  expect(screen.getByText("senin payın 51,00 ₺")).toHaveStyle({ color: DEBT });
  expect(screen.getByText("senin payın 52,00 ₺")).toHaveStyle({ color: CREDIT });
  expect(screen.getByText("senin payın 53,00 ₺")).toHaveStyle({ color: MUTED });
});

it("alt satir iki satira kadar sariyor, baslik tek satir kaliyor", async () => {
  await render(<GroupScreen />);
  expect(await screen.findByText("Aksam yemegi")).toBeTruthy();

  // Kesmenin kendisi platformda oluyor, jest metni olcmuyor. Olculebilen
  // sey sinirin kendisi: 1'e geri donerse bu test duser.
  expect(screen.getByText(/Veli ve Ben ödedi/)).toHaveProp("numberOfLines", 2);
  expect(screen.getByText("Aksam yemegi")).toHaveProp("numberOfLines", 1);
});
