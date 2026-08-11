import { describe, expect, it } from "vitest";
import { MESSAGES_TR, translate } from "@/lib/messages";

describe("translate", () => {
  it("kodu metne cevirir", () => {
    expect(translate("group.not_found")).toBe("Grup bulunamadı");
  });

  it("yer tutuculari parametrelerle doldurur", () => {
    expect(translate("split.sum_mismatch", { total: 12000, amount: 10000 })).toBe(
      "payların toplamı (12000) amount'a (10000) eşit değil",
    );
  });

  it("ayni parametre birden fazla gecerse hepsini doldurur", () => {
    expect(translate("expense.participants_not_active", { userIds: "a, b" })).toBe(
      "Şu kullanıcılar grubun aktif üyesi değil: a, b",
    );
  });

  it("bilinmeyen kodda patlamaz, kodun kendisini dondurur", () => {
    // Sunucu ile istemci farkli surumlerde olabilir (kullanicinin sekmesi
    // acikken deploy edildi diyelim). O an bos ekran gostermek en kotusu.
    expect(translate("boyle.bir.kod.yok")).toBe("boyle.bir.kod.yok");
  });

  it("eksik parametreyi oldugu gibi birakir, undefined yazmaz", () => {
    // "undefined" yazan bir hata mesaji, hatanin kendisinden daha kafa
    // karistirici olur.
    expect(translate("split.sum_mismatch", { total: 5 })).toBe(
      "payların toplamı (5) amount'a ({amount}) eşit değil",
    );
  });

  it("parametre verilmezse sablonu bozmaz", () => {
    expect(translate("split.amount_too_large")).toBe("amount {max} değerini aşamaz");
  });
});

describe("sozluk butunlugu", () => {
  it("hicbir metin bos degil", () => {
    for (const [code, text] of Object.entries(MESSAGES_TR)) {
      expect(text.trim(), `${code} bos`).not.toBe("");
    }
  });

  it("hicbir metin kod gibi gorunmuyor", () => {
    // Kopyala-yapistir sirasinda anahtari deger yerine yazmak kolay bir hata;
    // ekranda "group.not_found" goren kullanici ne oldugunu anlamaz.
    for (const [code, text] of Object.entries(MESSAGES_TR)) {
      expect(text, `${code} deger yerine kod iceriyor`).not.toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it("yer tutucu sozdizimi bozuk degil", () => {
    // "{ad" gibi kapanmamis bir yer tutucu sessizce metinde kalir.
    for (const [code, text] of Object.entries(MESSAGES_TR)) {
      const opens = (text.match(/\{/g) ?? []).length;
      const closes = (text.match(/\}/g) ?? []).length;
      expect(opens, `${code} yer tutucu parantezleri eslesmiyor`).toBe(closes);
    }
  });
});
