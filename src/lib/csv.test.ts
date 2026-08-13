import { describe, expect, it } from "vitest";
import { CSV_BOM, csvSeparator, toCsv } from "@/lib/csv";

describe("csvSeparator", () => {
  // Ayrac ile ondalik birlikte degismek zorunda: Turkce Excel ";" bekliyor ve
  // ondaligi virgul okuyor. Virgullu ondaligi virgullu ayracla yazsaydik
  // "120,50" tek deger degil iki hucre olurdu.
  it("Turkcede noktali virgul, Ingilizcede virgul", () => {
    expect(csvSeparator("tr")).toBe(";");
    expect(csvSeparator("en")).toBe(",");
  });

  it("dil belirtilmezse Turkce davranir", () => {
    expect(csvSeparator()).toBe(csvSeparator("tr"));
  });
});

describe("CSV_BOM", () => {
  it("tek bir U+FEFF karakteri", () => {
    expect(CSV_BOM).toBe("﻿");
    expect(CSV_BOM).toHaveLength(1);
    expect(CSV_BOM.codePointAt(0)).toBe(0xfeff);
  });
});

describe("toCsv", () => {
  it("duz degerleri ayracla birlestirir", () => {
    expect(toCsv([["a", "b"], ["c", "d"]], "tr")).toBe("a;b\r\nc;d");
  });

  it("satirlari CRLF ile ayirir", () => {
    // RFC 4180 ve Excel'in bekledigi bicim. Yalniz \n yazsaydik bazi
    // Excel surumleri butun dosyayi tek satir gorurdu.
    expect(toCsv([["a"], ["b"]], "en")).toBe("a\r\nb");
  });

  // Aciklama alani kullanicidan geliyor: "Yemek; icki" gibi bir metin
  // tirnaklanmazsa satiri iki hucreye boler ve o satirdan sonra tablo kayar.
  it("ayrac iceren degeri tirnaklar", () => {
    expect(toCsv([["Yemek; icki"]], "tr")).toBe('"Yemek; icki"');
  });

  // Ayni metin Ingilizce dosyada tirnaga GEREK DUYMUYOR, cunku orada ayrac
  // virgul. Kacis kurali ayraca bagli, sabit bir karakter listesine degil.
  it("tirnaklama karari ayraca gore veriliyor", () => {
    expect(toCsv([["Yemek; icki"]], "en")).toBe("Yemek; icki");
    expect(toCsv([["Yemek, icki"]], "en")).toBe('"Yemek, icki"');
    expect(toCsv([["Yemek, icki"]], "tr")).toBe("Yemek, icki");
  });

  it("cift tirnagi ikiye katlar ve tirnaklar", () => {
    expect(toCsv([['12" pizza']], "tr")).toBe('"12"" pizza"');
  });

  it("satir sonu iceren degeri tirnaklar", () => {
    expect(toCsv([["ilk\nikinci"]], "tr")).toBe('"ilk\nikinci"');
    expect(toCsv([["ilk\r\nikinci"]], "tr")).toBe('"ilk\r\nikinci"');
  });

  it("bos deger ve bos liste bozulmaz", () => {
    expect(toCsv([["", "a"]], "tr")).toBe(";a");
    expect(toCsv([], "tr")).toBe("");
  });

  // Turkce tutar bicimi virgullu; noktali virgul ayracla yan yana geldiginde
  // tirnaga gerek kalmiyor ve Excel degeri sayi olarak okuyor.
  it("Turkce tutar bicimi tirnaksiz gecer", () => {
    expect(toCsv([["Market", "120,50"]], "tr")).toBe("Market;120,50");
  });
});
