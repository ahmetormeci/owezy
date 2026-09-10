import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { sniffImageType } from "@/lib/receipts";
import { deleteObject, getObject, putObject } from "@/lib/storage";

/**
 * Profil fotografi (ADR-054).
 *
 * FISLE AYNI DESEN, BILEREK: okuma da yazma da buradan geciyor ve istemciye
 * depo adresi ACILMIYOR. Bir fotograf bir YUZ - herkese acik ya da imzali bir
 * adres verseydik, adresi eline gecirenin yetkisi bir daha kontrol edilmezdi.
 *
 * BU AYNI ZAMANDA CSP'YI YERINDE BIRAKIYOR. img-src 'self' data: blob:
 * duruyor ve dokunulmasi gerekmiyor, cunku goruntu kendi ucumuzdan cikiyor.
 * PROGRESS.md "uzak depo secilirse CSP de degismeli" diye yaziyordu; fisler
 * o gerekceyi coktan cozmustu, yalnizca not guncellenmemisti.
 */

/**
 * 2 MB. Fisinkinden (4 MB) KUCUK ve sebebi var: fis bir BELGE, uzerindeki
 * kucuk yazinin okunabilmesi gerekiyor. Avatar en buyuk 96 piksel bir daire
 * olarak cikiyor; 2 MB zaten fazlasiyla comert.
 *
 * Vercel'in istek govdesi siniri 4.5 MB - bu sinir onun cok altinda, yani
 * hata bizim cumlemizle donuyor, platformun ham cevabiyla degil.
 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Depo anahtari. Her yuklemede YENI bir uuid aliyor, ustune yazmiyor.
 *
 * NEDEN USTUNE YAZMIYOR: adres sabit kalsaydi tarayicidaki eski fotograf
 * onbellekten gelmeye devam ederdi (uc "private, max-age=300" diyor) ve
 * kullanici fotografini degistirdikten sonra bes dakika eskisini gorurdu.
 * Yeni anahtar -> yeni adres -> onbellek kendiliginden bosa duser.
 */
function storageKeyFor(userId: string, contentType: string): string {
  const extension = contentType === "image/png" ? "png" : "jpg";
  return `avatars/${userId}/${randomUUID()}.${extension}`;
}

/** Anahtarin uzantisindan icerik turu. Uzantiyi bu dosya uretiyor - kapali dongu. */
export function contentTypeForKey(key: string): "image/jpeg" | "image/png" {
  return key.endsWith(".png") ? "image/png" : "image/jpeg";
}

/** Arayuzun basacagi adres. Surum parcasi onbellegi bosa dusurmek icin. */
function avatarUrlFor(userId: string, key: string): string {
  const version = key.split("/").pop()?.split(".")[0] ?? "";
  return `/api/v1/users/${userId}/avatar?v=${version}`;
}

/**
 * Fotografi koyar ya da DEGISTIRIR. Yalnizca kisinin KENDISI - baskasinin
 * yuzunu degistirmek diye bir yetki yok, o yuzden uc de /me altinda.
 */
export async function setAvatar(userId: string, body: ArrayBuffer) {
  if (body.byteLength === 0) {
    throw new ValidationError("avatar.empty");
  }
  if (body.byteLength > MAX_AVATAR_BYTES) {
    throw new ValidationError("avatar.too_large");
  }
  const contentType = sniffImageType(new Uint8Array(body));
  if (!contentType) {
    throw new ValidationError("avatar.unsupported_type");
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageKey: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) {
    throw new NotFoundError("user.not_found");
  }

  const key = storageKeyFor(userId, contentType);

  /**
   * ONCE DEPOYA, SONRA VERITABANINA - fisteki gerekcenin aynisi (ADR-046).
   * Tersi olsaydi kayit, isaret ettigi nesne yokken yazilir ve arayuz kirik
   * gorsel gosterirdi. Bu sirada depoya yazip veritabanina yazamamak OKSUZ
   * BIR NESNE birakiyor: kimse goremez, faturasi odenir - kirik bir
   * goruntuden iyi.
   */
  await putObject(key, body, contentType);

  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarStorageKey: key,
      avatarUrl: avatarUrlFor(userId, key),
      hasImage: true,
    },
  });

  // Eskisi artik hicbir yerden gorunmuyor. Silinemezse oksuz kaliyor ve
  // bu, yeni fotografi kaydetmemek icin sebep degil.
  if (existing.avatarStorageKey) {
    await deleteObject(existing.avatarStorageKey).catch(() => false);
  }

  return { avatarUrl: avatarUrlFor(userId, key) };
}

/**
 * Fotografi okur.
 *
 * YETKI: KENDIN, ya da seninle EN AZ BIR AKTIF GRUP paylasan biri.
 *
 * Neden bu kural: avatarin varlik sebebi bir listede insanlari birbirinden
 * ayirmak. Yalnizca sahibi gorseydi hicbir ise yaramazdi; herkes gorseydi
 * elinde bir kullanici kimligi olan herkes bir yuze ulasirdi. Fis "bir
 * gruba ait" - avatar bir kisiye ait, o yuzden en yakin karsilik "ortak
 * grup" oluyor.
 */
export async function readAvatar(viewerId: string, ownerId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { avatarStorageKey: true, hasImage: true, deletedAt: true },
  });
  if (!owner || owner.deletedAt || !owner.hasImage || !owner.avatarStorageKey) {
    throw new NotFoundError("avatar.not_found");
  }

  if (viewerId !== ownerId) {
    const shared = await prisma.groupMember.findFirst({
      where: {
        userId: viewerId,
        leftAt: null,
        group: {
          deletedAt: null,
          members: { some: { userId: ownerId, leftAt: null } },
        },
      },
      select: { id: true },
    });
    if (!shared) {
      throw new ForbiddenError("avatar.permission_denied");
    }
  }

  const bytes = await getObject(owner.avatarStorageKey);
  if (!bytes) {
    // Kayit var, nesne yok. Kullaniciya "fotograf yok" demek dogru cevap -
    // elimizde gercekten yok.
    throw new NotFoundError("avatar.not_found");
  }
  return { bytes, contentType: contentTypeForKey(owner.avatarStorageKey) };
}

/** Fotografi kaldirir. Yine yalnizca kisinin kendisi. */
export async function removeAvatar(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarStorageKey: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    throw new NotFoundError("user.not_found");
  }
  if (!user.avatarStorageKey) {
    throw new NotFoundError("avatar.not_found");
  }

  // ONCE REFERANS, SONRA NESNE (ADR-046). Tersi, depoda olmayan bir nesneye
  // isaret eden kayit birakirdi.
  await prisma.user.update({
    where: { id: userId },
    data: { avatarStorageKey: null, avatarUrl: null, hasImage: false },
  });
  await deleteObject(user.avatarStorageKey).catch(() => false);
}

/**
 * HESAP SILME icin: kaydi temizler ve DEPO ANAHTARINI DONER.
 *
 * Nesneyi burada silmiyor - fisteki gerekcenin aynisi: bu fonksiyon hesap
 * silmenin transaction'i icinde calisiyor ve bir AG ISTEGI orada durmamali.
 * Cagiran, commit'ten SONRA anahtari depoya goturuyor.
 *
 * avatarUrl ve hasImage'i BURADA SIFIRLAMIYOR: hesap silme zaten kendi
 * anonimlestirme adiminda ikisini de temizliyor (account.ts). Iki yerde
 * yazmak, birinin degisip otekinin unutulmasina acik kapi olurdu.
 */
export async function takeAvatarKeyForDeletion(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string | null> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { avatarStorageKey: true },
  });
  if (!user?.avatarStorageKey) return null;

  await tx.user.update({ where: { id: userId }, data: { avatarStorageKey: null } });
  return user.avatarStorageKey;
}
