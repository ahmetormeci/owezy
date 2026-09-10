import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";

/**
 * BU DOSYA NEYI KORUYOR: OCR MODULU HIC YOKKEN UYGULAMANIN AYAKTA KALMASINI.
 *
 * GERCEKTEN YASANDI (10 Eylul, simulatorde). expo-text-extractor NATIVE bir
 * modul ve requireNativeModule MODUL GOVDESI CALISIRKEN firliyor,
 * cagrildiginda degil. Ekran onu statik "import ... from" ile aliyordu; Expo
 * Go'da modul olmadigi icin expo-router rota agacini kurarken bu dosyayi
 * yukluyor, yukleme firlatiyor ve ekranda kirmizi bir "Cannot find native
 * module 'ExpoTextExtractor'" kaliyordu. Dusen sey OCR degil, UYGULAMANIN
 * TAMAMIYDI.
 *
 * NEDEN HICBIR TEST GORMEDI: jest-setup modulu TAKLIT ediyor, yani testlerde
 * modul HER ZAMAN vardi. EAS build'i de goremezdi - orada modul gercekten
 * bagli. Yalnizca "modul YOK" hali sinanmamisti ve kusur tam oradaydi.
 *
 * Bu yuzden buradaki taklit modulu bos birakmiyor, YUKLENIRKEN FIRLATIYOR -
 * gercek davranisin ta kendisi.
 */
jest.mock("expo-text-extractor", () => {
  throw new Error("Cannot find native module 'ExpoTextExtractor'");
});

const mockPost = jest.fn();
const mockPick = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
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
});

describe("OCR modulu yokken", () => {
  it("EKRAN ACILIYOR - modulun yuklenmesi ekrani dusurmuyor", async () => {
    await render(<NewExpenseScreen />);

    expect(screen.getByTestId("amount")).toBeTruthy();
  });

  it("FIS EKLENEBILIYOR - okuma sessizce atlaniyor, tutar bos kaliyor", async () => {
    await render(<NewExpenseScreen />);

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await fireEvent.press(screen.getByText("Fiş ekle"));
    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });

    // Fis eklendi ama tutar OKUNMADI - ve hicbir hata gosterilmedi.
    // OCR bir kolaylik; yoksa kullanici tutari elle yaziyor.
    expect(screen.getByTestId("amount").props.value).toBe("");
    expect(screen.queryByText("Fişteki toplamdan okundu")).toBeNull();
  });
});
