import { describe, expect, it } from "vitest";
import { guessCategory } from "@/lib/expense-category-guess";

describe("guessCategory", () => {
  it("her kategoriyi yaygin bir aciklamadan bulur", () => {
    expect(guessCategory("Market alisverisi")).toBe("SHOPPING");
    expect(guessCategory("Dogalgaz faturasi")).toBe("BILLS");
    expect(guessCategory("Havaalani taksisi")).toBe("TRANSPORT");
    expect(guessCategory("Otel odasi")).toBe("ACCOMMODATION");
    expect(guessCategory("Aksam yemegi")).toBe("FOOD");
    expect(guessCategory("Sinema bileti")).toBe("ENTERTAINMENT");
  });

  it("buyuk harf ve Turkce karakter fark etmiyor", () => {
    // foldForSearch iki tarafi da ayni kumeye indiriyor; bu, aramada
    // 13.3a'da olculmus ve 14.4'te cozulmus bir isin yeniden kullanimi.
    expect(guessCategory("KAHVALTI")).toBe("FOOD");
    expect(guessCategory("Kahvaltı")).toBe("FOOD");
    expect(guessCategory("kahvalti")).toBe("FOOD");
    expect(guessCategory("DOĞALGAZ FATURASI")).toBe("BILLS");
  });

  it("unsuz yumusamasini yakalar", () => {
    // "yemek" -> "yemegi", "kebap" -> "kebabi", "simit" -> "simidi".
    // Bas eslesmesi tek basina yetmiyordu; kural koda yazildi.
    expect(guessCategory("Aksam yemegi")).toBe("FOOD");
    expect(guessCategory("Akşam yemeği")).toBe("FOOD");
    expect(guessCategory("Kebabi paylastik")).toBe("FOOD");
  });

  it("Turkce ekleri yakalar", () => {
    // Sinir 5'ten 4'e indirildi cunku "otel" gibi yaygin bir kelime ekli
    // halleriyle kaciriliyordu.
    expect(guessCategory("Otelde konaklama")).toBe("ACCOMMODATION");
    expect(guessCategory("Taksiyle eve donus")).toBe("TRANSPORT");
    expect(guessCategory("Elektrik faturasini odedim")).toBe("BILLS");
  });

  it("kisa anahtarlarda tam eslesme istiyor", () => {
    // "sok" bas eslesmesiyle calissaydi "sokak" da market sayilirdi;
    // "gaz" da "gazete"yi yakalardi.
    expect(guessCategory("Sokak temizligi")).toBeNull();
    expect(guessCategory("Gazete")).toBeNull();
    expect(guessCategory("Sok market")).toBe("SHOPPING");
  });

  it("marka adlarini taniyor", () => {
    expect(guessCategory("Migros")).toBe("SHOPPING");
    expect(guessCategory("Uber")).toBe("TRANSPORT");
    expect(guessCategory("Airbnb odemesi")).toBe("ACCOMMODATION");
    expect(guessCategory("Netflix")).toBe("ENTERTAINMENT");
    expect(guessCategory("A101")).toBe("SHOPPING");
  });

  it("ipucu yoksa null doner, OTHER degil", () => {
    // Ayrim onemli: null "bilmiyorum", OTHER "biliyorum, digeri" demek.
    // Cagiran taraf varsayilana kendisi karar veriyor.
    expect(guessCategory("Ahmete verdigim borc")).toBeNull();
    expect(guessCategory("")).toBeNull();
    expect(guessCategory("   ")).toBeNull();
    expect(guessCategory("12345")).toBeNull();
  });

  it("cakismada en uzun anahtar kazanir", () => {
    // "kahve" (5, FOOD) ile "market" (6, SHOPPING) ayni cumlede: daha uzun
    // anahtar daha ozgul bir ipucu sayiliyor.
    expect(guessCategory("Markette kahve aldim")).toBe("SHOPPING");
    // Tersi de dogru olmali.
    expect(guessCategory("Kahve")).toBe("FOOD");
  });

  it("noktalama ve fazla bosluk tahmini bozmuyor", () => {
    expect(guessCategory("  market,  alisveris ")).toBe("SHOPPING");
    expect(guessCategory("Taksi!")).toBe("TRANSPORT");
  });
});
