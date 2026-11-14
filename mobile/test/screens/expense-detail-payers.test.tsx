import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ExpenseScreen from "../../app/groups/[groupId]/expenses/[expenseId]";

/**
 * BU DOSYA NEYI KORUYOR: harcama detayinda BIRDEN FAZLA ODEYEN (ADR-067).
 *
 * ASIL TEHLIKE SESSIZ VERI KAYBI. Bu ekran "tam degistirme" gonderiyor;
 * dagilim forma geri yuklenmeseydi bir aciklama duzeltmesi diger
 * odeyenleri silerdi. Sunucu eski govdeyi (paidById) cok odeyenli
 * harcamada reddediyor - bu testler yeni istemcinin o yola hic girmedigini
 * ve dagilimi koruyarak gonderdigini gosteriyor.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockPut = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1", expenseId: "e1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok" }),
}));

// Fis ve yorumlar bu testin konusu degil; kendi istekleri var.
jest.mock("../../components/receipt-photo", () => ({ ReceiptPhoto: () => null }));
jest.mock("../../components/expense-comments", () => ({ ExpenseComments: () => null }));

const ME = { user: { id: "u1" } };
const MEMBERS = {
  members: [
    { userId: "u1", displayName: "Ben" },
    { userId: "u2", displayName: "Veli" },
  ],
};

/** 100 TL; Veli 70, ben 30 odedim, esit bolundu. Ana odeyen Veli. */
const TWO_PAYERS = {
  id: "e1",
  description: "Akşam yemeği",
  amount: 10000,
  currency: "TRY",
  category: "OTHER",
  splitType: "EQUAL",
  expenseDate: "2026-11-10",
  paidById: "u2",
  payers: [
    { userId: "u2", amount: 7000 },
    { userId: "u1", amount: 3000 },
  ],
  createdById: "u1",
  participants: [
    { userId: "u1", shareAmount: 5000, basisPoints: null },
    { userId: "u2", shareAmount: 5000, basisPoints: null },
  ],
  version: 3,
  receipt: null,
};

let mockExpense: Record<string, unknown> = TWO_PAYERS;

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    post: jest.fn(),
    get: jest.fn(),
    put: mockPut,
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: {
      kind: "ok",
      data:
        path === "/api/v1/me"
          ? ME
          : path?.endsWith("/members")
            ? MEMBERS
            : { expense: mockExpense },
    },
    reload: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockExpense = TWO_PAYERS;
  mockPut.mockResolvedValue({ ok: true, data: { expense: TWO_PAYERS } });
});

describe("duzenleyebilen kisi", () => {
  it("dagilim forma geri geliyor: ana odeyen kalanda, digeri kendi satirinda", async () => {
    await render(<ExpenseScreen />);

    expect(screen.getByTestId("payer-rest")).toHaveTextContent("70,00 ₺");
    expect(screen.getByTestId("payer-amount-0")).toHaveDisplayValue("30");
    expect(screen.getByLabelText("Ben ödediği tutar")).toBeTruthy();
  });

  it("aciklama duzeltmesi DAGILIMI KORUYOR ve paidById gondermiyor", async () => {
    await render(<ExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("description"), "Akşam yemeği (düzeltme)");
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    const [path, body] = mockPut.mock.calls[0];
    expect(path).toBe("/api/v1/groups/g1/expenses/e1");
    expect(body.payers).toEqual([
      { userId: "u2", amount: 7000 },
      { userId: "u1", amount: 3000 },
    ]);
    expect(body).not.toHaveProperty("paidById");
    expect(body.version).toBe(3);
  });

  it("tutar degisince farki ANA ODEYENIN kalani aliyor", async () => {
    await render(<ExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("amount"), "120");
    expect(screen.getByTestId("payer-rest")).toHaveTextContent("90,00 ₺");

    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1].payers).toEqual([
      { userId: "u2", amount: 9000 },
      { userId: "u1", amount: 3000 },
    ]);
  });

  it("alani tasimayan (eski) cevapta tek odeyen, tutarin tamami", async () => {
    mockExpense = { ...TWO_PAYERS, payers: undefined, paidById: "u1" };
    await render(<ExpenseScreen />);
    expect(screen.queryByTestId("payer-rest")).toBeNull();

    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut.mock.calls[0][1].payers).toEqual([{ userId: "u1", amount: 10000 }]);
  });
});

describe("salt okunur", () => {
  it("baskasinin kaydinda odeyenler kisi basina bir satir", async () => {
    mockExpense = { ...TWO_PAYERS, createdById: "u2" };
    await render(<ExpenseScreen />);

    expect(screen.getByText("ÖDEYENLER")).toBeTruthy();
    expect(screen.getByText("Veli")).toBeTruthy();
    expect(screen.getByText("70,00 ₺")).toBeTruthy();
    expect(screen.getByText("30,00 ₺")).toBeTruthy();
    // Duzenleme denetimi yok.
    expect(screen.queryByTestId("add-payer")).toBeNull();
    expect(screen.queryByTestId("payer-rest")).toBeNull();
  });
});
