import { describe, expect, it } from "vitest";
import {
  formatIban,
  isIbanRecentlyChanged,
  isValidIban,
  maskIban,
  normalizeIban,
} from "@/lib/iban";

/**
 * Ornekler SWIFT IBAN kaydindaki ve bankalarin yayinladigi ORNEK IBAN'lar -
 * gercek bir kisinin hesabi degil. Kontrol haneleri dogru.
 */
const VALID = [
  "TR330006100519786457841326",
  "DE89370400440532013000",
  "GB82WEST12345698765432",
  "FR1420041010050500013M02606",
  "NL91ABNA0417164300",
  "BE68539007547034",
  "NO9386011117947", // en kisa (15)
  "CH9300762011623852957",
];

describe("normalizeIban", () => {
  it("bosluklari atar ve harfleri buyutur", () => {
    expect(normalizeIban(" tr33 0006 1005 1978 6457 8413 26 ")).toBe("TR330006100519786457841326");
  });

  it("sekme ve satir sonunu da atar (kopyala-yapistir)", () => {
    expect(normalizeIban("TR33\t0006\n1005 19786457841326")).toBe("TR330006100519786457841326");
  });

  it("kucuk i'yi noktali I'ya CEVIRMEZ (Turkce yerel ayar tuzagi)", () => {
    // "gb82west..." icindeki harflerin hicbiri "İ" olmamali.
    expect(normalizeIban("gb82west12345698765432")).toBe("GB82WEST12345698765432");
    expect(normalizeIban("xi")).toBe("XI");
  });
});

describe("isValidIban", () => {
  it.each(VALID)("gecerli ornek: %s", (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  it("tek bir yanlis haneyi reddeder (kontrol hanesi)", () => {
    expect(isValidIban("TR330006100519786457841327")).toBe(false);
  });

  it("yer degistirmis iki haneyi reddeder", () => {
    // ...8413 26 -> ...8413 62
    expect(isValidIban("TR330006100519786457841362")).toBe(false);
  });

  it("eksik haneyi reddeder (TR 26 karakter olmali)", () => {
    expect(isValidIban("TR33000610051978645784132")).toBe(false);
  });

  it("fazla haneyi reddeder", () => {
    expect(isValidIban("TR3300061005197864578413260")).toBe(false);
  });

  it("IBAN kullanmayan ulkeyi reddeder", () => {
    expect(isValidIban("US12345678901234567890")).toBe(false);
  });

  it("normalize edilmemis girdiyi reddeder - tolerans normalizeIban'da", () => {
    expect(isValidIban("TR33 0006 1005 1978 6457 8413 26")).toBe(false);
    expect(isValidIban("tr330006100519786457841326")).toBe(false);
  });

  it("harf disi isaretleri reddeder", () => {
    expect(isValidIban("TR33-0006-1005-1978-6457-8413-26")).toBe(false);
    expect(isValidIban("")).toBe(false);
  });
});

describe("formatIban", () => {
  it("4'erli gruplar, sonda bosluk yok", () => {
    expect(formatIban("TR330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26");
    expect(formatIban("BE68539007547034")).toBe("BE68 5390 0754 7034");
  });
});

describe("maskIban", () => {
  it("yalnizca ulke kodu ve son dort hane gorunur", () => {
    const masked = maskIban("TR330006100519786457841326");
    expect(masked).toBe("TR•• •••• 1326");
    expect(masked).not.toContain("0006");
  });
});

describe("isIbanRecentlyChanged", () => {
  const now = new Date("2026-09-27T12:00:00Z");

  it("hic degismemisse (null) uyari yok", () => {
    expect(isIbanRecentlyChanged(null, now)).toBe(false);
  });

  it("6 gun once degismisse uyari var", () => {
    expect(isIbanRecentlyChanged(new Date("2026-09-21T12:00:01Z"), now)).toBe(true);
  });

  it("tam 7 gun once degismisse uyari yok - pencere 7 gun", () => {
    expect(isIbanRecentlyChanged(new Date("2026-09-20T12:00:00Z"), now)).toBe(false);
  });

  it("JSON'dan gelen metin tarihi de kabul eder", () => {
    expect(isIbanRecentlyChanged("2026-09-26T12:00:00.000Z", now)).toBe(true);
  });
});
