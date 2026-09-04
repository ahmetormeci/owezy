import { NextResponse } from "next/server";

/**
 * Apple'in universal link dosyasi.
 *
 * NE ISE YARIYOR: iOS bu dosyayi okuyup "owezy.net/join/... adresi bu
 * uygulamaya aittir" diyor. Sonrasinda davet baglantisina dokunan kisi
 * Safari yerine UYGULAMADA aciliyor - bugun kullanici baglantiyi kopyalayip
 * "Gruba katil" alanina yapistirmak zorunda.
 *
 * NEDEN ROUTE HANDLER, public/ ALTINDA DURAN BIR DOSYA DEGIL: Apple dosyayi
 * "application/json" ile sunmamizi istiyor ve public/ altindaki UZANTISIZ
 * bir dosyanin content type'ini kontrol edemiyoruz. Burada basligi kendimiz
 * yaziyoruz.
 *
 * KAPSAM DAR: yalnizca /join/*. Butun owezy.net kapsansaydi gizlilik
 * politikasi, destek sayfasi ve WEB UYGULAMASININ KENDISI de uygulamaya
 * yonlenirdi - web'i kullanmak isteyen kisi native uygulamaya firlatilirdi.
 *
 * DOSYANIN ADINDA UZANTI YOK ve olmamali; Apple tam olarak bu adresi
 * istiyor: /.well-known/apple-app-site-association
 */

/** Apple Team ID - EAS build ciktisindan okundu, tahmin degil. */
const TEAM_ID = "A5WH8JT28C";
const BUNDLE_ID = "net.owezy.app";

const ASSOCIATION = {
  applinks: {
    details: [
      {
        appIDs: [`${TEAM_ID}.${BUNDLE_ID}`],
        /**
         * "components" GUNCEL BICIM; eski "paths" dizisi hala calisiyor ama
         * Apple yenisini oneriyor ve sorgu/parca eslemesine izin veriyor.
         */
        components: [
          {
            "/": "/join/*",
            comment: "Davet baglantisi",
          },
        ],
      },
    ],
  },
};

/**
 * ONBELLEK KISA TUTULUYOR. Apple'in CDN'i bu dosyayi kendi tarafinda
 * onbellekliyor ve degisiklikler ANINDA yansimiyor; bir de bizim tarafta
 * uzun bir onbellek olsaydi hatali bir surumu duzeltmek gunler alirdi.
 */
export async function GET() {
  return NextResponse.json(ASSOCIATION, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
