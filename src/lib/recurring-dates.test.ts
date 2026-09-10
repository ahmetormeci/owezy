import { describe, expect, it } from "vitest";
import { daysInUtcMonth, nextOccurrence, startOfUtcDay } from "@/lib/recurring-dates";

/**
 * BU DOSYA NEYI KORUYOR: ay sonu kaymasini.
 *
 * Aylik bir sablonda ayin gunu `startsOn`dan okunuyor, bir onceki donemden
 * DEGIL. Fark yalnizca 29/30/31'inde baslayan sablonlarda goruluyor ve
 * yilda birkac kez - yani canlida fark edilmesi aylar surerdi, ve fark
 * edildiginde de "kira neden ayin 28'ine kaydi" diye sorulurdu.
 */

const d = (iso: string) => new Date(iso + "T00:00:00.000Z");

describe("startOfUtcDay", () => {
  it("saati sifirliyor ve UTC kaliyor", () => {
    const result = startOfUtcDay(new Date("2026-09-10T21:45:12.345Z"));
    expect(result.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });
});

describe("daysInUtcMonth", () => {
  it("ay uzunluklarini biliyor - artik yil dahil", () => {
    expect(daysInUtcMonth(2026, 0)).toBe(31); // Ocak
    expect(daysInUtcMonth(2026, 1)).toBe(28); // Subat, normal yil
    expect(daysInUtcMonth(2028, 1)).toBe(29); // Subat, artik yil
    expect(daysInUtcMonth(2026, 3)).toBe(30); // Nisan
  });
});

describe("haftalik", () => {
  it("yedi gun ekliyor", () => {
    expect(nextOccurrence(d("2026-09-01"), d("2026-09-01"), "WEEKLY").toISOString()).toBe(
      d("2026-09-08").toISOString(),
    );
  });

  it("ay ve yil sinirini gecebiliyor", () => {
    expect(nextOccurrence(d("2026-12-28"), d("2026-12-28"), "WEEKLY").toISOString()).toBe(
      d("2027-01-04").toISOString(),
    );
  });
});

describe("aylik", () => {
  it("ayin ayni gunune gidiyor", () => {
    expect(nextOccurrence(d("2026-09-05"), d("2026-09-05"), "MONTHLY").toISOString()).toBe(
      d("2026-10-05").toISOString(),
    );
  });

  it("Aralik'tan Ocak'a gecerken yil artiyor", () => {
    expect(nextOccurrence(d("2026-12-15"), d("2026-12-15"), "MONTHLY").toISOString()).toBe(
      d("2027-01-15").toISOString(),
    );
  });

  it("KISA AYA KIRPILIYOR: 31 Ocak -> 28 Subat", () => {
    expect(nextOccurrence(d("2026-01-31"), d("2026-01-31"), "MONTHLY").toISOString()).toBe(
      d("2026-02-28").toISOString(),
    );
  });

  it("KIRPILAN GUN GERI GELIYOR: 28 Subat -> 31 Mart", () => {
    /**
     * BU TESTIN KORUDUGU SEY: ayin gunu `startsOn`dan okunuyor, `from`dan
     * degil. `from`dan okusaydik 28 Subat'tan sonra Mart da 28 olurdu ve
     * kirpilan gun KALICI olarak kaybolurdu - "kira ayin 31'inde" diyen
     * kullanicinin sablonu sessizce ayin 28'ine tasinmis olurdu.
     */
    expect(nextOccurrence(d("2026-01-31"), d("2026-02-28"), "MONTHLY").toISOString()).toBe(
      d("2026-03-31").toISOString(),
    );
  });

  it("bir yil boyunca cipa hic kaymiyor", () => {
    const startsOn = d("2026-01-31");
    let cursor = startsOn;
    const days: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      cursor = nextOccurrence(startsOn, cursor, "MONTHLY");
      days.push(cursor.getUTCDate());
    }
    // Subat 28, Nisan/Haziran/Eylul/Kasim 30, digerleri 31.
    expect(days).toEqual([28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31]);
  });

  it("artik yilda Subat 29'a kirpiliyor", () => {
    expect(nextOccurrence(d("2028-01-31"), d("2028-01-31"), "MONTHLY").toISOString()).toBe(
      d("2028-02-29").toISOString(),
    );
  });
});
