/**
 * Iki adimli dogrulamanin meydan okuma cerezini Set-Cookie basligindan cikarir.
 *
 * ONCEDEN lib/auth.tsx'in ICINDEYDI ve disa acik degildi. Buraya tasindi
 * cunku yaptigi is tek basina durmayi hak ediyor: gercek bir sunucu yanitiyla
 * olculmus bir ayristirma ve yanlis yapilmasinin belirtisi sessiz - kullanici
 * "kod ekranina dustum ama kodum hicbir zaman kabul edilmiyor" der, sebebi
 * hicbir yerde yazmaz.
 *
 * BU DOSYA URETIMDE BIR KEZ KIRILDI. 1.0 cerezi ADI ILE ariyordu ve arama
 * TAM ESLESME DEGIL metin aramasiydi:
 *     setCookie.indexOf("better-auth.two_factor=")
 * Better Auth cerez adlarina https'te "__Secure-" onegi ekliyor, yani
 * production'daki ad "__Secure-better-auth.two_factor". Aranan dize o adin
 * ICINDE de geciyor - 9. karakterden itibaren. Arama "buluyor" ama dokuz
 * karakter gec basliyor ve onek geride kaliyor; uygulama cerezi var olmayan
 * bir adla geri gonderiyordu. Sunucu adi birebir ariyor, bulamiyor,
 * INVALID_TWO_FACTOR_COOKIE donuyordu - kullanicinin gordugu cumle
 * "Dogrulama suresi doldu", yani hata kendini bir zaman asimi gibi
 * gosteriyordu. SONUCU: 2FA acik hesaplar iOS 1.0'a HIC GIREMEDI.
 *
 * NEDEN GELISTIRMEDE GORUNMEDI: onegi tetikleyen sey NODE_ENV. Gelistirme
 * ve E2E'de onek HIC olusmuyor, dolayisiyla metin aramasi tesadufen tam
 * eslesme oluyor. Bu dosyanin testleri gercek bir yanittan olculmustu - ama
 * GELISTIRME sunucusundan, yani ayirt edici ozelligin bulunmadigi yerden.
 * Gerekce ve kural ADR-045'te.
 */
export const TWO_FACTOR_COOKIE = "better-auth.two_factor";

/**
 * Cerez adinda gecerli karakterler (RFC 6265 token).
 *
 * ONEK BURADAN GELIYOR: "__Secure-" da bu karakterlerden olusuyor, yani
 * isaretten sola dogru bu kumede genisleyince onek KENDILIGINDEN iceri
 * giriyor. Yarin "__Host-" ya da baska bir onek gelirse de tasinir - kural
 * onegi TANIMIYOR, adin nerede bittigini biliyor.
 */
const NAME_CHAR = /[A-Za-z0-9!#$%&'*+\-.^_`|~]/;

/**
 * React Native, birden fazla Set-Cookie satirini TEK bir baslikta ", " ile
 * birlestirerek veriyor.
 *
 * NEDEN AYIRICIYA GORE BOLMUYORUZ: bir cerezin Expires ozniteligi
 * ("Expires=Wed, 09 Jun 2021 10:18:14 GMT") VIRGUL iceriyor, yani ", "
 * guvenilir bir sinir degil. Onun yerine cerezin ADINI buluyor ve adin
 * gercek basina kadar SOLA genisliyoruz; sag sinir ilk ";" - degerin
 * icinde nokta ve yuzde isareti olabiliyor ama ";" olamiyor.
 *
 * BUTUN GECISLERE BAKILIYOR, ilkine degil: yanit ayni ad icin once bir
 * SILME satiri tasiyabiliyor. Eski kod ilk gecise bakip null donerdi ve
 * gercek meydan okumayi kacirirdi.
 *
 * Donen deger "ad=deger" ciftinin TAMAMI - onegiyle birlikte - cunku
 * dogrudan bir Cookie basligina konuyor.
 */
export function readChallengeCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;

  const marker = `${TWO_FACTOR_COOKIE}=`;
  for (let at = setCookie.indexOf(marker); at !== -1; at = setCookie.indexOf(marker, at + 1)) {
    let nameStart = at;
    while (nameStart > 0 && NAME_CHAR.test(setCookie[nameStart - 1])) {
      nameStart--;
    }

    const end = setCookie.indexOf(";", at);
    const pair = (end === -1 ? setCookie.slice(nameStart) : setCookie.slice(nameStart, end)).trim();

    // Degeri BOS olan satir cerezi SILIYOR, meydan okuma degil. Onu meydan
    // okuma sayarsak ikinci adima bos bir cerezle gidilir ve kod hep
    // reddedilirdi.
    if (pair.slice(pair.indexOf("=") + 1).length > 0) {
      return pair;
    }
  }

  return null;
}
