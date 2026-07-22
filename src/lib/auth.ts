import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Clerk oturumundaki kullaniciyi bizim User tablomuza baglar.
 * Webhook kurana kadar (Faz 9, production) kullandigimiz basit yontem:
 * kayit yoksa ilk istekte olusturulur ("lazy sync").
 *
 * Tum is mantigi bu fonksiyonun dondurdugu User kaydini (bizim ic id'mizi)
 * kullanmali - Clerk'in clerkId'sini degil.
 */
export async function getOrCreateCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { clerkId } });
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
    throw new Error(`Clerk kullanicisinin (${clerkId}) e-posta adresi bulunamadi.`);
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    primaryEmail;

  return prisma.user.create({
    data: {
      clerkId,
      email: primaryEmail,
      displayName,
      avatarUrl: clerkUser.imageUrl,
    },
  });
}
