/**
 * Iki harcama anlik goruntusunu karsilastirir ve NELERIN degistigini soyler.
 *
 * Nerede kullaniliyor: optimistic locking cakismasinda (ADR-032). Kaydetmeye
 * calisan istemci 409 aldiginda sunucudaki guncel hali yeniden cekiyor ve
 * kendi YUKLEDIGI hal ile karsilastiriyor. Yani buradaki fark, kullanicinin
 * kendi yazdiklari degil, ARADA BASKASININ yaptigi degisiklik.
 *
 * SAF MODUL - bilerek: mobil istemci de bunu ayni yoldan (@/lib/expense-diff)
 * ice aktariyor, boylece karsilastirma iki kez yazilmiyor. Bu yuzden burada
 * Prisma, React, i18n ya da locale YOK. Bicimleme (para, tarih, isim) cagiran
 * tarafin isi: ayni fark web'de Intl ile, mobilde RN tarafinda yazilir.
 */

export type ExpenseSplitTypeValue = "EQUAL" | "EXACT" | "PERCENTAGE";

/**
 * Her iki istemcinin de GET'ten aldigi alanlarin ortak alt kumesi.
 * expenseDate hem "2026-08-05" hem "2026-08-05T00:00:00.000Z" gelebilir
 * (JSON'a cikarken Date tam ISO oluyor); normalizeDate ikisini de kabul eder.
 */
export type ExpenseComparable = {
  description: string;
  amount: number;
  category: string;
  splitType: ExpenseSplitTypeValue;
  expenseDate: string;
  paidById: string;
  participants: {
    userId: string;
    shareAmount: number;
    /**
     * OPSIYONEL cunku her istemci bu alani tasimiyor: mobil ekran yalnizca
     * esit bolusum duzenledigi icin kendi tipinde yuzde yok. Karsilastirma
     * asagida "?? null" ile normalize ediliyor, boylece alani hic tasimayan
     * bir istemcide undefined/null farki sahte bir degisiklik uretmiyor.
     */
    basisPoints?: number | null;
  }[];
};

export type ExpenseChange =
  | { field: "description"; before: string; after: string }
  | { field: "amount"; before: number; after: number }
  | { field: "category"; before: string; after: string }
  | { field: "splitType"; before: ExpenseSplitTypeValue; after: ExpenseSplitTypeValue }
  | { field: "expenseDate"; before: string; after: string }
  | { field: "paidById"; before: string; after: string }
  | {
      field: "participants";
      addedUserIds: string[];
      removedUserIds: string[];
      /** Ayni kisiler duruyor ama paylari (ya da yuzdeleri) degismis. */
      sharesChanged: boolean;
    };

/** "2026-08-05T00:00:00.000Z" ve "2026-08-05" ayni gundur. */
function normalizeDate(value: string): string {
  return value.slice(0, 10);
}

/**
 * Katilimci farki. Uc ayri soru soruluyor cunku kullaniciya soylenecek cumle
 * de uc turlu: "kim eklendi", "kim cikarildi", "kisiler ayni ama paylar
 * degisti". Ucuncusu onemli - EXACT bir bolusumde tutar ve kisiler ayni kalip
 * yalnizca dagilim degisebilir; onu yakalamazsak cakisma "hicbir sey
 * degismemis" gibi gorunur.
 */
function diffParticipants(
  before: ExpenseComparable["participants"],
  after: ExpenseComparable["participants"],
): Extract<ExpenseChange, { field: "participants" }> | null {
  const beforeById = new Map(before.map((participant) => [participant.userId, participant]));
  const afterById = new Map(after.map((participant) => [participant.userId, participant]));

  const addedUserIds = after
    .filter((participant) => !beforeById.has(participant.userId))
    .map((participant) => participant.userId);
  const removedUserIds = before
    .filter((participant) => !afterById.has(participant.userId))
    .map((participant) => participant.userId);

  // Pay karsilastirmasi yalnizca IKI TARAFTA DA olan kisiler icin anlamli:
  // eklenen/cikarilan zaten ayrica raporlaniyor.
  const sharesChanged = before.some((participant) => {
    const counterpart = afterById.get(participant.userId);
    if (!counterpart) {
      return false;
    }
    return (
      counterpart.shareAmount !== participant.shareAmount ||
      (counterpart.basisPoints ?? null) !== (participant.basisPoints ?? null)
    );
  });

  if (addedUserIds.length === 0 && removedUserIds.length === 0 && !sharesChanged) {
    return null;
  }

  return { field: "participants", addedUserIds, removedUserIds, sharesChanged };
}

/**
 * `before`: istemcinin ekrana yukledigi hal.
 * `after`: sunucuda su an duran hal.
 *
 * Bos dizi donerse gorunur bir fark yok demektir. Bu MUMKUN: cakismayi
 * tetikleyen degisiklik bir silme-geri yukleme ciftinden ya da bu modulun
 * bakmadigi bir alandan gelmis olabilir. O durumda cagiran taraf "degisti ama
 * ne degistigini gosteremiyoruz" demeli - bos listeyi "degisiklik yok" diye
 * yorumlayip cakismayi gizlememeli.
 */
export function diffExpenses(
  before: ExpenseComparable,
  after: ExpenseComparable,
): ExpenseChange[] {
  const changes: ExpenseChange[] = [];

  if (before.description !== after.description) {
    changes.push({
      field: "description",
      before: before.description,
      after: after.description,
    });
  }
  if (before.amount !== after.amount) {
    changes.push({ field: "amount", before: before.amount, after: after.amount });
  }
  if (before.paidById !== after.paidById) {
    changes.push({ field: "paidById", before: before.paidById, after: after.paidById });
  }
  if (before.category !== after.category) {
    changes.push({ field: "category", before: before.category, after: after.category });
  }
  if (before.splitType !== after.splitType) {
    changes.push({ field: "splitType", before: before.splitType, after: after.splitType });
  }
  if (normalizeDate(before.expenseDate) !== normalizeDate(after.expenseDate)) {
    changes.push({
      field: "expenseDate",
      before: normalizeDate(before.expenseDate),
      after: normalizeDate(after.expenseDate),
    });
  }

  const participantsChange = diffParticipants(before.participants, after.participants);
  if (participantsChange) {
    changes.push(participantsChange);
  }

  return changes;
}
