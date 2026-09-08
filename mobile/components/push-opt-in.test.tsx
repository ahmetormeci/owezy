import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PushOptIn } from "./push-opt-in";

/**
 * BU DOSYA NEYI KORUYOR: izin isteminin NE ZAMAN cizildigini.
 *
 * iOS izin istemini uygulama omrunde BIR KEZ veriyor. Yanlis durumda dugme
 * cizmek geri alinamaz bir hata: reddedilmis birine tekrar dugme gostermek,
 * basildiginda HICBIR SEY OLMAYAN bir dugme demek - kullanici bildirimlerin
 * neden gelmedigini anlamadan uygulamayi birakir.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON
 * (ayrintisi test/screens/sign-in.test.tsx'te).
 */

const mockPushState = jest.fn();
const mockEnablePush = jest.fn();

jest.mock("../lib/push", () => ({
  pushState: () => mockPushState(),
  enablePush: (token: string | null) => mockEnablePush(token),
}));

jest.mock("../lib/auth", () => ({
  useSession: () => ({ getToken: async () => "tok" }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEnablePush.mockResolvedValue("granted");
});

const ASK = "BİLDİRİMLERİ TELEFONA GETİR";

it("izin HENUZ SORULMAMISSA dugme ve ne gonderildigi yaziyor", async () => {
  mockPushState.mockResolvedValue("undetermined");
  await render(<PushOptIn />);

  await waitFor(() => expect(screen.getByText(ASK)).toBeTruthy());
  // ASIL IDDIA: kullanici bir PARA uygulamasina bildirim izni veriyor ve
  // kilit ekraninda tutar cikip cikmayacagini IZIN VERMEDEN once bilmeli.
  expect(screen.getByText(/Tutarlar ve kişi adları bildirimde yazmaz/)).toBeTruthy();
});

it("SIMULATORDE hicbir sey cizilmiyor", async () => {
  // Gercek bir adres yalnizca fiziksel cihazda uretilebiliyor; burada dugme
  // gostermek calismayacak bir sey sunmak olurdu.
  mockPushState.mockResolvedValue("unsupported");
  await render(<PushOptIn />);
  await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
});

it("IZIN VERILMISSE dugme YOK, yalnizca durum yaziyor", async () => {
  mockPushState.mockResolvedValue("granted");
  await render(<PushOptIn />);

  await waitFor(() => expect(screen.getByText("BU TELEFONA BİLDİRİM GELİYOR")).toBeTruthy());
  expect(screen.queryByText(ASK)).toBeNull();
});

it("REDDEDILMISSE dugme YOK - basilsa hicbir sey olmazdi", async () => {
  mockPushState.mockResolvedValue("denied");
  await render(<PushOptIn />);

  await waitFor(() => expect(screen.getByText(/Ayarlar/)).toBeTruthy());
  expect(screen.queryByText(ASK)).toBeNull();
});

it("durum okunana kadar hicbir sey cizilmiyor", async () => {
  // Once "kapali" cizip sonra "acik"a donmek, ekran acilisinda goze carpan
  // bir zipllama olurdu.
  mockPushState.mockReturnValue(new Promise(() => {}));
  await render(<PushOptIn />);
  expect(screen.queryByText(ASK)).toBeNull();
});

it("dugmeye basilinca izin isteniyor ve durum GUNCELLENIYOR", async () => {
  mockPushState.mockResolvedValue("undetermined");
  await render(<PushOptIn />);
  await waitFor(() => expect(screen.getByText(ASK)).toBeTruthy());

  await fireEvent.press(screen.getByText(ASK));

  await waitFor(() => expect(mockEnablePush).toHaveBeenCalledWith("tok"));
  // Durum yenilenmezse kullanici izni verdigi halde dugmeyi gormeye devam
  // eder ve "olmadi mi?" diye tekrar basar.
  await waitFor(() => expect(screen.getByText("BU TELEFONA BİLDİRİM GELİYOR")).toBeTruthy());
});
