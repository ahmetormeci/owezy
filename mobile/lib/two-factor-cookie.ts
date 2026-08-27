/**
 * Iki adimli dogrulamanin meydan okuma cerezini Set-Cookie basligindan cikarir.
 *
 * ONCEDEN lib/auth.tsx'in ICINDEYDI ve disa acik degildi. Buraya tasindi
 * cunku yaptigi is tek basina durmayi hak ediyor: gercek bir sunucu yanitiyla
 * olculmus bir ayristirma ve yanlis yapilmasinin belirtisi sessiz - kullanici
 * "kod ekranina dustum ama kodum hicbir zaman kabul edilmiyor" der, sebebi
 * hicbir yerde yazmaz.
 *
 * MEYDAN OKUMA CEREZININ ADI sunucudan gercek bir yanitla olculdu; yanit UC
 * Set-Cookie satiri tasiyor (ikisi oturum cerezlerini SILEN bos satirlar,
 * biri bu). Yani "gelen Set-Cookie'yi oldugu gibi geri gonder" YANLIS olurdu:
 * silme satirlarini da geri gondermis olurduk.
 */
export const TWO_FACTOR_COOKIE = "better-auth.two_factor";

/**
 * React Native, birden fazla Set-Cookie satirini TEK bir baslikta ", " ile
 * birlestirerek veriyor. O yuzden ada gore ariyoruz ve degeri ilk ";" ye
 * kadar aliyoruz - degerin kendisi imzali, icinde nokta ve yuzde isareti
 * olabiliyor, ama ";" olamiyor.
 *
 * Donen deger "ad=deger" ciftinin TAMAMI, cunku dogrudan bir Cookie basligina
 * konuyor.
 */
export function readChallengeCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const start = setCookie.indexOf(`${TWO_FACTOR_COOKIE}=`);
  if (start === -1) return null;
  const end = setCookie.indexOf(";", start);
  const pair = end === -1 ? setCookie.slice(start) : setCookie.slice(start, end);
  // Max-Age=0 ile gelen bir SILME satirini meydan okuma sanmayalim.
  return pair === `${TWO_FACTOR_COOKIE}=` ? null : pair;
}
