/**
 * MAGAZADAKI 1.0 ICIN GECICI KOPRU. 1.0.1 yayilinca SILINECEK.
 *
 * NE OLDU: Better Auth cerez adlarina https'te "__Secure-" onegi ekliyor
 * (cookies/index.mjs:23 - useSecureCookies verilmemisse baseURL https ise ya
 * da NODE_ENV production ise). Yani ayni cerezin adi:
 *     gelistirme  http://localhost:3000  ->  better-auth.two_factor
 *     production  https://owezy.net      ->  __Secure-better-auth.two_factor
 *
 * Mobil 1.0 cerezi ADINI ARAYARAK cikariyor ve arama TAM ESLESME DEGIL,
 * metin aramasi: "better-auth.two_factor=" dizisi onekli adin ICINDE de
 * geciyor (9. karakterden itibaren). Arama "buluyor" ama dokuz karakter gec
 * basliyor ve "__Secure-" geride kaliyor. Uygulama cerezi var olmayan bir
 * adla geri gonderiyor, sunucu bulamiyor ve INVALID_TWO_FACTOR_COOKIE
 * donuyor - kullanicinin gordugu cumle "Dogrulama suresi doldu".
 *
 * SONUCU AGIR: 2FA acik bir hesap e-posta koduyla da giremiyor (bunu
 * better-auth.ts'deki kanca bilerek engelliyor, yoksa ikinci faktor hic
 * sorulmazdi). Yani o kullanici icin parola -> 2FA TEK yol ve o yol kirik.
 *
 * NEDEN SUNUCUDA CEVRILIYOR: mobil duzeltmesi dogru olan ama expo-updates
 * kurulu degil, yani yeni build + App Review demek. Magazadaki kopya o sure
 * boyunca kirik kalirdi.
 *
 * GUVENLIGI ZAYIFLATMIYOR: deger HMAC ile imzali ve sunucu imzayi yine
 * dogruluyor (better-call/context.mjs getSignedCookie). Burada yapilan tek
 * sey, ISTEMCININ ZATEN GONDERDIGI degeri sunucunun aradigi ada da
 * yazmak - bir dogrulama atlanmiyor.
 *
 * ODUNU DE YAZILI OLSUN: "__Secure-" onegi tarayicilar icin bir garanti
 * tasiyor (yalnizca https'ten kurulur ve yalnizca https'e gonderilir).
 * Onekli adi oneksiz bir cerezden turetmek o garantiyi BU UCTA gevsetiyor.
 * Kopru bu yuzden yalnizca iki dogrulama yoluna baglandi (route.ts) ve
 * kalici degil.
 */

/** Better Auth'un onegi - cookies/cookie-utils.mjs:10 */
const SECURE_PREFIX = "__Secure-";

/**
 * Cerezi ADIYLA TAM ESLESEREK okur.
 *
 * Buradaki "===" bir ayrinti degil, duzeltmeye calistigimiz hatanin ta
 * kendisi: indexOf ile aramak "better-auth.two_factor" adini
 * "__Secure-better-auth.two_factor" icinde de bulur ve iki AYRI cerezi ayni
 * sanar. Ad, ilk "=" isaretine kadar olan kisimdir ve butunuyle
 * karsilastirilmalidir.
 */
function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Sunucunun BEKLEDIGI ad verilir; gerekiyorsa koprulenmis bir Cookie basligi
 * doner, gerekmiyorsa null.
 *
 * TEK GIRDI OLARAK BEKLENEN AD ALINIYOR: eski adi ondan turetiyoruz. Boylece
 * "hangi ortamdayiz" sorusunu burada YENIDEN CEVAPLAMIYORUZ - cevabi zaten
 * Better Auth'un kendisi veriyor (route.ts'de createAuthCookie'ye soruluyor).
 * Sabit yazsaydik ayni hatayi ikinci kez yapmis olurduk.
 */
export function bridgedCookieHeader(
  cookieHeader: string | null,
  expectedName: string,
): string | null {
  if (!cookieHeader) return null;

  // Onek yoksa gelistirme/E2E'deyiz: eski ad ile yeni ad AYNI, koprulenecek
  // bir sey yok. Kopru boylece yalnizca production'da devreye giriyor.
  if (!expectedName.startsWith(SECURE_PREFIX)) return null;
  const legacyName = expectedName.slice(SECURE_PREFIX.length);

  // Dogru adli cerez zaten geldiyse dokunmuyoruz - web istemcisi ve
  // duzeltilmis mobil surumler bu daldan geciyor.
  if (readCookie(cookieHeader, expectedName) !== null) return null;

  const value = readCookie(cookieHeader, legacyName);
  if (value === null) return null;

  return `${cookieHeader}; ${expectedName}=${value}`;
}
