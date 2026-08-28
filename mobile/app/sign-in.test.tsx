import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import SignInScreen from "./sign-in";
import { mockRouter } from "../test/jest-setup";
import type { PasswordSignInResult } from "../lib/auth";

/**
 * BU DOSYA NEYI KORUYOR: giris ekraninin ADIM SIRASINI.
 *
 * lib/auth.test.tsx bir kat asagisini - sunucuyla konusan durum makinesini -
 * zaten kapsiyor. Buradaki soru farkli: o katmanin verdigi cevaba EKRAN dogru
 * tepkiyi veriyor mu? Ikisi ayri ayri dogru olup birlikte yanlis olabilir ve
 * 27.4'te tam olarak bu oldu: auth katmani { twoFactor: true } donduruyordu,
 * ekran onu "basari" sayip kullaniciyi gruplar sayfasina gonderiyordu, o da
 * oturumsuz oldugu icin geri atiliyordu.
 *
 * Bu ekran bugune kadar YALNIZCA simulatorde, elle dogrulandi.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 * v13'te ikisi de senkrondu. Bu kirici degisiklik olculerek bulundu ve
 * belirtisi yaniltici: senkron kullanildiginda render bir Promise donuyor,
 * sorgular ise "render function has not been called" diyor - yani hata mesaji
 * sebebi GOSTERMIYOR. Yeni test yazarken ikisini de await et.
 */

const mockSendCode = jest.fn();
const mockSignInWithCode = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockVerifySecondFactor = jest.fn();
const mockForgetChallenge = jest.fn();

jest.mock("../lib/auth", () => ({
  useSession: () => ({
    status: "signed-out",
    getToken: async () => null,
    // ANAHTARLAR gercek adlarda, DEGERLER "mock" onekli: jest.mock()
    // fabrikasi disaridaki degiskenlere yalnizca bu on ekle erisebiliyor.
    sendCode: mockSendCode,
    signInWithCode: mockSignInWithCode,
    signInWithPassword: mockSignInWithPassword,
    verifySecondFactor: mockVerifySecondFactor,
    forgetChallenge: mockForgetChallenge,
    signOut: jest.fn(),
  }),
}));

const OK = { ok: true } as const;
const PASSWORD_OK: PasswordSignInResult = { ok: true, twoFactor: false };
const NEEDS_SECOND_FACTOR: PasswordSignInResult = { ok: true, twoFactor: true };

beforeEach(() => {
  mockSendCode.mockResolvedValue(OK);
  mockSignInWithCode.mockResolvedValue(OK);
  mockSignInWithPassword.mockResolvedValue(PASSWORD_OK);
  mockVerifySecondFactor.mockResolvedValue(OK);
});

async function typeEmail(value = "a@b.co") {
  await fireEvent.changeText(screen.getByPlaceholderText("ornek@owezy.net"), value);
}

/** Parola yoluna gecer, e-postayi ve parolayi doldurur. */
async function goToPassword(password = "parola") {
  await fireEvent.press(screen.getByText("Parolayla gir"));
  await typeEmail();
  // Parola alaninin GORUNUR bir etiketi yok ve RNTL 14'te UNSAFE_* sorgulari
  // kaldirildi; o yuzden ekranda testID tasiyor.
  await fireEvent.changeText(screen.getByTestId("password"), password);
}

/** Ikinci faktordeki metin alani - yedek kod adiminda placeholder'i yok. */
function codeField() {
  return screen.getByTestId("two-factor-code");
}

describe("baslangic", () => {
  it("e-posta adiminda acilir", async () => {
    await render(<SignInScreen />);

    expect(screen.getByText("E-posta")).toBeTruthy();
    expect(screen.getByText("Kod gönder")).toBeTruthy();
    // Parola IKINCIL: varsayilan akis kodla girmek ve oyle kalmali.
    expect(screen.queryByText("Parola")).toBeNull();
  });
});

describe("e-posta koduyla giris", () => {
  it("kod istendikten sonra kod adimina gecer", async () => {
    await render(<SignInScreen />);
    await typeEmail("a@b.co");

    await fireEvent.press(screen.getByText("Kod gönder"));

    await screen.findByText("Doğrulama kodu");
    expect(mockSendCode).toHaveBeenCalledWith("a@b.co");
    // Adres ekranda tekrar gosteriliyor: yanlis yazan kullanici, gelmeyecek
    // bir kodu beklemesin.
    expect(screen.getByText("a@b.co adresine gönderildi.")).toBeTruthy();
  });

  it("kod isteme BASARISIZSA adimda kalir", async () => {
    mockSendCode.mockResolvedValue({ ok: false, code: "server.offline" });
    await render(<SignInScreen />);
    await typeEmail();

    await fireEvent.press(screen.getByText("Kod gönder"));

    // Kod adimina GECMEMELI - gecerse kullanici hic gelmeyecek bir kodu bekler.
    await waitFor(() => expect(mockSendCode).toHaveBeenCalled());
    expect(screen.queryByText("Doğrulama kodu")).toBeNull();
    expect(screen.getByText("E-posta")).toBeTruthy();
  });

  it("dogru kod ana sayfaya yonlendirir", async () => {
    await render(<SignInScreen />);
    await typeEmail();
    await fireEvent.press(screen.getByText("Kod gönder"));
    await screen.findByText("Doğrulama kodu");

    await fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");
    await fireEvent.press(screen.getByText("Giriş yap"));

    // replace, push DEGIL: giris ekrani gecmise yazilmamali, yoksa geri tusu
    // girisli kullaniciyi forma dondururdu.
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
  });
});

describe("parolayla giris", () => {
  it("ikincil bir baglantinin arkasinda", async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByText("Parolayla gir"));

    await screen.findByText("Parola");
    // Dugmenin yazisi da degismeli, yoksa kullanici hala kod istedigini sanir.
    expect(screen.getByText("Giriş yap")).toBeTruthy();
    expect(screen.queryByText("Kod gönder")).toBeNull();
  });

  it("2FA KAPALIYSA dogrudan ana sayfaya gider", async () => {
    await render(<SignInScreen />);
    await goToPassword();

    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
    expect(mockSignInWithPassword).toHaveBeenCalledWith("a@b.co", "parola");
  });

  it("2FA ACIKSA ana sayfaya GITMEZ, ikinci adimi gosterir", async () => {
    /**
     * 27.4'TE YASANAN HATANIN TESTI, ama bir kat yukarida.
     *
     * "ok" tek basina "iceri girdik" demiyor. Ekran bunu ayirt etmezse
     * kullaniciyi OTURUMSUZ halde gruplar sayfasina gonderir.
     */
    mockSignInWithPassword.mockResolvedValue(NEEDS_SECOND_FACTOR);
    await render(<SignInScreen />);
    await goToPassword();

    await fireEvent.press(screen.getByText("Giriş yap"));

    await screen.findByText("İki adımlı doğrulama");
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("parola yanlissa adimda kalir", async () => {
    mockSignInWithPassword.mockResolvedValue({ ok: false, code: "auth.invalid_credentials" });
    await render(<SignInScreen />);
    await goToPassword("yanlis");

    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Parola")).toBeTruthy();
  });
});

describe("ikinci faktor adimi", () => {
  async function atSecondFactor() {
    mockSignInWithPassword.mockResolvedValue(NEEDS_SECOND_FACTOR);
    await render(<SignInScreen />);
    await goToPassword();
    await fireEvent.press(screen.getByText("Giriş yap"));
    await screen.findByText("İki adımlı doğrulama");
  }

  it("uygulama kodunu gonderir", async () => {
    await atSecondFactor();

    await fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");
    await fireEvent.press(screen.getByText("Giriş yap"));

    // Ikinci parametre: yedek kod DEGIL.
    await waitFor(() => expect(mockVerifySecondFactor).toHaveBeenCalledWith("123456", false));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("yedek kod adimina gecebiliyor", async () => {
    await atSecondFactor();

    await fireEvent.press(screen.getByText("Yedek kod kullan"));

    await screen.findByText("Yedek kod");
    // Yedek kodlar rakam degil; sayi klavyesinin yer tutucusu da kalkmali.
    expect(screen.queryByPlaceholderText("000000")).toBeNull();
  });

  it("yedek kod AYRI parametreyle gonderiliyor", async () => {
    await atSecondFactor();
    await fireEvent.press(screen.getByText("Yedek kod kullan"));
    await screen.findByText("Yedek kod");

    await fireEvent.changeText(codeField(), "YEDEK-1");
    await fireEvent.press(screen.getByText("Giriş yap"));

    await waitFor(() => expect(mockVerifySecondFactor).toHaveBeenCalledWith("YEDEK-1", true));
  });

  it("adimlar arasinda GIRILEN KOD temizleniyor", async () => {
    // Yanlis alana yazilmis bir kodun oteki adimda durmasi, kullaniciyi
    // "dogru yazdim ama kabul etmiyor" noktasina goturur.
    await atSecondFactor();
    await fireEvent.changeText(screen.getByPlaceholderText("000000"), "123456");

    await fireEvent.press(screen.getByText("Yedek kod kullan"));

    await screen.findByText("Yedek kod");
    expect((codeField().props as { value: string }).value).toBe("");
  });

  it("CIKIS KAPISI var ve meydan okumayi da atiyor", async () => {
    /**
     * Telefonu da yedek kodlari da yaninda olmayan biri bu ekranda mahsur
     * kalmamali. Geri donerken bellekteki cerez de birakilmali; kalirsa
     * sonraki denemede tukenmis bir meydan okumayla ugrasilir.
     */
    await atSecondFactor();

    await fireEvent.press(screen.getByText("E-postayı değiştir"));

    await screen.findByText("Kod gönder");
    expect(mockForgetChallenge).toHaveBeenCalled();
  });
});

describe("parola kurtarma", () => {
  it("WEB'E yonlendiriyor - mobilde ekran yok", async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText("Parolayla gir"));
    await screen.findByText("Parola");

    const forgot = screen.queryByText("Parolamı unuttum");
    if (!forgot) return; // baglanti yoksa test edilecek bir sey de yok
    await fireEvent.press(forgot);

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
    // Kendi alan adimiza gitmeli, disariya degil (ADR-040 kapsam karari).
    const url = String((Linking.openURL as jest.Mock).mock.calls[0][0]);
    expect(url).toContain("/reset-password");
  });
});
