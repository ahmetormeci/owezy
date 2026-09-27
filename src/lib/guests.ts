import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { GuestNameInput } from "@/lib/guest-schemas";

/**
 * HESAPSIZ UYE - MISAFIR (ADR-057, Faz 50a).
 *
 * Misafir, isGuest isaretli ve tek bir gruba bagli bir "User" satiri. Bu
 * secimin butun sebebi paraya dokunmamak: odeyen, paylar, odemeler ve
 * kalemler zaten "User"a bagli; misafir de bir "User" oldugu icin bakiye
 * hesabi, bolusum ve veritabanindaki kurus kurallari AYNEN calisiyor.
 *
 * MISAFIR GIRIS YAPAMAZ ve bu uc katmanda tutuluyor - e-posta asagida,
 * oturum kancasi better-auth.ts'te, son katman veritabani trigger'larinda.
 */

/** Grupta ayni anda en fazla bu kadar aktif misafir. Kotuye kullanima tavan. */
export const MAX_GUESTS_PER_GROUP = 20;

/** Misafir e-postalarinin alan adi. Veritabanindaki CHECK ayni degeri bekliyor. */
export const GUEST_EMAIL_DOMAIN = "guest.invalid";

/**
 * Misafirin e-postasi.
 *
 * "User.email" zorunlu ve tekil (Better Auth), bos birakilamiyor. Adres bu
 * yuzden UYDURMA ama iki ozelligi bilincli:
 *
 *   - ".invalid" RFC 2606'ya gore HICBIR ZAMAN cozulmeyen bir alan adi:
 *     giris kodu gidecek bir posta kutusu YOK.
 *   - Rastgele bir UUID tasiyor: tahmin edilemiyor, yani kimse bu adresle
 *     "giris kodu gonder" bile diyemiyor.
 *
 * Silinen hesaplar ayni kalibi kullaniyor (account.ts, "@deleted.invalid").
 */
export function guestEmail(): string {
  return `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/**
 * Oturum acilmadan once: bu kullanici misafirse OTURUM ACILMAZ. Better
 * Auth'un session.create.before kancasi bunu cagiriyor (better-auth.ts);
 * false = olusturma. Burada duruyor cunku oradaki yapilandirmanin icinde
 * test edilemezdi.
 */
export async function mayOpenSession(userId: string): Promise<boolean> {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGuest: true },
  });
  return !owner?.isGuest;
}

/**
 * Gruba misafir ekler. HER AKTIF UYE ekleyebilir (kullanicinin karari,
 * 27 Eylul): harcama eklemek gibi, grubu kim tutuyorsa o. Cikarmak ise
 * bugunku uye kuraliyla yalnizca sahipte (removeGroupMember).
 *
 * invitedById EKLEYEN KISI: uye listesinde "kim ekledi" sorusunun cevabi
 * zaten bu alanda duruyordu, misafir icin ayri bir alan acilmadi.
 */
export async function addGuest(userId: string, groupId: string, input: GuestNameInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("group.not_member");
    }

    const activeGuests = await tx.groupMember.count({
      where: { groupId, leftAt: null, user: { isGuest: true } },
    });
    if (activeGuests >= MAX_GUESTS_PER_GROUP) {
      throw new ConflictError("guest.limit", { max: MAX_GUESTS_PER_GROUP });
    }

    const guest = await tx.user.create({
      data: {
        email: guestEmail(),
        displayName: input.displayName,
        isGuest: true,
        guestGroupId: groupId,
      },
      select: { id: true, displayName: true },
    });

    await tx.groupMember.create({
      data: { groupId, userId: guest.id, role: "MEMBER", invitedById: userId },
    });

    return { userId: guest.id, displayName: guest.displayName, isGuest: true as const };
  });
}

/**
 * Misafirin adini degistirir. Her aktif uye degistirebilir: misafirin
 * kendisi giris yapamiyor, yani adini ancak grup duzeltebilir.
 *
 * Yalnizca BU GRUBUN, HALA AKTIF misafiri: gruptan cikarilmis bir misafirin
 * adi degistirilmiyor - gecmis kayitlarda o adla gorunuyor ve oyle kalmali.
 * Baska bir grubun misafiri ya da gercek bir uye "bulunamadi" aliyor: hangi
 * kimliklerin var oldugu sizdirilmiyor.
 */
export async function renameGuest(
  userId: string,
  groupId: string,
  guestId: string,
  input: GuestNameInput,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("group.not_member");
    }

    const guestMembership = await tx.groupMember.findFirst({
      where: {
        groupId,
        userId: guestId,
        leftAt: null,
        user: { isGuest: true, guestGroupId: groupId },
      },
      select: { id: true },
    });
    if (!guestMembership) {
      throw new NotFoundError("guest.not_found");
    }

    return tx.user.update({
      where: { id: guestId },
      data: { displayName: input.displayName },
      select: { id: true, displayName: true },
    });
  });
}
