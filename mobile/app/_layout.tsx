import { ClerkProvider, useAuth } from "@clerk/expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
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

/**
 * Girisi olmayani giris ekranina gonderir.
 *
 * NEDEN BURADA, EKRANLARIN ICINDE DEGIL: bu koruma yalnizca app/index.tsx'te
 * ("/") vardi. Diger ekranlarin hicbirinde YOKTU - /groups, /groups/[id],
 * /members, /settlements, /expenses/[id]. Sonucu su oluyordu: kullanici
 * "Cikis yap"a basiyor, oturum kapaniyor, ama ekran oldugu yerde kaliyor -
 * yani dugme calismiyor gibi gorunuyor. Her ekrana ayri ayri Redirect
 * koymak, bir sonraki ekranda yine unutulacak bir sey demekti.
 *
 * SLOT HER ZAMAN RENDER EDILIYOR, yonlendirme etkiyle yapiliyor: kok
 * yerlesim <Slot /> yerine baska bir sey donerse gezinme baglami hic
 * kurulmamis olur ve router.replace cagrilacak bir yer bulamaz.
 *
 * isLoaded BEKLENIYOR: Clerk yuklenmeden isSignedIn false gorunuyor, yani
 * beklemeden yonlendirseydik girisli kullaniciyi da her aciliste bir an
 * icin giris ekranina atardik.
 */
function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    // Giris ekraninin KENDISI korumasiz olmali; yoksa kendine yonlendirir.
    const onSignIn = segments[0] === "sign-in";
    if (!isSignedIn && !onSignIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return <Slot />;
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
        <AuthGuard />
      </LocaleProvider>
    </ClerkProvider>
  );
}
