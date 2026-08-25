import { test, expect, trackContext } from "./fixtures";
import type { Browser, Page } from "@playwright/test";

/**
 * Gizlilik ve destek sayfalari.
 *
 * BU TESTLERIN VARLIK SEBEBI TEK CUMLE: bu iki adres GIRIS YAPMADAN
 * acilabilmek zorunda. App Store ve Play inceleyicisi oraya oturum acmadan
 * bakiyor; bir gun biri korumayi genisletip bu sayfalari da kapsarsa,
 * uygulama magazadan geri doner ve sebebi hicbir yerde gorunmez.
 *
 * O yuzden testler BILEREK anonim bir context aciyor - projedeki diger
 * testlerin aksine hicbir storageState yuklenmiyor.
 */
async function anonymousPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  trackContext(context);
  return context.newPage();
}

test.describe("gizlilik ve destek sayfalari", () => {
  test("giris yapmadan acilir ve iletisim adresini tasir", async ({ browser }) => {
    const page = await anonymousPage(browser);

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Gizlilik Politikası" })).toBeVisible();
    // Sayfa giris ekranina YONLENDIRMEMELI.
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByText("destek@owezy.net").first()).toBeVisible();

    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "Destek" })).toBeVisible();
    await expect(page).toHaveURL(/\/support$/);
    await expect(page.getByText("destek@owezy.net").first()).toBeVisible();
  });

  test("silmenin ne yaptigini acikca yaziyor", async ({ browser }) => {
    const page = await anonymousPage(browser);
    await page.goto("/privacy");

    // Bu cumle politikadaki EN ONEMLI durustluk: kullanici hesabini silince
    // harcama kayitlarinin kaldigini bilmeli. Metin degistirilirse bu test
    // duser ve degisiklik bilerek yapilmis olur.
    await expect(
      page.getByText(/harcama ve ödeşme kayıtları silinmez/),
    ).toBeVisible();
  });

  test("karsilama sayfasindan iki sayfaya da ulasiliyor", async ({ browser }) => {
    const page = await anonymousPage(browser);

    await page.goto("/");
    await page.getByRole("link", { name: "Gizlilik" }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.getByRole("link", { name: "Destek" }).click();
    await expect(page).toHaveURL(/\/support$/);
  });

  test("dil degistirilince metin de degisiyor", async ({ browser }) => {
    const page = await anonymousPage(browser);

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Gizlilik Politikası" })).toBeVisible();

    await page.getByRole("button", { name: "İngilizceye geç" }).click();

    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  // Duzen hatalarini E2E varsayilan olarak yakalamaz (metnin varligina bakar,
  // sayfanin kaydigina degil). Uzun paragraflar ve uzun e-posta adresi tasma
  // uretmeye en yatkin ikili, o yuzden olcum burada da yapiliyor - ozet
  // testindekiyle ayni yontemle.
  for (const width of [390, 768]) {
    test(`${width}px genislikte yatay tasma yok`, async ({ browser }) => {
      const page = await anonymousPage(browser);
      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/privacy", "/support"]) {
        await page.goto(path);
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflows, `${path} ${width}px'te yatay kayiyor`).toBe(false);
      }
    });
  }
});
