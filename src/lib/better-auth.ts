import { after } from "next/server";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { sendOtpEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

/**
 * Kodun omru. TEK YERDE cunku iki yer birden kullaniyor: eklentiye
 * "ne kadar gecerli" diye veriliyor, e-postaya da "kac dakika" diye
 * yaziliyor. Ayri yazilsalardi, biri degistiginde posta yalan soylerdi.
 */
const OTP_EXPIRES_IN_SECONDS = 300;

/**
 * Better Auth sunucu ornegi - kimlik dogrulamanin TEK kaynagi olacak.
 *
 * NEDEN BU DOSYA "better-auth.ts", "auth.ts" DEGIL: ikisi AYRI islere
 * bakiyor. Burasi kimlik dogrulama SUNUCUSU - uclari, eklentileri, posta
 * gonderimi. src/lib/auth.ts ise tek bir soruyu cevapliyor: "bu istekteki
 * kullanici kim". Doksanin uzerinde cagri noktasi ikincisini import ediyor
 * ve birincisini hic bilmiyor.
 *
 * NOT: bu yorumda bir ara "25.7'de Clerk sokulurken bu dosya auth.ts olacak"
 * yaziyordu. Yapilmadi ve sebebi yukarida: o plan "auth.ts adi Clerk
 * yardimcilarinda dolu" diye kurulmustu, oysa ayirmanin daha iyi bir sebebi
 * varmis.
 *
 * SECRET ve URL ortamdan geliyor. betterAuth() bunlari kendisi
 * BETTER_AUTH_SECRET / BETTER_AUTH_URL'den okuyor; burada elle
 * gecirmiyoruz ki tek okuma yeri kalsin.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  /**
   * KENDI User TABLOMUZ devralindi - Better Auth'a ayri bir kullanici
   * tablosu ACTIRMIYORUZ.
   *
   * Bu gocun en buyuk kazanci: Expense, Settlement, GroupMember ve
   * Notification'in tamami User.id'ye bagli. Better Auth kendi tablosunu
   * acsaydi, bugun Clerk icin tasidigimiz "clerkId -> User.id" eslemesinin
   * aynisini bu kez baska bir isimle tasimaya devam ederdik (ADR-007),
   * ve gocun amaci zaten o eslemeyi ORTADAN KALDIRMAKTI.
   *
   * id tipi de sansa kalmadi: bizim id'miz uuid, Better Auth'un varsayilani
   * da uuid. Ayni.
   *
   * fields: kendi sutun adlarimizi koruyoruz. Better Auth kodunun icinde
   * yine "name" ve "image" diye goruluyor; eslesme yalnizca veritabanina
   * inerken uygulaniyor.
   *
   * NOT: locale, hasImage, deletedAt gibi kendi sutunlarimiz burada
   * BILDIRILMIYOR (additionalFields). Sebep: onlari Better Auth'un
   * dondurdugu kullanici nesnesinden degil, kendi Prisma sorgularimizdan
   * okuyoruz. Bildirmek, ayni bilgiyi iki yerde tanimlamak olurdu.
   * Nullable olduklari icin Better Auth'un INSERT'i de onlara dokunmuyor.
   */
  user: {
    modelName: "User",
    fields: {
      name: "displayName",
      image: "avatarUrl",
    },
  },

  /**
   * Better Auth'un kendi tablolari da PascalCase olsun - semadaki diger
   * on modelin hepsi oyle ve @@map hicbir yerde kullanilmiyor. Varsayilani
   * kucuk harf ("session", "account", "verification"); birakirsak sema
   * okuyan biri iki ayri adlandirma gorurdu.
   */
  session: { modelName: "Session" },
  account: { modelName: "Account" },
  verification: { modelName: "Verification" },

  /**
   * HIZ SINIRI. Kurallar Better Auth'un varsayilanlari - degistirmiyoruz,
   * cunku olculdugunde makul cikti (rate-limiter/index.mjs:302):
   *     /sign-in*, /sign-up*                     3 istek / 10 sn
   *     /email-otp/send-verification-otp         3 istek / 60 sn
   *     digerleri                              100 istek / 10 sn
   *
   * DEGISTIRDIGIMIZ TEK SEY SAYACIN DURDUGU YER, ve sebebi olculdu.
   * Varsayilan "memory" ve Vercel'de her serverless ornegi kendi bellegini
   * tasiyor; ornekler de kisa omurlu. Yani sayac surekli sifirlaniyordu ve
   * "10 saniyede 3 deneme" pratikte cok daha fazlasina izin veriyordu.
   * Kural degil, saydigi yer yanlisti.
   *
   * HER ORTAMDA ACIK. Kutuphanenin varsayilani "yalnizca production" ve
   * birakilsaydi mekanizmanin ilk gercek kosusu CANLIDA olurdu - yanlis bir
   * ayarin bedeli de orada odenirdi. Acik tutmanin bedeli olculdu: E2E
   * kurulumu uc kullaniciyi arka arkaya yaratiyor ve /sign-up/email'in
   * siniri 10 saniyede 3 istek, yani kurulum tavana TAM oturuyordu (kosu
   * sonrasi sayac 3'te kaldi). Cozum sinirdan degil kurulumdan geldi:
   * hazirlik kendi biriktirdigi sayaci siliyor, hiz siniri testler boyunca
   * tam olarak acik kaliyor (bkz. e2e/db-cleanup.ts).
   *
   * ANAHTAR "IP + YOL" VE BUNUN BIR TUZAGI VAR: IP cozulemezse anahtar
   * "no-trusted-ip" oluyor, yani BUTUN KULLANICILAR TEK KOVAYA dusuyor -
   * uygulama 10 saniyede 3 girise kapaniyor. getIP, trustedProxies
   * verilmediginde x-forwarded-for'u yalnizca TEK bir IP tasiyorsa kabul
   * ediyor (core/utils/ip.mjs:188). Cloudflare proxy'miz kapali (ADR-026),
   * yani Vercel'e dogrudan gidiyoruz ve tek IP bekleniyor - ama bu
   * PRODUCTION'DA DOGRULANMALI. Belirtisi "uygulama herkese kapandi" olur.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
    // Semadaki diger modeller gibi PascalCase. Varsayilani "rateLimit";
    // birakirsak sema okuyan biri iki ayri adlandirma gorurdu.
    modelName: "RateLimit",
  },

  advanced: {
    database: {
      /**
       * VARSAYILANI DEGISTIRIYORUZ ve sebebi olculdu.
       *
       * Belgeler "varsayilan olarak UUID uretir" diyor; KAYNAK OYLE DEMIYOR.
       * Gercek uretici nanoid tarzi bir metin:
       *     createRandomStringGenerator("a-z", "0-9", "A-Z", "-_")
       * Buna guvenip sutunlari @db.Uuid yazsaydik ilk INSERT'te patlardi.
       *
       * "uuid" secilince uretim uuid oluyor ve uc yeni tablonun id'leri de
       * semadaki diger on tabloyla ayni tipte kaliyor.
       */
      generateId: "uuid",
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  hooks: {
    /**
     * 2FA ACIK OLAN HESAP E-POSTA KODUYLA GIREMEZ.
     *
     * NEDEN GEREKLI - OLCULDU: Better Auth'un twoFactor eklentisi ikinci
     * faktoru yalnizca su yollarda soruyor (two-factor/index.mjs:245):
     *     /sign-in/email, /sign-in/username, /sign-in/phone-number
     * Bizim BIRINCIL yolumuz olan /sign-in/email-otp listede YOK ve
     * email-otp eklentisinin kaynaginda "twoFactor" diye bir iz de yok.
     * Yani bu kanca olmasaydi: kullanici 2FA'yi acar, her zamanki gibi
     * e-posta koduyla girer ve IKINCI FAKTOR HIC SORULMAZDI. Korundugunu
     * sanan ama korunmayan bir kullanici - bir guvenlik ozelliginin en kotu
     * ariza bicimi.
     *
     * NEDEN BU COZUM, eklentinin kancasini taklit etmek DEGIL: o kanca
     * internalAdapter, createAuthCookie, HMAC ve setNewSession uzerine
     * kurulu. Taklit etmek, bir surum yukseltmesinde SESSIZCE bozulacak bir
     * kod demekti - ve bozulma sekli yine "2FA artik sorulmuyor" olurdu.
     * Buradaki kanca genel API (hooks.before) ve tek bir sey yapiyor.
     *
     * KOD DOGRULAMA ADIMINDA REDDEDILIYOR, kod GONDERME adiminda degil.
     * Gondermede reddetseydik, bir adresin kayitli olup olmadigi disaridan
     * tek tek sinanabilirdi. Burada reddedilen kisi kodu ZATEN OKUMUS
     * olan biri, yani posta kutusuna erisimi olan biri.
     */
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email-otp") {
        return;
      }

      const email = (ctx.body as { email?: unknown } | undefined)?.email;
      if (typeof email !== "string" || email.length === 0) {
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { twoFactorEnabled: true },
      });

      if (user?.twoFactorEnabled) {
        // KOD DONULUYOR, METIN DEGIL (ADR-017). Istemci sozlukten cumleyi
        // koyuyor; eslesme src/lib/auth-errors.ts'te.
        throw new APIError("BAD_REQUEST", {
          message: "This account uses two-step verification. Sign in with your password.",
          code: "TWO_FACTOR_REQUIRES_PASSWORD",
        });
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * GORUNEN AD BOS BIRAKILAMAZ.
         *
         * OLCULDU: e-posta koduyla ilk kez giren birine Better Auth
         * name: "" yaziyor - cunku o akista sorulan tek sey e-posta. Bizim
         * arayuzumuz displayName'i HER YERDE gosteriyor (uye listesi,
         * bakiyeler, fis, odesme plani); bos ad, o ekranlarin hepsinde bos
         * bir hucre demek.
         *
         * E-POSTANIN TAMAMI yaziliyor, "@"den oncesi degil. Sebep tutarlilik:
         * Clerk yolu da bastan beri boyle davraniyor
         * ([ad, soyad].join(" ") || primaryEmail). Gocun ortasinda gorunen
         * adin kuralini degistirmek, ayni gruptaki iki uyeyi iki farkli
         * bicimde gosterirdi.
         *
         * KALICI COZUM DEGIL: 25.4'teki kayit formu gercek bir ad soracak.
         * Bu, o form doldurulmadan giren herkes icin makul bir yedek.
         */
        async before(user) {
          if (typeof user.name === "string" && user.name.trim().length > 0) {
            return;
          }
          return { data: { ...user, name: user.email } };
        },
      },
    },
  },

  plugins: [
    /**
     * 6 HANELI KOD ile giris. Bugunku akisin aynisi - kullanicinin gordugu
     * sey degismiyor. Better Auth cekirdegi varsayilan olarak sihirli LINK
     * gonderiyor; bu eklenti olmadan giris deneyimi degisirdi.
     */
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      async sendVerificationOTP({ email, otp, type }, ctx) {
        /**
         * GONDERIM BEKLENMIYOR - ve bunun iki ayri sebebi var.
         *
         * 1. ZAMANLAMA SIZINTISI. Better Auth'un kendi notu: "not await the
         *    email sending to avoid timing attacks". Beklersek, kayitli bir
         *    adres ile kayitsiz bir adres arasindaki SURE FARKI olculebilir
         *    hale gelir; yani cevabin icerigi ayni olsa da hangi
         *    e-postalarin sistemde oldugu sizar.
         *
         * 2. SUNUCUSUZ ORTAM. Ama sadece "await etme" demek Vercel'de
         *    YETMIYOR: yanit donunce islem sonlandirilabilir ve posta hic
         *    gitmez. Bu yuzden after() - Next'in "yaniti gonder, SONRA sunu
         *    calistir" araci. Ikisini birden cozen tek yol bu.
         *
         * HATA YUTULMUYOR, ama kullaniciya da YANSITILMIYOR: cagiran taraf
         * her durumda "kod gonderildi" goruyor (yine 1. maddedeki sizinti).
         * Hata sunucu loguna dusuyor - teslimat bozuldugunda tek isaretimiz o.
         */
        after(async () => {
          try {
            await sendOtpEmail({
              to: email,
              code: otp,
              type,
              expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
              // Dil cerezi buradan okunuyor. ctx yoksa varsayilana dusuyor.
              headers: ctx?.request?.headers,
            });
          } catch (error) {
            console.error("[better-auth] tek seferlik kod gönderilemedi:", error);
          }
        });
      },
    }),

    /**
     * MOBIL ICIN. Bearer, oturumu cerez yerine
     * "Authorization: Bearer <token>" basligiyla tasiyor - yani ADR-029'da
     * olculen /api/v1 sozlesmesi AYNEN KALIYOR ve mobil istemcinin istek
     * katmani (lib/use-api.ts) degismiyor.
     *
     * Better Auth'un Expo rehberi bunun yerine cerezi elle tasimayi
     * (authClient.getCookie()) oneriyor; onu SECMEDIK cunku sunucu
     * tarafinda /api/v1 uclarinin tamami bugun Bearer bekliyor.
     */
    /**
     * IKI ADIMLI DOGRULAMA - TOTP + YEDEK KOD.
     *
     * E-POSTA KODU IKINCI FAKTOR OLARAK SUNULMUYOR (otpOptions verilmedi).
     * Ilk faktor zaten parola; ustune e-posta kodu koymak gercek bir 2FA
     * olurdu ama gucu posta kutusunun guvenligine inerdi. TOTP belirli bir
     * CIHAZ istiyor. "Telefonumu kaybettim" durumunu yedek kodlar
     * karsiliyor.
     *
     * issuer: authenticator uygulamasinda hesabin yaninda gorunen ad.
     *
     * twoFactorTable: semadaki diger modeller gibi PascalCase. Varsayilani
     * "twoFactor"; birakirsak sema okuyan biri iki ayri adlandirma gorurdu.
     *
     * trustDeviceMaxAge'e DOKUNULMUYOR (varsayilan 30 gun). "Bu cihazi
     * hatirla" yalnizca WEB'de sunuluyor: ozellik cerez tabanli ve mobil
     * cerez tasimiyor (ADR-038). Asimetri bilincli - mobil oturum belirteci
     * uzun omurlu oldugu icin orada zaten nadiren giris yapiliyor.
     */
    twoFactor({
      issuer: "Owezy",
      twoFactorTable: "TwoFactor",
    }),

    bearer(),
  ],
});
