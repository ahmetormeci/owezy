// Grup ozeti: "para nereye gitti" ve "benim bakiyem neden bu".
//
// Dosyanin ust kismi SAF: DB, HTTP veya Prisma bilmiyor. balances.ts ve
// split.ts ile ayni prensip - butun tutarlar kurus cinsinden tam sayi,
// hicbir adimda kesirli ara deger uretilmiyor.

import type { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";
import { loadGroupTotals, type UserTotals } from "@/lib/balances";
import { BASIS_POINTS_TOTAL } from "@/lib/split";

export type ExpenseForSummary = {
  paidById: string;
  amount: number;
  expenseDate: Date;
  category: ExpenseCategory;
  participants: { userId: string; shareAmount: number }[];
};

export type SettlementForSummary = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type CategorySlice = {
  category: ExpenseCategory;
  amount: number;
  /** Grubun toplamindaki payi. 10000 = %100. */
  basisPoints: number;
};

export type MonthSlice = {
  /** "2026-08". Gosterim icin degil, ANAHTAR - bicimlendirme dates.ts'te. */
  month: string;
  amount: number;
  count: number;
};

export type GroupSummary = {
  totalAmount: number;
  expenseCount: number;

  // Bakiyenin acilimi. Dordu asagidaki formulle birlesince myBalance cikar ve
  // bu deger calculateBalances'in ayni kullanici icin urettigiyle BIREBIR
  // ayni olmak zorunda - bir test bunu koruyor.
  myPaid: number;
  myShare: number;
  mySettlementsOut: number;
  mySettlementsIn: number;
  myBalance: number;

  byCategory: CategorySlice[];
  byMonth: MonthSlice[];
};

/**
 * Bir parcanin butun icindeki payini basis point olarak verir (10000 = %100).
 *
 * Float bolmesi YOK: bolumun tam kismi ve kalani ayri hesaplanip yakina
 * yuvarlaniyor (split.ts'teki inferBasisPoints ile ayni kalip). Carpim en
 * fazla 2^31 * 10^4 ~ 2.1e13, guvenli tam sayi araliginin cok altinda.
 */
function shareInBasisPoints(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  const scaled = part * BASIS_POINTS_TOTAL;
  const floor = Math.floor(scaled / whole);
  const remainder = scaled - floor * whole;
  return remainder * 2 >= whole ? floor + 1 : floor;
}

/**
 * Harcamanin ayini "2026-08" bicimine indirir.
 *
 * toISOString kullaniliyor, getFullYear/getMonth DEGIL. Expense.expenseDate
 * kolonu @db.Date (saatsiz) ve Prisma bunu UTC gece yarisi olarak donduruyor.
 * Yerel saat dilimi UTC'nin gerisindeyse (Amerika) getMonth() bir onceki ayi
 * verir ve ayin ilk gunundeki harcamalar yanlis aya duser.
 */
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Ozetin ham girdisi: her sey ONCEDEN toplanmis.
 *
 * Kategori ve gun kirilimleri veritabanindan GROUP BY ile geliyor; donen satir
 * sayisi harcama sayisina degil, farkli kategori ve farkli gun sayisina bagli.
 * Gun bazinda gelip aya burada katlaniyor, cunku Prisma groupBy tarihi aya
 * indiremiyor - ham SQL yazmak yerine bir kademe kucuk gruplayip bellekte
 * toplamak hem daha basit hem tipli kaliyor.
 */
export type SummaryAggregates = {
  totalAmount: number;
  expenseCount: number;
  /** Cagiran kisinin dort hareketi. */
  mine: UserTotals;
  byCategory: { category: ExpenseCategory; amount: number }[];
  byDay: { date: Date; amount: number; count: number }[];
};

/**
 * OZETIN TEK HESAP YERI. Girdi ozetlenmis oldugu icin harcama sayisindan
 * bagimsiz; toplamayi ister veritabani yapsin ister bellek, sonuc buradan
 * geciyor.
 */
export function buildGroupSummary(input: SummaryAggregates): GroupSummary {
  const { mine, totalAmount } = input;

  // calculateBalancesFromTotals ile AYNI formul. Orada herkes icin, burada
  // yalnizca cagiran icin - sonuc ayni olmak zorunda, bir test bunu koruyor.
  const myBalance = mine.paid - mine.share + mine.settledOut - mine.settledIn;

  // Buyukten kucuge; esitlikte kategori adiyla kesinlestiriliyor ki ayni girdi
  // her zaman ayni sirayi uretsin.
  const byCategory = input.byCategory
    .map((slice) => ({
      category: slice.category,
      amount: slice.amount,
      basisPoints: shareInBasisPoints(slice.amount, totalAmount),
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const monthTotals = new Map<string, { amount: number; count: number }>();
  for (const day of input.byDay) {
    const key = monthKey(day.date);
    const month = monthTotals.get(key) ?? { amount: 0, count: 0 };
    month.amount += day.amount;
    month.count += day.count;
    monthTotals.set(key, month);
  }

  // Yeniden eskiye - harcama listesiyle ayni siralama. "2026-08" bicimi metin
  // olarak siralandiginda da kronolojik, cunku alanlar sabit genislikte.
  const byMonth = [...monthTotals.entries()]
    .map(([month, totals]) => ({ month, ...totals }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    totalAmount,
    expenseCount: input.expenseCount,
    myPaid: mine.paid,
    myShare: mine.share,
    mySettlementsOut: mine.settledOut,
    mySettlementsIn: mine.settledIn,
    myBalance,
    byCategory,
    byMonth,
  };
}

/**
 * Ham satirlardan ozet. Toplamayi bellekte yapar ve buildGroupSummary'ye verir.
 *
 * Servis katmani artik bu yolu kullanmiyor (toplama veritabaninda yapiliyor),
 * ama fonksiyon duruyor: ozetin butun davranisi bunun uzerinden test ediliyor
 * ve iki yolun ayni sonucu verdigini bir test dogruluyor.
 */
export function calculateGroupSummary(
  expenses: ExpenseForSummary[],
  settlements: SettlementForSummary[],
  userId: string,
): GroupSummary {
  let totalAmount = 0;
  const mine: UserTotals = { userId, paid: 0, share: 0, settledOut: 0, settledIn: 0 };

  const categoryTotals = new Map<ExpenseCategory, number>();
  const dayTotals = new Map<number, { date: Date; amount: number; count: number }>();

  for (const expense of expenses) {
    totalAmount += expense.amount;

    if (expense.paidById === userId) {
      mine.paid += expense.amount;
    }
    for (const participant of expense.participants) {
      if (participant.userId === userId) {
        mine.share += participant.shareAmount;
      }
    }

    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount,
    );

    const dayKey = expense.expenseDate.getTime();
    const day = dayTotals.get(dayKey) ?? { date: expense.expenseDate, amount: 0, count: 0 };
    day.amount += expense.amount;
    day.count += 1;
    dayTotals.set(dayKey, day);
  }

  for (const settlement of settlements) {
    if (settlement.fromUserId === userId) {
      mine.settledOut += settlement.amount;
    }
    if (settlement.toUserId === userId) {
      mine.settledIn += settlement.amount;
    }
  }

  return buildGroupSummary({
    totalAmount,
    expenseCount: expenses.length,
    mine,
    byCategory: [...categoryTotals.entries()].map(([category, amount]) => ({
      category,
      amount,
    })),
    byDay: [...dayTotals.values()],
  });
}

// ============================================================
// SERVIS KATMANI
// ============================================================

export async function getGroupSummary(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const where = { groupId, deletedAt: null };

  const [totals, overall, categoryRows, dayRows] = await Promise.all([
    // Ayni istekte getGroupBalances de bunu cagiriyor; cache() sayesinde
    // veritabanina tek kez gidiyor.
    loadGroupTotals(groupId),
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
    }),
    // Gun bazinda: Prisma groupBy tarihi aya indiremiyor, aya katlama
    // buildGroupSummary'de yapiliyor. Donen satir sayisi farkli GUN sayisi
    // kadar - harcama sayisi kadar degil.
    prisma.expense.groupBy({
      by: ["expenseDate"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  // Hic hareketi olmayan kullanici loadGroupTotals'ta hic gorunmez; o durumda
  // dort hareketi de sifir.
  const mine = totals.find((entry) => entry.userId === userId) ?? {
    userId,
    paid: 0,
    share: 0,
    settledOut: 0,
    settledIn: 0,
  };

  return {
    // currency istemciden degil, her zaman grubun kaydindan.
    currency: group.currency,
    ...buildGroupSummary({
      totalAmount: overall._sum.amount ?? 0,
      expenseCount: overall._count._all,
      mine,
      byCategory: categoryRows.map((row) => ({
        category: row.category,
        amount: row._sum.amount ?? 0,
      })),
      byDay: dayRows.map((row) => ({
        date: row.expenseDate,
        amount: row._sum.amount ?? 0,
        count: row._count._all,
      })),
    }),
  };
}
