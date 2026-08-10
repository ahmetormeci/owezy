import type { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  splitByPercentage,
  splitEqually,
  splitExactly,
  type ExactShareInput,
  type PercentageShareInput,
  type SplitShare,
} from "@/lib/split";

type CreateExpenseBase = {
  description: string;
  amount: number;
  paidById: string;
  category?: ExpenseCategory;
  expenseDate?: Date;
};

export type CreateExpenseInput =
  | (CreateExpenseBase & { splitType: "EQUAL"; participantUserIds: string[] })
  | (CreateExpenseBase & { splitType: "EXACT"; shares: ExactShareInput[] })
  | (CreateExpenseBase & { splitType: "PERCENTAGE"; shares: PercentageShareInput[] });

function getParticipantUserIds(input: CreateExpenseInput): string[] {
  switch (input.splitType) {
    case "EQUAL":
      return input.participantUserIds;
    case "EXACT":
    case "PERCENTAGE":
      return input.shares.map((share) => share.userId);
  }
}

// split.ts fonksiyonlari framework'ten bagimsiz kalmasi icin duz Error firlatir.
// Burada API katmaninin (handleApiError) anladigi AppError ailesine ceviriyoruz.
function computeShares(amount: number, input: CreateExpenseInput): SplitShare[] {
  try {
    switch (input.splitType) {
      case "EQUAL":
        return splitEqually({ amount, participantUserIds: input.participantUserIds });
      case "EXACT":
        return splitExactly({ amount, shares: input.shares });
      case "PERCENTAGE":
        return splitByPercentage({ amount, shares: input.shares });
    }
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Bolusum hesaplanamadi");
  }
}

export async function createExpense(userId: string, groupId: string, input: CreateExpenseInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    const participantUserIds = getParticipantUserIds(input);
    const userIdsToCheck = [...new Set([userId, input.paidById, ...participantUserIds])];

    const activeMemberships = await tx.groupMember.findMany({
      where: { groupId, userId: { in: userIdsToCheck }, leftAt: null },
      select: { userId: true },
    });
    const activeUserIds = new Set(activeMemberships.map((membership) => membership.userId));
    const missingUserIds = userIdsToCheck.filter((id) => !activeUserIds.has(id));

    if (missingUserIds.length > 0) {
      throw new ForbiddenError(
        `Su kullanicilar grubun aktif uyesi degil: ${missingUserIds.join(", ")}`,
      );
    }

    // currency istemciden hic alinmiyor - her zaman grubun currency'sinden turetilir.
    const shares = computeShares(input.amount, input);

    const expense = await tx.expense.create({
      data: {
        groupId,
        paidById: input.paidById,
        createdById: userId,
        description: input.description,
        amount: input.amount,
        currency: group.currency,
        category: input.category ?? "OTHER",
        splitType: input.splitType,
        expenseDate: input.expenseDate ?? new Date(),
      },
    });

    await tx.expenseParticipant.createMany({
      data: shares.map((share) => ({
        expenseId: expense.id,
        userId: share.userId,
        shareAmount: share.amount,
      })),
    });

    return tx.expense.findUniqueOrThrow({
      where: { id: expense.id },
      include: { participants: true },
    });
  });
}
