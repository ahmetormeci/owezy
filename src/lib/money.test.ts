import { describe, expect, it } from "vitest";
import {
  formatBasisPoints,
  formatMoney,
  formatSignedMoney,
  parseMoney,
  parsePercentageToBasisPoints,
} from "@/lib/money";

describe("formatMoney", () => {
  it("tam lira tutarini gosterir", () => {
    expect(formatMoney(12000)).toBe("120,00 ₺");
  });

  it("kurus kismini iki basamakla gosterir", () => {
    expect(formatMoney(12050)).toBe("120,50 ₺");
    expect(formatMoney(12005)).toBe("120,05 ₺");
  });

  it("sifiri dogru gosterir", () => {
    expect(formatMoney(0)).toBe("0,00 ₺");
  });

  it("tek kurusu dogru gosterir", () => {
    expect(formatMoney(1)).toBe("0,01 ₺");
  });

  it("binlik ayraci ekler", () => {
    expect(formatMoney(123456789)).toBe("1.234.567,89 ₺");
  });

  it("negatif tutari isaretiyle gosterir", () => {
    expect(formatMoney(-12050)).toBe("-120,50 ₺");
  });

  it("farkli para birimlerinin sembolunu kullanir", () => {
    expect(formatMoney(12050, "USD")).toBe("120,50 $");
    expect(formatMoney(12050, "EUR")).toBe("120,50 €");
  });

  it("bilinmeyen para biriminde kodun kendisini gosterir", () => {
    expect(formatMoney(12050, "JPY")).toBe("120,50 JPY");
  });

  it("izin verilen en buyuk tutarda tasma yapmaz", () => {
    expect(formatMoney(2_147_483_647)).toBe("21.474.836,47 ₺");
  });
});

describe("formatSignedMoney", () => {
  it("alacagi arti isaretiyle gosterir", () => {
    expect(formatSignedMoney(12050)).toBe("+120,50 ₺");
  });

  it("borcu eksi isaretiyle gosterir", () => {
    expect(formatSignedMoney(-12050)).toBe("−120,50 ₺");
  });

  it("sifira isaret koymaz", () => {
    expect(formatSignedMoney(0)).toBe("0,00 ₺");
  });

  it("eksi icin kisa tire degil U+2212 kullanir", () => {
    // Kisa tire (U+002D) rakamlardan dar oldugu icin tutarlarin hizasini
    // bozar. Bu testin varlik sebebi: birisi ileride "-" yazarsa fark edelim.
    expect(formatSignedMoney(-100).charCodeAt(0)).toBe(0x2212);
    expect(formatSignedMoney(-100)).not.toContain("-");
  });

  it("binlik ayracini ve para birimini korur", () => {
    expect(formatSignedMoney(-123456789, "USD")).toBe("−1.234.567,89 $");
  });
});

describe("parseMoney", () => {
  it("virgullu ondalik girisi cevirir", () => {
    expect(parseMoney("120,50")).toBe(12050);
  });

  it("noktali ondalik girisi de cevirir", () => {
    expect(parseMoney("120.50")).toBe(12050);
  });

  it("tek ondalik basamagi iki basamaga tamamlar", () => {
    expect(parseMoney("120,5")).toBe(12050);
  });

  it("ondaliksiz girisi lira olarak kabul eder", () => {
    expect(parseMoney("120")).toBe(12000);
  });

  it("uc basamakli ayraci binlik olarak yorumlar", () => {
    expect(parseMoney("1.234")).toBe(123400);
    expect(parseMoney("1,234")).toBe(123400);
  });

  it("binlik + ondalik birlikte kullanildiginda dogru cozer", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("1,234.56")).toBe(123456);
    expect(parseMoney("1.234.567,89")).toBe(123456789);
  });

  it("bosluklari ve para birimi sembolunu yok sayar", () => {
    expect(parseMoney(" 120,50 ₺ ")).toBe(12050);
    expect(parseMoney("$120.50")).toBe(12050);
  });

  it("yalnizca kurus girisini kabul eder", () => {
    expect(parseMoney(",50")).toBe(50);
  });

  it("sifiri kabul eder", () => {
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("0,00")).toBe(0);
  });

  it("negatif girisi isaretiyle cevirir", () => {
    expect(parseMoney("-120,50")).toBe(-12050);
  });

  it("bos girisi reddeder", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("   ")).toBeNull();
  });

  it("harf iceren girisi reddeder", () => {
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("120 TL")).toBeNull();
  });

  it("ikiden fazla ondalik basamagi reddeder", () => {
    expect(parseMoney("120,5678")).toBeNull();
  });

  it("yarim kalmis girisi reddeder", () => {
    expect(parseMoney("120,")).toBeNull();
    expect(parseMoney(",")).toBeNull();
  });

  it("guvenli tam sayi sinirini asan girisi reddeder", () => {
    expect(parseMoney("99999999999999999999")).toBeNull();
  });

  it("format edilmis bir tutar tekrar ayni sayiya cozulur (gidis-donus)", () => {
    for (const amount of [0, 1, 99, 100, 12050, 123456789, 2_147_483_647]) {
      expect(parseMoney(formatMoney(amount))).toBe(amount);
    }
  });
});

describe("parsePercentageToBasisPoints", () => {
  it("tam yuzdeyi cevirir", () => {
    expect(parsePercentageToBasisPoints("100")).toBe(10000);
    expect(parsePercentageToBasisPoints("50")).toBe(5000);
  });

  it("ondalikli yuzdeyi cevirir", () => {
    expect(parsePercentageToBasisPoints("33,33")).toBe(3333);
    expect(parsePercentageToBasisPoints("33.34")).toBe(3334);
  });

  it("tek ondalik basamagi tamamlar", () => {
    expect(parsePercentageToBasisPoints("12,5")).toBe(1250);
  });

  it("negatif yuzdeyi reddeder", () => {
    expect(parsePercentageToBasisPoints("-10")).toBeNull();
  });

  it("gecersiz girisi reddeder", () => {
    expect(parsePercentageToBasisPoints("abc")).toBeNull();
    expect(parsePercentageToBasisPoints("")).toBeNull();
  });
});

describe("formatBasisPoints", () => {
  it("tam yuzdeyi ondaliksiz gosterir", () => {
    expect(formatBasisPoints(10000)).toBe("%100");
    expect(formatBasisPoints(5000)).toBe("%50");
  });

  it("ondalikli yuzdeyi iki basamakla gosterir", () => {
    expect(formatBasisPoints(3333)).toBe("%33,33");
    expect(formatBasisPoints(1250)).toBe("%12,50");
  });

  it("sifiri gosterir", () => {
    expect(formatBasisPoints(0)).toBe("%0");
  });
});
