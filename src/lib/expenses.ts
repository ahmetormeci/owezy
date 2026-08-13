import type { ExpenseCategory, Prisma, SplitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { assertActiveMemberOfGroup, assertCanModifyRecord } from "@/lib/group-access";
import { createNotifications } from "@/lib/notifications";
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

// Kullanicinin GIRDIGI yuzdeler paylarla birlikte saklanir. split.ts'ten geri
// almiyoruz cunku orasi "kim ne kadar oder" sorusunu cevapliyor; girdiyi
// ciktinin icinden gecirmek o fonksiyonlarin isi degil, bu katmanin tesisati.
// EQUAL/EXACT'ta null doner: o bolusumlerde yuzde diye bir sey yok.
function getBasisPointsByUser(input: CreateExpenseInput): Map<string, number> | null {
  if (input.splitType !== "PERCENTAGE") {
    return null;
  }
  return new Map(input.shares.map((share) => [share.userId, share.basisPoints]));
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
    // split.ts artik ValidationError firlatiyor: kodu ve parametreleri
    // (hangi kullanici, hangi toplam) zaten dogru. Yeniden sarmalarsak
    // o bilgi kaybolur, o yuzden oldugu gibi geciriyoruz.
    if (error instanceof AppError) {
      throw error;
    }
    throw new ValidationError("split.failed");
  }
}

// Harcamalarda "paidById olmak yetki VERMEZ" kurali kritik: parayi odeyen kisi
// baskasinin girdigi kaydi duzenleyemez, cunku paidById'nin kendisi de
// duzenlenebilir bir alan - aksi halde biri paidById'yi kendine cevirip o kayit
// uzerinde kalici yetki kazanabilirdi. Bu yuzden yetki yalnizca createdById'ye bakar.
const assertCanModifyExpense = (
  tx: Prisma.TransactionClient,
  groupId: string,
  expense: { createdById: string },
  userId: string,
) => assertCanModifyRecord(tx, groupId, expense, userId, "expense");

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
  // basisPoints de snapshot'a giriyor: snapshot eski bolusumun tek kalici
  // kaydi, ve yuzdeli bir harcamada "kim ne kadar odedi" ile "kim yuzde kac
  // dedi" ayri iki bilgi. Ikincisi disarida kalirsa audit log, artik
  // saklayabildigimiz bir seyi kaybediyor demektir.
  participants: { userId: string; shareAmount: number; basisPoints: number | null }[];
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
  participants: { userId: string; shareAmount: number; basisPoints: number | null }[],
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
        basisPoints: participant.basisPoints,
      }))
      .sort((a, b) => a.userId.localeCompare(b.userId)),
  };
}

export type ListExpensesOptions = {
  limit?: number;
  cursor?: string;
  includeDeleted?: boolean;
  /** Aciklamada gecen metin. Buyuk/kucuk harf ayrimi yok. */
  q?: string;
  category?: ExpenseCategory;
  /** Yalnizca cagiranin katilimci oldugu harcamalar. */
  mine?: boolean;
};

/**
 * Filtre kosulu TEK yerde kuruluyor.
 *
 * Hem listeleme hem disa aktarma bunu kullaniyor. Iki yerde ayri yazilsaydi
 * zamanla ayrisirlardi ve "ekranda gordugum 12 satiri indirdim" diyen
 * kullanici baska bir dosya alirdi.
 */
function buildExpenseWhere(
  userId: string,
  groupId: string,
  options: ListExpensesOptions,
): Prisma.ExpenseWhereInput {
  return {
    groupId,
    ...(options.includeDeleted ? {} : { deletedAt: null }),
    ...(options.q ? { description: { contains: options.q, mode: "insensitive" } } : {}),
    ...(options.category ? { category: options.category } : {}),
    // "Beni ilgilendiren" = payi olan. Odeyen olmak yetmez: baskasi adina
    // odeyip bolusume girmeyen kisinin bakiyesi degisir ama harcama onun
    // "kendi harcamasi" degildir.
    ...(options.mine ? { participants: { some: { userId } } } : {}),
  };
}

/**
 * Filtreleme SUNUCUDA yapiliyor, ekrandaki satirlarda degil.
 *
 * Liste bir seferde 20 kayit tasiyor. Yuklenmis satirlari suzseydik kullanici
 * "sonuc yok" gorurken aradigi kayit sonraki sayfada duruyor olabilirdi -
 * yani arama kutusu sessizce yalan soylerdi.
 *
 * TURKCE ARAMA SINIRI (olculdu, veritabani collation'i C.UTF-8): buyuk "I"
 * kucultuldugunde "i" oluyor, "ı" degil. Yani "Isik" yazan bir harcama "ışık"
 * aramasiyla BULUNMAZ. Diger Turkce harflerde (c/C, s/S, o/O, u/U, g/G)
 * sorun yok; "İstanbul" da "istanbul" ile eslesiyor. Duzgun cozum Turkce
 * katlama yapan uretilmis bir kolon + index - kendi basina bir is.
 * Aranan metinde "ı"yi "i"ye cevirmek COZUM DEGIL: "isi" ile "ısı"yi
 * eslestirip yanlis sonuc uretirdi.
 */
export async function listExpenses(
  userId: string,
  groupId: string,
  options: ListExpensesOptions = {},
) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const limit = Math.min(options.limit ?? DEFAULT_EXPENSE_PAGE_SIZE, MAX_EXPENSE_PAGE_SIZE);

  const where = buildExpenseWhere(userId, groupId, options);
  const isFiltered = Boolean(options.q || options.category || options.mine);

  const [rows, matches] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { participants: true },
      // Cursor sayfalamasinin dogru calismasi icin siralama BENZERSIZ olmali.
      // expenseDate tek basina yeterli degil (ayni gune birden fazla harcama
      // dusebilir), bu yuzden createdAt ve id ile kesinlestiriliyor.
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      // Bir fazla kayit cekip "daha var mi" sorusunu ek sorgu yapmadan cevapliyoruz.
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    }),
    // Sonuc ozeti yalnizca filtre varken hesaplaniyor. AYNI where kullaniliyor,
    // yani sayilan kumeyle listelenen kume ayrisamaz.
    isFiltered
      ? prisma.expense.aggregate({ where, _count: { _all: true }, _sum: { amount: true } })
      : null,
  ]);

  const hasMore = rows.length > limit;
  const expenses = hasMore ? rows.slice(0, limit) : rows;

  return {
    expenses,
    nextCursor: hasMore ? expenses[expenses.length - 1].id : null,
    // Filtre yokken null: "kac sonuc" sorusu ancak bir arama varsa anlamli.
    matches: matches
      ? { count: matches._count._all, total: matches._sum.amount ?? 0 }
      : null,
  };
}

// Duzenleme sayfasi icin tek harcama. Okuma yetkisi listeleme ile ayni:
// grubun her aktif uyesi gorebilir (duzenleyip duzenleyemeyecegi ayri konu,
// onu updateExpense kendi icinde kontrol ediyor).
export async function getExpenseForUser(
  userId: string,
  groupId: string,
  expenseId: string,
) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { participants: true },
  });

  if (!expense || expense.deletedAt || expense.groupId !== groupId) {
    throw new NotFoundError("expense.not_found");
  }

  return expense;
}

export async function createExpense(userId: string, groupId: string, input: CreateExpenseInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
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
      throw new ForbiddenError("expense.participants_not_active", {
        userIds: missingUserIds.join(", "),
      });
    }

    // currency istemciden hic alinmiyor - her zaman grubun currency'sinden turetilir.
    const shares = computeShares(input.amount, input);
    const basisPointsByUser = getBasisPointsByUser(input);

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
        basisPoints: basisPointsByUser?.get(share.userId) ?? null,
      })),
    });

    // Bildirim yalnizca KATILIMCILARA gider, tum gruba degil: harcamaya dahil
    // olmayan birinin bakiyesi degismiyor, dolayisiyla haber vermek gurultu olur.
    await createNotifications(tx, {
      type: "EXPENSE_ADDED",
      actorId: userId,
      recipientIds: shares.map((share) => share.userId),
      payload: {
        groupId,
        groupName: group.name,
        expenseId: expense.id,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
      },
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
      throw new NotFoundError("expense.not_found");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
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
      throw new ForbiddenError("expense.participants_not_active", {
        userIds: missingUserIds.join(", "),
      });
    }

    const shares = computeShares(input.amount, input);
    const basisPointsByUser = getBasisPointsByUser(input);

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

    // PERCENTAGE'dan EQUAL'a gecen bir harcamada basisPoints kendiliginden
    // null oluyor: satirlar silinip yeniden yaziliyor ve yeni girdide yuzde yok.
    await tx.expenseParticipant.createMany({
      data: shares.map((share) => ({
        expenseId,
        userId: share.userId,
        shareAmount: share.amount,
        basisPoints: basisPointsByUser?.get(share.userId) ?? null,
      })),
    });

    const newData = buildSnapshot(
      updated,
      shares.map((share) => ({
        userId: share.userId,
        shareAmount: share.amount,
        basisPoints: basisPointsByUser?.get(share.userId) ?? null,
      })),
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

    // Hem YENI hem ESKI katilimcilar haber almali: paylasimdan cikarilan kisinin
    // borcu da degisti ve bunu yalnizca bu bildirimden ogrenebilir.
    await createNotifications(tx, {
      type: "EXPENSE_UPDATED",
      actorId: userId,
      recipientIds: [
        ...shares.map((share) => share.userId),
        ...existing.participants.map((participant) => participant.userId),
      ],
      payload: {
        groupId,
        groupName: group.name,
        expenseId,
        description: updated.description,
        amount: updated.amount,
        currency: updated.currency,
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
      throw new NotFoundError("expense.not_found");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
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

    await createNotifications(tx, {
      type: "EXPENSE_DELETED",
      actorId: userId,
      recipientIds: existing.participants.map((participant) => participant.userId),
      payload: {
        groupId,
        groupName: group.name,
        expenseId,
        description: existing.description,
        amount: existing.amount,
        currency: existing.currency,
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
      throw new NotFoundError("expense.not_found");
    }
    // Yalnizca soft-delete edilmis bir harcama geri yuklenebilir.
    if (!existing.deletedAt) {
      throw new ConflictError("expense.not_deleted");
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
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

/**
 * Disa aktarma icin eslesen HER kayit.
 *
 * Sayfalama YOK ve bu bilerek: kullanici "ekranda gordugum listeyi indir"
 * bekliyor, "ilk 20'sini" degil. Sessizce kirpilmis bir mali dosya, yanlis
 * bir toplamdan daha kotudur - dosyanin eksik oldugu hicbir yerde belli olmaz.
 *
 * Filtre kosulu listelemeyle AYNI fonksiyondan geliyor (buildExpenseWhere),
 * yani indirilen kume ekrandaki kumeyle ayrisamaz.
 *
 * SINIR: bu sorgunun ustunde de limit yok. Grup sayfasi zaten butun
 * harcamalari okuyor (loadGroupFinancials), yani yeni bir sinif sorun degil;
 * ayni teknik borcun parcasi.
 */
export async function listExpensesForExport(
  userId: string,
  groupId: string,
  options: Omit<ListExpensesOptions, "limit" | "cursor"> = {},
) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  return prisma.expense.findMany({
    where: buildExpenseWhere(userId, groupId, options),
    include: { participants: true },
    // Disa aktarmada ESKIDEN YENIYE: tablo okuyan biri zaman sirasi bekler,
    // ekrandaki "en yenisi ustte" mantigi burada gecerli degil.
    orderBy: [{ expenseDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}
