import { randomBytes, createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";
import { calculateBalances } from "@/lib/balances";
import { createNotifications } from "@/lib/notifications";
import { DEFAULT_CURRENCY, type SupportedCurrency } from "@/lib/money";

const DEFAULT_INVITE_TTL_DAYS = 7;
const DEFAULT_INVITE_MAX_USES = 1;

// currency tipi bilerek DAR: sema calisma zamaninda eliyor, bu tip de derleme
// zamaninda eliyor. Servisi bir gun baska bir yerden (ornegin bir betikten)
// cagiran biri desteklenmeyen bir kod veremez.
type CreateGroupInput = {
  name: string;
  description?: string;
  currency?: SupportedCurrency;
};

export async function createGroup(userId: string, input: CreateGroupInput) {
  const currency = input.currency ?? DEFAULT_CURRENCY;

  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: input.name,
        description: input.description,
        currency,
        createdById: userId,
      },
    });

    await tx.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "OWNER",
      },
    });

    return group;
  });
}

export async function listGroupsForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, leftAt: null, group: { deletedAt: null } },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((membership) => ({
    ...membership.group,
    role: membership.role,
  }));
}

function generateRawToken() {
  return randomBytes(32).toString("hex");
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

type CreateInviteOptions = {
  maxUses?: number;
  ttlDays?: number;
};

export async function createGroupInvite(
  userId: string,
  groupId: string,
  opts: CreateInviteOptions = {},
) {
  await assertActiveMemberOfGroup(groupId, userId);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const ttlDays = opts.ttlDays ?? DEFAULT_INVITE_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.groupInvite.create({
    data: {
      groupId,
      invitedById: userId,
      tokenHash,
      expiresAt,
      maxUses: opts.maxUses ?? DEFAULT_INVITE_MAX_USES,
    },
  });

  // rawToken veritabaninda hic saklanmiyor - sadece bu cevapta, bir kereligine donuyor.
  return {
    inviteId: invite.id,
    token: rawToken,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
  };
}

export async function acceptGroupInvite(userId: string, rawToken: string) {
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const invite = await tx.groupInvite.findUnique({ where: { tokenHash } });

    if (!invite || invite.revokedAt) {
      throw new NotFoundError("invite.invalid");
    }
    if (invite.expiresAt < new Date()) {
      throw new ConflictError("invite.expired");
    }
    if (invite.useCount >= invite.maxUses) {
      throw new ConflictError("invite.exhausted");
    }

    const existingMembership = await tx.groupMember.findFirst({
      where: { userId, groupId: invite.groupId, leftAt: null },
    });
    if (existingMembership) {
      throw new ConflictError("group.already_member");
    }

    const membership = await tx.groupMember.create({
      data: {
        groupId: invite.groupId,
        userId,
        role: "MEMBER",
        invitedById: invite.invitedById,
      },
    });

    await tx.groupInvite.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    });

    // Gruptaki mevcut uyeler yeni katilimi ogrenir. Sorgu katilim SONRASI
    // calistigi icin listede katilan kisi de var; createNotifications actorId'yi
    // ayikladigi icin kendine bildirim gitmiyor.
    const group = await tx.group.findUniqueOrThrow({
      where: { id: invite.groupId },
      select: { name: true },
    });
    const activeMembers = await tx.groupMember.findMany({
      where: { groupId: invite.groupId, leftAt: null },
      select: { userId: true },
    });

    await createNotifications(tx, {
      type: "MEMBER_JOINED",
      actorId: userId,
      recipientIds: activeMembers.map((member) => member.userId),
      payload: { groupId: invite.groupId, groupName: group.name },
    });

    return membership;
  });
}

// Grup detay sayfasi icin: grubun kendisi + cagiran kisinin rolu.
// listGroupsForUser'i filtrelemek yerine tek kayda giden ayri bir okuma.
export async function getGroupForUser(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!membership) {
    throw new ForbiddenError("group.not_member");
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    currency: group.currency,
    role: membership.role,
  };
}

type UpdateGroupInput = {
  name: string;
  description?: string;
};

/**
 * Grup adi ve aciklamasini gunceller. Yetki grup sahibindedir.
 *
 * currency BILEREK guncellenemez: mevcut harcama ve odemeler kendi
 * currency'lerini kayit aninda saklamis durumda ve veritabani trigger'i
 * bunlarin Group.currency ile ayni olmasini sart kosuyor. Grubun para birimini
 * sonradan degistirmek gecmis kayitlari bu kuralla celiskiye dusururdu.
 */
export async function updateGroup(
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
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
    if (membership.role !== "OWNER") {
      throw new ForbiddenError("group.owner_only");
    }

    return tx.group.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description ?? null,
      },
    });
  });
}

export type InviteStatus =
  | { valid: true; groupName: string }
  | { valid: false; reason: "NOT_FOUND" | "REVOKED" | "EXPIRED" | "EXHAUSTED" };

/**
 * Katilma sayfasi icin davetin durumunu kontrol eder - HENUZ KATILMADAN.
 * Kullanici gecersiz bir linke tiklayip once giris yapip sonra hata almasin.
 *
 * Grup adini yalnizca davet GECERLIYSE donuyoruz. Token 32 rastgele bayt
 * oldugu icin tahmin edilemez; adi gormek icin gecerli bir davete sahip
 * olmak gerekiyor.
 */
export async function getInviteStatus(rawToken: string): Promise<InviteStatus> {
  const invite = await prisma.groupInvite.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      revokedAt: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      group: { select: { name: true, deletedAt: true } },
    },
  });

  if (!invite || invite.group.deletedAt) {
    return { valid: false, reason: "NOT_FOUND" };
  }
  if (invite.revokedAt) {
    return { valid: false, reason: "REVOKED" };
  }
  if (invite.expiresAt < new Date()) {
    return { valid: false, reason: "EXPIRED" };
  }
  if (invite.useCount >= invite.maxUses) {
    return { valid: false, reason: "EXHAUSTED" };
  }

  return { valid: true, groupName: invite.group.name };
}

export async function listGroupInvites(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  // tokenHash BILEREK select edilmiyor: davetin dogrulama sirri hicbir API
  // cevabinda disari cikmamali.
  return prisma.groupInvite.findMany({
    where: { groupId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      invitedById: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeGroupInvite(userId: string, groupId: string, inviteId: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.groupInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.groupId !== groupId) {
      throw new NotFoundError("invite.not_found");
    }
    if (invite.revokedAt) {
      throw new ConflictError("invite.already_revoked");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const callerMembership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!callerMembership) {
      throw new ForbiddenError("group.not_member");
    }

    // Daveti olusturan kisi VEYA grup sahibi iptal edebilir. Harcamalardaki
    // "yalnizca olusturan kisi" kuralindan bilincli sapma: bir davet linki
    // sahibine ait finansal bir kayit degil, grubun tamamini ilgilendiren bir
    // guvenlik nesnesidir - sizan bir linkten herkes etkilenir.
    if (invite.invitedById !== userId && callerMembership.role !== "OWNER") {
      throw new ForbiddenError("invite.revoke_forbidden");
    }

    return tx.groupInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  });
}

export async function listGroupMembers(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const members = await prisma.groupMember.findMany({
    where: { groupId, leftAt: null },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { displayName: true, avatarUrl: true, hasImage: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((member) => ({
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
    hasImage: member.user.hasImage,
  }));
}

// Acik bakiyesi olan bir uye gruptan ayrilamaz/cikarilamaz - aksi halde
// "borclu ortadan kayboldu" durumu olusur ve grubun bakiyeleri artik sifira
// toplanmaz. Hesap, test edilmis calculateBalances uzerinden yapiliyor.
async function assertBalanceIsSettled(
  tx: Prisma.TransactionClient,
  groupId: string,
  userId: string,
) {
  const [expenses, settlements] = await Promise.all([
    tx.expense.findMany({
      where: { groupId, deletedAt: null },
      select: {
        paidById: true,
        amount: true,
        participants: { select: { userId: true, shareAmount: true } },
      },
    }),
    tx.settlement.findMany({
      where: { groupId, cancelledAt: null },
      select: { fromUserId: true, toUserId: true, amount: true },
    }),
  ]);

  const balance = calculateBalances(expenses, settlements).find(
    (entry) => entry.userId === userId,
  );

  if (balance && balance.amount !== 0) {
    throw new ConflictError(
      balance.amount > 0 ? "member.has_credit" : "member.has_debt",
      { amount: Math.abs(balance.amount) },
    );
  }
}

export async function leaveGroup(userId: string, groupId: string, newOwnerId?: string) {
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

    await assertBalanceIsSettled(tx, groupId, userId);

    const otherActiveMembers = await tx.groupMember.findMany({
      where: { groupId, leftAt: null, userId: { not: userId } },
      select: { userId: true },
    });

    // Grup sahibi, arkasinda uye birakarak ayriliyorsa sahipligi devretmek
    // zorunda: her grupta her zaman bir OWNER bulunmalidir.
    if (membership.role === "OWNER" && otherActiveMembers.length > 0) {
      if (!newOwnerId) {
        throw new ConflictError("group.owner_must_transfer");
      }
      const isActiveMember = otherActiveMembers.some(
        (member) => member.userId === newOwnerId,
      );
      if (!isActiveMember) {
        throw new ForbiddenError("member.transfer_target_not_active");
      }

      await tx.groupMember.updateMany({
        where: { groupId, userId: newOwnerId, leftAt: null },
        data: { role: "OWNER" },
      });
    }

    const left = await tx.groupMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    // Son aktif uye de ayrildiysa gruba artik kimse erisemez; ortada birakmak
    // yerine arsivliyoruz. Harcama/odeme kayitlari silinmiyor, sadece grup
    // deletedAt ile isaretleniyor.
    if (otherActiveMembers.length === 0) {
      await tx.group.update({
        where: { id: groupId },
        data: { deletedAt: new Date() },
      });
    }

    return left;
  });
}

export async function removeGroupMember(
  userId: string,
  groupId: string,
  targetUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const callerMembership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!callerMembership) {
      throw new ForbiddenError("group.not_member");
    }
    if (callerMembership.role !== "OWNER") {
      throw new ForbiddenError("member.remove_owner_only");
    }
    // Sahip kendini bu endpoint'le cikaramaz; aksi halde sahiplik devri
    // mantigini atlayip grubu sahipsiz birakabilirdi.
    if (targetUserId === userId) {
      throw new ConflictError("member.owner_cannot_remove_self");
    }

    const targetMembership = await tx.groupMember.findFirst({
      where: { groupId, userId: targetUserId, leftAt: null },
    });
    if (!targetMembership) {
      throw new NotFoundError("member.not_found");
    }

    await assertBalanceIsSettled(tx, groupId, targetUserId);

    return tx.groupMember.update({
      where: { id: targetMembership.id },
      data: { leftAt: new Date() },
    });
  });
}
