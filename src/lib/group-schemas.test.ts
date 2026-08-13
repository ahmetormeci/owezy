import { describe, expect, it } from "vitest";
import { createGroupSchema, updateGroupSchema } from "@/lib/group-schemas";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

// Bu semanin currency alani bir DOGRULUK siniri, tercih degil: formatMoney ve
// parseMoney her para biriminin iki ondalik basamagi oldugunu varsayiyor.
// Sifir ondalikli bir kod (JPY) buradan gecerse o gruptaki butun tutarlar
// 100 kat kucuk gorunur - ve arayuz bunu hicbir yerde belli etmez.
describe("createGroupSchema - currency", () => {
  it("desteklenen para birimlerini kabul eder", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      const result = createGroupSchema.safeParse({ name: "Grup", currency });
      expect(result.success).toBe(true);
    }
  });

  it("currency verilmezse gecerli (servis TRY'ye dusuyor)", () => {
    const result = createGroupSchema.safeParse({ name: "Grup" });
    expect(result.success).toBe(true);
  });

  // Asil hata buydu: sema uc harfli HER kodu geciriyordu.
  it("desteklenmeyen uc harfli kodu reddeder", () => {
    const result = createGroupSchema.safeParse({ name: "Grup", currency: "JPY" });

    expect(result.success).toBe(false);
    // Mesaj degil KOD tasiniyor - semayi istemci de kullaniyor ve ceviriyi
    // gosteren taraf yapiyor.
    expect(result.error?.issues[0].message).toBe("validation.currency_unsupported");
  });

  it("kucuk harfli yazimi reddeder", () => {
    // Eski .length(3) bunu geciriyordu ve "try" olarak saklaniyordu; sembol
    // tablosunda karsiligi olmadigi icin ekranda "1.200,00 try" yaziyordu.
    const result = createGroupSchema.safeParse({ name: "Grup", currency: "try" });
    expect(result.success).toBe(false);
  });

  it("uc harften uzun kodu reddeder", () => {
    const result = createGroupSchema.safeParse({ name: "Grup", currency: "TRYX" });
    expect(result.success).toBe(false);
  });
});

describe("updateGroupSchema", () => {
  // Grubun para birimi olusturulduktan sonra DEGISMEZ: mevcut harcama ve
  // odemeler kendi currency'lerini saklamis durumda ve DB trigger'i bunlarin
  // grubunkiyle ayni olmasini sart kosuyor.
  it("currency alanini tasimaz, gonderilse bile eler", () => {
    const result = updateGroupSchema.safeParse({ name: "Yeni ad", currency: "USD" });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("currency");
  });
});
