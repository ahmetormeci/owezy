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
 * modules/receipt-ocr NATIVE: Node'da yuklenemiyor - expo-secure-store ile
 * ayni sebep.
 *
 * ARTIK BLOK DONDURUYOR, duz metin degil (ADR-055): her parcanin KONUMU da
 * geliyor cunku bir fiste ad solda, tutar sagda duruyor ve Vision ikisini
 * ayri gozlem olarak veriyor. Testlerin de ayni sekli tasimasi sart -
 * yoksa sinanan sey uygulamanin gordugu veri olmazdi.
 *
 * TAKLIDIN VARSAYILANI BOS DIZI: "fiste okunacak bir sey bulunamadi".
 * Boylece fisle ilgili MEVCUT testler OCR'dan hic etkilenmiyor.
 *
 * Adi "mock" ile basliyor cunku jest.mock fabrikasi disaridaki
 * degiskenlere ancak bu on ekle erisebiliyor.
 */
type MockBlock = { text: string; x: number; y: number; width: number; height: number };

export const mockReadBlocks = jest.fn(async (_uri: string): Promise<MockBlock[]> => []);

jest.mock("../modules/receipt-ocr", () => ({
  __esModule: true,
  default: {
    isSupported: true,
    readBlocks: (uri: string) => mockReadBlocks(uri),
  },
}));

/**
 * Fis satirlarini test icinde kurmanin kisa yolu: her dizge BIR SATIR,
 * icindeki parcalar soldan saga.
 *
 * y degerleri USTTEN ALTA azaliyor cunku Vision'in orijini SOL ALTTA.
 * Yukseklikler sabit; gruplama kurali dikey ORTUSMEYE bakiyor ve satirlar
 * arasindaki mesafe yukseklikten buyuk oldugu surece dogru ayriliyor.
 */
export function mockReceiptLines(lines: string[][]): MockBlock[] {
  const blocks: MockBlock[] = [];
  lines.forEach((parts, row) => {
    parts.forEach((text, column) => {
      blocks.push({
        text,
        x: 0.1 + column * 0.25,
        y: 0.9 - row * 0.05,
        width: 0.2,
        height: 0.02,
      });
    });
  });
  return blocks;
}

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
