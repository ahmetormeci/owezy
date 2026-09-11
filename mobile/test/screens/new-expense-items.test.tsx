import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";
import { mockReadBlocks, mockReceiptLines } from "../jest-setup";

/**
 * BU DOSYA NEYI KORUYOR: fişten okunan tutarın KULLANICININ YAZDIĞINI
 * EZMEMESINI (ADR-053).
 *
 * Okumanin kendisi burada yok - onun kurallari saf modulde ve orada
 * ayri ayri sinaniyor (src/lib/receipt-amount.test.ts). Burada sinanan
 * sey EKRANIN DAVRANISI ve en agir kusur su: fis okumasi birkac saniye
 * suruyor, kullanici o sirada tutari yaziyor, okuma bitince yazdigini
 * eziyor. Sonucu SESSIZCE YANLIS bir harcama - ve kullanici kendi
 * yazdigini gordugunu sandigi icin fark etmiyor.
 *
 * Ikinci korudugu sey: okunan tutarin OKUNDUGUNUN SOYLENMESI. Sessizce
 * dolan bir alan, kullaniciya kendi yazmadigi bir sayiyi kendi yazmis
 * gibi gosterir.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockPost = jest.fn();
const mockPick = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  // MemberAvatar bunu cagiriyor (ADR-054). null = belirtec yok -> bas harf.
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok" }),
}));

jest.mock("../../lib/receipt-file", () => ({
  pickReceipt: (source: string) => mockPick(source),
  uploadReceipt: jest.fn(async () => ({ ok: true })),
  receiptEndpoint: (b: string, g: string, e: string) =>
    `${b}/api/v1/groups/${g}/expenses/${e}/receipt`,
}));

const ME = { user: { id: "u1" } };
const MEMBERS = { members: [{ userId: "u1", displayName: "Ben" }] };
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
  mockPick.mockResolvedValue({ kind: "picked", uri: "file:///fis.jpg" });
  mockPost.mockResolvedValue({ ok: true, data: { expense: { id: "e1" } } });
  mockReadBlocks.mockResolvedValue([]);
});

async function attachReceipt() {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await fireEvent.press(screen.getByText("Fiş ekle"));
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  await act(async () => {
    await buttons?.[1]?.onPress?.();
  });
}

/** Uc kalemli, toplami basili bir market fisi. */
function marketReceipt() {
  return mockReceiptLines([
    ["MARKET A.S."],
    ["EKMEK", "8,50"],
    ["PEYNIR", "120,40"],
    ["ZEYTIN", "237,78"],
    ["TOPLAM", "366,68"],
  ]);
}

describe("fisten cikan kalemler", () => {
  it("KALEMLERI LISTELIYOR", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());
    expect(screen.getByText("EKMEK")).toBeTruthy();
    expect(screen.getByText("PEYNIR")).toBeTruthy();
    expect(screen.getByText("ZEYTIN")).toBeTruthy();
    // TOPLAM bir kalem DEGIL.
    expect(screen.queryByText("TOPLAM")).toBeNull();
  });

  it("HICBIRI SECILI BASLAMIYOR", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());
    // Secili sayisi sifir oldugu icin dugme "Seçilen 0 kalemi al" diyor.
    expect(screen.getByText("Seçilen 0 kalemi al")).toBeTruthy();
  });

  it("SECILENLERIN TOPLAMI tutar oluyor - FISIN TOPLAMI DEGIL", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();
    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());

    // Ekmek ve peynir: 8,50 + 120,40 = 128,90. Fisin toplami 366,68.
    await fireEvent.press(screen.getByText("EKMEK"));
    await fireEvent.press(screen.getByText("PEYNIR"));
    await fireEvent.press(screen.getByText("Seçilen 2 kalemi al"));

    /**
     * Fisin toplamini birakip kalemleri de yazmak SUM(kalem) = tutar
     * degismezini kirardi (ADR-052) ve kayit sunucuda reddedilirdi.
     */
    await waitFor(() => expect(screen.getByTestId("amount").props.value).toBe("128,90"));
  });

  it("SECINCE bolusum KALEM KALEM'e geciyor ve kalemler forma giriyor", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();
    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());

    await fireEvent.press(screen.getByText("ZEYTIN"));
    await fireEvent.press(screen.getByText("Seçilen 1 kalemi al"));

    // Kalem editorundeki ad alani doldu.
    await waitFor(() => expect(screen.getByDisplayValue("ZEYTIN")).toBeTruthy());
  });

  it("FARKI SOYLUYOR - eksik okunan satir sessizce gecmiyor", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();
    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());

    await fireEvent.press(screen.getByText("EKMEK"));

    // Secilen 8,50; fisin toplami 366,68. Kullanici eksigi GORUYOR.
    await waitFor(() =>
      expect(screen.getByText("Seçtiklerin 8,50 ₺ · fişin toplamı 366,68 ₺")).toBeTruthy(),
    );
  });

  it("ESITSE fark satiri CIZILMIYOR", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();
    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());

    await fireEvent.press(screen.getByText("EKMEK"));
    await fireEvent.press(screen.getByText("PEYNIR"));
    await fireEvent.press(screen.getByText("ZEYTIN"));

    // 8,50 + 120,40 + 237,78 = 366,68 - fisin toplaminin tam kendisi.
    await waitFor(() => expect(screen.getByText("Seçilen 3 kalemi al")).toBeTruthy());
    expect(screen.queryByText(/fişin toplamı/)).toBeNull();
  });

  it("VAZGECILEBILIYOR - liste kapaniyor", async () => {
    mockReadBlocks.mockResolvedValue(marketReceipt());

    await render(<NewExpenseScreen />);
    await attachReceipt();
    await waitFor(() => expect(screen.getByText("FİŞTE 3 KALEM BULUNDU")).toBeTruthy());

    await fireEvent.press(screen.getByText("Kalemleri gösterme"));

    await waitFor(() => expect(screen.queryByText("FİŞTE 3 KALEM BULUNDU")).toBeNull());
  });
});
