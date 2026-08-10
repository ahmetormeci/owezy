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
    throw new ForbiddenError("Bu grubun uyesi degilsiniz");
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
  recordLabel: string,
) {
  const callerMembership = await tx.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!callerMembership) {
    throw new ForbiddenError("Bu grubun uyesi degilsiniz");
  }

  if (record.createdById === userId) {
    return;
  }

  const creatorMembership = await tx.groupMember.findFirst({
    where: { groupId, userId: record.createdById, leftAt: null },
  });
  if (creatorMembership) {
    throw new ForbiddenError(
      `Bu ${recordLabel} uzerinde yalnizca onu olusturan kisi islem yapabilir`,
    );
  }

  if (callerMembership.role !== "OWNER") {
    throw new ForbiddenError(
      "Kaydi olusturan kisi gruptan ayrildi; bu kayit uzerinde yalnizca grup sahibi islem yapabilir",
    );
  }
}
