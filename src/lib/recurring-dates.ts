/**
 * Tekrarlayan harcamanin TARIH ARITMETIGI (ADR-051).
 *
 * AYRI VE SAF BIR MODUL: burada veritabani da HTTP de yok, yani ay sonu
 * kaymasi gibi ince kurallar dogrudan test edilebiliyor. split.ts ve
 * balances.ts'in ust yarisiyla ayni prensip.
 *
 * HER SEY UTC. expenseDate kolonu @db.Date, yani veritabaninda UTC gece
 * yarisi duruyor (expenses.ts monthKeyToRange ile ayni gerekce). Yerel
 * saatle hesaplasaydik UTC'nin gerisindeki bir dilimde ayin ilk gunu bir
 * onceki aya duserdi.
 */

export type RecurrenceInterval = "WEEKLY" | "MONTHLY";

/** Gunun UTC gece yarisi. Karsilastirmalar hep bu birimde. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Bir ayin gun sayisi. Ay 0-tabanli (Date ile ayni). */
export function daysInUtcMonth(year: number, month: number): number {
  // Bir sonraki ayin 0. gunu = bu ayin son gunu.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Bir sonraki donemin tarihi.
 *
 * AYLIKTA AYIN GUNU `startsOn`DAN OKUNUYOR, `from`DAN DEGIL - ve bu kurulusun
 * en kolay gozden kacan yeri. 31 Ocak'ta baslayan bir sablon Subat'ta 28'e
 * KIRPILIYOR; gunu `from`dan alsaydik Mart da 28 olurdu ve kirpilan gun
 * KALICI olarak kaybolurdu. Cipa baslangicta duruyor:
 *
 *     31 Oca -> 28 Sub -> 31 Mar -> 30 Nis -> 31 May
 */
export function nextOccurrence(
  startsOn: Date,
  from: Date,
  interval: RecurrenceInterval,
): Date {
  if (interval === "WEEKLY") {
    return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const anchorDay = startsOn.getUTCDate();
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  // Aralik -> Ocak gecisinde yil da kendiliginden artiyor: Date.UTC ay
  // tasmasini kendisi normallestiriyor.
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}
