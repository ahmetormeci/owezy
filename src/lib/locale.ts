// Dilin KENDISI: tip, cerez adi ve gelen degerin dogrulanmasi.
//
// NEDEN AYRI DOSYA: bu uc seyi hem sunucu (cerezi okuyan i18n-server.ts) hem
// istemci (cerezi yazan language-toggle.tsx) kullaniyor. Ikisinden birine
// koyamayiz:
//   - i18n-server.ts "server-only" - istemciden import edilirse derleme hatasi
//   - i18n.tsx "use client" - oradan import edilen degerler sunucuda cagrilamaz
// Ortada duran, iki tarafta da calisan notr bir modul gerekiyordu. Cerez adini
// iki yerde ayri ayri yazmak, sessizce birbirini kacirmanin en kisa yolu.

/**
 * Desteklenen diller. Dil DEGERININ nereden geldigi (cerez, hesap tercihi)
 * bicimlendirme fonksiyonlarinin isi degil - onlar saf: ayni girdi + ayni dil
 * her zaman ayni ciktiyi verir. Boylece test edilebilir kaliyorlar ve hem
 * sunucuda hem istemcide ayni sonucu uretiyorlar.
 */
export const SUPPORTED_LOCALES = ["tr", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export const LOCALE_COOKIE = "locale";

/** Cerez bir yil yasar: dil tercihi her oturumda yeniden sorulacak bir sey degil. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cerezden gelen ham degeri desteklenen bir dile cevirir.
 *
 * GUVENLIK: cerez kullanicinin kontrolunde. Tarayici konsolundan
 * `document.cookie = "locale=zz"` yazilabilir. Bu deger dogrudan
 * `Intl.NumberFormat`'a giderse RangeError firlar ve sunucuda render edilen
 * sayfa 500 verir - yani bir cerez duzenleyerek uygulamayi cokertmek mumkun
 * olurdu. Beyaz liste disindaki her sey varsayilana duser.
 */
export function normalizeLocale(value: string | null | undefined): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}
