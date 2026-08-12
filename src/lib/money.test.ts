import { describe, expect, it } from "vitest";
import {
  formatBasisPoints,
  formatBasisPointsForInput,
  formatMoney,
  formatMoneyForInput,
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

describe("formatMoney - dil", () => {
  it("Ingilizcede ondalik ayraci nokta, binlik ayraci virgul olur", () => {
    expect(formatMoney(123456789, "USD", "en")).toBe("$1,234,567.89");
  });

  it("Ingilizcede sembol basa gelir, Turkcede sona", () => {
    expect(formatMoney(12050, "USD", "en")).toBe("$120.50");
    expect(formatMoney(12050, "USD", "tr")).toBe("120,50 $");
  });

  it("dil belirtilmezse Turkce davranir", () => {
    // Mevcut cagrilarin hicbiri dil vermiyor; varsayilan degisirse
    // butun arayuz sessizce degisir. Bu test onu sabitliyor.
    expect(formatMoney(12050, "USD")).toBe(formatMoney(12050, "USD", "tr"));
  });

  it("grup para birimi TRY olsa da yerlesim dile gore belirlenir", () => {
    // Para birimi gruba ait, dil kullaniciya ait. Ingilizce konusan bir uye
    // TRY'li bir grupta sembolu yine basta gorur.
    expect(formatMoney(12050, "TRY", "en")).toBe("₺120.50");
  });

  it("negatif tutarda isaret en basta durur", () => {
    expect(formatMoney(-12050, "USD", "en")).toBe("-$120.50");
  });

  it("bilinmeyen para biriminde kod basa yapistirilmaz", () => {
    // "JPY120.50" okunmaz. Kod bir sembol degil, bosluklu ve sonda durmali.
    expect(formatMoney(12050, "JPY", "en")).toBe("120.50 JPY");
  });

  it("Ingilizce ciktisi parseMoney tarafindan geri cozulebilir", () => {
    // Dil degistiginde ekrandaki tutarin tekrar okunabilir kalmasi sart:
    // kullanici bir tutari kopyalayip forma yapistirabilir.
    for (const amount of [0, 1, 99, 12050, 123456789]) {
      expect(parseMoney(formatMoney(amount, "USD", "en"))).toBe(amount);
    }
  });
});

describe("formatBasisPoints - dil", () => {
  it("Turkcede yuzde isareti basta, Ingilizcede sonda durur", () => {
    expect(formatBasisPoints(3333, "tr")).toBe("%33,33");
    expect(formatBasisPoints(3333, "en")).toBe("33.33%");
  });

  it("tam sayi yuzdede ondalik gostermez", () => {
    expect(formatBasisPoints(5000, "tr")).toBe("%50");
    expect(formatBasisPoints(5000, "en")).toBe("50%");
  });

  it("dil belirtilmezse Turkce davranir", () => {
    expect(formatBasisPoints(3333)).toBe(formatBasisPoints(3333, "tr"));
  });
});

describe("parseMoney - dilden bagimsizligi", () => {
  // Bu testler bir DAVRANISI degil, bir KARARI koruyor: parseMoney bilerek
  // dile duyarli degil, cunku kurali ayracin kimligine degil ondan sonraki
  // basamak sayisina bakiyor. Iki yazim da ayni sonuca cikmali.
  it("iki yazim da ayni sonucu verir", () => {
    const pairs: Array<[string, string]> = [
      ["2.500", "2,500"],
      ["2,50", "2.50"],
      ["1.234,56", "1,234.56"],
      ["12.345.678,90", "12,345,678.90"],
    ];
    for (const [turkish, english] of pairs) {
      expect(parseMoney(turkish)).toBe(parseMoney(english));
      expect(parseMoney(turkish)).not.toBeNull();
    }
  });

  it("numpad aliskanligiyla yazilan noktali tutari kabul eder", () => {
    // Bu girdi katı bir dil kuralinda reddedilirdi. Reddedilmemeli.
    expect(parseMoney("120.50")).toBe(12050);
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

  it("dili formatMoney'e gecirir ve isaret en basta kalir", () => {
    expect(formatSignedMoney(12050, "USD", "en")).toBe("+$120.50");
    expect(formatSignedMoney(-12050, "USD", "en")).toBe("−$120.50");
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

describe("formatMoneyForInput", () => {
  it("tam sayida ondalik kismi yazilmaz", () => {
    expect(formatMoneyForInput(12000)).toBe("120");
    expect(formatMoneyForInput(0)).toBe("0");
  });

  it("kurus kismi iki basamakli yazilir", () => {
    expect(formatMoneyForInput(12050)).toBe("120,50");
    expect(formatMoneyForInput(12005)).toBe("120,05");
  });

  it("binlik ayraci ve para birimi simgesi YOK", () => {
    // formatMoney burada "1.234.567,89 TL" yazardi; bu cikti bir input alanina
    // gidiyor ve kullanicinin duzenleyecegi metin olmali.
    expect(formatMoneyForInput(123456789)).toBe("1234567,89");
  });

  it("ondalik ayraci dile gore degisir", () => {
    expect(formatMoneyForInput(12050, "tr")).toBe("120,50");
    expect(formatMoneyForInput(12050, "en")).toBe("120.50");
  });

  it("negatif tutarda isaret korunur", () => {
    expect(formatMoneyForInput(-12050)).toBe("-120,50");
  });

  // Asil sozlesme bu: forma yazilan metin parseMoney'den ayni sayiyla donmeli.
  // Aksi halde kullanici hicbir seye dokunmadan kaydettiginde tutar degisirdi.
  it("parseMoney ile gidip gelen deger degismez", () => {
    for (const minorUnits of [0, 1, 99, 100, 12005, 12050, 123456789]) {
      expect(parseMoney(formatMoneyForInput(minorUnits, "tr"))).toBe(minorUnits);
      expect(parseMoney(formatMoneyForInput(minorUnits, "en"))).toBe(minorUnits);
    }
  });
});

describe("formatBasisPointsForInput", () => {
  it("yuzde isareti YOK (o, alanin etiketinde)", () => {
    expect(formatBasisPointsForInput(3333)).toBe("33,33");
    expect(formatBasisPointsForInput(5000)).toBe("50");
    expect(formatBasisPointsForInput(10000)).toBe("100");
  });

  it("ondalik ayraci dile gore degisir", () => {
    expect(formatBasisPointsForInput(3333, "en")).toBe("33.33");
  });

  it("parsePercentageToBasisPoints ile gidip gelen deger degismez", () => {
    for (const basisPoints of [0, 1, 3333, 5000, 6667, 10000]) {
      expect(parsePercentageToBasisPoints(formatBasisPointsForInput(basisPoints))).toBe(
        basisPoints,
      );
    }
  });
});
