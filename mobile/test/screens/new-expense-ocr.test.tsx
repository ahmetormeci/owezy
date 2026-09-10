import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";
import { mockExtractTextFromImage } from "../jest-setup";

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
  mockExtractTextFromImage.mockResolvedValue([]);
});

/**
 * Fis ekler. "Fis ekle" bir Alert aciyor (kamera / galeri / vazgec);
 * galeri secenegine basiyoruz - new-expense-receipt.test.tsx ile ayni yol.
 */
async function attachReceipt() {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await fireEvent.press(screen.getByText("Fiş ekle"));
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  /**
   * act() SART: Alert'in dugmesi senkron donuyor ama arkasinda fis secme
   * ve OCR okuma zinciri var; o zincirin setState'leri fireEvent
   * bittikten SONRA dusuyor ve act uyarisi uretiyor. Uyari bir urun
   * hatasi degil, ama gurultu ilerideki gercek bir uyariyi gizler.
   */
  await act(async () => {
    await buttons?.[1]?.onPress?.();
  });
}

describe("fisten tutar okuma", () => {
  it("alan BOSKEN fisteki toplami yaziyor", async () => {
    mockExtractTextFromImage.mockResolvedValue([
      "MARKET",
      "EKMEK 8,50",
      "TOPLAM 366,68",
    ]);

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(screen.getByTestId("amount").props.value).toBe("366,68"));
  });

  it("OKUNDUGUNU SOYLUYOR - sessizce doldurmuyor", async () => {
    mockExtractTextFromImage.mockResolvedValue(["TOPLAM 366,68"]);

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(screen.getByText("Fişteki toplamdan okundu")).toBeTruthy());
  });

  it("ZAYIF tahminde AYRI cumle kuruyor", async () => {
    // Etiket yok: yalnizca kuruslu en buyuk sayi secildi. Bunu guclu
    // tahmin gibi gostermek, kontrol etmeden kaydetmeye davet olurdu.
    mockExtractTextFromImage.mockResolvedValue(["EKMEK 8,50", "PEYNIR 120,40"]);

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() =>
      expect(screen.getByText("Fişten okundu — kontrol et")).toBeTruthy(),
    );
  });

  it("KULLANICININ YAZDIGINI EZMIYOR", async () => {
    /**
     * NEGATIF KONTROL VE BU DOSYANIN ASIL SEBEBI. Alan doluysa okuma
     * hic konusmuyor - kategori tahmininin (ADR-028) kuralinin aynisi.
     */
    mockExtractTextFromImage.mockResolvedValue(["TOPLAM 366,68"]);

    await render(<NewExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("amount"), "120");
    await attachReceipt();

    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(screen.getByTestId("amount").props.value).toBe("120");
    expect(screen.queryByText("Fişteki toplamdan okundu")).toBeNull();
  });

  it("hicbir sey bulunamazsa SESSIZ - hata gostermiyor", async () => {
    // OCR bir kolaylik. Okuyamamak bir ariza degil; hata gostermek
    // olmayan bir sorunu varmis gibi sunmak olurdu.
    mockExtractTextFromImage.mockResolvedValue(["MARKET", "TESEKKURLER"]);

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(screen.getByTestId("amount").props.value).toBe("");
    expect(screen.queryByText(/okundu/)).toBeNull();
  });

  it("OKUMA PATLARSA fis yine de ekleniyor", async () => {
    // Fisin kendisi OCR'dan bagimsiz bir ozellik; biri digerini
    // dusurmemeli.
    mockExtractTextFromImage.mockRejectedValue(new Error("vision failed"));

    await render(<NewExpenseScreen />);
    await attachReceipt();

    await waitFor(() => expect(screen.getByText("Harcama kaydedilince eklenecek.")).toBeTruthy());
  });
});
