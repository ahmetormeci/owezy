import { cache } from "react";
import { headers } from "next/headers";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";

/**
 * Oturumdaki kullanicinin kaydini OKUR. Yoksa null doner - OLUSTURMAZ.
 *
 * GOC SIRASINDA IKI YOL YAN YANA (Faz 25.3). Once Better Auth'a bakiyoruz -
 * varis noktasi o; bulunamazsa Clerk'e dusuyoruz. Clerk dali 25.7'de
 * silinecek.
 *
 * NEDEN IKISI BIRDEN, NEDEN TEK SEFERDE DEGISTIRMIYORUZ: bu fonksiyon
 * uygulamanin TEK kimlik kapisi - 98 cagri noktasi buradan geciyor. Tek
 * seferde cevirmek, o anda acik olan her oturumu dusurmek ve gocun geri
 * kalanini calismayan bir uygulama uzerinde yapmak demekti.
 *
 * NEDEN BETTER AUTH ONCE: bir kullanicinin ikisinde birden oturumu olabilir
 * (web'de yeni sistemle girmis, eski Clerk cerezi de duruyor). Boyle bir
 * durumda YENI olan kazanmali; tersi, gocun ilerlemesini geri alirdi.
 *
 * cache() ile sarili: React ayni istek icinde ikinci cagriyi tekrar
 * calistirmiyor. Bu sayede getLocale() ile (app) layout ayni istekte ayni
 * satiri iki kez cekmiyor - dil tercihini okumanin net maliyeti sifir.
 */
export const findCurrentUser = cache(async () => {
  const fromBetterAuth = await findUserFromBetterAuth();
  if (fromBetterAuth) {
    return fromBetterAuth;
  }
  return findUserFromClerk();
});

/**
 * YENI YOL.
 *
 * session.user.id DOGRUDAN bizim User.id'miz - arada bir esleme YOK. Better
 * Auth kendi kullanici tablosunu acmiyor, bizimkini kullaniyor (ADR-036
 * oncesi kurulum, bkz. src/lib/better-auth.ts). Gocun butun mesele ettigi
 * sey bu: Clerk'te tasidigimiz "clerkId -> User.id" eslemesinin dengi
 * burada hic olusmuyor.
 *
 * SATIRI YINE DE CEKIYORUZ: Better Auth'un dondurdugu kullanici nesnesi
 * yalnizca kendi bildigi alanlari tasiyor (id, email, name, image,
 * emailVerified). Bize locale, hasImage, deletedAt de gerekiyor.
 *
 * Bearer eklentisi sayesinde bu yol MOBIL ICIN DE calisiyor: getSession
 * cerezi de "Authorization: Bearer ..." basligini da okuyor, yani ayri bir
 * dal gerekmiyor.
 */
async function findUserFromBetterAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/** ESKI YOL. 25.7'de bu fonksiyon ve tum Clerk importlari silinecek. */
async function findUserFromClerk() {
  const { userId: clerkId } = await clerkAuth();
  if (!clerkId) {
    return null;
  }
  return prisma.user.findUnique({ where: { clerkId } });
}

/**
 * Oturumdaki kullaniciyi bizim User tablomuza baglar; Clerk yolunda kayit
 * yoksa olusturur ("lazy sync", ADR-011).
 *
 * BETTER AUTH YOLUNDA OLUSTURMA YOK ve buna gerek de yok: kaydi Better Auth
 * zaten kendisi yaratiyor, cunku yazdigi tablo bizim User tablomuz. Yani
 * "oturum var ama satir yok" durumu o yolda OLUSAMAZ. Bu fonksiyonun
 * "getOrCreate" olmasinin sebebi tamamen Clerk'ti ve 25.7'de sadelesecek.
 *
 * Tum is mantigi bu fonksiyonun dondurdugu User kaydini (bizim ic id'mizi)
 * kullanmali.
 */
export async function getOrCreateCurrentUser() {
  const existing = await findCurrentUser();
  if (existing) {
    return existing;
  }

  // Buradan asagisi YALNIZCA CLERK yolu.
  const { userId: clerkId } = await clerkAuth();
  if (!clerkId) {
    return null;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error(`Clerk kullanıcısının (${clerkId}) e-posta adresi bulunamadı.`);
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    primaryEmail;

  try {
    return await prisma.user.create({
      data: {
        clerkId,
        email: primaryEmail,
        displayName,
        avatarUrl: clerkUser.imageUrl,
        // Clerk fotograf yuklememis kullaniciya da bir imageUrl veriyor;
        // "gercekten yukledi mi" bilgisi yalnizca burada.
        hasImage: clerkUser.hasImage,
      },
    });
  } catch (error) {
    // P2002 = benzersizlik kisiti ihlali. Iki sebebi olabilir:
    //   - YARIS: ayni kullanici icin paralel giden baska bir istek kaydi
    //     bizden hemen once olusturdu. Kazananin kaydini okuyup donuyoruz.
    //   - E-POSTA CAKISMASI: 25.1'de email UNIQUE oldu. Ayni adres Better
    //     Auth ile zaten kayitliysa, Clerk yolu ikinci bir satir ACAMAZ -
    //     ve acmamali. Var olan satiri dondurmek dogru davranis: kisi ayni
    //     kisi, kaydi da ayni olmali.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const byClerkId = await prisma.user.findUnique({ where: { clerkId } });
      if (byClerkId) {
        return byClerkId;
      }
      const byEmail = await prisma.user.findUnique({ where: { email: primaryEmail } });
      if (byEmail) {
        return byEmail;
      }
      // IKISI DE BULUNAMADIYSA HATA GIZLENMEZ. P2002 aldik, yani bir kisit
      // ihlal edildi - ama ihlale sebep olan satiri bulamiyoruz. Bu tutarsiz
      // bir durum ve sessizce null donmek, cagiran tarafa "oturum yok" diye
      // yalan soylemek olurdu.
    }
    throw error;
  }
}
