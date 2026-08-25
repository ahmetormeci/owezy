"use client";

import { useLocale, useTranslate } from "@/lib/i18n";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/locale";

// Iki dil oldugu icin tek dugme yetiyor: uzerinde HEDEF dil yaziyor.
// Ucuncu dil eklenirse burasi acilir listeye doner.
const NEXT_LOCALE: Record<Locale, Locale> = { tr: "en", en: "tr" };
const SHORT_LABEL_CODES: Record<Locale, string> = {
  tr: "ui.language_short_tr",
  en: "ui.language_short_en",
};
const SWITCH_LABEL_CODES: Record<Locale, string> = {
  tr: "ui.switch_to_tr",
  en: "ui.switch_to_en",
};

/**
 * Dil dugmesi.
 *
 * CEREZI ISTEMCI YAZIYOR. Next 16'da cerez yazmak yalnizca Server Function ya
 * da Route Handler icinde mumkun; Server Function "use server" demek ve bu
 * projede yasak. Bir /api/v1 ucu acmak da dogru degildi: oradaki uclar mobil
 * istemcinin de cagiracagi IS MANTIGI, dil tercihi ise temaya benzeyen bir
 * gosterim tercihi - bugun hicbir yere kaydedilmiyor. 11.4d'de User.locale
 * geldiginde o gercekten bir kayit olacak ve API ucu orada anlam kazanacak;
 * cerez o zaman da hizli yol ve "cikis yapmis kullanici" yolu olarak kalir.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslate();

  const target = NEXT_LOCALE[locale];

  function switchLanguage() {
    // Yerelde http, canlida https calisiyoruz. "secure" bayragini kosulsuz
    // yazarsak cerez yerelde hic olusmaz ve dugme sessizce ise yaramaz.
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    // samesite=lax: cerez baska sitelerden gelen isteklerde gonderilmiyor.
    // Bir sir tasimıyor ama gereksiz genis kapsam da vermiyoruz.
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;

    // Tercihi hesaba da yaz: baska bir cihazda cerez olmayacak.
    //
    // BEKLENMIYOR (await yok): gorunen isi cerez zaten yapti. Bunu beklemek
    // arayuzu bir ag istegi boyunca duraklatirdi. Hata da yutuluyor - cikis
    // yapmis kullanicida 401 gelmesi normal ve kullanicinin gordugu hicbir sey
    // bozulmuyor. Sessizce kaybolmasin diye konsola dusuyor.
    //
    // keepalive: hemen ardindan sayfa bosaltiliyor ve
    // normalde tarayici ucusta olan istegi iptal ederdi - tercih hesaba hic
    // yazilmazdi. keepalive istegin sayfa omrunu asmasina izin veriyor.
    // Istek kucuk (tek alanli JSON), keepalive'in 64 KB sinirinin cok altinda.
    void fetch("/api/v1/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: target }),
      keepalive: true,
    }).catch((error) => {
      console.warn("Dil tercihi hesaba yazilamadi", error);
    });

    // TAM YENILEME, HER YERDE.
    //
    // Clerk'in bilesenleri "localization" ayarini YALNIZCA mount olurken
    // okuyor. router.refresh() sunucu agacini yeni dilde getiriyor ama zaten
    // mount olmus Clerk arayuzu eski dilde kaliyor - kullanici yarisi Turkce
    // yarisi Ingilizce bir ekran goruyor.
    //
    // BU ONCE YALNIZCA HERKESE ACIK SAYFALARDA YAPILIYORDU ve buradaki yorum
    // "uygulama ici sayfalarda Clerk arayuzu yok" diyordu. O varsayim
    // (app)/layout.tsx'e <UserButton /> eklendigi gun sessizce gecersizlesti:
    // dili degistiren kullanici, CIKIS YAPMAYA calisirken profil menusunu
    // eski dilde goruyordu. Yani en cok "bu uygulama bozuk mu" diyecegi anda.
    //
    // BEDELI: istemci state'i siliniyor - yarim kalmis form, acik pencere,
    // acilmis aylar. Dil degistirmek nadir bir is; yarisi cevrilmemis bir
    // arayuz ise her seferinde yanlis.
    //
    // key={locale} ile ClerkProvider'i yeniden mount ettirmek DENENMEDI cunku
    // ayni state kaybini uretir, ustune Clerk'i bastan baslatir.
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={t(SWITCH_LABEL_CODES[target])}
      className="flex size-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {t(SHORT_LABEL_CODES[target])}
    </button>
  );
}
