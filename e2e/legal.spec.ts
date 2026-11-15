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

/**
 * DAR EKRAN DUZENI. Iki hata 15 Kasim'da canlida olculdu (7 sayfa x 10
 * ekran boyutu):
 *
 *  - Gizlilik ve destekte dil/tema dugmeleri SABIT kosedeydi ve arkalari
 *    seffafti: telefonda ve tablette kaydirinca yazi altlarindan geciyordu
 *    ("ortak" -> "ortEN"). Sayfa ilk acildiginda cakisma YOKTU - o yuzden
 *    olcum butun kaydirma boyunca yapiliyor.
 *  - Karsilama basligi 320px'e sigmiyordu: sayfa 18px yana kayiyor, "Kayit
 *    ol" kesiliyor, logo 0px'e eziliyordu (375px'te 13px).
 */
test.describe("dar ekran duzeni", () => {
  test("kaydirinca dil ve tema dugmeleri yazinin ustune binmiyor", async ({ browser }) => {
    const page = await anonymousPage(browser);
    await page.setViewportSize({ width: 375, height: 667 });

    for (const path of ["/privacy", "/support"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "İngilizceye geç" })).toBeVisible();

      /**
       * Sayfanin TAMAMI 50px adimlarla kaydiriliyor; her adimda metnin GERCEK
       * satir kutulari dugmelerin kutusuyla kesisiyor mu diye bakiliyor.
       * Kapsayici kutu (p, li) DEGIL: kisa bir satir sag kenara ulasmaz ama
       * paragrafin kutusu ulasir - yanlis alarm verirdi.
       *
       * Tek bir evaluate icinde: scrollTo'dan sonra getBoundingClientRect
       * duzeni senkron yeniden hesapliyor, ara bekleme gerekmiyor.
       */
      const overlaps = await page.evaluate(() => {
        const controls = document.querySelector('button[aria-label="İngilizceye geç"]')!
          .parentElement!;
        const hits: string[] = [];
        const max = document.documentElement.scrollHeight - window.innerHeight;
        for (let y = 0; y <= max; y += 50) {
          window.scrollTo(0, y);
          const c = controls.getBoundingClientRect();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const text = n.textContent?.trim();
            if (!text || controls.contains(n)) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) {
              const crosses =
                r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top;
              // 1px'lik kutular ekran okuyucu metni (sr-only) - gorunmuyor.
              if (crosses && r.width > 1 && r.height > 1) {
                hits.push(`y=${y}: ${text.slice(0, 30)}`);
              }
            }
          }
        }
        return hits;
      });

      expect(overlaps, `${path}: dugmelerin altindan gecen yazi`).toEqual([]);
    }
  });

  for (const width of [320, 375]) {
    test(`karsilama basligi ${width}px'e sigiyor, logo ezilmiyor`, async ({ browser }) => {
      const page = await anonymousPage(browser);
      await page.setViewportSize({ width, height: 640 });
      await page.goto("/");

      // Baslikta, cunku sayfanin govdesinde de "Kayit ol" var.
      await expect(
        page.locator("header").getByRole("link", { name: "Kayıt ol", exact: true }),
      ).toBeInViewport({ ratio: 1 });

      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        mark: document.querySelector("header svg")!.getBoundingClientRect().width,
      }));
      expect(layout.overflow, "sayfa yana kayiyor").toBe(0);
      // Logo size-6 = 24px. Yer daralinca tarayicinin ILK ezdigi oydu.
      expect(layout.mark, "logo ezilmis").toBe(24);
    });
  }
});
