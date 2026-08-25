import "server-only";

// Sunucu tarafinin metne erisim kapisi. Karsiligi istemcide useTranslate().
//
// Ayri dosyada olmasinin sebebi "server-only" paketi: bu modul yanlislikla
// bir Client Component'tan import edilirse derleme HATA veriyor. Aksi halde
// cerez okuyan kod istemci paketine sizabilir ve orada sessizce calismaz.

import { cookies } from "next/headers";
import { translate, type MessageParams } from "@/lib/messages";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/locale";
import { findCurrentUser } from "@/lib/auth";
import type { Translator } from "@/lib/i18n";

/**
 * Istegin dili. Sira: CEREZ -> HESAP TERCIHI -> varsayilan.
 *
 * Neden cerez once: cerez "bu cihazda, su an" cevabidir. Kullanici bir
 * cihazda dili degistirdiginde o cihaz oyle kalmali; hesap tercihi ONCE
 * gelseydi cerezin hicbir anlami olmazdi. Hesap, cerezi olmayan YENI bir
 * cihaz icin yedek.
 *
 * URL'de dil segmenti yok (ADR-017): cerez, sunucunun da istemcinin de ayni
 * degeri gorebilecegi tek yer. localStorage sunucuya ulasmaz, Accept-Language
 * ise kullanicinin SECIMI degil tarayici ayaridir.
 *
 * MALIYET: hesap sorgusu yalnizca cerez YOKKEN yapiliyor, ve findCurrentUser
 * cache()'li - ayni istekte (app) layout da ayni satiri istedigi icin net ek
 * sorgu sayisi sifir. Cikis yapmis ziyaretcide auth() bos donuyor, sorgu hic
 * calismiyor.
 *
 * KAYIT OLUSTURMAZ. Burada findCurrentUser() cagrilamaz: o fonksiyon
 * yan etkili ve karsilama sayfasinin render'i kullanici satiri uretirdi.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie) {
    return normalizeLocale(fromCookie);
  }

  const user = await findCurrentUser();
  // Hesaptaki deger de dogrulamadan geciyor: kolon String ve veritabanina
  // elle yazilmis bir deger olabilir.
  return normalizeLocale(user?.locale);
}

export async function getTranslate(): Promise<Translator> {
  const locale = await getLocale();
  return (code, params?: MessageParams) => translate(code, params, locale);
}
