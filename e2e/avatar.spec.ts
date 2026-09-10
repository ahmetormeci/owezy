import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createGroupAndOpen, pageAs, uniqueGroupName } from "./helpers";

/**
 * PROFIL FOTOGRAFI - UCTAN UCA (ADR-054).
 *
 * BURADA SINANAN SEY BIRIM TESTLERIN GOREMEDIGI: baytlarin tarayicidan
 * cikip depoya gitmesi, geri gelen ADRESIN gercekten bir goruntu dondurmesi,
 * ve CSP'nin o goruntuyu GECIRMESI.
 *
 * CSP MADDESI TESADUFI DEGIL: bu ozellik bir kez tam orada kirilmisti.
 * Clerk devrinde avatarUrl uzak bir adres tasiyordu, img-src 'self' onu
 * gecirmiyordu ve kullanici kendi hesabinda KIRIK BIR KUTU goruyordu. Simdi
 * goruntu kendi ucumuzdan geliyor - ama bunu iddia etmek yetmez, tarayicida
 * gorulmesi gerekiyor.
 */

/** Gecerli, 1x1 PNG. Baytlar gercek - sunucu turu bunlardan okuyor. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Avatar GORSELI. alt="" ve aria-hidden BILEREK oyle - ad zaten yaninda
 * yaziyor, yani goruntu dekoratif (person-avatar.tsx). Bu yuzden metinden
 * degil, menuyu acan dugmenin ICINDEN bulunuyor.
 */
function avatarImage(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).locator("img");
}

async function uploadPhoto(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Fotoğraf ekle" }).click();
  await (
    await chooser
  ).setFiles({
    name: "yuz.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64"),
  });
  await expect(page.getByText("Fotoğrafın güncellendi")).toBeVisible();
}

test("fotograf yukleniyor, GERCEKTEN cizilliyor ve kaldiriliyor", async ({ browser }) => {
  const page = await pageAs(browser, "owner");
  await createGroupAndOpen(page, uniqueGroupName("fotograf"));

  await uploadPhoto(page, "testuser1");

  // Menuyu kapat: acik popover, altindaki avatari orten bir katman.
  await page.keyboard.press("Escape");

  const avatar = avatarImage(page, "testuser1");
  await expect(avatar).toBeVisible();

  /**
   * GORUNTUNUN GERCEKTEN COZULDUGUNU soruyoruz, "img etiketi var mi" diye
   * DEGIL. naturalWidth, tarayicinin baytlari cozdugunu soyleyen tek isaret;
   * CSP engelleseydi ya da uc hata donseydi etiket yine durur ve test yesil
   * kalirdi - tam da eski kusurun goze gorunmedigi yer.
   */
  await expect
    .poll(async () => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // Kendi ucumuzdan geliyor: CSP'ye dokunmak gerekmedi.
  expect(await avatar.getAttribute("src")).toContain("/api/v1/users/");

  await page.getByRole("button", { name: "testuser1", exact: true }).click();
  await page.getByRole("button", { name: "Fotoğrafı kaldır" }).click();
  await expect(page.getByText("Fotoğrafın kaldırıldı")).toBeVisible();
  await page.keyboard.press("Escape");

  // Bas harfe geri donuldu.
  await expect(avatarImage(page, "testuser1")).toHaveCount(0);
});

test("ORTAK GRUBU OLMAYAN fotografi goremiyor", async ({ browser }) => {
  const owner = await pageAs(browser, "owner");
  await createGroupAndOpen(owner, uniqueGroupName("gizli"));

  await uploadPhoto(owner, "testuser1");
  await owner.keyboard.press("Escape");

  const src = await avatarImage(owner, "testuser1").getAttribute("src");
  expect(src).toBeTruthy();

  /**
   * BASKA BIR KULLANICI AYNI ADRESI ISTIYOR. Adres tahmin edilebilir
   * (/api/v1/users/<id>/avatar) ve bilincli olarak oyle: guvenlik adresin
   * gizliligine degil, HER ISTEKTE sorulan ortak grup kontrolune dayaniyor.
   */
  const stranger = await pageAs(browser, "outsider");
  const response = await stranger.request.get(src!);
  expect(response.status()).toBe(403);

  // Kendisi hala gorebiliyor - kural "kimse goremez" degil.
  const mine = await owner.request.get(src!);
  expect(mine.status()).toBe(200);

  await owner.getByRole("button", { name: "testuser1", exact: true }).click();
  await owner.getByRole("button", { name: "Fotoğrafı kaldır" }).click();
  await expect(owner.getByText("Fotoğrafın kaldırıldı")).toBeVisible();
});
