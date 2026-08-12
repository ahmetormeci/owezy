import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Oturumdaki kullanicinin kaydini OKUR. Yoksa null doner - OLUSTURMAZ.
 *
 * NEDEN AYRI: getOrCreateCurrentUser() yan etkili, kayit yaratabiliyor.
 * Yalnizca "bu kullanicinin dil tercihi ne" diye soran bir yerin kayit
 * yaratmasi kabul edilemez; kok layout her istekte calisiyor ve karsilama
 * sayfasinin render'i kullanici satiri uretirdi.
 *
 * cache() ile sarili: React ayni istek icinde ikinci cagriyi veritabanina
 * goturmuyor. Bu sayede getLocale() ile (app) layout ayni istekte ayni
 * satiri iki kez cekmiyor - dil tercihini okumanin net maliyeti sifir.
 */
export const findCurrentUser = cache(async () => {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }
  return prisma.user.findUnique({ where: { clerkId } });
});

/**
 * Clerk oturumundaki kullaniciyi bizim User tablomuza baglar.
 * Webhook kurana kadar (Faz 9, production) kullandigimiz basit yontem:
 * kayit yoksa ilk istekte olusturulur ("lazy sync").
 *
 * Tum is mantigi bu fonksiyonun dondurdugu User kaydini (bizim ic id'mizi)
 * kullanmali - Clerk'in clerkId'sini degil.
 *
 * Fonksiyon ayni anda birden fazla kez cagrilabilir (bir sayfa acilirken
 * tarayici genellikle es zamanli istek atar). Bu yuzden "yoksa olustur"
 * adimi yarisa dayanikli olmak zorunda; asagidaki P2002 yakalamasi bunun icin.
 */
export async function getOrCreateCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  // Okuma adimi findCurrentUser'a devredildi: ayni istekte getLocale() de
  // ayni satiri istiyorsa iki sorgu degil bir sorgu oluyor.
  const existing = await findCurrentUser();
  if (existing) {
    return existing;
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
      },
    });
  } catch (error) {
    // P2002 = benzersizlik kisiti ihlali. Buraya dusmemizin tek makul sebebi,
    // ayni kullanici icin paralel giden baska bir istegin kaydi bizden hemen
    // once olusturmus olmasi. Bu bir hata degil, yaris; kazananin olusturdugu
    // kaydi okuyup donuyoruz.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const created = await prisma.user.findUnique({ where: { clerkId } });
      if (created) {
        return created;
      }
    }
    throw error;
  }
}
