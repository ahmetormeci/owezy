import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertActiveMemberOfGroup, assertCanModifyRecord } from "@/lib/group-access";
import { prisma } from "@/lib/prisma";
import { deleteObject, getObject, putObject } from "@/lib/storage";

/**
 * Harcamaya ekli fis fotografi.
 *
 * OKUMA DA YAZMA DA BURADAN GECIYOR; istemciye depo adresi ACILMIYOR. Fis
 * uzerinde isim, adres, kartin son hanesi olabilir - herkese acik ya da
 * imzali bir adres verseydik, adresi eline gecirenin yetkisi bir daha
 * kontrol edilmezdi.
 */

/**
 * Vercel'in istek govdesi siniri 4.5MB. Buradaki sinir onun ALTINDA
 * kalmali, yoksa hata bizim anlasilir cumlemiz yerine platformun ham
 * cevabi olarak doner.
 *
 * Telefon zaten kucultup gonderiyor (~200-500KB); bu sinir kotu niyetli
 * ya da bozuk bir istemci icin.
 */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

/**
 * TURU BAYTLARDAN OKUYORUZ, istemcinin sozune bakmiyoruz.
 *
 * Content-Type basligi istemcinin YAZDIGI bir metin. "image/jpeg" diyip
 * HTML gonderen biri, sundugumuz adreste tarayicinin calistiracagi bir
 * belge birakabilirdi - kendi alan adimizda depolanmis XSS. Sihirli
 * baytlar yalanlanamaz.
 *
 * YALNIZCA JPEG VE PNG. Telefon HEIC uretiyor ama cihazda JPEG'e
 * cevriliyor (expo-image-manipulator); burada HEIC kabul etmek, tarayicilarin
 * cogunun gosteremedigi bir bicimi depolamak olurdu.
 */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && PNG.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  return null;
}

/** Depo anahtari. Tahmin edilebilir olmasinin sakincasi yok - adres disariya hic cikmiyor. */
function storageKeyFor(expenseId: string, contentType: string): string {
  const extension = contentType === "image/png" ? "png" : "jpg";
  return `receipts/${expenseId}/${randomUUID()}.${extension}`;
}

/**
 * Fisi ekler ya da DEGISTIRIR.
 *
 * YETKI: harcamayi DEGISTIRME yetkisiyle ayni (group-access.ts). Fis eklemek
 * kaydi degistirmektir; odemis olmak yetki VERMEZ - paidById'nin kendisi de
 * duzenlenebilir bir alan oldugu icin (expenses.ts'teki gerekce).
 */
export async function attachReceipt(userId: string, expenseId: string, body: ArrayBuffer) {
  if (body.byteLength === 0) {
    throw new ValidationError("receipt.empty");
  }
  if (body.byteLength > MAX_RECEIPT_BYTES) {
    throw new ValidationError("receipt.too_large");
  }
  const contentType = sniffImageType(new Uint8Array(body));
  if (!contentType) {
    throw new ValidationError("receipt.unsupported_type");
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true, groupId: true, createdById: true, deletedAt: true },
  });
  if (!expense || expense.deletedAt) {
    throw new NotFoundError("expense.not_found");
  }
  await assertCanModifyRecord(prisma, expense.groupId, expense, userId, "expense");

  const existing = await prisma.expenseReceipt.findUnique({
    where: { expenseId },
    select: { storageKey: true },
  });

  const key = storageKeyFor(expenseId, contentType);

  /**
   * ONCE DEPOYA, SONRA VERITABANINA. Tersi olsaydi kayit isaret ettigi
   * nesne yokken yazilir ve arayuz kirik gorsel gosterirdi. Bu sirada
   * depoya yazip veritabanina yazamamak OKSUZ BIR NESNE birakiyor - kimse
   * goremez, faturasi odenir; kirik bir goruntuden iyi.
   */
  await putObject(key, body, contentType);

  await prisma.expenseReceipt.upsert({
    where: { expenseId },
    create: {
      expenseId,
      uploadedById: userId,
      storageKey: key,
      contentType,
      byteSize: body.byteLength,
    },
    update: {
      uploadedById: userId,
      storageKey: key,
      contentType,
      byteSize: body.byteLength,
      createdAt: new Date(),
    },
  });

  // Degistirme durumunda ESKI nesne artik hicbir kayittan gorunmuyor.
  // En iyi gayret: silinemezse oksuz kaliyor, kayit zaten dogru.
  if (existing) {
    await deleteObject(existing.storageKey);
  }

  return { contentType, byteSize: body.byteLength };
}

/**
 * Fisi okur. YETKI: grubun AKTIF UYESI olmak yeterli - fis grubun ortak
 * kaydinin parcasi, herkes harcamayi zaten goruyor.
 *
 * SILINMIS HARCAMANIN FISI DE OKUNABILIYOR ve bu bilincli: silme geri
 * alinabilir (ADR-046) ve "silinenleri goster" acikken satir ekranda
 * duruyor. Fisi gizlemek, geri almadan once ne oldugunu gormeyi
 * engellerdi.
 */
export async function readReceipt(userId: string, expenseId: string) {
  const receipt = await prisma.expenseReceipt.findUnique({
    where: { expenseId },
    select: {
      contentType: true,
      storageKey: true,
      expense: { select: { groupId: true } },
    },
  });
  if (!receipt) {
    throw new NotFoundError("receipt.not_found");
  }

  await assertActiveMemberOfGroup(receipt.expense.groupId, userId);

  const bytes = await getObject(receipt.storageKey);
  if (!bytes) {
    // Kayit var, nesne yok: oksuz kalmis bir silme ya da depo sorunu.
    // Kullaniciya "fis yok" demek dogru cevap - elimizde gercekten yok.
    throw new NotFoundError("receipt.not_found");
  }
  return { bytes, contentType: receipt.contentType };
}

/** Fisi kaldirir. Yetki eklemekle ayni. */
export async function removeReceipt(userId: string, expenseId: string) {
  const receipt = await prisma.expenseReceipt.findUnique({
    where: { expenseId },
    select: { storageKey: true, expense: { select: { groupId: true, createdById: true } } },
  });
  if (!receipt) {
    throw new NotFoundError("receipt.not_found");
  }
  await assertCanModifyRecord(
    prisma,
    receipt.expense.groupId,
    receipt.expense,
    userId,
    "expense",
  );

  // ONCE REFERANS, SONRA NESNE (ADR-046). Tersi, depoda olmayan bir nesneye
  // isaret eden kayit birakirdi.
  await prisma.expenseReceipt.delete({ where: { expenseId } });
  await deleteObject(receipt.storageKey);
}

/**
 * HESAP SILME icin: bu kullanicinin yukledigi butun fislerin kayitlarini
 * siler ve DEPO ANAHTARLARINI DONER.
 *
 * Nesneleri burada silmiyor: bu fonksiyon hesap silmenin transaction'i
 * icinde calisiyor ve ag istegi orada durmamali (push'takiyle ayni gerekce).
 * Cagiran, commit'ten SONRA anahtarlari depoya goturuyor.
 */
export async function deleteReceiptsUploadedBy(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string[]> {
  const receipts = await tx.expenseReceipt.findMany({
    where: { uploadedById: userId },
    select: { id: true, storageKey: true },
  });
  if (receipts.length === 0) return [];

  await tx.expenseReceipt.deleteMany({ where: { uploadedById: userId } });
  return receipts.map((receipt) => receipt.storageKey);
}
