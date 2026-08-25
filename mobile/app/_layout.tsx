import { ClerkProvider } from "@clerk/expo";
import { Slot } from "expo-router";
import { LocaleProvider } from "../lib/i18n";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/locale";
import { tokenCache } from "../lib/token-cache";

// Yayimlanabilir anahtar gizli degil (web'de de tarayiciya gidiyor), ama yine
// de dosyaya gomulmuyor: gelistirme "pk_test_", yayin "pk_live_" kullanacak
// ve ikisini kod degistirmeden ayirabilmek gerekiyor.
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Cihazin dili.
 *
 * Intl'i kullanabiliyoruz cunku Hermes'in Intl destegi 18.2'de OLCULDU -
 * formatMoney ciktisi web'in birim testleriyle birebir cikti. Ayri bir
 * paket (expo-localization) eklemeye gerek yok.
 *
 * split("-") SART: cihaz "en-US" donduruyor, normalizeLocale ise tam eslesme
 * ariyor ve "en-US" beyaz listede olmadigi icin varsayilana (tr) duserdi -
 * yani Ingilizce cihazda Turkce arayuz. Beyaz listeyi gevsetmek yerine
 * bolgeyi burada ayiriyoruz; o liste web'de cerezden gelen degeri de
 * koruyor ve gevsetilmemeli.
 */
function deviceLocale() {
  try {
    return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0]);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export default function RootLayout() {
  if (!publishableKey) {
    // Sessizce devam etmek daha kotu olurdu: Clerk anahtarsiz da yukleniyor
    // ama her giris denemesi anlamsiz bir hatayla dusuyor.
    throw new Error(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY tanimli degil. mobile/.env.local " +
        "dosyasini mobile/.env.local.example'a bakarak doldur.",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      {/* Sozluk web ile ORTAK (src/lib/messages.ts). Iki ayri sozluk zamanla
          ayrisirdi; ADR-020'nin "eksik ceviri = derleme hatasi" garantisi
          boylece mobilde de gecerli. */}
      <LocaleProvider locale={deviceLocale()}>
        <Slot />
      </LocaleProvider>
    </ClerkProvider>
  );
}
