import { describe, expect, it } from "vitest";
import {
  displayNameForLine,
  groupByMonth,
  shouldShowShare,
  visibleSecondaryFields,
} from "./expense-list-view";

const row = (date: string, category: string, payer: string) => ({ date, category, payer });

describe("visibleSecondaryFields", () => {
  it("ilk satirda uc alani da yaziyor", () => {
    expect(visibleSecondaryFields(row("29 Agu", "Yemek", "Baris odedi"), null)).toEqual([
      "29 Agu",
      "Yemek",
      "Baris odedi",
    ]);
  });

  it("tarih ve odeyen ayniysa yalnizca kategori kaliyor", () => {
    expect(
      visibleSecondaryFields(
        row("29 Agu", "Alisveris", "Baris odedi"),
        row("29 Agu", "Yemek", "Baris odedi"),
      ),
    ).toEqual(["Alisveris"]);
  });

  it("tarih degisince tarih geri geliyor", () => {
    expect(
      visibleSecondaryFields(
        row("28 Agu", "Yemek", "Baris odedi"),
        row("29 Agu", "Yemek", "Baris odedi"),
      ),
    ).toEqual(["28 Agu", "Yemek"]);
  });

  it("odeyen degisince odeyen geri geliyor", () => {
    expect(
      visibleSecondaryFields(
        row("29 Agu", "Yemek", "Ayse odedi"),
        row("29 Agu", "Yemek", "Baris odedi"),
      ),
    ).toEqual(["Yemek", "Ayse odedi"]);
  });

  /**
   * KATEGORI HIC ELENMIYOR. Elenebilseydi ustteki satirla her alani ayni
   * olan bir harcama BOS bir ikincil satir birakirdi.
   */
  it("uc alan da ayniyken bile kategori yaziliyor", () => {
    const same = row("29 Agu", "Yemek", "Baris odedi");
    expect(visibleSecondaryFields(same, same)).toEqual(["Yemek"]);
  });

  /**
   * MODULUN ASIL GEREKCESI. Ham expenseDate uzerinden karsilastirsaydik
   * 2026-08-29T23:00:00Z ile 2026-08-29T01:00:00Z ayni gune duser ve ikinci
   * satirin tarihi gizlenirdi - oysa UTC+3'te biri 30, oteki 29 Agustos.
   * Burada karsilastirilan sey YAZILACAK METIN oldugu icin iki tarih de
   * yaziliyor.
   */
  it("yerel gunleri farkli olan iki satirda iki tarih de yaziliyor", () => {
    expect(
      visibleSecondaryFields(
        row("29 Agu", "Yemek", "Baris odedi"),
        row("30 Agu", "Yemek", "Baris odedi"),
      ),
    ).toEqual(["29 Agu", "Yemek"]);
  });
});

describe("displayNameForLine", () => {
  it("e-postanin @ oncesini aliyor", () => {
    expect(displayNameForLine("bak@owezy.net")).toBe("bak");
  });

  it("gercek bir adi oldugu gibi birakiyor", () => {
    expect(displayNameForLine("Baris Yilmaz")).toBe("Baris Yilmaz");
  });

  /** "@" tasiyan ama e-posta OLMAYAN bir ad kirpilmamali. */
  it("icinde @ gecen bir adi kirpmiyor", () => {
    expect(displayNameForLine("Ali @ Ev")).toBe("Ali @ Ev");
  });

  it("alan adi noktasi olmayan bir metni kirpmiyor", () => {
    expect(displayNameForLine("bak@localhost")).toBe("bak@localhost");
  });

  it("@ ile baslayan bir kullanici adini bosaltmiyor", () => {
    expect(displayNameForLine("@baris")).toBe("@baris");
  });
});

describe("shouldShowShare", () => {
  it("pay tutarin aynisiyken yazilmiyor", () => {
    expect(shouldShowShare(12300, 12300)).toBe(false);
  });

  it("pay tutardan farkliyken yaziliyor", () => {
    expect(shouldShowShare(6150, 12300)).toBe(true);
  });

  /** Harcamaya hic katilmayan bir uye icin pay YOK - satirda da yazmamali. */
  it("pay tanimsizken yazilmiyor", () => {
    expect(shouldShowShare(undefined, 12300)).toBe(false);
  });

  /** Herkesin payi sifir olan bir kayit da tutarla ayni degil - yazilmali. */
  it("sifir pay yaziliyor", () => {
    expect(shouldShowShare(0, 12300)).toBe(true);
  });
});

describe("groupByMonth", () => {
  it("ardisik ayni ay satirlarini tek bloga topluyor", () => {
    const groups = groupByMonth([
      { expenseDate: "2026-08-29T10:00:00.000Z" },
      { expenseDate: "2026-08-01T10:00:00.000Z" },
      { expenseDate: "2026-07-30T10:00:00.000Z" },
    ]);
    expect(groups.map((group) => group.month)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0].expenses).toHaveLength(2);
  });

  /**
   * DILIM UTC. Date'e cevirip getMonth() kullansaydik UTC'nin gerisindeki bir
   * saat diliminde bu satir Temmuz'a duserdi ve Agustos'un toplamiyla
   * celisirdi.
   */
  it("ayin ilk gunu UTC'ye gore bolunuyor", () => {
    expect(groupByMonth([{ expenseDate: "2026-08-01T00:00:00.000Z" }])[0].month).toBe(
      "2026-08",
    );
  });

  it("bos listede bos donuyor", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
