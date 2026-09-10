import { describe, expect, it } from "vitest";
import { guessReceiptAmount, parseReceiptMoney } from "@/lib/receipt-amount";

/**
 * BU DOSYA NEYI KORUYOR: fisten okunan tutarin YANLIS bir sayi olmasini.
 *
 * OCR'in kendisi burada yok - girdisi zaten metin. Asil risk tanimakta
 * degil ANLAMAKTA: bir fisin uzerinde tutar gorunumlu ON TANE sayi var
 * (KDV, ara toplam, para ustu, tarih, vergi numarasi, saat, adet) ve
 * yanlis olani secmek sessizce yanlis bir harcama yazdirir.
 *
 * Bu yuzden testlerin cogu "dogru olani buldu mu" degil, "YANLIS OLANI
 * ELEDI MI" diye soruyor.
 */

describe("parseReceiptMoney", () => {
  it("Turkce bicimi cozuyor", () => {
    expect(parseReceiptMoney("342,50")).toEqual({ amount: 34250, hasFraction: true });
    expect(parseReceiptMoney("1.234,56")).toEqual({ amount: 123456, hasFraction: true });
  });

  it("Ingilizce bicimi cozuyor", () => {
    expect(parseReceiptMoney("342.50")).toEqual({ amount: 34250, hasFraction: true });
    expect(parseReceiptMoney("1,234.56")).toEqual({ amount: 123456, hasFraction: true });
  });

  it("tek basamakli kurusu tamamliyor", () => {
    // "342,5" bir fiste gorunuyor ve 342,50 demek - 342,05 degil.
    expect(parseReceiptMoney("342,5")).toEqual({ amount: 34250, hasFraction: true });
  });

  it("kurussuz sayiyi kabul ediyor ama BUNU SOYLUYOR", () => {
    expect(parseReceiptMoney("350")).toEqual({ amount: 35000, hasFraction: false });
  });

  it("UC BASAMAK binlik ayiricidir, ondalik degil", () => {
    // "1.234" = 1234 TL. Ondalik sayilsaydi 1,23 TL olurdu - bin kat hata.
    expect(parseReceiptMoney("1.234")).toEqual({ amount: 123400, hasFraction: false });
    expect(parseReceiptMoney("1,234")).toEqual({ amount: 123400, hasFraction: false });
  });

  it("cok basamakli binlikleri cozuyor", () => {
    expect(parseReceiptMoney("1.234.567,89")).toEqual({ amount: 123456789, hasFraction: true });
  });

  it("TARIHI REDDEDIYOR", () => {
    // NEGATIF KONTROL: "10.09.2026" son ayiricidan sonra dort basamak
    // tasiyor - para degil.
    expect(parseReceiptMoney("10.09.2026")).toBeNull();
  });

  it("VERGI NUMARASI gibi uzun sayilari reddediyor", () => {
    expect(parseReceiptMoney("12345678901234")).toBeNull();
  });

  it("PARA OLMAYAN metni reddediyor", () => {
    expect(parseReceiptMoney("")).toBeNull();
    expect(parseReceiptMoney("TOPLAM")).toBeNull();
    expect(parseReceiptMoney("12A34")).toBeNull();
  });

  it("SIFIR ve tasan tutar reddediliyor", () => {
    expect(parseReceiptMoney("0,00")).toBeNull();
    expect(parseReceiptMoney("99999999,99")).toBeNull();
  });

  it("FLOAT'A DONMUYOR - kurus tam cikiyor", () => {
    // 0.1 + 0.2 ailesinden bir hata burada 1 kurus kayip demek olurdu.
    for (const [text, expected] of [
      ["0,10", 10],
      ["0,20", 20],
      ["8,70", 870],
      ["12,29", 1229],
      ["999,99", 99999],
    ] as [string, number][]) {
      expect(parseReceiptMoney(text)?.amount).toBe(expected);
    }
  });
});

describe("guessReceiptAmount - etiketli", () => {
  it("TOPLAM satirini buluyor", () => {
    const guess = guessReceiptAmount(["MARKET A.S.", "EKMEK 15,00", "TOPLAM 342,50"]);
    expect(guess).toMatchObject({ amount: 34250, source: "labelled" });
  });

  it("GENEL TOPLAM, TOPLAM'a gore ONCELIKLI", () => {
    // Fiste ikisi de gecebiliyor ve dogru cevap genel toplam.
    const guess = guessReceiptAmount(["TOPLAM 300,00", "KDV 54,00", "GENEL TOPLAM 354,00"]);
    expect(guess?.amount).toBe(35400);
  });

  it("ARA TOPLAM'i toplam SANMIYOR", () => {
    /**
     * NEGATIF KONTROL VE EN ONEMLISI: "ARA TOPLAM" icinde "TOPLAM"
     * geciyor, yani eleme listesi olmasa etiket eslesmesini gecerdi ve
     * vergiden ONCEKI tutar yazilirdi - her fiste, sessizce eksik.
     */
    const guess = guessReceiptAmount(["ARA TOPLAM 300,00", "KDV 54,00", "TOPLAM 354,00"]);
    expect(guess?.amount).toBe(35400);
  });

  it("SUBTOTAL'i de elemiyor sanmiyor", () => {
    const guess = guessReceiptAmount(["SUBTOTAL 300.00", "TAX 54.00", "TOTAL 354.00"]);
    expect(guess?.amount).toBe(35400);
  });

  it("NAKIT ve PARA USTU'nu toplam sanmiyor", () => {
    // Musterinin verdigi para toplamdan BUYUK; secilse fazla yazilirdi.
    const guess = guessReceiptAmount([
      "TOPLAM 342,50",
      "NAKIT 400,00",
      "PARA USTU 57,50",
    ]);
    expect(guess?.amount).toBe(34250);
  });

  it("ETIKET VE TUTAR AYRI SATIRDAYSA da buluyor", () => {
    // OCR bunu sik yapiyor: etiket bir satir, rakam bir sonraki.
    const guess = guessReceiptAmount(["TOPLAM", "342,50"]);
    expect(guess).toMatchObject({ amount: 34250, source: "labelled" });
  });

  it("etiketli satirda KURUS ZORUNLU DEGIL", () => {
    const guess = guessReceiptAmount(["TOPLAM 350"]);
    expect(guess?.amount).toBe(35000);
  });

  it("para birimi simgesi engel degil", () => {
    expect(guessReceiptAmount(["TOPLAM 342,50 TL"])?.amount).toBe(34250);
    expect(guessReceiptAmount(["TOPLAM ₺342,50"])?.amount).toBe(34250);
    expect(guessReceiptAmount(["TOTAL $342.50"])?.amount).toBe(34250);
  });
});

describe("guessReceiptAmount - yedek yol", () => {
  it("etiket yoksa KURUSU OLAN en buyuk sayiyi seciyor", () => {
    const guess = guessReceiptAmount(["EKMEK 15,00", "SUT 42,75", "PEYNIR 120,40"]);
    expect(guess).toMatchObject({ amount: 12040, source: "largest" });
  });

  it("YEDEK YOLDA KURUS ZORUNLU - yil ve vergi no boyle eleniyor", () => {
    /**
     * NEGATIF KONTROL: kurus sarti kalkarsa "2026" (yil) ya da fisin
     * ustundeki numaralar en buyuk sayi olarak secilir. Fis toplami
     * neredeyse her zaman kurusuyla basiliyor; sart bu yuzden eleyici.
     */
    const guess = guessReceiptAmount(["FIS NO 987654", "10.09.2026", "EKMEK 15,00"]);
    expect(guess).toMatchObject({ amount: 1500, source: "largest" });
  });

  it("yedek yolda da NAKIT satiri eleniyor", () => {
    const guess = guessReceiptAmount(["EKMEK 15,00", "NAKIT 400,00"]);
    expect(guess?.amount).toBe(1500);
  });

  it("hicbir sey bulamazsa null - uydurmuyor", () => {
    expect(guessReceiptAmount(["MARKET A.S.", "TESEKKUR EDERIZ"])).toBeNull();
    expect(guessReceiptAmount([])).toBeNull();
  });
});

describe("gercek fis metinleri", () => {
  it("Turkce market fisi", () => {
    const guess = guessReceiptAmount([
      "MIGROS TICARET A.S.",
      "KADIKOY / ISTANBUL",
      "VKN 6110084", 
      "TARIH 10.09.2026  SAAT 14:32",
      "FIS NO 0231",
      "",
      "EKMEK              %1      8,50",
      "SUT 1 LT           %1     42,75",
      "BEYAZ PEYNIR       %8    189,90",
      "DETERJAN           %20   101,35",
      "",
      "ARA TOPLAM               342,50",
      "TOPKDV                    24,18",
      "TOPLAM                   366,68",
      "NAKIT                    400,00",
      "PARA USTU                 33,32",
      "",
      "TESEKKUR EDERIZ",
    ]);
    expect(guess).toMatchObject({ amount: 36668, source: "labelled" });
  });

  it("Ingilizce restoran fisi - bahsisli", () => {
    const guess = guessReceiptAmount([
      "THE CORNER BISTRO",
      "Table 7          2026-09-10",
      "2x Pizza                24.00",
      "1x Salad                 9.50",
      "3x Water                 4.50",
      "Subtotal                38.00",
      "Tax                      3.04",
      "Tip                      6.00",
      "TOTAL                   47.04",
      "Thank you!",
    ]);
    expect(guess).toMatchObject({ amount: 4704, source: "labelled" });
  });

  it("etiketi OCR'in bozdugu fis - yedek yola dusuyor", () => {
    // "T0PLAM" (sifirli) eslesmiyor; yedek yol yine de makul cevabi
    // veriyor cunku toplam satirdaki en buyuk kuruslu sayi.
    const guess = guessReceiptAmount([
      "BAKKAL",
      "CAY                  12,00",
      "SIMIT                 8,00",
      "T0PLAM               20,00",
    ]);
    expect(guess).toMatchObject({ amount: 2000, source: "largest" });
  });
});
