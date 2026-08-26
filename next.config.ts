import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Her yanita eklenen guvenlik basliklari.
 *
 * OLCULEREK SECILDILER: canlinin bugun ne gonderdigine bakildi (curl -I) ve
 * yalnizca EKSIK olanlar yazildi. Vercel'in kendi ekledigi
 * Strict-Transport-Security burada YOK - degeri zaten iki yil
 * (max-age=63072000) ve kendi basligimizi eklersek ayni baslik iki kez
 * gidebilir; bunu deploy etmeden olcemeyiz.
 *
 * ACIK KALAN: Vercel'in HSTS'i "includeSubDomains" tasimiyor. Bugun HTTP
 * konusan bir alt alan adimiz yok (send.owezy.net yalnizca posta), o yuzden
 * acil degil. "preload" ise BILEREK onerilmiyor - tarayici listesine girmek
 * geri donusu zor bir kapi.
 *
 * CSP BU LISTEDE YOK ve bu bilincli: yanlis bir CSP uygulamayi SESSIZCE
 * bozar (stil yuklenmez, Sentry sustur, sayfa bos gorunur). Kendi isi olarak
 * ve once Content-Security-Policy-Report-Only ile olculerek eklenecek.
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * Icerik Guvenligi Politikasi (CSP).
 *
 * NONCE YOK VE BU BIR KARAR, eksiklik degil. Next 16'nin nonce yolu
 * (docs/01-app/02-guides/content-security-policy.md) iki sey istiyor:
 * proxy.ts'in geri gelmesi - 25.7'de bilerek silmistik - ve "you must use
 * dynamic rendering to add nonces", yani HER SAYFANIN dinamik render'a
 * zorlanmasi. Ikisi de sessiz bir bedel.
 *
 * Kapattigi boslukla karsilastirildiginda bu bedel agir kaliyor, cunku
 * OLCTUK: kod tabaninda tek bir dangerouslySetInnerHTML ya da innerHTML yok.
 * Kullanicidan gelen her metin React'in kacisindan geciyor. Yani buradaki
 * CSP bilinen bir deligi yamamiyor, DERINLEMESINE SAVUNMA yapiyor.
 *
 * 'unsafe-inline' ile bu politikanin KAPATMADIGI sey enjekte edilmis satir
 * ici script'tir - ve onun icin once bir XSS deligi gerekiyor. KAPATTIKLARI
 * ise gercek: saldirganin kendi sunucusundan script yuklemesi, <base>
 * enjeksiyonu, formun disari gonderilmesi, cerceveleme, eklenti calistirma.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'unsafe-inline': Next'in kendi onyukleme script'i satir ici. 'unsafe-eval'
  // YALNIZCA gelistirmede - Turbopack'in sicak yenilemesi kullaniyor, yayinda
  // hicbir sey kullanmiyor.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind ve Next satir ici stil uretiyor.
  "style-src 'self' 'unsafe-inline'",
  /**
   * DIS KAYNAKLI GORSEL BEKLENMIYOR ve bu olculdu: avatarUrl'i artik yazan
   * kimse yok (Clerk 25.7'de sokuldu, yeni kayit akisi fotograf sormuyor) ve
   * veritabaninda hasImage=true olan tek bir kullanici bile yok. Fis
   * fotografi ozelligi gelirse (PROGRESS'teki aday) bu satir ONUNLA BIRLIKTE
   * degisir - sessizce yuklenmeyen bir gorsel olarak degil.
   */
  "img-src 'self' data: blob:",
  // next/font yazi tiplerini derleme aninda kendi barindirmamiza aliyor.
  "font-src 'self'",
  /**
   * Sentry'nin tarayici SDK'si hatalari kendi ucuna POST ediyor. 'self' ile
   * birakilsaydi hata bildirimi SESSIZCE kesilirdi - yani gozumuzu kapatan
   * sey, gormemiz gereken seyin ta kendisi olurdu.
   *
   * BOLGE ADI YAZILMIYOR ve bunun sebebi olculdu. Once
   * "*.ingest.sentry.io" ve "*.ingest.de.sentry.io" yaziliydi; Sentry'nin
   * guncel adresleri ise "o12345.ingest.US.sentry.io" bicimde, yani
   * ".ingest.sentry.io" ile BITMIYOR ve o kalip onlari eslestirmiyordu.
   * Bolgeyi tek tek saymak, yanlis bolgede sessizce kirilan bir CSP demek -
   * ve kirildigini gosterecek olan sey de tam olarak Sentry'nin kendisi.
   *
   * Tek girdi, Sentry'nin butun alan adi. Ucuncu taraf zaten beyan edilmis
   * bir isleyici (bkz. /privacy).
   */
  "connect-src 'self' https://*.sentry.io",
  // Cerceveleme: X-Frame-Options'in modern karsiligi. Ikisi birden duruyor,
  // cunku eski tarayicilar frame-ancestors'i bilmiyor.
  "frame-ancestors 'none'",
  // <base> enjeksiyonu butun goreli adresleri saldirganin sunucusuna
  // cevirebiliyor.
  "base-uri 'self'",
  // Form baska bir yere gonderilemesin.
  "form-action 'self'",
  // <object>/<embed> ile eklenti calistirma.
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  {
    /**
     * ZORLAYICI - ama once Report-Only ile olculdu ve sirasi onemliydi.
     * Yanlis bir CSP uygulamayi SESSIZCE bozuyor: stil yuklenmez, Sentry
     * susar, sayfa bos gorunur.
     *
     * OLCUM: Report-Only ile giris, grup sayfasi, tema degistirme, bildirim
     * zili, satir ici harcama ekleme (POST + toast) ve koyu tema gezildi -
     * sifir ihlal. Ardindan zorlayiciya cevrilip 43 E2E kosuldu: zorlayici
     * modda bir ihlal GERCEKTEN bir seyi bozar, yani testler onu yakalar.
     * Report-Only'de yalnizca konsola yazardi ve Playwright oraya bakmiyor.
     */
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    // Tarayici, sunucunun soyledigi Content-Type'i TAHMIN ETMEYE calismasin.
    // Sniffing, kullanicinin yukledigi bir dosyanin script gibi
    // calistirilmasina yol acabiliyor.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    /**
     * BU BASLIGIN BIZDE SOMUT BIR SEBEBI VAR: davet linki bir SIR tasiyor
     * (/join/<token>) ve o adres tarayicinin adres cubugunda duruyor. Referrer
     * kisitlanmazsa, o sayfadan disari giden herhangi bir istek tam adresi -
     * yani daveti - karsi tarafa verebilir.
     *
     * Modern tarayicilarin varsayilani zaten bu; yine de yaziyoruz cunku
     * "varsayilan boyle" bir garanti degil, bir gozlem.
     */
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Clickjacking. Uygulamada geri alinmasi zor dugmeler var (harcama silme,
    // gruptan ayrilma); gorunmez bir iframe'in ustune konumlanan bir sayfa
    // kullaniciya onlari yanlislikla bastirabilir.
    //
    // CSP'nin frame-ancestors'i bunun modern karsiligi ve CSP geldiginde bu
    // satir gereksizlesecek - ama CSP ertelendigi icin bugun koruma bu.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Hicbirini kullanmiyoruz. Bir gun fis fotografi eklenirse camera'nin
    // acilmasi gerekecek (bkz. PROGRESS'teki aday) - o zaman bu satir
    // degisir, sessizce calismayan bir kamera degil.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // "x-powered-by: Next.js" gonderilmesin. Buyuk bir acik degil, ama saldirgana
  // hangi cerceveyi hedefleyecegini bedava soylemenin de gerekcesi yok.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Kaynak haritalari (source map) yalnizca token varken yuklenir. Onlar
  // olmadan Sentry'de yigin izi kucultulmus kod olarak gorunur - okunabilir
  // ama satir numaralari isimizi gormez. Token yoksa yukleme denemesi build'i
  // uzatip uyari uretecegi icin tamamen kapatiyoruz.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  // Sentry'nin kendi debug loglarini bundle'dan cikarir.
  disableLogger: true,

  silent: true,
});
