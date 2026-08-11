// Bakiye hesaplamalari.
//
// Bu dosyanin ust kismi (calculateBalances / simplifyDebts) DB, HTTP veya
// Prisma'dan tamamen bagimsiz SAF fonksiyonlardir; split.ts ile ayni prensip:
// tum tutarlar en kucuk para birimi cinsinden (kurus) tam sayidir, hicbir
// adimda kesirli deger uretilmez.
//
// Dosyanin sonundaki getGroupBalances ise servis katmanidir: veriyi ceker ve
// bu saf fonksiyonlara verir.

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

/**
 * Her kullanici icin net bakiye:
 *   (odedigi toplam) - (paylarinin toplami) + (yaptigi odemeler) - (aldigi odemeler)
 *
 * Yalnizca silinmemis harcamalar ve iptal edilmemis odemeler verilmelidir;
 * filtreleme cagiran katmanin sorumlulugudur.
 *
 * Ciktida bakiyesi tam sifir olan kullanicilar da yer alir ("odesmis" bilgisi de
 * gosterilmeye deger); filtrelemek isteyen cagiran katman filtreler.
 */
export function calculateBalances(
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): UserBalance[] {
  const totals = new Map<string, number>();

  const add = (userId: string, delta: number) => {
    totals.set(userId, (totals.get(userId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    // Parayi odeyen kisi tutarin tamamini "alacak" yazar...
    add(expense.paidById, expense.amount);
    // ...ve her katilimci kendi payi kadar borclanir. Odeyen kisi katilimci
    // olmak zorunda degil (baskasi adina odeme senaryosu).
    for (const participant of expense.participants) {
      add(participant.userId, -participant.shareAmount);
    }
  }

  for (const settlement of settlements) {
    add(settlement.fromUserId, settlement.amount);
    add(settlement.toUserId, -settlement.amount);
  }

  // Alacaklidan borcluya dogru siralanir; esitlikte userId ile kesinlestirilir
  // ki ayni girdi her zaman ayni sirayi uretsin.
  return [...totals.entries()]
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
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
  // Gruptan ayrilmis ama bakiyesi kapanmamis uyeler de listede yer alir;
  // arayuz bunlari "Ahmet (ayrildi)" seklinde gosterebilsin diye isaretliyoruz.
  hasLeft: boolean;
};

export async function getGroupBalances(userId: string, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) {
    throw new NotFoundError("group.not_found");
  }

  await assertActiveMemberOfGroup(groupId, userId);

  // Yalnizca silinmemis harcamalar ve iptal edilmemis odemeler hesaba katilir.
  const [expenses, settlements, memberships] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: {
        paidById: true,
        amount: true,
        participants: { select: { userId: true, shareAmount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId, cancelledAt: null },
      select: { fromUserId: true, toUserId: true, amount: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
        leftAt: true,
        user: { select: { displayName: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const rawBalances = calculateBalances(expenses, settlements);

  // Bir kullanicinin birden fazla uyelik satiri olabilir (ayrilip tekrar
  // katilmissa). Aktif bir satiri varsa o gecerlidir.
  const membershipByUserId = new Map<string, { hasLeft: boolean; displayName: string; avatarUrl: string | null }>();
  for (const membership of memberships) {
    const existing = membershipByUserId.get(membership.userId);
    const isActive = membership.leftAt === null;
    if (!existing || (existing.hasLeft && isActive)) {
      membershipByUserId.set(membership.userId, {
        hasLeft: !isActive,
        displayName: membership.user.displayName,
        avatarUrl: membership.user.avatarUrl,
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
