import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";

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

async function assertActiveMember(userId: string, groupId: string) {
  const membership = await prisma.groupMember.findFirst({
    where: { userId, groupId, leftAt: null },
  });
  if (!membership) {
    throw new ForbiddenError("Bu grubun uyesi degilsiniz");
  }
  return membership;
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
  await assertActiveMember(userId, groupId);

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
