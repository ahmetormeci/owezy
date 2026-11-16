import { test, expect } from "./fixtures";
import { addEqualExpense, createGroup, createGroupAndOpen, openGroup, pageAs, uniqueGroupName } from "./helpers";

test.describe("gruplar", () => {
  test("grup olusturulur ve listede gorunur", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    const name = uniqueGroupName("olusturma");

    await createGroup(page, name);

    // Sayfayi bastan yukleyip kaydin gercekten veritabaninda oldugunu
    // dogruluyoruz (yalnizca istemci durumunda kalmadigini).
    await page.reload();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("bos ad ile grup olusturulamaz", async ({ browser }) => {
    const page = await pageAs(browser, "owner");

    await page.goto("/groups");
    await page.getByRole("button", { name: "Yeni grup", exact: true }).click();
    await page.getByRole("button", { name: "Oluştur", exact: true }).click();

    await expect(page.getByText("Grup adı boş olamaz")).toBeVisible();
  });

  // BU TESTIN SEBEBI (16 Kasim): pencerelerin kosesindeki X dugmesinin ekran
  // okuyucu adi her dilde "Close" idi - shadcn'den kalma sabit metin. Ad
  // "Kapat" DEGIL "Pencereyi kapat": guvenlik penceresinde "iki adimli
  // dogrulamayi kapat" anlaminda GORUNEN bir "Kapat" dugmesi var; ayni adli
  // iki dugme, ekran okuyucuda hangisinin neyi kapattigini belirsiz
  // birakirdi. O pencerede tam "Kapat" adli tek dugmenin 2FA dugmesi
  // kaldigini two-factor.spec.ts zaten siniyor (ayni ad iki kez olsaydi
  // getByRole orada coklu eslesmeden duserdi).
  test("pencerenin kapatma dugmesi Turkce adli ve pencereyi kapatiyor", async ({ browser }) => {
    const page = await pageAs(browser, "owner");

    await page.goto("/groups");
    await page.getByRole("button", { name: "Yeni grup", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Grup adı")).toBeVisible();

    await dialog.getByRole("button", { name: "Pencereyi kapat", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("grup sahibi grup adini ve aciklamasini duzenleyebilir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    const name = uniqueGroupName("duzenleme");
    const updatedName = `${name} guncel`;

    await createGroup(page, name);
    await openGroup(page, name);

    await page.getByRole("button", { name: "Düzenle" }).click();
    await page.getByLabel("Grup adı").fill(updatedName);
    await page.getByLabel("Açıklama").fill("Test aciklamasi");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();

    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
    await expect(page.getByText("Test aciklamasi")).toBeVisible();
  });

  /**
   * SAYFA TEK SUTUN OLMALI - ve bu iddia GORSEL DEGIL, ILISKISEL.
   *
   * GERCEKTEN YASANDI (10 Eylul): bakiye karti ile fis ayni sutunda
   * FARKLI genislikteydi ve kullanici bunu fark etti. Sebep sasirtici
   * degil: genislik (36.25rem) UC AYRI YERDE tek tek yaziliyordu ve iki
   * blok o listeden dusmustu - kart ve baslik satiri. Ikisi de kisitsiz
   * kalinca main'in max-w-4xl'ini aliyorlardi.
   *
   * OLCULEN FARK: kart x=208 w=864, fis x=350 w=580. 284 piksel.
   *
   * TEST MUTLAK PIKSEL SORMUYOR - "ayni sol kenar, ayni genislik" diyor.
   * Boylece sutun genisligi ileride degisirse test bozulmuyor; yalnizca
   * ikisinin BIRBIRINDEN AYRILMASI bozuyor. Kusur tam olarak oydu.
   */
  test("bakiye karti ile fis ayni genislikte", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    const name = uniqueGroupName("genislik");

    await createGroupAndOpen(page, name);
    await addEqualExpense(page, { description: "Market", amount: "1842,60" });

    const card = await page.locator("div.bg-balance-card").first().boundingBox();
    const paper = await page.locator("div.paper").first().boundingBox();

    expect(card).not.toBeNull();
    expect(paper).not.toBeNull();
    expect(Math.round(card!.x)).toBe(Math.round(paper!.x));
    expect(Math.round(card!.width)).toBe(Math.round(paper!.width));
  });
});
