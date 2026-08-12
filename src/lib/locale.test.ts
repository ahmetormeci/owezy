import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/locale";

describe("normalizeLocale", () => {
  it("desteklenen dilleri oldugu gibi dondurur", () => {
    expect(normalizeLocale("tr")).toBe("tr");
    expect(normalizeLocale("en")).toBe("en");
  });

  it("cerez yoksa varsayilana duser", () => {
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });

  // ASIL SEBEP BU. Cerez kullanicinin kontrolunde: tarayici konsolundan
  // document.cookie = "locale=zz" yazilabilir. Bu deger dogrudan
  // Intl.NumberFormat'a gitseydi RangeError firlatir, sunucuda render edilen
  // sayfa 500 verirdi - yani bir cerez duzenleyerek uygulamayi cokertmek
  // mumkun olurdu.
  it.each([
    ["zz", "desteklenmeyen dil kodu"],
    ["en-US", "bolgeli kod - beyaz listede yok"],
    ["EN", "buyuk harf"],
    ["", "bos metin"],
    ["tr; DROP TABLE", "cop girdi"],
    ["../../etc/passwd", "yol denemesi"],
  ])("beklenmeyen degerde varsayilana duser: %s (%s)", (value) => {
    expect(normalizeLocale(value)).toBe(DEFAULT_LOCALE);
  });

  it("varsayilan dil Turkce", () => {
    // Bu deger degisirse 24 E2E testinin tamami Turkce metin bekliyor olur.
    expect(DEFAULT_LOCALE).toBe("tr");
  });
});
