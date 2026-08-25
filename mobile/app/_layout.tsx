import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { LocaleProvider } from "../lib/i18n";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/locale";
import { SessionProvider, useSession } from "../lib/auth";

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
 * koymak, bir sonraki ekranda yine unutulacak bir sey demekti (ADR-037).
 *
 * SLOT HER ZAMAN RENDER EDILIYOR, yonlendirme etkiyle yapiliyor: kok
 * yerlesim <Slot /> yerine baska bir sey donerse gezinme baglami hic
 * kurulmamis olur ve router.replace cagrilacak bir yer bulamaz.
 *
 * "loading" BEKLENIYOR: belirtec Keychain'den okunana kadar oturumun olup
 * olmadigini bilmiyoruz. Beklemeseydik girisli kullaniciyi da her aciliste
 * bir an icin giris ekranina atardik.
 */
function AuthGuard() {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    // Giris ekraninin KENDISI korumasiz olmali; yoksa kendine yonlendirir.
    const onSignIn = segments[0] === "sign-in";
    if (status === "signed-out" && !onSignIn) {
      router.replace("/sign-in");
    }
  }, [status, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  /**
   * ADRES ACILISTA KONTROL EDILIYOR, ilk istekte degil.
   *
   * lib/api.ts'teki apiBaseUrl() de bu kontrolu yapiyor ama orada firlatilan
   * hata send()'in try blogunun ICINDE kaliyor ve "Bağlantı yok" cumlesine
   * cevriliyor - yani eksik yapilandirma, ag arizasi gibi gorunurdu. Yanlis
   * teshise goturen bir mesaj, hic mesaj olmamasindan kotu.
   *
   * Onceden burada Clerk'in yayimlanabilir anahtari kontrol ediliyordu;
   * Clerk mobilde artik hic yok (Faz 25.5).
   */
  if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL tanimli degil. mobile/.env.local " +
        "dosyasini mobile/.env.local.example'a bakarak doldur.",
    );
  }

  return (
    <SessionProvider>
      {/* Sozluk web ile ORTAK (src/lib/messages.ts). Iki ayri sozluk zamanla
          ayrisirdi; ADR-020'nin "eksik ceviri = derleme hatasi" garantisi
          boylece mobilde de gecerli. */}
      <LocaleProvider locale={deviceLocale()}>
        <AuthGuard />
      </LocaleProvider>
    </SessionProvider>
  );
}
