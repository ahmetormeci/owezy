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
});
