import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
} from "@expo-google-fonts/familjen-grotesk";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { useFonts } from "expo-font";
import { Platform } from "react-native";

/**
 * Uygulamanin yazi tipleri (kagit & petrol yonu).
 *
 * BU DOSYA NEDEN VAR - React Native'de fontWeight AILELER ARASINDA GECIS
 * YAPMIYOR. Web'de "Familjen Grotesk" tek bir aile ve font-weight: 600
 * dogru yuzu seciyor. Burada her agirlik AYRI BIR AILE olarak yukleniyor
 * ("FamiljenGrotesk_600SemiBold"), yani:
 *
 *     fontFamily: fonts.body, fontWeight: "600"   -> YANLIS.
 *         iOS 400'luk yuzu YAPAY kalinlastirir, Android cogu zaman hic
 *         bir sey yapmaz. Ikisi de tasarimdaki yuz DEGIL.
 *     fontFamily: fonts.semibold                   -> DOGRU.
 *
 * Bu yuzden ekranlarda fontWeight KULLANILMIYOR; agirligi aile adi tasiyor.
 *
 * ITALIK YUKLENMIYOR: tasarimda italik yalnizca web tanitim sayfasinin
 * basliginda var. Yuklemek iki dosya daha demekti, karsiligi yok.
 */
export const fonts = {
  /** Govde metni. Familjen Grotesk 400. */
  body: "FamiljenGrotesk_400Regular",
  /** Vurgulu govde, kucuk etiketler. 500. */
  medium: "FamiljenGrotesk_500Medium",
  /** Tutarlar ve satir basliklari. 600. */
  semibold: "FamiljenGrotesk_600SemiBold",
  /** Basliklar. Instrument Serif - TEK agirlikta (400) geliyor. */
  heading: "InstrumentSerif_400Regular",
  /**
   * Teknik gosterim: davet baglantisi gibi. Sistem monosu, yuklenen bir
   * aile degil - web'de de --font-mono ayni sebeple duruyor.
   */
  mono: Platform.OS === "ios" ? "Menlo" : "monospace",
} as const;

/**
 * TUTARLARIN HIZALANMASI. Web'de .money bunu font-feature-settings 'tnum'
 * ile yapiyor; React Native'in karsiligi bu.
 *
 * Bir stil nesnesi olarak duruyor cunku tutar gosteren her yerde ayni ucu
 * birlikte gerekiyor: aile, tabular rakam ve satirin bolunmemesi.
 */
export const moneyText = {
  fontFamily: fonts.semibold,
  fontVariant: ["tabular-nums"],
  letterSpacing: -0.2,
} as const;

/**
 * Yazi tiplerini yukler.
 *
 * DONEN DEGER BEKLENMELI: yuklenmeden cizilen metin sistem fontuyla cikar
 * ve fontlar gelince yerinden ziplar. Acilista bir kare yanlis yazi tipi,
 * bir kare bos ekrandan daha kotu gorunuyor.
 *
 * HATA DURUMUNDA DA DEVAM EDILIYOR: useFonts ikinci deger olarak hatayi
 * veriyor ve orada takilip kalmak, yazi tipi yuklenemedi diye uygulamayi
 * hic actirmamak olurdu. Sistem fontuyla acilmasi dogru davranis.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    FamiljenGrotesk_400Regular,
    FamiljenGrotesk_500Medium,
    FamiljenGrotesk_600SemiBold,
    InstrumentSerif_400Regular,
  });
  return loaded || error !== null;
}
