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
const SECURITY_HEADERS = [
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
