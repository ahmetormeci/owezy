import { test, expect } from "./fixtures";
import { userByKey } from "./users";

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

  // BU TESTIN SEBEBI: bundan oncekiler cerezi sinar. Cerez tarayiciya ait,
  // yani baska bir cihazda YOK. "Hesaptaki tercih" ozelliginin tamami, tam
  // olarak cerezin bulunmadigi durumda calisip calismadigina bagli - ve onu
  // birim testleri yalnizca mock'la gosterebiliyor.
  //
  // Burada gercek zincir kosuyor: dugme -> PATCH /api/v1/me -> Postgres ->
  // getLocale() -> sunucuda render edilen sayfa.
  test("dil tercihi hesaba yazilir ve cerez silinince oradan okunur", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: userByKey("outsider").storageStatePath,
    });
    const page = await context.newPage();

    await page.goto("/groups");
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    // Dugmeye basmak PATCH'i ARKADA gonderiyor (arayuz ag istegini
    // beklemiyor). Cerezi silmeden once o istegin bittiginden emin olmaliyiz,
    // yoksa test kendi yarisini kaybeder.
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/me") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "İngilizceye geç" }).click();
    expect((await saved).status()).toBe(200);

    await expect(page.getByRole("heading", { name: "My groups" })).toBeVisible();

    // Yeni bir cihazi taklit ediyoruz: YALNIZCA dil cerezini siliyoruz.
    // Hepsini silseydik Clerk oturumu da giderdi ve test giris ekranina
    // duserdi - olcmek istedigimiz sey o degil.
    await context.clearCookies({ name: "locale" });
    await page.reload();

    // Cerez yok, dil yine de Ingilizce: bu bilgi yalnizca veritabanindan
    // gelebilir.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "My groups" })).toBeVisible();

    // Sonraki kosular Turkce baslasin diye tercihi geri aliyoruz: bu test
    // kalici bir kayit birakiyor ve diger 26 test Turkce metin bekliyor.
    const restored = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/me") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Switch to Turkish" }).click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await context.close();
  });
});
