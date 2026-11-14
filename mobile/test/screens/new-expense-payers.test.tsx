import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";

/**
 * BU DOSYA NEYI KORUYOR: harcama eklemede BIRDEN FAZLA ODEYEN (ADR-067).
 *
 *   1. GOVDE. Yeni istemci `payers` gonderiyor, tek odeyende de; `paidById`
 *      yalnizca sablonlarin bicimi. Ilk satirin tutari ekranda yazan
 *      "kalan"in AYNISI.
 *   2. KAYDI ENGELLEYEN IKI DURUM: bos tutar ve "digerleri tutari
 *      dolduruyor". Ikisi de istek GITMEDEN soyleniyor.
 *   3. TEKRARLAMA. Cok odeyenli bir sablon yok: kutu gizleniyor VE kutu
 *      isaretliyken ikinci odeyen eklenirse kayit sablon ucuna GITMIYOR.
 *      Ayni kusur kalem kalem'de de vardi (kutu gizli, `repeats` dogru).
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockPost = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok" }),
}));

const ME = { user: { id: "u1" } };
const MEMBERS = {
  members: [
    { userId: "u1", displayName: "Ben" },
    { userId: "u2", displayName: "Veli" },
    { userId: "u3", displayName: "Ayşe" },
  ],
};
const GROUP = { group: { id: "g1", name: "Ev", currency: "TRY" } };

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: {
      kind: "ok",
      data: path === "/api/v1/me" ? ME : path?.endsWith("/members") ? MEMBERS : GROUP,
    },
    reload: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ ok: true, data: { expense: { id: "e-yeni" } } });
});

async function fillBasics(amount = "100") {
  await render(<NewExpenseScreen />);
  await fireEvent.changeText(screen.getByTestId("description"), "Akşam yemeği");
  await fireEvent.changeText(screen.getByTestId("amount"), amount);
}

describe("odeyenler", () => {
  it("tek odeyende de LISTE gidiyor, paidById gitmiyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/api/v1/groups/g1/expenses");
    expect(body.payers).toEqual([{ userId: "u1", amount: 10000 }]);
    expect(body).not.toHaveProperty("paidById");
  });

  it("ikinci odeyen: ilk satir KALANI gosteriyor ve ayni sayi gidiyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByTestId("add-payer"));
    await fireEvent.changeText(screen.getByTestId("payer-amount-0"), "70");

    // Ilk bos uye ekleniyor: Veli. Kimse 30 yazmadi.
    expect(screen.getByLabelText("Veli ödediği tutar")).toBeTruthy();
    expect(screen.getByTestId("payer-rest")).toHaveTextContent("30,00 ₺");

    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][1].payers).toEqual([
      { userId: "u1", amount: 3000 },
      { userId: "u2", amount: 7000 },
    ]);
  });

  it("tutari bos birakilan satir istek GITMEDEN soyleniyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByTestId("add-payer"));
    await fireEvent.press(screen.getByTestId("save"));

    expect(screen.getByText("Her ödeyen için geçerli bir tutar gir")).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("digerleri tutari doldurursa CANLI soyleniyor ve kayit gitmiyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByTestId("add-payer"));
    await fireEvent.changeText(screen.getByTestId("payer-amount-0"), "100");

    const message = "Diğer ödeyenler tutarın tamamını karşılıyor; ilk ödeyene kalan yok.";
    expect(screen.getByText(message)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("save"));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("herkes odeyen olunca 'ekle' kayboluyor; satir cikarilinca geri geliyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByTestId("add-payer"));
    await fireEvent.press(screen.getByTestId("add-payer"));
    expect(screen.queryByTestId("add-payer")).toBeNull();

    await fireEvent.press(screen.getByTestId("remove-payer-1"));
    expect(screen.getByTestId("add-payer")).toBeTruthy();
  });
});

describe("tekrarlama ve odeyenler", () => {
  it("ikinci odeyen varken 'Bunu tekrarla' YOK, cikarilinca geri geliyor", async () => {
    await fillBasics();
    expect(screen.getByText("Bunu tekrarla")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("add-payer"));
    expect(screen.queryByText("Bunu tekrarla")).toBeNull();

    await fireEvent.press(screen.getByTestId("remove-payer-0"));
    expect(screen.getByText("Bunu tekrarla")).toBeTruthy();
  });

  it("kutu isaretliyken ikinci odeyen eklenirse kayit SABLON UCUNA gitmiyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByText("Bunu tekrarla"));
    await fireEvent.press(screen.getByTestId("add-payer"));
    await fireEvent.changeText(screen.getByTestId("payer-amount-0"), "40");
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0]).toBe("/api/v1/groups/g1/expenses");
  });

  it("tek odeyenli tekrarlayan SABLON eski bicimle (paidById) gidiyor", async () => {
    await fillBasics();
    await fireEvent.press(screen.getByText("Bunu tekrarla"));
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/api/v1/groups/g1/recurring-expenses");
    expect(body.paidById).toBe("u1");
    expect(body).not.toHaveProperty("payers");
  });
});
