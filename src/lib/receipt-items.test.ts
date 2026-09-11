import { describe, expect, it } from "vitest";
import swiss from "@/lib/fixtures/receipt-swiss.json";
import office from "@/lib/fixtures/receipt-officeworks.json";
import { groupIntoLines, type TextBlock } from "@/lib/receipt-blocks";
import { readReceiptItems, sumItems } from "@/lib/receipt-items";

/**
 * BU DOSYA NEYI KORUYOR: fisteki KALEMLERIN cikarilmasini (ADR-055).
 *
 * Veri gercek (bkz. fixtures/README.md). Testlerin cogu "su fiste su
 * kalemler cikmali" diyor - yani iddia kodun kendi mantigi degil, GERCEK
 * BIR FISIN icerigi.
 */

const swissLines = groupIntoLines(swiss as TextBlock[]);
const officeLines = groupIntoLines(office as TextBlock[]);

/** Elle kurulmus satir - ozel durumlari sinamak icin. */
function line(...parts: string[]) {
  return groupIntoLines(
    parts.map((text, index) => ({
      text,
      x: 0.1 + index * 0.2,
      y: 0.5,
      width: 0.15,
      height: 0.02,
    })),
  );
}

describe("gercek fisten kalem cikarma", () => {
  it("Isvicre fisi: DORT kalemin dordu de, adetleriyle", () => {
    const items = readReceiptItems(swissLines);

    expect(items.map((item) => `${item.description} = ${item.amount}`)).toEqual([
      "2x Latte Macchiato = 900",
      "1x Gloki = 500",
      "1x Schweinschnitzel = 2200",
      "1x Chässpätzli = 1850",
    ]);
  });

  it("Isvicre fisi: kalemlerin toplami FISIN TOPLAMINA esit", () => {
    // 54,50 - fisin uzerinde yazan tutar. Ne eksik ne fazla kalem alindi.
    expect(sumItems(readReceiptItems(swissLines))).toBe(5450);
  });

  it("TOPLAM, KDV, NAKIT, YUVARLAMA satirlari kalem SAYILMIYOR", () => {
    const items = readReceiptItems(officeLines);

    const texts = items.map((item) => item.description.toLowerCase());
    expect(texts.some((text) => text.includes("total"))).toBe(false);
    expect(texts.some((text) => text.includes("rounding"))).toBe(false);
    expect(texts.some((text) => text.includes("cash"))).toBe(false);
  });

  it("ADI BIR ALT SATIRDA olan fis: kod yerine URUN ADI aliniyor", () => {
    // Fiste kod ve fiyat bir satirda, ad bir altta:
    //   AC90050                        $27.96
    //   PK50 RXL CONVNT CRDHLDR PN/CLP
    const items = readReceiptItems(officeLines);

    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("PK50 RXL CONVNT CRDHLDR PN/CLP");
    expect(items[0].amount).toBe(2796);
  });
});

describe("adet", () => {
  it('"2x Kola" bicimine cevriliyor', () => {
    const items = readReceiptItems(line("2xKola", "12,50", "25,00"));

    expect(items[0].description).toBe("2x Kola");
    expect(items[0].quantity).toBe(2);
  });

  it("SATIR TOPLAMI BASILIYSA carpilmiyor", () => {
    // "2xKola 12,50 25,00" -> 25,00 zaten satirin toplami. Carpmak 50,00
    // yazardi ve kullanici bunu ancak kaydettikten sonra fark ederdi.
    const items = readReceiptItems(line("2xKola", "12,50", "25,00"));

    expect(items[0].amount).toBe(2500);
  });

  it("SATIR TOPLAMI YOKSA carpiliyor", () => {
    // "2 x 12,50" yazip satir toplamini basmayan fisler var.
    const items = readReceiptItems(line("2 x Kola", "12,50"));

    expect(items[0].amount).toBe(2500);
  });
});

describe("kalem olmayanlar eleniyor", () => {
  it("KURUSU OLMAYAN sayi kalem degil", () => {
    // "Rech. Nr. 4572" - fis numarasi. Kurus sarti olmasa 4572,00 TL'lik
    // bir kalem olurdu.
    expect(readReceiptItems(line("Rech. Nr.", "4572"))).toEqual([]);
  });

  it("YUZDE tasiyan satir kalem degil", () => {
    expect(readReceiptItems(line("Incl. 7.6% MwSt", "3.85"))).toEqual([]);
  });

  it("ADINDA HARF OLMAYAN satir kalem degil", () => {
    expect(readReceiptItems(line("0001", "12,50"))).toEqual([]);
  });

  it("TUTARSIZ satir kalem degil", () => {
    expect(readReceiptItems(line("Tesekkurler"))).toEqual([]);
  });
});

describe("toplama", () => {
  it("kurus cinsinden tam sayi topluyor - float yok", () => {
    const total = sumItems([{ amount: 1 }, { amount: 2 }, { amount: 3 }]);

    expect(total).toBe(6);
    expect(Number.isInteger(total)).toBe(true);
  });
});
