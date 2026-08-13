import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, foldForSearch } from "@/lib/search-fold";

describe("foldForSearch - tablo butunlugu", () => {
  // Tablolar farkli uzunlukta olsaydi translate() sessizce karakter DUSURURDU
  // ve katlama SQL ile JS arasinda ayrisirdi.
  it("kaynak ve hedef tablolari ayni uzunlukta", () => {
    expect(FOLD_FROM).toHaveLength(FOLD_TO.length);
  });

  it("kaynak tablosunda tekrar eden karakter yok", () => {
    expect(new Set(FOLD_FROM).size).toBe(FOLD_FROM.length);
  });
});

describe("foldForSearch", () => {
  // Asil hata buydu: buyuk I kucultuldugunde "i" oluyor, "ı" degil.
  it("noktali ve noktasiz i ayni yere duser", () => {
    for (const value of ["Isik", "ısık", "İSİK", "isik", "IŞIK", "ışık"]) {
      expect(foldForSearch(value)).toBe("isik");
    }
  });

  it("diger Turkce harfler ASCII karsiligina iner", () => {
    expect(foldForSearch("Çay")).toBe("cay");
    expect(foldForSearch("ÖĞLE")).toBe("ogle");
    expect(foldForSearch("şükrü")).toBe("sukru");
    expect(foldForSearch("Güneş")).toBe("gunes");
  });

  it("aksana duyarsiz hale geliyor - bu istenen yan etki", () => {
    expect(foldForSearch("saç")).toBe(foldForSearch("sac"));
    expect(foldForSearch("kahvaltı")).toBe(foldForSearch("kahvalti"));
  });

  it("Turkce olmayan metni yalnizca kucultur", () => {
    expect(foldForSearch("Market Alisveris")).toBe("market alisveris");
    expect(foldForSearch("UBER 42")).toBe("uber 42");
  });

  it("bos metin ve noktalama bozulmaz", () => {
    expect(foldForSearch("")).toBe("");
    expect(foldForSearch("A-1; B_2")).toBe("a-1; b_2");
  });

  it("ayni girdi her zaman ayni ciktiyi verir", () => {
    const input = "İstanbul'da ÖĞLE yemegi";
    expect(foldForSearch(input)).toBe(foldForSearch(input));
  });

  // "İ" once tabloyla cevrilmezse JS onu "i + birlesik nokta"ya donusturur ve
  // sonuc tek karakterlik "i" olmaz - aramada eslesme kaybolurdu.
  it("buyuk I nokta birakmadan katlaniyor", () => {
    const folded = foldForSearch("İ");
    expect(folded).toBe("i");
    expect(folded).toHaveLength(1);
  });
});
