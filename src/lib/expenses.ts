import type { ExpenseCategory, Prisma, SplitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  DEFAULT_EXPENSE_PAGE_SIZE,
  MAX_EXPENSE_PAGE_SIZE,
} from "@/lib/expense-schemas";
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

// Guncelleme "tam degistirme" semantigi tasir: istemci harcamanin tam halini
// gonderir, bu yuzden govde olusturma ile ayni sekle sahiptir.
export type UpdateExpenseInput = CreateExpenseInput;

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

// Bir harcama uzerinde (update / delete / restore) kimin islem yapabilecegi:
//
//   1. Kayit sahibi (createdById) - grubun aktif uyesi olmak sartiyla.
//      paidById olmak yetki VERMEZ: parayi odeyen kisi baskasinin girdigi
//      kaydi duzenleyemez, cunku paidById'nin kendisi de duzenlenebilir bir
//      alan - aksi halde biri paidById'yi kendine cevirip yetki kazanabilirdi.
//
//   2. Grup OWNER'i - YALNIZCA kaydi olusturan kisi artik grubun aktif uyesi
//      degilse (ayrildi veya cikarildi). Bu, sahibi gitmis kayitlarin sonsuza
//      kadar kilitli kalmasini onleyen tek istisnadir. Olusturan kisi grupta
//      oldugu surece OWNER dahil hic kimse onun kaydina dokunamaz.
// Okuma islemleri icin: grubun aktif uyesi olan herkes harcamalari gorebilir.
// (Yazma islemlerindeki "yalnizca olusturan kisi" kisiti okumada gecerli degil -
// grubun butun harcamalarini gormek, uygulamanin temel amaci.)
async function assertActiveMemberOfGroup(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!membership) {
    throw new ForbiddenError("Bu grubun uyesi degilsiniz");
  }
}

async function assertCanModifyExpense(
  tx: Prisma.TransactionClient,
  groupId: string,
  expense: { createdById: string },
  userId: string,
) {
  const callerMembership = await tx.groupMember.findFirst({
    where: { groupId, userId, leftAt: null },
  });
  if (!callerMembership) {
    throw new ForbiddenError("Bu grubun uyesi degilsiniz");
  }

  if (expense.createdById === userId) {
    return;
  }

  const creatorMembership = await tx.groupMember.findFirst({
    where: { groupId, userId: expense.createdById, leftAt: null },
  });
  if (creatorMembership) {
    throw new ForbiddenError(
      "Bu harcama uzerinde yalnizca onu olusturan kisi islem yapabilir",
    );
  }

  if (callerMembership.role !== "OWNER") {
    throw new ForbiddenError(
      "Harcamayi olusturan kisi gruptan ayrildi; bu kayit uzerinde yalnizca grup sahibi islem yapabilir",
    );
  }
}

// ExpenseEdit.previousData / newData icin kullanilan anlik goruntu.
// ExpenseParticipant satirlari guncellemede fiziksel olarak silinip yeniden
// yazildigi icin, eski bolusumun tek kalici kaydi bu snapshot'tir.
type ExpenseSnapshot = {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  splitType: SplitType;
  expenseDate: string;
  paidById: string;
  // Silinme durumu da snapshot'in parcasi: RESTORE audit kaydinda previousData
  // (silinmis hal) ile newData (geri yuklenmis hal) ancak bu alanlar sayesinde
  // birbirinden ayirt edilebiliyor.
  deletedAt: string | null;
  deletedById: string | null;
  participants: { userId: string; shareAmount: number }[];
};

type SnapshotExpenseFields = {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  splitType: SplitType;
  expenseDate: Date;
  paidById: string;
  deletedAt: Date | null;
  deletedById: string | null;
};

function buildSnapshot(
  expense: SnapshotExpenseFields,
  participants: { userId: string; shareAmount: number }[],
): ExpenseSnapshot {
  return {
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    splitType: expense.splitType,
    // expenseDate kolonu @db.Date (saatsiz), snapshot'ta da saatsiz tutuluyor.
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    paidById: expense.paidById,
    deletedAt: expense.deletedAt ? expense.deletedAt.toISOString() : null,
    deletedById: expense.deletedById ?? null,
    // Iki snapshot karsilastirilirken sadece sira farkindan kaynaklanan sahte
    // "degisiklik" gorunmesin diye userId'ye gore deterministik siralaniyor.
    participants: participants
      .map((participant) => ({
        userId: participant.userId,
        shareAmount: participant.shareAmount,
      }))
      .sort((a, b) => a.userId.localeCompare(b.userId)),
  };
}

export type ListExpensesOptions = {
  limit?: number;
  cursor?: string;
  includeDeleted?: boolean;
};

export async function listExpenses(
  userId: string,
  groupId: string,
  options: ListExpensesOptions = {},
) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("Grup bulunamadi");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const limit = Math.min(options.limit ?? DEFAULT_EXPENSE_PAGE_SIZE, MAX_EXPENSE_PAGE_SIZE);

  const rows = await prisma.expense.findMany({
    where: {
      groupId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
    },
    include: { participants: true },
    // Cursor sayfalamasinin dogru calismasi icin siralama BENZERSIZ olmali.
    // expenseDate tek basina yeterli degil (ayni gune birden fazla harcama
    // dusebilir), bu yuzden createdAt ve id ile kesinlestiriliyor.
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    // Bir fazla kayit cekip "daha var mi" sorusunu ek sorgu yapmadan cevapliyoruz.
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const expenses = hasMore ? rows.slice(0, limit) : rows;

  return {
    expenses,
    nextCursor: hasMore ? expenses[expenses.length - 1].id : null,
  };
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

export async function updateExpense(
  userId: string,
  groupId: string,
  expenseId: string,
  input: UpdateExpenseInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { participants: true },
    });

    // Soft-delete edilmis harcama guncellenemez. groupId eslesmesi de burada
    // kontrol ediliyor: baska bir grubun harcamasi, kendi grup ID'n uzerinden
    // duzenlenemesin (varligini sizdirmamak icin 403 degil 404 donuyoruz).
    if (!existing || existing.deletedAt || existing.groupId !== groupId) {
      throw new NotFoundError("Harcama bulunamadi");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    await assertCanModifyExpense(tx, groupId, existing, userId);

    // Snapshot, participant satirlari silinmeden ONCE aliniyor.
    const previousData = buildSnapshot(existing, existing.participants);

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

    const shares = computeShares(input.amount, input);

    // Tam degistirme: eski paylarin tamami silinip yenileri yaziliyor. Bu ayni
    // zamanda "SUM(shareAmount) = amount" trigger'inin her guncellemede
    // calismasini garanti ediyor (trigger yalnizca ExpenseParticipant
    // degisikliklerinde tetiklenir, Expense.amount degisiminde degil).
    await tx.expenseParticipant.deleteMany({ where: { expenseId } });

    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        description: input.description,
        amount: input.amount,
        paidById: input.paidById,
        // Opsiyonel alanlar gonderilmezse mevcut deger korunur (sifirlanmaz).
        category: input.category ?? existing.category,
        splitType: input.splitType,
        expenseDate: input.expenseDate ?? existing.expenseDate,
      },
    });

    await tx.expenseParticipant.createMany({
      data: shares.map((share) => ({
        expenseId,
        userId: share.userId,
        shareAmount: share.amount,
      })),
    });

    const newData = buildSnapshot(
      updated,
      shares.map((share) => ({ userId: share.userId, shareAmount: share.amount })),
    );

    // Audit kaydi ayni transaction icinde yaziliyor: transaction geri alinirsa
    // log da geri alinir, yani "olmayan bir degisikligin kaydi" olusmaz.
    // ExpenseEdit satirlari hicbir zaman UPDATE/DELETE edilmez (immutable log).
    await tx.expenseEdit.create({
      data: {
        expenseId,
        action: "UPDATE",
        previousData,
        newData,
        changedById: userId,
      },
    });

    return tx.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { participants: true },
    });
  });
}

export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { participants: true },
    });

    // Zaten silinmis bir harcama tekrar silinemez; baska grubun harcamasi da
    // kendi grup ID'n uzerinden silinemez (varligini sizdirmamak icin 404).
    if (!existing || existing.deletedAt || existing.groupId !== groupId) {
      throw new NotFoundError("Harcama bulunamadi");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    await assertCanModifyExpense(tx, groupId, existing, userId);

    const previousData = buildSnapshot(existing, existing.participants);

    // Fiziksel silme YOK: yalnizca deletedAt/deletedById isaretleniyor.
    // ExpenseParticipant satirlarina da dokunulmuyor - hem paylar korunuyor
    // hem de "SUM(shareAmount) = amount" trigger'i bozulmuyor.
    await tx.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date(), deletedById: userId },
    });

    // action = DELETE -> yalnizca previousData dolu (newData hic yazilmaz).
    await tx.expenseEdit.create({
      data: {
        expenseId,
        action: "DELETE",
        previousData,
        changedById: userId,
      },
    });

    return tx.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { participants: true },
    });
  });
}

export async function restoreExpense(userId: string, groupId: string, expenseId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { participants: true },
    });

    if (!existing || existing.groupId !== groupId) {
      throw new NotFoundError("Harcama bulunamadi");
    }
    // Yalnizca soft-delete edilmis bir harcama geri yuklenebilir.
    if (!existing.deletedAt) {
      throw new ConflictError("Harcama zaten silinmemis");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("Grup bulunamadi");
    }

    await assertCanModifyExpense(tx, groupId, existing, userId);

    const previousData = buildSnapshot(existing, existing.participants);

    const restored = await tx.expense.update({
      where: { id: expenseId },
      data: { deletedAt: null, deletedById: null },
    });

    // Paylar silme/geri yukleme sirasinda hic degismedigi icin ayni listeyi
    // kullaniyoruz; iki snapshot yalnizca deletedAt/deletedById'de farklilasir.
    const newData = buildSnapshot(restored, existing.participants);

    // action = RESTORE -> previousData (silinmis hal) ve newData (geri yuklenen hal) dolu.
    await tx.expenseEdit.create({
      data: {
        expenseId,
        action: "RESTORE",
        previousData,
        newData,
        changedById: userId,
      },
    });

    return tx.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { participants: true },
    });
  });
}
