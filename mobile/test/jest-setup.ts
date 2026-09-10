import { Linking } from "react-native";

/**
 * Ekran testlerinin ortak kurulumu.
 *
 * Buradaki her taklit, GERCEK BIR ENGELIN karsiligi: ilgili modul ya native
 * bir baglanti istiyor ya da testin kontrol etmesi gereken bir dis dunya
 * cagrisi yapiyor. "Her ihtimale karsi" taklit YOK - eklenen her satirin
 * sebebi yaninda yazili.
 */

// expo-secure-store NATIVE: Node'da yuklenemiyor. Bellekteki ikizi zaten
// vitest tarafi icin yazilmisti, ayni dosya burada da kullaniliyor.
jest.mock("expo-secure-store", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./expo-secure-store.mock"),
);

/**
 * expo-text-extractor NATIVE: Node'da yuklenemiyor ("Cannot find native
 * module 'ExpoTextExtractor'") - expo-secure-store ile ayni sebep.
 *
 * TAKLIDIN VARSAYILANI BOS DIZI: yani "fiste okunacak bir sey bulunamadi".
 * Boylece fisle ilgili MEVCUT testler OCR'dan hic etkilenmiyor; okumayi
 * sinamak isteyen test mockExtractTextFromImage'i kendisi dolduruyor.
 *
 * Adi "mock" ile basliyor cunku jest.mock fabrikasi disaridaki
 * degiskenlere ancak bu on ekle erisebiliyor.
 */
export const mockExtractTextFromImage = jest.fn(async (_uri: string): Promise<string[]> => []);

jest.mock("expo-text-extractor", () => ({
  isSupported: true,
  extractTextFromImage: (uri: string) => mockExtractTextFromImage(uri),
}));

/**
 * expo-router'in yonlendirmesi. Testler "hangi adrese gidildi" sorusunu
 * sormak istiyor; gercek router bir navigasyon agaci kurmayi bekliyor ve o
 * agac bu testlerin konusu degil.
 */
// ADI "mock" ILE BASLAMAK ZORUNDA: jest.mock() fabrikasi disaridaki
// degiskenlere erisemiyor ("not allowed to reference any out-of-scope
// variables") ve tek istisnasi bu on ek. Kural, henuz kurulmamis bir taklide
// erisilmesini engellemek icin var.
export const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  Redirect: () => null,
  Link: () => null,
}));

/**
 * Linking.openURL - parola kurtarma mobilde YOK, kullaniciyi web'e
 * gonderiyoruz (ADR-040 kapsam karari). Testin bunu dogrulayabilmesi icin
 * cagrinin yakalanabilir olmasi gerekiyor.
 *
 * jest.mock("react-native/Libraries/Linking/Linking") DENENDI VE TUTMADI:
 * ekranlar Linking'i "react-native" kokunden aliyor ve o dis aktarim derin
 * yolun taklidini gormedi - cagri "Cannot read properties of undefined" ile
 * dustu. spyOn dogrudan kullanilan nesneyi degistiriyor, o yuzden calisiyor.
 */
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});
