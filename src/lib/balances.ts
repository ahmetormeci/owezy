// Bakiye hesaplamalari.
//
// Bu dosyanin ust kismi (calculateBalances / simplifyDebts) DB, HTTP veya
// Prisma'dan tamamen bagimsiz SAF fonksiyonlardir; split.ts ile ayni prensip:
// tum tutarlar en kucuk para birimi cinsinden (kurus) tam sayidir, hicbir
// adimda kesirli deger uretilmez.
//
// Dosyanin sonundaki getGroupBalances ise servis katmanidir: veriyi ceker ve
// bu saf fonksiyonlara verir.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";

export type ExpenseForBalance = {
  paidById: string;
  amount: number;
  participants: { userId: string; shareAmount: number }[];
};

export type SettlementForBalance = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type UserBalance = {
  userId: string;
  // Pozitif: bu kisiye borclular (alacakli). Negatif: bu kisi borclu.
  amount: number;
};

export type SuggestedTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

/** Bir kullanicinin gruptaki dort hareketi. Bakiye bunlardan cikar. */
export type UserTotals = {
  userId: string;
  /** Odedigi harcamalarin toplami. */
  paid: number;
  /** Paylarinin toplami. */
  share: number;
  /** Yaptigi odemeler. */
  settledOut: number;
  /** Aldigi odemeler. */
  settledIn: number;
};

/**
 * PARA KURALININ TEK YERI:
 *   bakiye = odedigi - payi + yaptigi odemeler - aldigi odemeler
 *
 * Girdi ozetlenmis oldugu icin bu fonksiyon kac harcama oldugundan bagimsiz:
 * 10 harcamali grupta da 10.000 harcamali grupta da kisi sayisi kadar satir
 * aliyor. Toplamayi kim yaparsa yapsin (bellekte calculateBalances, ya da
 * veritabaninda SUM/GROUP BY) sonuc buradan geciyor.
 *
 * Ciktida bakiyesi tam sifir olan kullanicilar da yer alir ("odesmis" bilgisi
 * de gosterilmeye deger); filtrelemek isteyen cagiran katman filtreler.
 */
export function calculateBalancesFromTotals(totals: UserTotals[]): UserBalance[] {
  return (
    totals
      .map((entry) => ({
        userId: entry.userId,
        amount: entry.paid - entry.share + entry.settledOut - entry.settledIn,
      }))
      // Alacaklidan borcluya dogru siralanir; esitlikte userId ile
      // kesinlestirilir ki ayni girdi her zaman ayni sirayi uretsin.
      .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId))
  );
}

/**
 * Ham satirlardan bakiye. Toplamayi bellekte yapar ve sonucu
 * calculateBalancesFromTotals'a verir - hesabin kendisi orada.
 *
 * Yalnizca silinmemis harcamalar ve iptal edilmemis odemeler verilmelidir;
 * filtreleme cagiran katmanin sorumlulugudur.
 */
export function calculateBalances(
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): UserBalance[] {
  const totals = new Map<string, UserTotals>();

  const entryFor = (userId: string): UserTotals => {
    let entry = totals.get(userId);
    if (!entry) {
      entry = { userId, paid: 0, share: 0, settledOut: 0, settledIn: 0 };
      totals.set(userId, entry);
    }
    return entry;
  };

  for (const expense of expenses) {
    // Parayi odeyen kisi tutarin tamamini "alacak" yazar...
    entryFor(expense.paidById).paid += expense.amount;
    // ...ve her katilimci kendi payi kadar borclanir. Odeyen kisi katilimci
    // olmak zorunda degil (baskasi adina odeme senaryosu).
    for (const participant of expense.participants) {
      entryFor(participant.userId).share += participant.shareAmount;
    }
  }

  for (const settlement of settlements) {
    entryFor(settlement.fromUserId).settledOut += settlement.amount;
    entryFor(settlement.toUserId).settledIn += settlement.amount;
  }

  return calculateBalancesFromTotals([...totals.values()]);
}

/**
 * Borclari en az sayida transferle kapatan bir plan uretir (acgozlu eslestirme:
 * en buyuk borclu, en buyuk alacakliyla eslestirilir).
 *
 * En fazla (kisi sayisi - 1) transfer uretir ve sonuc her zaman DOGRUDUR
 * (herkes tam olarak hak ettigi yerde biter). Ancak her girdide mutlak minimum
 * transfer sayisini garanti etmez: gercek minimumu bulmak NP-zor bir problemdir
 * ve pratikte aradaki fark tipik olarak sifir ya da bir transferdir.
 *
 * Bakiyelerin toplami tam sifir ve hepsi tam sayi oldugu icin bu hesapta hic
 * yuvarlama yapilmaz - kurus kaybi imkansizdir.
 */
export function simplifyDebts(balances: UserBalance[]): SuggestedTransfer[] {
  const total = balances.reduce((sum, balance) => sum + balance.amount, 0);
  if (total !== 0) {
    // Bu bir veri butunlugu hatasidir: bir yerde para "yaratilmis" veya "yok
    // olmus" demektir. Sessizce yanlis transfer uretmektense yuksek sesle patlat.
    throw new Error(`bakiyelerin toplamı sıfır olmalıdır, bulunan: ${total}`);
  }

  const debtors = balances
    .filter((balance) => balance.amount < 0)
    .map((balance) => ({ userId: balance.userId, remaining: -balance.amount }))
    .sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));

  const creditors = balances
    .filter((balance) => balance.amount > 0)
    .map((balance) => ({ userId: balance.userId, remaining: balance.amount }))
    .sort((a, b) => b.remaining - a.remaining || a.userId.localeCompare(b.userId));

  const transfers: SuggestedTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount,
    });

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) debtorIndex++;
    if (creditor.remaining === 0) creditorIndex++;
  }

  return transfers;
}

// ============================================================
// SERVIS KATMANI
// ============================================================

export type GroupBalanceEntry = UserBalance & {
  displayName: string;
  avatarUrl: string | null;
  hasImage: boolean | null;
  // Gruptan ayrilmis ama bakiyesi kapanmamis uyeler de listede yer alir;
  // arayuz bunlari "Ahmet (ayrildi)" seklinde gosterebilsin diye isaretliyoruz.
  hasLeft: boolean;
};

/**
 * Grubun para hareketlerini KISI BASINA toplayarak okur.
 *
 * Eskiden burasi grubun butun harcamalarini katilimcilariyla birlikte cekiyordu
 * (limitsiz). 1000 harcamali ve 3 katilimcili bir grupta bu 4000 nesne demekti
 * ve her sayfa goruntulemesinde tekrarlaniyordu. Simdi toplama veritabaninda
 * yapiliyor ve donen satir sayisi harcama sayisindan degil UYE sayisindan
 * bagimli - yani grup buyudukce degismiyor.
 *
 * Dort sorgu paralel gidiyor ve dordu de indeksli toplama; hepsi bir avuc
 * satir donuyor. Para kurali hala saf fonksiyonda (calculateBalancesFromTotals),
 * SQL yalnizca topluyor - toplamanin nerede yapildigi degisti, hesabin nerede
 * yapildigi degil.
 *
 * cache() ile sarili (auth.ts'teki findCurrentUser ile ayni kalip): grup
 * sayfasi hem getGroupBalances hem getGroupSummary cagiriyor, ikisi ayni
 * istekte ayni sonucu paylasiyor.
 */
export const loadGroupTotals = cache(async (groupId: string): Promise<UserTotals[]> => {
  const [paidRows, shareRows, outRows, inRows] = await Promise.all([
    prisma.expense.groupBy({
      by: ["paidById"],
      where: { groupId, deletedAt: null },
      _sum: { amount: true },
    }),
    // Katilimci paylari harcamaya baglanarak filtreleniyor: silinmis bir
    // harcamanin paylari bakiyeye girmemeli.
    prisma.expenseParticipant.groupBy({
      by: ["userId"],
      where: { expense: { groupId, deletedAt: null } },
      _sum: { shareAmount: true },
    }),
    prisma.settlement.groupBy({
      by: ["fromUserId"],
      where: { groupId, cancelledAt: null },
      _sum: { amount: true },
    }),
    prisma.settlement.groupBy({
      by: ["toUserId"],
      where: { groupId, cancelledAt: null },
      _sum: { amount: true },
    }),
  ]);

  const totals = new Map<string, UserTotals>();
  const entryFor = (userId: string): UserTotals => {
    let entry = totals.get(userId);
    if (!entry) {
      entry = { userId, paid: 0, share: 0, settledOut: 0, settledIn: 0 };
      totals.set(userId, entry);
    }
    return entry;
  };

  // _sum hic satir yoksa null doner; 0'a cevirmezsek aritmetik NaN uretirdi.
  for (const row of paidRows) entryFor(row.paidById).paid = row._sum.amount ?? 0;
  for (const row of shareRows) entryFor(row.userId).share = row._sum.shareAmount ?? 0;
  for (const row of outRows) entryFor(row.fromUserId).settledOut = row._sum.amount ?? 0;
  for (const row of inRows) entryFor(row.toUserId).settledIn = row._sum.amount ?? 0;

  return [...totals.values()];
});

export async function getGroupBalances(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  const [totals, memberships] = await Promise.all([
    loadGroupTotals(groupId),
    prisma.groupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
        leftAt: true,
        user: { select: { displayName: true, avatarUrl: true, hasImage: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const rawBalances = calculateBalancesFromTotals(totals);

  // Bir kullanicinin birden fazla uyelik satiri olabilir (ayrilip tekrar
  // katilmissa). Aktif bir satiri varsa o gecerlidir.
  const membershipByUserId = new Map<
    string,
    { hasLeft: boolean; displayName: string; avatarUrl: string | null; hasImage: boolean | null }
  >();
  for (const membership of memberships) {
    const existing = membershipByUserId.get(membership.userId);
    const isActive = membership.leftAt === null;
    if (!existing || (existing.hasLeft && isActive)) {
      membershipByUserId.set(membership.userId, {
        hasLeft: !isActive,
        displayName: membership.user.displayName,
        avatarUrl: membership.user.avatarUrl,
        hasImage: membership.user.hasImage,
      });
    }
  }

  const balances: GroupBalanceEntry[] = rawBalances
    .map((balance) => {
      const membership = membershipByUserId.get(balance.userId);
      return {
        ...balance,
        displayName: membership?.displayName ?? "Bilinmeyen kullanıcı",
        avatarUrl: membership?.avatarUrl ?? null,
        hasImage: membership?.hasImage ?? null,
        hasLeft: membership?.hasLeft ?? true,
      };
    })
    // Ayrilmis VE bakiyesi tam kapanmis uyeleri gostermiyoruz; ayrilmis ama
    // borcu/alacagi duran uyeler listede kalmali, yoksa para "kaybolmus" gorunur.
    .filter((balance) => !(balance.hasLeft && balance.amount === 0));

  // Hic hareketi olmayan aktif uyeler de "odesmis" olarak listede gorunsun.
  const seenUserIds = new Set(rawBalances.map((balance) => balance.userId));
  for (const [memberUserId, membership] of membershipByUserId) {
    if (!seenUserIds.has(memberUserId) && !membership.hasLeft) {
      balances.push({
        userId: memberUserId,
        amount: 0,
        displayName: membership.displayName,
        avatarUrl: membership.avatarUrl,
        hasImage: membership.hasImage,
        hasLeft: false,
      });
    }
  }

  balances.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  return {
    currency: group.currency,
    balances,
    // simplifyDebts saf bakiyeler uzerinden calisir; goruntuleme alanlari
    // (displayName vb.) hesaba karismaz.
    suggestedTransfers: simplifyDebts(rawBalances),
  };
}
