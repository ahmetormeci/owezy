import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";

// Grup icindeki kayitlara erisim kurallari. Harcamalar ve odeme kayitlari ayni
// kurallari paylastigi icin buradan tek noktadan yonetiliyor - yetkilendirme
// mantiginin iki yerde kopyalanip zamanla birbirinden ayrilmasi, guvenlik
// hatalarinin en klasik kaynagidir.

/**
 * Okuma islemleri icin: grubun aktif uyesi olan herkes gorebilir.
 */
export async function assertActiveMemberOfGroup(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!membership) {
    throw new ForbiddenError("group.not_member");
  }
}

/**
 * Degistirme islemleri (update / delete / restore / cancel) icin:
 *
 *   1. Kaydi olusturan kisi (createdById) - grubun aktif uyesi olmak sartiyla.
 *   2. Grup OWNER'i - YALNIZCA kaydi olusturan kisi artik grubun aktif uyesi
 *      degilse. Bu, sahibi gitmis kayitlarin sonsuza kadar kilitli kalmasini
 *      onleyen tek istisnadir; olusturan kisi grupta oldugu surece OWNER dahil
 *      hic kimse onun kaydina dokunamaz.
 */
export async function assertCanModifyRecord(
  tx: Prisma.TransactionClient,
  groupId: string,
  record: { createdById: string },
  userId: string,
  // Eskiden Turkce bir etiketti ("harcama"). Metin parametresi cevrilemez;
  // kayit TURUNU geciyoruz, metni sozluk uretiyor.
  recordKind: "expense" | "settlement",
) {
  const callerMembership = await tx.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!callerMembership) {
    throw new ForbiddenError("group.not_member");
  }

  if (record.createdById === userId) {
    return;
  }

  const creatorMembership = await tx.groupMember.findFirst({
    where: { groupId, userId: record.createdById, leftAt: null },
  });
  if (creatorMembership) {
    throw new ForbiddenError(
      recordKind === "expense"
        ? "access.expense_creator_only"
        : "access.settlement_creator_only",
    );
  }

  if (callerMembership.role !== "OWNER") {
    throw new ForbiddenError("access.creator_left_owner_only");
  }
}
