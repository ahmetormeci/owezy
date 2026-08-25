import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins/bearer";
import { emailOTP } from "better-auth/plugins/email-otp";
import { prisma } from "@/lib/prisma";

/**
 * Better Auth sunucu ornegi - kimlik dogrulamanin TEK kaynagi olacak.
 *
 * NEDEN BU DOSYA "better-auth.ts", "auth.ts" DEGIL: src/lib/auth.ts su an
 * Clerk'in oturumunu okuyan yardimcilarimizi tasiyor ve gocun sonuna kadar
 * calisir durumda kalacak (bkz. PROGRESS Faz 25). Ikisini ayni ada
 * sikistirmak, gocun ortasinda hangisinin hangisi oldugunu belirsiz
 * yapardi. 25.7'de Clerk sokulurken bu dosya auth.ts olacak.
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

  plugins: [
    /**
     * 6 HANELI KOD ile giris. Bugunku akisin aynisi - kullanicinin gordugu
     * sey degismiyor. Better Auth cekirdegi varsayilan olarak sihirli LINK
     * gonderiyor; bu eklenti olmadan giris deneyimi degisirdi.
     */
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        // 25.2'DE RESEND GELECEK. O zamana kadar kod SUNUCU LOGUNA
        // yaziliyor - yerelde calisabilmek icin.
        //
        // Production'da bu yol KAPALI: bir giris kodunu loga yazmak, log'a
        // erisen herkese o hesabi acmak demek. Sessizce loglamaktansa
        // patlamak dogru davranis - yanlis yapilandirilmis bir kurulum
        // calisiyormus gibi gorunmemeli.
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "E-posta gönderimi henüz yapılandırılmadı (Faz 25.2). " +
              "Kod üretildi ama gönderilemedi.",
          );
        }
        console.log(`[better-auth] ${type} kodu ${email} icin: ${otp}`);
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
    bearer(),
  ],
});
