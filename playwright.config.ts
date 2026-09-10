import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

if (!process.env.E2E_DATABASE_URL) {
  throw new Error(
    "E2E_DATABASE_URL tanimli degil. E2E testleri ayri bir Neon branch'ine yazmalidir; " +
      ".env.local dosyasina E2E_DATABASE_URL ekleyin.",
  );
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Testler ayni veritabanini paylastigi icin sirayla calisiyorlar; paralel
  // calissalardi bir testin olusturdugu veri digerinin sayfasinda gorunup
  // beklentileri bozabilirdi.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 60_000,

  /**
   * IDDIA BASINA BEKLEME. Playwright'in varsayilani 5 saniye ve BU PROJEDE
   * DAR KALIYOR: E2E veritabani us-east-1'de, gelistirme makinesi
   * Istanbul'da. Gruba katilma ve harcama kaydetme birer islem ve iclerinde
   * birkac sorgu var; her biri Atlantik'i geciyor.
   *
   * GERCEKTEN YASANDI (8 Eylul): iki collaboration testi ust uste dustu ve
   * hata "URL degismedi" diyordu - sanki yonlendirme bozukmus gibi. Oysa
   * sayfanin anlik goruntusunde dugme hala "Katilinlyor..." ve devre disiydi,
   * yani istek YOLDAYDI. Ayni sinif ikinci testte "Kaydediliyor..." olarak
   * cikti. Bunlar islev hatasi degil, olcu hatasiydi.
   *
   * ONEMLI: testin kendi butcesi (timeout: 60_000) DEGISMIYOR. Yani
   * gercekten takilan bir sey hala yakalanIyor; degisen yalnizca tek bir
   * iddianin ne kadar sabirli oldugu.
   *
   * BUNUN BIR GECMISI VAR: uca "locale" parametresi ekleyen bir degisiklik
   * tam da bu testleri "bozuyor" sanilmis ve GERI ALINMISTI. Mekanizma o
   * zaman bulunamamisti; buyuk ihtimalle suclu o degisiklik degil, buradaki
   * 5 saniyeydi.
   */
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    // Hazir bir sunucuyu YENIDEN KULLANMIYORUZ: o sunucu yanlis veritabanina
    // bagli olabilir ve testler gercek gelistirme verisinin ustune yazardi.
    reuseExistingServer: false,
    env: {
      // Dev sunucusunu E2E branch'ine baglıyoruz. Next.js, process.env'de zaten
      // var olan degiskenleri .env.local ile EZMEZ; bu yuzden burada verilen
      // deger gecerli olur.
      DATABASE_URL: process.env.E2E_DATABASE_URL,
      // BETTER_AUTH_URL DE EZILMEK ZORUNDA. .env.local'daki deger 3000'i
      // gosteriyor (gelistirme sunucusu); E2E ise 3100'de kosuyor. Better Auth
      // guvendigi origin listesini BU adresten turetiyor, yani duzeltilmezse
      // tarayicidan giden her giris istegi 3100'den gelip 3000 beklenen
      // listeye takilir ve 403 INVALID_ORIGIN doner.
      BETTER_AUTH_URL: baseURL,
      /**
       * E2E UCUNCU TARAFA GERCEK E-POSTA YOLLAMAZ.
       *
       * Testler tek seferlik kodu posta kutusundan degil VERITABANINDAN
       * okuyor (readOtpFromDatabase). Yani gonderimin gercekten yapilmasi
       * kapsama hicbir sey katmiyor; katmadigi halde her kosuda Resend'e
       * onlarca istek gidiyordu - kurulumun uc kullanicisi, kod isteyen her
       * test, ve 28'den beri her kayit (sendVerificationOnSignUp).
       *
       * Bos anahtar sendOtpEmail'i AGA CIKMADAN dusuruyor (email.ts:28) ve
       * hata zaten yutuluyor (better-auth.ts'teki after). Bedeli, sunucu
       * loguna dusen gurultulu yigin izleri.
       *
       * NE OLCULMEDI: bunun kosu suresine etkisi. Bir ara "yavaslamanin
       * sebebi buydu" diye yazilmisti; sonraki kosu DAHA KOTU cikti ve ayni
       * yavaslama DEGISIKLIKLERIN HICBIRI OLMADAN da (temiz agacta)
       * uretildi. Yani buradaki gerekce yalnizca yukaridaki: ucuncu tarafa
       * bosuna istek atmamak.
       *
       * URETIM YOLU DEGISMIYOR: anahtar yoksa hata firlatmak bilincli bir
       * karar ve oyle kaliyor - burada yalnizca E2E sunucusuna bos deger
       * geciliyor.
       */
      RESEND_API_KEY: "",
      /**
       * ZAMANLANMIS ISIN SIRRI - E2E'YE OZGU BIR DEGER (ADR-051).
       *
       * NEDEN BURADA: /api/cron/recurring, CRON_SECRET tanimli DEGILSE
       * calismayi REDDEDIYOR (503) ve bu bilincli - o uc finansal kayit
       * uretiyor, acik kapi birakilamaz. Testin uretimi gorebilmesi icin
       * sunucunun bir sirri olmali.
       *
       * .env.local'a KONMADI: o dosyayi yalnizca kullanici duzenliyor ve
       * bu deger yalnizca test sunucusunu ilgilendiriyor. Uretimdeki deger
       * Vercel'de duruyor; ikisinin ayni olmasi gerekmiyor, olmamali da.
       *
       * DEGERIN GIZLI OLMASI GEREKMIYOR: bu sunucu yalnizca test kosusu
       * boyunca ve yalnizca localhost'ta yasiyor. Onemli olan VARLIGI -
       * testler yetki yolunun kendisini de geciyor.
       */
      CRON_SECRET: "e2e-cron-secret",
    },
  },
});
