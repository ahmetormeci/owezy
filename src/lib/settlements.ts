import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertActiveMemberOfGroup, assertCanModifyRecord } from "@/lib/group-access";
import { createNotifications } from "@/lib/notifications";
import {
  DEFAULT_SETTLEMENT_PAGE_SIZE,
  MAX_SETTLEMENT_PAGE_SIZE,
} from "@/lib/settlement-schemas";

// Settlement = "X kisisi Y kisisine Z tutar odedi" kaydi. Gercek para transferi
// DEGILDIR; sistem para tasimaz, yalnizca bu odemenin gerceklestigi bilgisini
// kaydeder ve bakiye hesabi (balances.ts) bunu dusurur.

export type CreateSettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
  settledAt?: Date;
};

export type ListSettlementsOptions = {
  limit?: number;
  cursor?: string;
  includeCancelled?: boolean;
};

export async function createSettlement(
  userId: string,
  groupId: string,
  input: CreateSettlementInput,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    if (input.fromUserId === input.toUserId) {
      throw new ValidationError("settlement.self_transfer");
    }

    // Islemi yapan kisi grubun AKTIF uyesi olmali.
    const callerMembership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!callerMembership) {
      throw new ForbiddenError("group.not_member");
    }

    // ...ve odemenin taraflarindan biri olmali. Ucuncu bir sahsin baskalari
    // arasindaki odemeyi kaydedebilmesi, dogrudan borc silen bir istismar
    // yuzeyi olurdu.
    if (userId !== input.fromUserId && userId !== input.toUserId) {
      throw new ForbiddenError("settlement.party_only");
    }

    // Odemenin taraflari grubun uyesi olmali ama AKTIF olmak zorunda degil:
    // gruptan ayrilmis bir uyenin borcu hala kapatilabilmeli, yoksa borc
    // sonsuza kadar acik kalirdi.
    const partyMemberships = await tx.groupMember.findMany({
      where: { groupId, userId: { in: [input.fromUserId, input.toUserId] } },
      select: { userId: true },
    });
    const partyUserIds = new Set(partyMemberships.map((membership) => membership.userId));
    const missingUserIds = [input.fromUserId, input.toUserId].filter(
      (id) => !partyUserIds.has(id),
    );
    if (missingUserIds.length > 0) {
      throw new ForbiddenError("settlement.users_not_member", {
        userIds: missingUserIds.join(", "),
      });
    }

    // currency istemciden hic alinmiyor - her zaman grubun currency'sinden gelir.
    const settlement = await tx.settlement.create({
      data: {
        groupId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: group.currency,
        note: input.note,
        settledAt: input.settledAt ?? new Date(),
        createdById: userId,
      },
    });

    // Odemenin iki tarafi da haber alir; kaydi giren kisi kendi islemi icin
    // bildirim almaz (createNotifications actorId'yi listeden ayikliyor).
    await createNotifications(tx, {
      type: "SETTLEMENT_RECORDED",
      actorId: userId,
      recipientIds: [settlement.fromUserId, settlement.toUserId],
      payload: {
        groupId,
        groupName: group.name,
        settlementId: settlement.id,
        amount: settlement.amount,
        currency: settlement.currency,
      },
    });

    return settlement;
  });
}

export async function listSettlements(
  userId: string,
  groupId: string,
  options: ListSettlementsOptions = {},
) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const limit = Math.min(
    options.limit ?? DEFAULT_SETTLEMENT_PAGE_SIZE,
    MAX_SETTLEMENT_PAGE_SIZE,
  );

  const rows = await prisma.settlement.findMany({
    where: {
      groupId,
      ...(options.includeCancelled ? {} : { cancelledAt: null }),
    },
    // Cursor sayfalamasinin dogru calismasi icin siralama BENZERSIZ olmali;
    // settledAt tek basina yeterli degil, id ile kesinlestiriliyor.
    orderBy: [{ settledAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const settlements = hasMore ? rows.slice(0, limit) : rows;

  return {
    settlements,
    nextCursor: hasMore ? settlements[settlements.length - 1].id : null,
  };
}

export async function cancelSettlement(
  userId: string,
  groupId: string,
  settlementId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.settlement.findUnique({ where: { id: settlementId } });

    // groupId eslesmesi burada kontrol ediliyor: baska bir grubun odeme kaydi,
    // kendi grup ID'n uzerinden iptal edilemesin.
    if (!existing || existing.groupId !== groupId) {
      throw new NotFoundError("settlement.not_found");
    }
    // Iptal edilmis kayitlar listelemede hala gorulebildigi icin (includeCancelled)
    // "bulunamadi" demek yaniltici olurdu; durum cakismasi olarak bildiriliyor.
    if (existing.cancelledAt) {
      throw new ConflictError("settlement.already_cancelled");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    await assertCanModifyRecord(tx, groupId, existing, userId, "settlement");

    // Fiziksel silme YOK: cancelledAt/cancelledById isaretleniyor ve kayit
    // bakiye hesabindan (cancelledAt: null filtresi) otomatik dusuyor.
    const cancelled = await tx.settlement.update({
      where: { id: settlementId },
      data: { cancelledAt: new Date(), cancelledById: userId },
    });

    // Iptal, kapanmis sanilan bir borcu geri getirir. Karsi tarafin bunu
    // ogrenmesi, odemenin kendisinden bile daha onemli.
    await createNotifications(tx, {
      type: "SETTLEMENT_CANCELLED",
      actorId: userId,
      recipientIds: [existing.fromUserId, existing.toUserId],
      payload: {
        groupId,
        groupName: group.name,
        settlementId,
        amount: existing.amount,
        currency: existing.currency,
      },
    });

    return cancelled;
  });
}
