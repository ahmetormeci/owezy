import { ValidationError } from "@/lib/errors";

// Harcama bolusum hesaplamalari - DB, HTTP veya Prisma'dan tamamen bagimsiz saf fonksiyonlar.
// Tum tutarlar en kucuk para birimi cinsinden (TRY icin kurus) tam sayi olarak islenir.
// Hicbir hesaplama adiminda kesirli (float) bir ara deger uretilmez.

// Expense.amount / ExpenseParticipant.shareAmount kolonlari Postgres'te INTEGER (4 byte,
// maksimum 2_147_483_647) oldugu icin bu sinir burada da erken uygulanir.
export const MAX_SPLIT_AMOUNT = 2_147_483_647;

// Yuzdeler float olarak degil, "basis point" (yuzde binde biri) cinsinden tam sayi olarak
// temsil edilir: 10000 basis point = %100. Ornek: %33.33 -> 3333, %66.67 -> 6667.
// Boylece yuzde -> tutar donusumu (amount * basisPoints / 10000) sadece iki tam sayinin
// carpimi ve tam sayi bolmesiyle yapilir, hicbir ondalik deger araya girmez.
export const BASIS_POINTS_TOTAL = 10_000;

export type SplitShare = {
  userId: string;
  amount: number;
};

function assertValidAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("split.amount_invalid");
  }
  if (amount > MAX_SPLIT_AMOUNT) {
    throw new ValidationError("split.amount_too_large", { max: MAX_SPLIT_AMOUNT });
  }
}

function assertNoDuplicateUserIds(userIds: string[]) {
  const seen = new Set<string>();
  for (const userId of userIds) {
    if (seen.has(userId)) {
      throw new ValidationError("split.duplicate_participant", { userId });
    }
    seen.add(userId);
  }
}

// ============================================================
// EQUAL
// ============================================================

export type EqualSplitInput = {
  amount: number;
  participantUserIds: string[];
};

export function splitEqually({ amount, participantUserIds }: EqualSplitInput): SplitShare[] {
  assertValidAmount(amount);
  if (participantUserIds.length === 0) {
    throw new ValidationError("split.no_participants");
  }
  assertNoDuplicateUserIds(participantUserIds);

  const n = participantUserIds.length;
  const base = Math.floor(amount / n);
  const remainder = amount - base * n; // 0 <= remainder < n

  // Kalan kurus'lar, katilimci listesindeki ILK `remainder` kisiye 1'er kurus olarak
  // dagitilir. Girdi sirasi sabit oldugu icin bu deterministiktir.
  return participantUserIds.map((userId, index) => ({
    userId,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

// ============================================================
// EXACT
// ============================================================

export type ExactShareInput = {
  userId: string;
  amount: number;
};

export type ExactSplitInput = {
  amount: number;
  shares: ExactShareInput[];
};

export function splitExactly({ amount, shares }: ExactSplitInput): SplitShare[] {
  assertValidAmount(amount);
  if (shares.length === 0) {
    throw new ValidationError("split.no_participants");
  }
  assertNoDuplicateUserIds(shares.map((share) => share.userId));

  let total = 0;
  for (const share of shares) {
    if (!Number.isInteger(share.amount) || share.amount < 0) {
      throw new ValidationError("split.share_invalid", { userId: share.userId });
    }
    total += share.amount;
  }

  if (total !== amount) {
    throw new ValidationError("split.sum_mismatch", { total, amount });
  }

  return shares.map((share) => ({ userId: share.userId, amount: share.amount }));
}

// ============================================================
// PERCENTAGE
// ============================================================

export type PercentageShareInput = {
  userId: string;
  basisPoints: number; // 10000 = %100
};

export type PercentageSplitInput = {
  amount: number;
  shares: PercentageShareInput[];
};

export function splitByPercentage({ amount, shares }: PercentageSplitInput): SplitShare[] {
  assertValidAmount(amount);
  if (shares.length === 0) {
    throw new ValidationError("split.no_participants");
  }
  assertNoDuplicateUserIds(shares.map((share) => share.userId));

  let totalBasisPoints = 0;
  for (const share of shares) {
    if (!Number.isInteger(share.basisPoints) || share.basisPoints < 0) {
      throw new ValidationError("split.percentage_invalid", { userId: share.userId });
    }
    if (share.basisPoints > BASIS_POINTS_TOTAL) {
      throw new ValidationError("split.percentage_too_large", { userId: share.userId });
    }
    totalBasisPoints += share.basisPoints;
  }

  if (totalBasisPoints !== BASIS_POINTS_TOTAL) {
    throw new ValidationError("split.percentage_sum_mismatch", {
      total: totalBasisPoints / 100,
    });
  }

  // "En buyuk kalan yontemi" (largest remainder method): her katilimcinin ideal payi
  // asagi yuvarlanir, geriye kalan kurus'lar yuvarlamada en cok kaybeden (kesirli kismi
  // en buyuk olan) katilimcilara sirayla 1'er kurus olarak dagitilir. Esitlik durumunda
  // girdi sirasindaki once gelen kazanir (deterministik, stabil siralama).
  const floorShares = shares.map((share) => {
    const exact = amount * share.basisPoints; // iki tam sayinin carpimi, guvenli aralikta
    const floor = Math.floor(exact / BASIS_POINTS_TOTAL);
    const fraction = exact - floor * BASIS_POINTS_TOTAL;
    return { userId: share.userId, floor, fraction };
  });

  const distributed = floorShares.reduce((sum, share) => sum + share.floor, 0);
  const remainder = amount - distributed; // 0 <= remainder < shares.length

  const order = floorShares
    .map((share, index) => ({ ...share, index }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const extraRecipientIndexes = new Set(order.slice(0, remainder).map((share) => share.index));

  return floorShares.map((share, index) => ({
    userId: share.userId,
    amount: share.floor + (extraRecipientIndexes.has(index) ? 1 : 0),
  }));
}

/**
 * Kayitli paylardan yuzdeleri geri hesaplar - AMA yalnizca sonuc
 * ispatlanabildiginde.
 *
 * Neden gerekli: ExpenseParticipant.basisPoints kolonu sonradan eklendi.
 * Ondan onceki yuzdeli harcamalarda kullanicinin girdigi yuzde hicbir yerde
 * saklanmadi; elimizde yalnizca sonuc paylari var.
 *
 * Neden "ispat": yuzde -> pay donusumu kayiplidir. Bu fonksiyon KULLANICININ
 * YAZDIGI yuzdeyi bulmaz - oyle bir sey mumkun degil. Buldugu sey, kayitli
 * paylari BIREBIR ureten bir yuzde kumesi. Ikisi ayni olmayabilir: 100 kurus
 * uce bolundugunde 34/33/33 paylari hem %33,33/%33,33/%33,34'ten hem de
 * %34/%33/%33'ten cikar, ve bu fonksiyon ikincisini doner.
 *
 * Onemli olan garanti su: kullanici formu acip hicbir seye dokunmadan
 * kaydederse tutarlar DEGISMEZ. Ispat gecmezse null doner ve alan bos kalir -
 * yani bugunku davranis. Tahmin edip doldurmak, kullanicinin farkina bile
 * varmadan bir kurusun yer degistirmesi demek olurdu.
 */
export function inferBasisPoints({
  amount,
  shares,
}: {
  amount: number;
  // Girdi, bir bolusumun CIKTISI: kayitli paylar.
  shares: SplitShare[];
}): PercentageShareInput[] | null {
  if (amount <= 0 || shares.length === 0) {
    return null;
  }

  const candidate = shares.map((share) => {
    // Yakina yuvarlama, float bolmesi olmadan: (pay * 10000) / amount degerinin
    // tam kismi ve kalani ayri hesaplaniyor. Carpim en fazla 2^31 * 10^4 ~ 2.1e13,
    // Number.MAX_SAFE_INTEGER'in cok altinda, dolayisiyla tam sayi.
    const scaled = share.amount * BASIS_POINTS_TOTAL;
    const whole = Math.floor(scaled / amount);
    const remainder = scaled - whole * amount;
    return {
      userId: share.userId,
      basisPoints: remainder * 2 >= amount ? whole + 1 : whole,
    };
  });

  const total = candidate.reduce((sum, share) => sum + share.basisPoints, 0);
  if (total !== BASIS_POINTS_TOTAL) {
    return null;
  }

  let recomputed: SplitShare[];
  try {
    recomputed = splitByPercentage({ amount, shares: candidate });
  } catch {
    // Yinelenen katilimci gibi bozuk bir kayit: tahmin uretmektense vazgec.
    return null;
  }

  const isExact = recomputed.every(
    (share, index) =>
      share.userId === shares[index].userId && share.amount === shares[index].amount,
  );

  return isExact ? candidate : null;
}
