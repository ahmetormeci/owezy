import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES_EN, MESSAGES_TR, translate } from "@/lib/messages";

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

describe("kullanilan kodlar sozlukte var mi", () => {
  // NEDEN BU TEST VAR: translate() bilerek "string" kabul ediyor (sunucu ile
  // istemci farkli surumde olabilir, bilinmeyen kodda patlamak yerine kodu
  // gosteriyor). Bunun bedeli, arayuzdeki bir yazim hatasinin DERLEMEDE
  // yakalanmamasi: t("ui.yanlis_kod") ekranda "ui.yanlis_kod" yazar.
  //
  // Bu tam olarak yasandi: t("ui.use_suggested_amount") yazildi, sozlukte
  // yoktu, tsc sustu. E2E'nin bakligi bir metindi - orada patlayacakti.
  it("kaynak kodda gecen her ui.* kodu sozlukte tanimli", () => {
    const root = path.join(process.cwd(), "src");
    const missing: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          // Test dosyalari haric: ornek/karsi-ornek kodlar iceriyorlar.
        } else if (
          /\.tsx?$/.test(entry.name) &&
          !/\.test\.tsx?$/.test(entry.name) &&
          entry.name !== "messages.ts"
        ) {
          const source = fs.readFileSync(full, "utf8");
          for (const match of source.matchAll(/"(ui\.[a-z0-9_]+)"/g)) {
            const code = match[1];
            if (!(code in MESSAGES_TR)) {
              missing.push(`${code}  (${path.relative(root, full)})`);
            }
          }
        }
      }
    };

    walk(root);
    expect(missing, `sozlukte olmayan kodlar:\n${missing.join("\n")}`).toEqual([]);
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

describe("Ingilizce sozluk", () => {
  it("kodu Ingilizce metne cevirir", () => {
    expect(translate("group.not_found", undefined, "en")).toBe("Group not found");
  });

  it("Ingilizcede de yer tutuculari doldurur", () => {
    expect(translate("ui.paid_by", { name: "Ayse" }, "en")).toBe("paid by Ayse");
  });

  it("dil verilmezse Turkce kalir", () => {
    // Varsayilanin Turkce olmasi 24 E2E testinin dayandigi sey.
    expect(translate("group.not_found")).toBe("Grup bulunamadı");
  });

  // ASIL TEST BU. Sozlugun EKSIKSIZ olmasini tsc garantiliyor
  // (Record<MessageCode, string>), ama yer tutuculari garantilemiyor:
  // "{amount} kurusluk alacagi var" cumlesini "has a credit" diye cevirmek
  // derlenir, testler gecer, ve ekranda TUTAR KAYBOLUR. Sayinin dustugunu
  // kimse fark etmez cunku cumle hala anlamlidir.
  it("her kodun yer tutuculari iki dilde ayni", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    const mismatched: string[] = [];
    for (const code of Object.keys(MESSAGES_TR) as (keyof typeof MESSAGES_TR)[]) {
      const tr = placeholders(MESSAGES_TR[code]);
      const en = placeholders(MESSAGES_EN[code]);
      if (tr.join(",") !== en.join(",")) {
        mismatched.push(`${code}: tr={${tr.join(",")}} en={${en.join(",")}}`);
      }
    }

    expect(mismatched, `yer tutucular uyusmuyor:\n${mismatched.join("\n")}`).toEqual([]);
  });

  it("hicbir Ingilizce metin bos degil", () => {
    for (const [code, text] of Object.entries(MESSAGES_EN)) {
      expect(text.trim(), `${code} bos`).not.toBe("");
    }
  });

  it("hicbir Ingilizce metin kod gibi gorunmuyor", () => {
    for (const [code, text] of Object.entries(MESSAGES_EN)) {
      expect(text, `${code} deger yerine kod iceriyor`).not.toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  // Kopyala-yapistir kalintisi: Ingilizce sozluge Turkce metin birakmak.
  // Turkce'ye ozgu harfler bunun en ucuz kanitidir.
  it("Ingilizce sozlukte Turkce harf kalmamis", () => {
    const leftovers: string[] = [];
    for (const [code, text] of Object.entries(MESSAGES_EN)) {
      if (/[çğışöüÇĞİŞÖÜ]/.test(text)) {
        leftovers.push(`${code}: ${text}`);
      }
    }
    expect(leftovers, `Turkce metin kalmis:\n${leftovers.join("\n")}`).toEqual([]);
  });
});
