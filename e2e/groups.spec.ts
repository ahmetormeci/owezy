import { test, expect } from "./fixtures";
import { createGroup, openGroup, pageAs, uniqueGroupName } from "./helpers";

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
});
