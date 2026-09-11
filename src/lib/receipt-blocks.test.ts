import { describe, expect, it } from "vitest";
import swiss from "@/lib/fixtures/receipt-swiss.json";
import office from "@/lib/fixtures/receipt-officeworks.json";
import { groupIntoLines, linesFrom, type TextBlock } from "@/lib/receipt-blocks";
import { guessReceiptAmount } from "@/lib/receipt-amount";

/**
 * BU DOSYA NEYI KORUYOR: OCR parcalarinin GORSEL SATIRLARA geri toplanmasini
 * (ADR-055).
 *
 * VERI UYDURULMADI. Iki fixture, Wikimedia'daki acik lisansli GERCEK fis
 * fotograflarinin Apple Vision ciktisidir - uygulamanin iOS'ta kullandigi
 * motorun aynisi. Gerekcesi aci bir dersti: Faz 46'nin testleri etiketle
 * tutarin AYNI SATIRDA oldugunu varsayiyordu ("NAKIT 400,00"), oysa gercek
 * Vision ciktisi onlari ayri gozlemlere boluyor. Uydurma veri o kusuru
 * GOSTEREMEZDI.
 */

/** Tip dogrulamasi: fixture'lar gercekten TextBlock mu. */
const swissBlocks = swiss as TextBlock[];
const officeBlocks = office as TextBlock[];

describe("gorsel satirlara toplama", () => {
  it("AD VE FIYATI AYNI SATIRDA birlestiriyor", () => {
    const lines = linesFrom(swissBlocks);

    // Vision bunlari dort ayri gozlem olarak vermisti: ad, birim fiyat,
    // para birimi, satir toplami.
    expect(lines).toContain("2xLatte Macchiato 4.50 CHF 9.00");
    expect(lines).toContain("1xGloki 5.00 CHF 5.00");
  });

  it("SATIRLARI USTTEN ALTA siraliyor", () => {
    const lines = linesFrom(swissBlocks);

    // Vision'in koordinat duzeninde orijin SOL ALT: y buyudukce yukari.
    // Yanlis siralama fisin basligini sona atardi.
    expect(lines[0]).toBe("Berghotel");
    expect(lines[lines.length - 1]).toContain("E-mail");
  });

  it("PARCALARI SOLDAN SAGA siraliyor", () => {
    const line = groupIntoLines(swissBlocks).find((l) => l.text.startsWith("2x"));

    // Vision bu satirda once "CHF"yi dondurmustu; x'e gore siralanmasaydi
    // ad ile tutar arasindaki iliski yine bozuk kalirdi.
    expect(line?.parts.map((part) => part.text)).toEqual([
      "2xLatte Macchiato",
      "4.50",
      "CHF",
      "9.00",
    ]);
  });

  it("BOS parcalari atiyor", () => {
    const withEmpty: TextBlock[] = [
      { text: "  ", x: 0.1, y: 0.5, width: 0.1, height: 0.02 },
      { text: "Kola", x: 0.2, y: 0.5, width: 0.1, height: 0.02 },
    ];

    expect(linesFrom(withEmpty)).toEqual(["Kola"]);
  });
});

describe("toplam okuma - GERCEK fis verisiyle", () => {
  /**
   * BU IKI TEST OLCULMUS BIR KUSURU KORUYOR.
   *
   * Gruplama olmadan "TOPLAM" etiketi ile tutari AYRI satirlardi, yani
   * etiket yolu hic calismiyor ve is "en buyuk kuruslu sayi" yedegine
   * kaliyordu. Officeworks fisinde bu, toplam 27,96 iken ODENEN NAKIT
   * 28,00'i secmisti. Gruplamayla ikisi ayni satira gelince etiket yolu
   * devreye giriyor.
   */
  it("Isvicre fisi: 54,50 ve ETIKETTEN okundu", () => {
    const guess = guessReceiptAmount(linesFrom(swissBlocks));

    expect(guess?.amount).toBe(5450);
    expect(guess?.source).toBe("labelled");
  });

  it("Officeworks fisi: 27,96 - ODENEN 28,00 DEGIL", () => {
    const guess = guessReceiptAmount(linesFrom(officeBlocks));

    expect(guess?.amount).toBe(2796);
    expect(guess?.source).toBe("labelled");
  });

  it("GRUPLAMADAN once ayni fis YANLIS okunuyordu - kusurun kaydi", () => {
    // Vision'in dondurdugu ham sira, gruplama yapilmadan.
    const raw = officeBlocks.map((block) => block.text);
    const guess = guessReceiptAmount(raw);

    // Odenen nakit. Fisin toplami 27,96.
    expect(guess?.amount).toBe(2800);
    expect(guess?.source).toBe("largest");
  });
});
