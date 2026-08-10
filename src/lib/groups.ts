import { randomBytes, createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";
import { calculateBalances } from "@/lib/balances";

const DEFAULT_INVITE_TTL_DAYS = 7;
const DEFAULT_INVITE_MAX_USES = 1;

type CreateGroupInput = {
  name: string;
  description?: string;
  currency?: string;
};

export async function createGroup(userId: string, input: CreateGroupInput) {
  const currency = input.currency ?? "TRY";

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
      throw new NotFoundError("Davet linki gecersiz");
    }
    if (invite.expiresAt < new Date()) {
      throw new ConflictError("Davet linkinin suresi dolmus");
    }
    if (invite.useCount >= invite.maxUses) {
      throw new ConflictError("Davet linki kullanim limitine ulasmis");
    }

    const existingMembership = await tx.groupMember.findFirst({
      where: { userId, groupId: invite.groupId, leftAt: null },
    });
    if (existingMembership) {
      throw new ConflictError("Zaten bu grubun uyesisiniz");
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

    return membership;
  });
}

export async function listGroupInvites(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("Grup bulunamadi");
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
      throw new NotFoundError("Davet bulunamadi");
    }
    if (invite.revokedAt) {
      throw new ConflictError("Bu davet zaten iptal edilmis");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    const callerMembership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!callerMembership) {
      throw new ForbiddenError("Bu grubun uyesi degilsiniz");
    }

    // Daveti olusturan kisi VEYA grup sahibi iptal edebilir. Harcamalardaki
    // "yalnizca olusturan kisi" kuralindan bilincli sapma: bir davet linki
    // sahibine ait finansal bir kayit degil, grubun tamamini ilgilendiren bir
    // guvenlik nesnesidir - sizan bir linkten herkes etkilenir.
    if (invite.invitedById !== userId && callerMembership.role !== "OWNER") {
      throw new ForbiddenError(
        "Bu daveti yalnizca olusturan kisi veya grup sahibi iptal edebilir",
      );
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
    throw new NotFoundError("Grup bulunamadi");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const members = await prisma.groupMember.findMany({
    where: { groupId, leftAt: null },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((member) => ({
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
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
      balance.amount > 0
        ? `Bu uyenin ${balance.amount} kurusluk alacagi var; once odesilmelidir`
        : `Bu uyenin ${-balance.amount} kurusluk borcu var; once odesilmelidir`,
    );
  }
}

export async function leaveGroup(userId: string, groupId: string, newOwnerId?: string) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("Bu grubun uyesi degilsiniz");
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
        throw new ConflictError(
          "Grup sahibi ayrilmadan once sahipligi baska bir uyeye devretmelidir",
        );
      }
      const isActiveMember = otherActiveMembers.some(
        (member) => member.userId === newOwnerId,
      );
      if (!isActiveMember) {
        throw new ForbiddenError("Sahipligin devredilecegi kisi grubun aktif uyesi degil");
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
      throw new NotFoundError("Grup bulunamadi");
    }

    const callerMembership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!callerMembership) {
      throw new ForbiddenError("Bu grubun uyesi degilsiniz");
    }
    if (callerMembership.role !== "OWNER") {
      throw new ForbiddenError("Uye cikarma yetkisi yalnizca grup sahibindedir");
    }
    // Sahip kendini bu endpoint'le cikaramaz; aksi halde sahiplik devri
    // mantigini atlayip grubu sahipsiz birakabilirdi.
    if (targetUserId === userId) {
      throw new ConflictError(
        "Grup sahibi kendini cikaramaz; ayrilmak icin gruptan ayrilma islemini kullanin",
      );
    }

    const targetMembership = await tx.groupMember.findFirst({
      where: { groupId, userId: targetUserId, leftAt: null },
    });
    if (!targetMembership) {
      throw new NotFoundError("Uye bulunamadi");
    }

    await assertBalanceIsSettled(tx, groupId, targetUserId);

    return tx.groupMember.update({
      where: { id: targetMembership.id },
      data: { leftAt: new Date() },
    });
  });
}
