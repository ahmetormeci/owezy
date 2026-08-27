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

/**
 * BU TEST BIR VERI KAYBINI KORUYOR - ve o kayip gercekten yasandi.
 *
 * OLCULDU: dogrulanmamis bir hesapta e-posta koduyla giris yapmak
 * PAROLAYI SILIYOR. Better Auth'un revokeUnprovenAccountAccess'i,
 * emailVerified=false olan bir satira e-posta koduyla ulasildiginda o satirin
 * butun hesap baglarini siliyor - gerekcesi dogru: o satir, bagli erisimin
 * posta kutusu sahibine ait oldugunun kanitini tasimiyor.
 *
 * Biz e-postayi hic dogrulamadigimiz icin parolayla kaydolan HERKES bu
 * tuzaga acikti. Cozum: kayitta dogrulama kodu gonderiliyor
 * (sendVerificationOnSignUp) ve dogrulanan hesabin parolasi artik
 * silinmiyor.
 *
 * TEST IKI YONU DE YURUYOR, cunku tek yonu yurumek yetmezdi: dogrulanmis
 * hesapta parolanin DURDUGUNU gostermek, dogrulanmamista GITTIGINI
 * gostermeden "koruma calisiyor" demek olurdu - oysa ikincisi hala gecerli
 * ve arayuz onu bilerek soyluyor.
 */
test.describe.serial("e-posta dogrulama parolayi koruyor", () => {
  const email = `e2e-dogrulama-${Date.now()}@owezy.test`;
  const password = userByKey("owner").password;

  test("DOGRULANMIS hesapta e-posta koduyla giris parolayi SILMIYOR", async ({
    browser,
  }) => {
    const page = await newPage(browser);

    // Kayit - sunucu kayitla birlikte bir dogrulama kodu yolluyor.
    await page.goto("/sign-up");
    await page.getByLabel("Adın").fill("Doğrulama");
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Parola").fill(password);
    await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();

    // Kayit formu artik dogrulama adimina geciyor.
    await expect(page.getByText("E-postanı doğrula")).toBeVisible();
    await page
      .getByLabel("E-postanı doğrula")
      .fill(await readOtpFromDatabase("email-verification", email));
    await page.getByRole("button", { name: "Doğrula", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    // ASIL KONTROL: simdi e-posta koduyla gir, sonra parolanin hala
    // calistigini dogrula.
    const second = await newPage(browser);
    await second.goto("/sign-in");
    await second.getByLabel("E-posta").fill(email);
    await second.getByRole("button", { name: "Kod gönder" }).click();
    await second
      .getByLabel("Doğrulama kodu")
      .fill(await readOtpFromDatabase("sign-in", email));
    await second.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(second.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    const third = await newPage(browser);
    await third.goto("/sign-in");
    await third.getByRole("button", { name: "Parolayla gir" }).click();
    await third.getByLabel("E-posta").fill(email);
    await third.getByLabel("Parola").fill(password);
    await third.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(third.getByRole("heading", { name: "Gruplarım" })).toBeVisible();
  });
});

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
