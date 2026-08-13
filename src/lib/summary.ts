// Grup ozeti: "para nereye gitti" ve "benim bakiyem neden bu".
//
// Dosyanin ust kismi SAF: DB, HTTP veya Prisma bilmiyor. balances.ts ve
// split.ts ile ayni prensip - butun tutarlar kurus cinsinden tam sayi,
// hicbir adimda kesirli ara deger uretilmiyor.

import type { ExpenseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";
import { loadGroupFinancials } from "@/lib/balances";
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

export function calculateGroupSummary(
  expenses: ExpenseForSummary[],
  settlements: SettlementForSummary[],
  userId: string,
): GroupSummary {
  let totalAmount = 0;
  let myPaid = 0;
  let myShare = 0;

  const categoryTotals = new Map<ExpenseCategory, number>();
  const monthTotals = new Map<string, { amount: number; count: number }>();

  for (const expense of expenses) {
    totalAmount += expense.amount;

    if (expense.paidById === userId) {
      myPaid += expense.amount;
    }
    for (const participant of expense.participants) {
      if (participant.userId === userId) {
        myShare += participant.shareAmount;
      }
    }

    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount,
    );

    const key = monthKey(expense.expenseDate);
    const month = monthTotals.get(key) ?? { amount: 0, count: 0 };
    month.amount += expense.amount;
    month.count += 1;
    monthTotals.set(key, month);
  }

  let mySettlementsOut = 0;
  let mySettlementsIn = 0;
  for (const settlement of settlements) {
    if (settlement.fromUserId === userId) {
      mySettlementsOut += settlement.amount;
    }
    if (settlement.toUserId === userId) {
      mySettlementsIn += settlement.amount;
    }
  }

  // calculateBalances ile AYNI formul. Orada kisi basina toplaniyor, burada
  // yalnizca bir kisi icin - sonuc ayni olmak zorunda.
  const myBalance = myPaid - myShare + mySettlementsOut - mySettlementsIn;

  // Buyukten kucuge; esitlikte kategori adiyla kesinlestiriliyor ki ayni girdi
  // her zaman ayni sirayi uretsin.
  const byCategory = [...categoryTotals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      basisPoints: shareInBasisPoints(amount, totalAmount),
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  // Yeniden eskiye - harcama listesiyle ayni siralama. "2026-08" bicimi metin
  // olarak siralandiginda da kronolojik, cunku alanlar sabit genislikte.
  const byMonth = [...monthTotals.entries()]
    .map(([month, totals]) => ({ month, ...totals }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    totalAmount,
    expenseCount: expenses.length,
    myPaid,
    myShare,
    mySettlementsOut,
    mySettlementsIn,
    myBalance,
    byCategory,
    byMonth,
  };
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

  // Ayni istekte getGroupBalances de bunu cagiriyor; cache() sayesinde
  // veritabanina tek sorgu gidiyor.
  const { expenses, settlements } = await loadGroupFinancials(groupId);

  return {
    // currency istemciden degil, her zaman grubun kaydindan.
    currency: group.currency,
    ...calculateGroupSummary(expenses, settlements, userId),
  };
}
