import type { ExpenseCategory, Prisma, RecurrenceInterval, SplitType } from "@prisma/client";
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
import { guessCategory } from "@/lib/expense-category-guess";
import { nextOccurrence, startOfUtcDay } from "@/lib/recurring-dates";
import {
  MAX_CATCHUP_PER_RUN,
  MAX_TEMPLATES_PER_RUN,
} from "@/lib/recurring-schemas";
import {
  splitByPercentage,
  splitEqually,
  splitExactly,
  type ExactShareInput,
  type PercentageShareInput,
  type SplitShare,
} from "@/lib/split";

/**
 * TEKRARLAYAN HARCAMA (ADR-051).
 *
 * SABLON BIR HARCAMA DEGIL. Hicbir bakiyeye girmiyor; bakiyeye giren sey
 * bundan URETILEN Expense satirlari. Ayrimi korumak sart - sablon bakiyeye
 * girseydi "gelecekte olacak" bir borc bugunku hesaba karisirdi.
 */

type RecurringBase = {
  description: string;
  amount: number;
  paidById: string;
  category?: ExpenseCategory;
  interval: RecurrenceInterval;
  startsOn: Date;
};

export type CreateRecurringInput =
  | (RecurringBase & { splitType: "EQUAL"; participantUserIds: string[] })
  | (RecurringBase & { splitType: "EXACT"; shares: ExactShareInput[] })
  | (RecurringBase & { splitType: "PERCENTAGE"; shares: PercentageShareInput[] });

function participantsOf(input: CreateRecurringInput): string[] {
  switch (input.splitType) {
    case "EQUAL":
      return input.participantUserIds;
    case "EXACT":
    case "PERCENTAGE":
      return input.shares.map((share) => share.userId);
  }
}

function basisPointsOf(input: CreateRecurringInput): Map<string, number> | null {
  if (input.splitType !== "PERCENTAGE") return null;
  return new Map(input.shares.map((share) => [share.userId, share.basisPoints]));
}

// expenses.ts'teki computeShares ile AYNI is - ve bilerek AYNI saf
// fonksiyonlari cagiriyor. Sablonun paylari, elle girilmis bir harcamanin
// paylariyla ayni kuraldan cikmali; iki ayri hesap iki ayri sonuc demek olurdu.
function computeShares(amount: number, input: CreateRecurringInput): SplitShare[] {
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
    if (error instanceof AppError) throw error;
    throw new ValidationError("split.failed");
  }
}

export type RecurringView = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  splitType: SplitType;
  interval: RecurrenceInterval;
  startsOn: Date;
  nextRunOn: Date;
  pausedAt: Date | null;
  lastRunAt: Date | null;
  paidById: string;
  createdById: string;
  shares: { userId: string; shareAmount: number; basisPoints: number | null }[];
};

const VIEW_SELECT = {
  id: true,
  description: true,
  amount: true,
  currency: true,
  category: true,
  splitType: true,
  interval: true,
  startsOn: true,
  nextRunOn: true,
  pausedAt: true,
  lastRunAt: true,
  paidById: true,
  createdById: true,
  shares: { select: { userId: true, shareAmount: true, basisPoints: true } },
} satisfies Prisma.RecurringExpenseSelect;

export async function listRecurringExpenses(
  userId: string,
  groupId: string,
): Promise<RecurringView[]> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }
  await assertActiveMemberOfGroup(groupId, userId);

  return prisma.recurringExpense.findMany({
    where: { groupId, deletedAt: null },
    // Duraklatilmislar da geliyor: kullanicinin onlari GERI ACABILMESI icin
    // gorunmeleri sart. Duraklatilmis bir sablonu gizlemek, sistem tarafindan
    // durdurulmus bir kaydi kayip gostermek olurdu.
    orderBy: [{ nextRunOn: "asc" }, { id: "asc" }],
    select: VIEW_SELECT,
  });
}

/**
 * Sablonu kurar.
 *
 * ILK DONEMI BURADA URETMIYORUZ. startsOn bugun ya da gecmisse harcama
 * calistiricinin ilk kosusunda cikiyor. Sebep: uretimin TEK bir yolu olsun.
 * Iki yol olsaydi (kurulusta bir kez, sonra cron) ikisi zamanla ayrisirdi ve
 * "kurulusta uretilen" ile "cron'un urettigi" arasindaki fark ancak canlida
 * gorunurdu.
 */
export async function createRecurringExpense(
  userId: string,
  groupId: string,
  input: CreateRecurringInput,
): Promise<RecurringView> {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const participantUserIds = participantsOf(input);
    const toCheck = [...new Set([userId, input.paidById, ...participantUserIds])];
    const active = await tx.groupMember.findMany({
      where: { groupId, userId: { in: toCheck }, leftAt: null },
      select: { userId: true },
    });
    const activeIds = new Set(active.map((m) => m.userId));
    const missing = toCheck.filter((id) => !activeIds.has(id));
    if (missing.length > 0) {
      throw new ForbiddenError("expense.participants_not_active", {
        userIds: missing.join(", "),
      });
    }

    const shares = computeShares(input.amount, input);
    const basisPoints = basisPointsOf(input);
    const startsOn = startOfUtcDay(input.startsOn);

    const created = await tx.recurringExpense.create({
      data: {
        groupId,
        createdById: userId,
        paidById: input.paidById,
        description: input.description,
        amount: input.amount,
        // currency istemciden HIC alinmiyor - grubunkinden turetiliyor
        // (ADR-006). Veritabaninda ayrica bir tetikleyici bekliyor.
        currency: group.currency,
        category: input.category ?? guessCategory(input.description) ?? "OTHER",
        splitType: input.splitType,
        interval: input.interval,
        startsOn,
        // ILK DONEM startsOn'un KENDISI: gecmis bir tarihle kurulan sablon
        // ilk kosuda gecmisi yakaliyor.
        nextRunOn: startsOn,
        shares: {
          create: shares.map((share) => ({
            userId: share.userId,
            shareAmount: share.amount,
            basisPoints: basisPoints?.get(share.userId) ?? null,
          })),
        },
      },
      select: VIEW_SELECT,
    });

    return created;
  });
}

async function loadForModify(userId: string, groupId: string, id: string) {
  const template = await prisma.recurringExpense.findUnique({
    where: { id },
    select: { id: true, groupId: true, createdById: true, pausedAt: true, deletedAt: true },
  });
  // groupId eslesmesi burada: baska bir grubun sablonu, kendi grup kimligin
  // uzerinden degistirilemesin (varligini sizdirmamak icin 403 degil 404).
  if (!template || template.deletedAt || template.groupId !== groupId) {
    throw new NotFoundError("recurring.not_found");
  }
  await prisma.$transaction(async (tx) => {
    await assertCanModifyRecord(tx, groupId, template, userId, "recurring");
  });
  return template;
}

/** Duraklat / devam ettir. */
export async function setRecurringPaused(
  userId: string,
  groupId: string,
  id: string,
  paused: boolean,
): Promise<RecurringView> {
  const template = await loadForModify(userId, groupId, id);

  if (paused && template.pausedAt) {
    throw new ConflictError("recurring.already_paused");
  }
  if (!paused && !template.pausedAt) {
    throw new ConflictError("recurring.not_paused");
  }

  /**
   * DEVAM ETTIRIRKEN nextRunOn'a DOKUNMUYORUZ ve bu bir karar.
   *
   * Duraklatma sirasinda gecen donemler, devam edildiginde YAKALANIYOR - yani
   * uc ay duraklatilan bir kira sablonu acildiginda uc harcama uretiyor.
   * Alternatifi "gecmisi atla" idi ve o, odenmis ama kaydedilmemis uc ayi
   * sessizce yok saymak olurdu. Kullanici istemiyorsa sablonu SILIP yeniden
   * kurabiliyor; ama karar onun, bizim degil.
   */
  return prisma.recurringExpense.update({
    where: { id },
    data: { pausedAt: paused ? new Date() : null },
    select: VIEW_SELECT,
  });
}

/**
 * Sablonu siler - YUMUSAK.
 *
 * FIZIKSEL SILME MUMKUN DEGIL: uretilmis Expense satirlari bu sablona
 * isaret ediyor (Expense.recurringExpenseId, onDelete: Restrict). Yani
 * "sildim ama gecmis harcamalarim durdu" kullanicinin gorecegi davranis ve
 * semanin kendisi de bunu garanti ediyor.
 */
export async function deleteRecurringExpense(
  userId: string,
  groupId: string,
  id: string,
): Promise<void> {
  await loadForModify(userId, groupId, id);
  await prisma.recurringExpense.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Hesap silmede cagriliyor (account.ts).
 *
 * YUMUSAK SILME, cunku fiziksel silme zaten imkansiz (yukaridaki gerekce).
 * KAPSAM GENIS: kullanicinin KURDUGU, ONUN ODEDIGI ya da ICINDE OLDUGU her
 * sablon duruyor. Ucu de ayni sebeple: hesap silinince uyelikleri kapaniyor,
 * yani o sablonlar zaten uretemez hale geliyor - calistirici onlari tek tek
 * duraklatip herkese bildirim gonderirdi. Sessizce durdurmak dogru olan.
 */
export async function deactivateRecurringFor(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const result = await tx.recurringExpense.updateMany({
    where: {
      deletedAt: null,
      OR: [
        { createdById: userId },
        { paidById: userId },
        { shares: { some: { userId } } },
      ],
    },
    data: { deletedAt: new Date() },
  });
  return result.count;
}

// ============================================================
// CALISTIRICI - gunluk cron buraya giriyor
// ============================================================

export type RunReport = { templates: number; created: number; paused: number };

/**
 * Vadesi gelmis sablonlari harcamaya donusturur.
 *
 * KIMLIK DOGRULAMASI BURADA DEGIL: bu fonksiyon oturum bilmiyor. Yetkiyi
 * cagiran uc yapiyor (api/cron/recurring) ve orasi CRON_SECRET olmadan
 * calismayi REDDEDIYOR.
 */
export async function runDueRecurringExpenses(now: Date = new Date()): Promise<RunReport> {
  const today = startOfUtcDay(now);

  const due = await prisma.recurringExpense.findMany({
    where: {
      nextRunOn: { lte: today },
      pausedAt: null,
      deletedAt: null,
      group: { deletedAt: null },
    },
    orderBy: { nextRunOn: "asc" },
    take: MAX_TEMPLATES_PER_RUN,
    select: { id: true },
  });

  let created = 0;
  let paused = 0;
  for (const row of due) {
    const outcome = await runOneTemplate(row.id, today);
    created += outcome.created;
    if (outcome.paused) paused += 1;
  }

  return { templates: due.length, created, paused };
}

async function runOneTemplate(
  id: string,
  today: Date,
): Promise<{ created: number; paused: boolean }> {
  let created = 0;

  for (let round = 0; round < MAX_CATCHUP_PER_RUN; round += 1) {
    const template = await prisma.recurringExpense.findUnique({
      where: { id },
      select: {
        ...VIEW_SELECT,
        groupId: true,
        group: { select: { name: true, deletedAt: true } },
      },
    });

    // Durum HER TURDA yeniden okunuyor: arada duraklatilmis ya da silinmis
    // olabilir ve yakalama dongusu bunu fark etmeli.
    if (!template || template.group.deletedAt || template.pausedAt) {
      return { created, paused: false };
    }
    if (template.nextRunOn > today) {
      return { created, paused: false };
    }

    const needed = [
      ...new Set([template.paidById, ...template.shares.map((share) => share.userId)]),
    ];
    const active = await prisma.groupMember.findMany({
      where: { groupId: template.groupId, userId: { in: needed }, leftAt: null },
      select: { userId: true },
    });
    const activeIds = new Set(active.map((member) => member.userId));
    const missing = needed.filter((userId) => !activeIds.has(userId));

    if (missing.length > 0) {
      /**
       * KATILIMCILARDAN BIRI GRUPTA DEGIL - SABLON DURUYOR.
       *
       * Alternatif o kisiyi bolusumden CIKARMAKTI ve kabul edilemez: parayi
       * kimseye sormadan YENIDEN DAGITMAK demek. Ayrilan kisinin payi
       * kalanlarin uzerine binerdi ve bunu ancak bakiyeye bakan biri fark
       * ederdi.
       */
      await pauseForMissingMember(template.id, template.createdById, missing[0], {
        groupId: template.groupId,
        groupName: template.group.name,
        description: template.description,
      });
      return { created, paused: true };
    }

    const occurrence = template.nextRunOn;
    const upcoming = nextOccurrence(template.startsOn, occurrence, template.interval);

    const didCreate = await claimAndCreate(template, occurrence, upcoming);
    if (!didCreate) {
      // Baska bir kosu ayni donemi almis. Cift uretim OLMADI - istenen bu.
      return { created, paused: false };
    }
    created += 1;
  }

  // Sinira dayanildi; kalan donemler bir sonraki kosuda uretilecek.
  return { created, paused: false };
}

type TemplateForRun = RecurringView & {
  groupId: string;
  group: { name: string; deletedAt: Date | null };
};

/**
 * Donemi SAHIPLENIR ve harcamayi yazar - ikisi tek transaction'da.
 *
 * CIFT URETIM KORUMASI compare-and-set: nextRunOn'u "hala bekledigim deger
 * mi" kosuluyla ilerletiyoruz. Iki kosu ayni anda calisirsa ikincisinin
 * updateMany'si SIFIR satir gunceller ve transaction geri alinir. Bu,
 * ADR-032'nin surum sayaciyla ayni fikir - kilidi Postgres'e yaptiriyoruz.
 *
 * Kosula pausedAt ve deletedAt de giriyor: sablon okuduktan sonra
 * duraklatilmis ya da silinmis olabilir.
 */
async function claimAndCreate(
  template: TemplateForRun,
  occurrence: Date,
  upcoming: Date,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.recurringExpense.updateMany({
        where: {
          id: template.id,
          nextRunOn: occurrence,
          pausedAt: null,
          deletedAt: null,
        },
        data: { nextRunOn: upcoming, lastRunAt: new Date() },
      });
      if (claim.count === 0) {
        throw new AlreadyClaimed();
      }

      const expense = await tx.expense.create({
        data: {
          groupId: template.groupId,
          paidById: template.paidById,
          // OLUSTURAN SABLONU KURAN KISI: uretilen kaydi duzenleme yetkisi
          // (ADR-009) boylece dogru kiside kaliyor.
          createdById: template.createdById,
          description: template.description,
          amount: template.amount,
          currency: template.currency,
          category: template.category,
          splitType: template.splitType,
          // TARIH DONEMIN TARIHI, bugun degil. Yakalama sirasinda uretilen
          // gecmis donemler dogru aya dusuyor.
          expenseDate: occurrence,
          recurringExpenseId: template.id,
        },
      });

      await tx.expenseParticipant.createMany({
        data: template.shares.map((share) => ({
          expenseId: expense.id,
          userId: share.userId,
          shareAmount: share.shareAmount,
          basisPoints: share.basisPoints,
        })),
      });

      /**
       * BILDIRIM KATILIMCILARA - sablonu kuran HARIC (createNotifications
       * actorId'yi eliyor). Kuran kisi zaten bu takvimi kendisi kurdu;
       * her donem ona haber vermek, kendi kurdugu saatin calmasi olurdu.
       */
      await createNotifications(tx, {
        type: "EXPENSE_RECURRED",
        actorId: template.createdById,
        recipientIds: template.shares.map((share) => share.userId),
        payload: {
          groupId: template.groupId,
          groupName: template.group.name,
          expenseId: expense.id,
          description: template.description,
          amount: template.amount,
          currency: template.currency,
        },
      });
    });
    return true;
  } catch (error) {
    if (error instanceof AlreadyClaimed) return false;
    throw error;
  }
}

/** Yalnizca claimAndCreate'in ic isareti; disari cikmiyor. */
class AlreadyClaimed extends Error {}

async function pauseForMissingMember(
  id: string,
  createdById: string,
  missingUserId: string,
  payload: { groupId: string; groupName: string; description: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const paused = await tx.recurringExpense.updateMany({
      where: { id, pausedAt: null, deletedAt: null },
      data: { pausedAt: new Date() },
    });
    // Zaten duraklatilmissa ikinci bir bildirim gondermiyoruz.
    if (paused.count === 0) return;

    /**
     * ISLEMI YAPAN olarak AYRILAN KISI geciyor ve bu bir tercih: cumlenin
     * bir OZNESI olmali ("Ayse gruptan ayrildigi icin ... duraklatildi").
     * Ayrilan kisi sablonu kuran kisiyse kendisine bildirim gitmiyor -
     * createNotifications actorId'yi eliyor - ve dogrusu da bu: gruptan
     * ayrilan kisiye o grubun takvimi hakkinda haber vermek anlamsiz.
     */
    await createNotifications(tx, {
      type: "RECURRING_PAUSED",
      actorId: missingUserId,
      recipientIds: [createdById],
      payload: {
        groupId: payload.groupId,
        groupName: payload.groupName,
        description: payload.description,
      },
    });
  });
}
