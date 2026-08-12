import { test, expect } from "./fixtures";

// Bu dosya 11.4d-1 ile geldi. Oncesinde dil degistirmek GOZLEMLENEMIYORDU:
// iki sozluk de Turkce metin donduruyordu, yani dugmeye basmak hicbir sey
// degistirmiyor gibi gorunurdu. Ingilizce sozluk geldigi anda sinanabilir
// hale geldi.
//
// Giris GEREKMIYOR: dugme artik karsilama sayfasinda da var. Bu testin
// hizli olmasinin sebebi bu - Clerk oturumu yuklemiyor.
test.describe("dil degistirme", () => {
  test("karsilama sayfasinda dil degisir ve yenilemede kalir", async ({ browser }) => {
    // Kayitli oturum YUKLEMEDEN: giris yapmis kullanici / adresinden
    // /groups'a yonlendiriliyor.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");

    // --- Baslangic: Turkce ---
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    // Para bicimi de dile bagli: Turkcede sembol sonda, ondalik virgul.
    await expect(page.getByText("360,00 ₺")).toBeVisible();

    // --- Ingilizceye gec ---
    await page.getByRole("button", { name: "İngilizceye geç" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    // Sembol basa gecti, ondalik nokta oldu. Metin cevrildi diye tutarin
    // dogru okundugunu varsaymiyoruz - 11.3'un sebebi tam olarak buydu.
    await expect(page.getByText("₺360.00")).toBeVisible();

    // --- Yenilemeden sonra da Ingilizce: secim cerezde, state'te degil ---
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    // --- Geri don ---
    // Dugmenin etiketi artik Ingilizce: hedef dil Turkce.
    await page.getByRole("button", { name: "Switch to Turkish" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();

    await context.close();
  });

  test("bozuk dil cerezi sayfayi cokertmez", async ({ browser }) => {
    // Cerez kullanicinin kontrolunde. Ham deger Intl'e gitseydi RangeError
    // firlatir ve sunucuda render edilen sayfa 500 verirdi - yani konsoldan
    // tek satirla uygulamayi cokertmek mumkun olurdu.
    const context = await browser.newContext();
    await context.addCookies([
      { name: "locale", value: "zz-ZZ", url: "http://localhost:3100" },
    ]);
    const page = await context.newPage();

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();

    await context.close();
  });
});
