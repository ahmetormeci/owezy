import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";

/**
 * BU DOSYA NEYI KORUYOR: harcamanin IKI KEZ yaratilmamasini.
 *
 * Fis, harcama kaydedildikten SONRA yukleniyor - baska turlusu mumkun degil,
 * fotografin baglanacagi kimlik o ana kadar yok. Bu, kismi basarisizligi
 * mumkun kiliyor: harcama kaydedildi, fis yuklenemedi.
 *
 * O anda kullanicinin gozunde islem TAMAMLANMADI ve dogal tepki "Kaydet"e
 * tekrar basmak. Ekran harcamanin kimligini tutmasaydi ikinci bir harcama
 * yaratilirdi - ve bu, bu projede en agir hata sinifi: BAKIYELER YANLIS
 * OLUR. Para tam sayi tutulur, silme yumusak yapilir, denetim kaydi
 * tutulur... hepsi bunun icin.
 */

const mockPost = jest.fn();
const mockUpload = jest.fn();
const mockPick = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useSession: () => ({ getToken: async () => "tok" }),
}));

jest.mock("../../lib/receipt-file", () => ({
  pickReceipt: (source: string) => mockPick(source),
  uploadReceipt: (...args: unknown[]) => mockUpload(...args),
  receiptEndpoint: (base: string, groupId: string, expenseId: string) =>
    `${base}/api/v1/groups/${groupId}/expenses/${expenseId}/receipt`,
}));

const ME = { user: { id: "u1" } };
const MEMBERS = { members: [{ userId: "u1", displayName: "Ben" }] };
const GROUP = { group: { id: "g1", name: "Ev", currency: "TRY" } };

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({ post: mockPost, get: jest.fn(), put: jest.fn(), patch: jest.fn(), remove: jest.fn() }),
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
  mockPick.mockResolvedValue({ kind: "picked", uri: "file:///fis.jpg" });
  mockUpload.mockResolvedValue({ ok: true });
});

/**
 * Kaydetmek icin gereken en az alan.
 *
 * ONCEDEN BIR "next" ADIMI DA VARDI: ekran iki adimliydi ve bolusme ikinci
 * adimdaydi. Adim kaldirildi (kagit & petrol yonu) - bagimlilik hala duruyor
 * ama onu adim SINIRI degil alanlarin SIRASI sagliyor: tutar formun ilk
 * alani.
 */
async function fillForm() {
  await fireEvent.changeText(screen.getByTestId("description"), "Market");
  await fireEvent.changeText(screen.getByTestId("amount"), "120,50");
}

/**
 * Fis secer VE SECIMIN OTURMASINI BEKLER.
 *
 * Beklemek sart: secim asenkron ve beklenmeden "Kaydet"e basilirsa ekranda
 * henuz fis YOKTUR - test, kismi basarisizligi sinadigini sanirken aslinda
 * fissiz kaydi sinar ve sessizce yanlis seyi dogrular.
 */
async function attachReceipt() {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  // Bos durum artik BUYUK HARF DEGIL: kesikli karenin yanindaki duz
  // etiket ("Fiş ekle"). Eskiden <Cap> ile buyuk harfe ceviriliyordu.
  await fireEvent.press(screen.getByText("Fiş ekle"));
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  buttons?.[1]?.onPress?.();
  await waitFor(() => expect(screen.getByText(/Harcama kaydedilince eklenecek/)).toBeTruthy());
}

it("fis SECILMEDIYSE yalnizca harcama gonderiliyor", async () => {
  await render(<NewExpenseScreen />);
  await fillForm();
  await fireEvent.press(screen.getByTestId("save"));

  await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
  expect(mockUpload).not.toHaveBeenCalled();
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
});

it("fis secildiyse harcamadan SONRA ve DOGRU kimlikle yukleniyor", async () => {
  await render(<NewExpenseScreen />);
  await fillForm();
  await attachReceipt();

  await fireEvent.press(screen.getByTestId("save"));

  await waitFor(() => expect(mockUpload).toHaveBeenCalled());
  // Kimlik SUNUCUNUN dondurdugu olmali; istemcide uretilemez.
  expect(mockUpload.mock.calls[0][1]).toContain("/expenses/e-yeni/receipt");
});

describe("KISMI BASARISIZLIK - harcama kaydedildi, fis yuklenemedi", () => {
  beforeEach(() => {
    mockUpload.mockResolvedValue({ ok: false, code: "receipt.too_large" });
  });

  it("EKRANDA KALIYOR ve harcamanin kaydedildigini SOYLUYOR", async () => {
    await render(<NewExpenseScreen />);
    await fillForm();
    await attachReceipt();
    await fireEvent.press(screen.getByTestId("save"));

    // "Fis eklenemedi" tek basina yaniltici olurdu: kullanici hicbir seyin
    // olmadigini sanip harcamayi bastan girerdi.
    await waitFor(() =>
      expect(screen.getByText(/Harcama kaydedildi ama fiş eklenemedi/)).toBeTruthy(),
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("TEKRAR BASILINCA IKINCI HARCAMA YARATILMIYOR", async () => {
    // ASIL TEST BU. Cift kayit bakiyeleri bozar - bu projedeki en agir hata
    // sinifi.
    await render(<NewExpenseScreen />);
    await fillForm();
    await attachReceipt();

    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("ikinci denemede fis GECERSE geri donuluyor", async () => {
    await render(<NewExpenseScreen />);
    await fillForm();
    await attachReceipt();
    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());

    mockUpload.mockResolvedValue({ ok: true });
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
