/**
 * Giristen sonra donulecek adresi GUVENLI hale getirir.
 *
 * NEDEN VAR: davet sayfasi girisi olmayan ziyaretciyi
 * /sign-in?redirect_url=/join/<token> adresine gonderiyor ve giris bitince
 * oraya donulmesi gerekiyor. Deger ADRES CUBUGUNDAN geliyor, yani saldirgan
 * onu istedigi gibi yazabilir.
 *
 * DOGRULANMADAN KULLANILSAYDI ACIK YONLENDIRME (open redirect) olurdu:
 *     /sign-in?redirect_url=https://sahte-owezy.net/giris
 * Kullanici GERCEK owezy.net'te giris yapar, sonra saldirganin sayfasina
 * dusurulur - ve oradaki sahte forma bilgilerini yazar. Kimlik avinin en
 * ikna edici bicimi budur, cunku zincirin ilk halkasi gercektir.
 *
 * KABUL EDILEN TEK SEY: kendi sitemizde kalan, tek "/" ile baslayan bir yol.
 *
 * REDDEDILENLER ve neden tek tek yaziliyor - hepsi bilinen kacis yollari:
 *   "//evil.com"    tarayici bunu PROTOKOL-BAGIMSIZ ADRES sayar, yani
 *                   https://evil.com'a gider. En sik atlanan durum.
 *   "/\\evil.com"   bazi tarayicilar ters bolu isaretini bolu gibi okur.
 *   "%2f%2fevil"    ayni sey, yuzde kodlamasiyla gizlenmis.
 *   "https://..."   acikca disari.
 *   "javascript:"   yonlendirme degil, kod calistirma.
 *
 * BOSSA ya da GECERSIZSE "/" donuyor: kullanici uygulamanin icine dusuyor.
 * Sessizce disari gitmektense, istenen sayfaya gidememek dogru davranis.
 */
const SAFE_PATH = /^\/(?!\/|\\|%2f|%5c)[\w\-.~+/@]*(?:\?[\w\-.~+/@=&%]*)?(?:#[\w\-.~+/@]*)?$/i;

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }
  return SAFE_PATH.test(value) ? value : "/";
}
