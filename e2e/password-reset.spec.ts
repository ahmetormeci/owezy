import { type Browser, type Page } from "@playwright/test";
import { test, expect, trackContext } from "./fixtures";
import { clearRateLimits, readOtpFromDatabase } from "./db-cleanup";
import { userByKey } from "./users";

/**
 * PAROLA BELIRLEME / YENILEME - UCTAN UCA (Faz 27.3).
 *
 * NEDEN BU EKRAN VE NEDEN BU TEST: iki adimli dogrulama, "parolami unuttum"un
 * o gune kadarki tek kacis kapisini KAPATIYOR. 2FA acik bir hesap e-posta
 * koduyla giremiyor (better-auth.ts'teki kanca), yani parolasini unutan biri
 * icin geriye yalnizca bu ekran kaliyor - yedek kodlar kurtarmiyor, cunku
 * onlar IKINCI faktor; birincisi yine parola. Bu akis sessizce bozulursa
 * bozuldugu, ancak birisi gercekten kilitlendiginde anlasilir.
 *
 * TEST KULLANICISI E-POSTA KODUYLA YARATILIYOR, kayit formundan degil - ve
 * bu bilincli: boyle yaratilan kullanicinin PAROLASI HIC YOK. Yani ayni test
 * iki seyi birden sinuyor:
 *   1. Parolasiz kullanici guvenlik ekraninda "once parola belirle" goruyor
 *      (calismayan bir dugme degil).
 *   2. /email-otp/reset-password, credential hesabi olmayan kullaniciya onu
 *      YARATIYOR - yani ayni ekran hem "unuttum"a hem "hic yoktu"ya yetiyor.
 */

const EMAIL = `e2e-parola-${Date.now()}@owezy.test`;
// Parola koda yazilmiyor: mevcut test kullanicisinin ortam degiskeninden
// TURETILIYOR (users.ts'teki kural).
const NEW_PASSWORD = `${userByKey("owner").password}-yeni`;

async function newPage(browser: Browser): Promise<Page> {
  await clearRateLimits();
  const context = await browser.newContext();
  trackContext(context);
  return context.newPage();
}

test.describe.serial("parola belirleme", () => {
  test("parolasiz kullanici e-posta koduyla girer ve 2FA acamadigini ANLAR", async ({
    browser,
  }) => {
    const page = await newPage(browser);

    // E-POSTA KODUYLA GIRIS: kullanici bu adimda YARATILIYOR (Better Auth
    // adresi tanimiyorsa hesabi kendisi aciyor - ADR-035).
    await page.goto("/sign-in");
    await page.getByLabel("E-posta").fill(EMAIL);
    await page.getByRole("button", { name: "Kod gönder" }).click();
    await page.getByLabel("Doğrulama kodu").fill(await readOtpFromDatabase("sign-in", EMAIL));
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    // Gorunen ad e-postanin kendisi: kod akisinda ad sorulmuyor ve
    // databaseHooks bos adi e-postayla dolduruyor (better-auth.ts).
    await page.getByRole("button", { name: EMAIL }).click();
    await page.getByRole("button", { name: /İki adımlı doğrulama/ }).click();

    // ASIL KONTROL: "Aç" dugmesi GOSTERILMIYOR. Gosterilseydi kullanici basar
    // ve INVALID_PASSWORD alirdi - CURRENT_TASK'ta "dugme calismiyor gibi
    // gorunmemeli" diye yazan sey tam olarak bu.
    await expect(
      page.getByText("İki adımlı doğrulama için hesabında bir parola olması gerekiyor.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Aç", exact: true })).toBeHidden();

    // Cikis da orada: kullanici ne yapacagini biliyor.
    await page.getByRole("link", { name: "Parola belirle" }).click();
    await expect(page).toHaveURL(/\/reset-password/);
  });

  test("kullanici e-posta koduyla kendine parola kurar", async ({ browser }) => {
    const page = await newPage(browser);

    await page.goto("/reset-password");
    await page.getByLabel("E-posta").fill(EMAIL);
    await page.getByRole("button", { name: "Kod gönder" }).click();

    await page
      .getByLabel("Doğrulama kodu")
      .fill(await readOtpFromDatabase("forget-password", EMAIL));
    await page.getByLabel("Yeni parola").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Kaydet" }).click();

    await expect(page.getByText("Parolan kaydedildi.", { exact: false })).toBeVisible();
  });

  test("yeni parolayla giris yapilabiliyor ve artik 2FA acilabiliyor", async ({ browser }) => {
    const page = await newPage(browser);

    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Parolayla gir" }).click();
    await page.getByLabel("E-posta").fill(EMAIL);
    await page.getByLabel("Parola").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    // Guvenlik ekrani artik parola SORUYOR - yani hasPassword true donuyor ve
    // credential hesabi gercekten yaratilmis.
    await page.getByRole("button", { name: EMAIL }).click();
    await page.getByRole("button", { name: /İki adımlı doğrulama/ }).click();
    await expect(page.getByLabel("Parola")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aç", exact: true })).toBeVisible();
  });
});
