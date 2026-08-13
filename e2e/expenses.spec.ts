import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import {
  addEqualExpense,
  createGroupAndOpen,
  createInviteLink,
  joinViaInvite,
  openGroup,
  pageAs,
  uniqueGroupName,
} from "./helpers";

test.describe("harcamalar", () => {
  test("esit bolusumlu harcama eklenir, listede ve bakiyede gorunur", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("harcama"));

    await addEqualExpense(page, { description: "Market alisverisi", amount: "120,50" });

    await expect(page.getByText("Market alisverisi")).toBeVisible();
    await expect(page.getByText("120,50 ₺").first()).toBeVisible();

    // Tek kisilik grupta harcamanin tamami kendine ait: net bakiye sifir.
    await expect(page.getByText("Ödeştin")).toBeVisible();
  });

  test("bolusum onizlemesi kalan kurusu gosterir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("onizleme"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Onizleme testi");
    await page.getByLabel("Tutar").fill("100");

    // Tek kisilik grupta tamami tek katilimciya dusuyor.
    await expect(page.getByText("Bölüşüm önizlemesi")).toBeVisible();
    await expect(page.getByText("100,00 ₺").first()).toBeVisible();
  });

  test("gecersiz tutar girildiginde uyari gosterilir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("gecersiz-tutar"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Bozuk tutar");
    await page.getByLabel("Tutar").fill("abc");

    await expect(page.getByText("Tutarı anlayamadım")).toBeVisible();
  });

  test("EXACT bolusumde paylarin toplami tutmazsa hata gosterilir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("exact-hata"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Eksik pay");
    await page.getByLabel("Tutar").fill("150");
    await page.getByLabel("Nasıl bölünecek?").selectOption("EXACT");

    // Tutar 150 TL ama paya 100 TL yaziyoruz: toplam tutmuyor.
    await page.locator('input[aria-label$="tutarı"]').first().fill("100");

    await expect(page.getByText(/toplamı .* eşit değil/)).toBeVisible();
  });

  test("harcama silinir, onay penceresi kapanir ve kayit listeden kalkar", async ({
    browser,
  }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("silme"));

    await addEqualExpense(page, { description: "Silinecek harcama", amount: "80" });
    await expect(page.getByText("Silinecek harcama")).toBeVisible();

    await page.getByRole("button", { name: "Sil", exact: true }).click();

    // Once pencerenin ACILDIGINI dogruluyoruz. Bunu atlarsak asagidaki
    // "kapandi mi" kontrolu, pencere hic acilmamis olsa da gecerdi.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sil", exact: true }).click();

    // Onay penceresinin KAPANDIGINI dogruluyoruz: acik kalirsa kullanici
    // islemi basarisiz saniyor ve tekrar deneyince "bulunamadi" aliyor.
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Silinecek harcama")).toBeHidden();
  });

  test("harcama duzenlenir ve yeni tutar bakiyeye yansir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("duzenleme"));

    await addEqualExpense(page, { description: "Duzenlenecek", amount: "50" });

    await page.getByRole("link", { name: "Düzenle" }).click();
    await page.getByLabel("Tutar").fill("75");
    await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

    await expect(page.getByText("75,00 ₺").first()).toBeVisible();
  });

  // Bu testin varlik sebebi bir hata: duzenleme formu yuzde alanlarini BOS
  // aciyordu, cunku yuzdeler hicbir yerde saklanmiyordu. Kullanici yalnizca
  // aciklamayi degistirmek istese bile butun yuzdeleri yeniden yazmak
  // zorunda kaliyordu - ve yaklasik yazarsa paylar sessizce degisiyordu.
  test("yuzdeli harcama duzenlenirken yuzdeler dolu gelir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("yuzde-duzenleme");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Yuzdeli harcama");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByLabel("Nasıl bölünecek?").selectOption("PERCENTAGE");

    const percentageInputs = owner.locator('input[aria-label$="yüzdesi"]');
    await percentageInputs.nth(0).fill("30");
    await percentageInputs.nth(1).fill("70");
    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();

    await expect(owner.getByText("Yuzdeli harcama")).toBeVisible();

    await owner.getByRole("link", { name: "Düzenle" }).first().click();

    // Asil iddia: alanlar dolu geliyor.
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(0)).toHaveValue("30");
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(1)).toHaveValue("70");

    // Ve yuzdelere hic dokunmadan yalnizca aciklamayi degistirip kaydetmek
    // bolusumu bozmuyor: form tekrar acildiginda ayni yuzdeler duruyor.
    await owner.getByLabel("Açıklama").fill("Yuzdeli harcama (aciklama degisti)");
    await owner.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

    await expect(owner.getByText("Yuzdeli harcama (aciklama degisti)")).toBeVisible();

    await owner.getByRole("link", { name: "Düzenle" }).first().click();
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(0)).toHaveValue("30");
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(1)).toHaveValue("70");
  });

  // Ozet ve ay basliklari (Faz 13). Buradaki asil iddia toplamlarin DOGRU
  // olmasi: ay basligindaki tutar ekrandaki satirlardan degil, grubun
  // tamamindan geliyor.
  test("ozet blogu ve ay basliklari dogru tutarlari gosterir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("ozet"));

    async function addExpense(input: {
      description: string;
      amount: string;
      date: string;
      category: string;
    }) {
      await page.getByRole("link", { name: "Harcama ekle" }).click();
      await page.getByLabel("Açıklama").fill(input.description);
      await page.getByLabel("Tutar").fill(input.amount);
      await page.getByLabel("Kategori").selectOption({ label: input.category });
      await page.getByLabel("Tarih").fill(input.date);
      await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(page.getByText(input.description)).toBeVisible();
    }

    await addExpense({
      description: "Villa kirasi",
      amount: "3000",
      date: "2026-08-10",
      category: "Konaklama",
    });
    await addExpense({
      description: "Aksam yemegi",
      amount: "1000",
      date: "2026-07-15",
      category: "Yemek",
    });

    // Ozet: toplam ve kategori kirilimi.
    await expect(page.getByText("4.000,00 ₺").first()).toBeVisible();
    await expect(page.getByText("3.000,00 ₺ · %75")).toBeVisible();
    await expect(page.getByText("1.000,00 ₺ · %25")).toBeVisible();

    // Ay adi IKI yerde geciyor: ozetteki aylik sutunun etiketinde ve listenin
    // ay basliginda. Baslik ".label" tasiyor (SectionHead ile ayni bicim),
    // sutun etiketi tasimiyor - iddiayi ona cipaliyoruz ki dogru olani
    // olctugumuzden emin olalim.
    await expect(page.locator(".label", { hasText: "Ağustos 2026" })).toBeVisible();
    await expect(page.locator(".label", { hasText: "Temmuz 2026" })).toBeVisible();

    // Ay toplami ve tekil/cogul. Bu metin yalnizca ay basliginda var.
    await expect(page.getByText("3.000,00 ₺ · 1 harcama")).toBeVisible();
    await expect(page.getByText("1.000,00 ₺ · 1 harcama")).toBeVisible();

    // Bakiyenin acilimi: tek kisilik grupta odedigin = payin, bakiye sifir.
    await expect(page.getByText("Bakiyen nasıl oluştu")).toBeVisible();

    await page.screenshot({ path: "test-results/faz13-ozet.png", fullPage: true });

    // Duzen hatalari normalde E2E'den kaciyor: testler metnin VARLIGINA
    // bakiyor, sayfanin kaydigina degil. 11.5'te mobilde yatay kayma tam da
    // bu yuzden ancak ekran goruntusuyle yakalanmisti. Ozet blogu yeni bir
    // grid ve sabit genislikli cubuklar getirdigi icin olcumu buraya aliyoruz.
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 800 });
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${width}px genisliginde sayfa yatay kayiyor`).toBe(false);
    }
  });

  // Arama ve filtre (Faz 13.3a). Filtre SUNUCUDA calisiyor; bu test onun
  // gorunur sonucunu dogruluyor - ozellikle "yalnizca beni ilgilendirenler"in
  // odeyene degil KATILIMCILIGA baktigini.
  test("arama ve filtreler listeyi daraltir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("filtre");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);

    async function addExpense(input: {
      description: string;
      amount: string;
      category: string;
      unselect?: string;
    }) {
      await owner.getByRole("link", { name: "Harcama ekle" }).click();
      await owner.getByLabel("Açıklama").fill(input.description);
      await owner.getByLabel("Tutar").fill(input.amount);
      await owner.getByLabel("Kategori").selectOption({ label: input.category });
      if (input.unselect) {
        await owner.getByRole("checkbox", { name: input.unselect }).uncheck();
      }
      await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(owner.getByText(input.description)).toBeVisible();
    }

    await addExpense({ description: "Market alisverisi", amount: "100", category: "Alışveriş" });
    // Owner bu bolusumden CIKARILIYOR: parayi o odedi ama payi yok.
    await addExpense({
      description: "Havaalani taksisi",
      amount: "200",
      category: "Ulaşım",
      unselect: "e2e+clerk_test@example.com",
    });

    const search = owner.getByLabel("Harcama ara");

    // 1) Metin aramasi.
    await search.fill("market");
    await expect(owner.getByText("Havaalani taksisi")).toBeHidden();
    await expect(owner.getByText("Market alisverisi")).toBeVisible();
    await expect(owner.getByText("1 sonuç · 100,00 ₺")).toBeVisible();

    // 2) Kategori filtresi.
    await search.fill("");
    await owner.getByLabel("Kategori").selectOption({ label: "Ulaşım" });
    await expect(owner.getByText("Market alisverisi")).toBeHidden();
    await expect(owner.getByText("Havaalani taksisi")).toBeVisible();
    await expect(owner.getByText("1 sonuç · 200,00 ₺")).toBeVisible();

    // 3) "Yalnizca beni ilgilendirenler": taksi owner'in payinda olmadigi icin
    //    dusmeli, market kalmali.
    await owner.getByLabel("Kategori").selectOption({ label: "Tüm kategoriler" });
    await owner.getByLabel("Yalnızca beni ilgilendirenler").check();
    await expect(owner.getByText("Havaalani taksisi")).toBeHidden();
    await expect(owner.getByText("Market alisverisi")).toBeVisible();

    await owner.screenshot({ path: "test-results/faz13-filtre.png", fullPage: true });

    // 4) Filtre kalkinca liste geri geliyor ve ay toplamlari yeniden yaziliyor.
    await owner.getByLabel("Yalnızca beni ilgilendirenler").uncheck();
    await expect(owner.getByText("Havaalani taksisi")).toBeVisible();
    await expect(owner.getByText("300,00 ₺ · 2 harcama")).toBeVisible();
  });

  // CSV disa aktarma (Faz 13.3b). Iddia dosyanin INDIGI degil, ICERIGI:
  // Excel'in okuyabilmesi icin BOM, Turkce yerelde ";" ayrac, ve ayrac iceren
  // bir aciklamanin tirnaklanmasi.
  test("CSV disa aktarma Excel'in okuyabilecegi bicimde ve filtreyi izler", async ({
    browser,
  }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("csv"));

    async function addExpense(description: string, amount: string) {
      await page.getByRole("link", { name: "Harcama ekle" }).click();
      await page.getByLabel("Açıklama").fill(description);
      await page.getByLabel("Tutar").fill(amount);
      await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(page.getByText(description)).toBeVisible();
    }

    // Aciklamada NOKTALI VIRGUL var: Turkce dosyada ayracin ta kendisi.
    // Tirnaklanmazsa satiri iki hucreye boler ve tablo kayar.
    // Ondalikli tutar bilerek: Turkce dosyada ondalik ayraci VIRGUL olmali ve
    // ayrac noktali virgul oldugu icin ikisi cakismamali.
    await addExpense("Market; alisveris", "120,50");
    await addExpense("Taksi", "200");

    async function downloadCsv() {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Dışa aktar" }).click();
      const download = await downloadPromise;
      const path = await download.path();
      return { text: readFileSync(path, "utf8"), name: download.suggestedFilename() };
    }

    const all = await downloadCsv();

    // Excel UTF-8'i ancak BOM ile taniyor; onsuz Turkce harfler bozuluyor.
    expect(all.text.startsWith("﻿")).toBe(true);
    expect(all.name).toMatch(/\.csv$/);

    const lines = all.text.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Tarih;Açıklama;Kategori;Ödeyen;Tutar (TRY);Payın (TRY)");

    // Ayrac iceren aciklama tirnakli; tutarlar Turkce ondalikla ve para birimi
    // simgesi olmadan (simgeli olsa Excel metin okurdu).
    expect(all.text).toContain('"Market; alisveris"');
    // Ondalik VIRGUL, ayrac NOKTALI VIRGUL - Turkce Excel ikisini de dogru
    // okuyor. Tam sayida ondalik hic yazilmiyor; Excel yine sayi goruyor.
    expect(all.text).toContain(";120,50;120,50");
    expect(all.text).toContain(";200;200");
    expect(lines).toHaveLength(3);

    // Filtre acikken indirilen dosya da suzulmus olmali.
    await page.getByLabel("Harcama ara").fill("taksi");
    await expect(page.getByText("1 sonuç · 200,00 ₺")).toBeVisible();

    const filtered = await downloadCsv();
    const filteredLines = filtered.text.replace("﻿", "").split("\r\n");

    expect(filteredLines).toHaveLength(2);
    expect(filtered.text).toContain("Taksi");
    expect(filtered.text).not.toContain("Market");
  });
});
