import { request, type Browser, type Page } from "@playwright/test";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { test, expect, trackContext } from "./fixtures";
import { clearRateLimits } from "./db-cleanup";
import { userByKey } from "./users";

/**
 * IKI ADIMLI DOGRULAMA - UCTAN UCA (Faz 27.3).
 *
 * NEDEN KENDI KULLANICISI VAR: /two-factor/verify-totp basarili oldugunda
 * OTURUMU DONDURUYOR - yeni bir oturum yaratip eskisini siliyor
 * (totp/index.mjs). Paylasilan test kullanicilarindan birinde 2FA acsaydik,
 * o kullanicinin diske yazilmis storageState'i (global.setup.ts) o anda
 * gecersizlesir ve BASKA dosyalardaki testler anlasilmaz sekilde duserdi.
 *
 * NEDEN describe.serial: adimlar birbirini besliyor - gizli anahtar ve yedek
 * kodlar ilk testte EKRANDAN okunuyor ve sonrakiler onlari kullaniyor. Bir
 * kullanicinin gercekte yaptigi sey de bu.
 *
 * KODU NASIL URETIYORUZ - VE BURADA BIR TUZAK VAR, OLCULDU:
 * createOTP(secret).url(...) gizli anahtari URI'ye BASE32'LEYEREK yaziyor.
 * Yani ekranda gordugumuz "secret" ham anahtar DEGIL, base32'si. Dogrudan
 * createOTP(ekrandakiDeger).totp() cagrilirsa YANLIS kod uretiliyor ve test
 * "2FA calismiyor" gibi duser. Once base32 cozulmeli - kimlik dogrulayici
 * uygulamalarin yaptigi da tam olarak bu.
 */

const BASE_URL = "http://localhost:3100";

// Adres benzersiz: E2E veritabani her kosuda temizleniyor ama ayni kosuda iki
// kez yaratilmaya calisilmasin.
const EMAIL = `e2e-2fa-${Date.now()}@owezy.test`;
const DISPLAY_NAME = "2fa-testuser";
// Parola KODA YAZILMIYOR - mevcut test kullanicilarininkiyle ayni ortam
// degiskeninden geliyor (users.ts).
const PASSWORD = userByKey("owner").password;

/** Ilk testte ekrandan okunuyor, sonrakiler kullaniyor. */
let base32Secret = "";
let backupCodes: string[] = [];

/** Kimlik dogrulayici uygulamanin urettigi kodun aynisi. */
async function authenticatorCode(): Promise<string> {
  const raw = new TextDecoder().decode(base32.decode(base32Secret));
  return createOTP(raw, { digits: 6, period: 30 }).totp();
}

/** Verilen sayfada parolayla giris formunu doldurup gonderir. */
async function submitPasswordSignIn(page: Page) {
  // Hiz siniri sayaclari siliniyor: /sign-in/* siniri 10 saniyede 3 istek ve
  // bu dosya arka arkaya birkac giris yapiyor. Sinirin KENDISI acik kaliyor;
  // yalnizca bu dosyanin biriktirdigi sayac temizleniyor (bkz. db-cleanup.ts).
  await clearRateLimits();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Parolayla gir" }).click();
  await page.getByLabel("E-posta").fill(EMAIL);
  await page.getByLabel("Parola").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
}

/** Yeni, BOS bir tarayici baglaminda giris yapar (cerez tasimaz). */
async function freshSignInPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  trackContext(context);
  const page = await context.newPage();
  await submitPasswordSignIn(page);
  return page;
}

/** Basliktaki kullanici menusunden guvenlik ekranini acar. */
async function openSecurityDialog(page: Page) {
  await page.getByRole("button", { name: DISPLAY_NAME }).click();
  await page.getByRole("button", { name: /İki adımlı doğrulama/ }).click();
  await expect(page.getByRole("heading", { name: "İki adımlı doğrulama" })).toBeVisible();
}

test.describe.serial("iki adimli dogrulama", () => {
  test("kullanici 2FA'yi acar: parola -> QR + yedek kodlar -> dogrulama", async ({
    browser,
  }) => {
    // Kullanici uygulamanin kendi kayit ucundan yaratiliyor - parola hash'ini
    // Better Auth uretsin diye (ayni gerekce global.setup.ts'te).
    await clearRateLimits();
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const created = await api.post("/api/auth/sign-up/email", {
        data: { name: DISPLAY_NAME, email: EMAIL, password: PASSWORD },
      });
      expect(created.ok()).toBeTruthy();
    } finally {
      await api.dispose();
    }

    const page = await freshSignInPage(browser);
    // 2FA HENUZ KAPALI: ikinci faktor sorulmadan iceri giriyoruz.
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await openSecurityDialog(page);

    // Menu ARKADA KALMIYOR: guvenlik ekrani acilinca kapaniyor.
    await expect(page.getByRole("button", { name: "Çıkış yap" })).toBeHidden();

    await page.getByLabel("Parola").fill(PASSWORD);
    await page.getByRole("button", { name: "Aç", exact: true }).click();

    // QR VE ELLE GIRILECEK ANAHTAR BIRLIKTE: kamerasi olmayan biri de
    // kurabilmeli.
    await expect(page.getByRole("img", { name: "Kurulum için QR kodu" })).toBeVisible();
    base32Secret = (await page.locator("code").first().innerText()).trim();
    expect(base32Secret.length).toBeGreaterThan(10);

    backupCodes = (
      await page.getByRole("list", { name: "Yedek kodlar" }).getByRole("listitem").allInnerTexts()
    ).map((line) => line.trim());
    expect(backupCodes.length).toBeGreaterThanOrEqual(2);

    // ENABLE TEK BASINA 2FA'YI ACMIYOR - dogrulama sart. Bu, eklentinin
    // davranisi ve iyi ki oyle: QR'i okutamayan kullanici yari yolda
    // kilitlenmiyor.
    await page.getByLabel("Doğrulama kodu").fill(await authenticatorCode());
    await page.getByRole("button", { name: "Doğrula" }).click();

    await expect(page.getByText("İki adımlı doğrulama açıldı")).toBeVisible();

    // Menudeki durum satiri da degismis olmali.
    await page.reload();
    await page.getByRole("button", { name: DISPLAY_NAME }).click();
    await expect(page.getByRole("button", { name: /İki adımlı doğrulama/ })).toContainText(
      "Açık",
    );
  });

  test("yanlis parola ANLASILIR bir cumle veriyor", async ({ browser }) => {
    /**
     * Guvenlik ekraninin EN OLASI hatasi bu ve bir sure en anlamsiz cumleyi
     * aliyordu: Better Auth'un dondurdugu INVALID_PASSWORD kodu
     * auth-errors.ts'te ESLENMEMISTI, yani kullanici "Bir seyler ters gitti"
     * goruyordu. Eslesme kaldirilirsa bu test duser.
     *
     * "E-posta ya da parola hatali" DE DEGIL: bu ekranda e-posta diye bir
     * alan yok, kullaniciyi olmayan bir alani kontrol etmeye gonderirdi.
     */
    const page = await freshSignInPage(browser);
    await page.getByLabel("Doğrulama kodu").fill(await authenticatorCode());
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await openSecurityDialog(page);
    await page.getByLabel("Parola").fill(`${PASSWORD}-yanlis`);
    await page.getByRole("button", { name: "Kapat", exact: true }).click();

    await expect(page.getByText("Parola hatalı.")).toBeVisible();
    // VE 2FA HALA ACIK: yanlis parola bir seyi kapatmis olmamali.
    await expect(page.getByRole("button", { name: "Kapat", exact: true })).toBeVisible();
  });

  test("2FA acikken e-posta koduyla giris REDDEDILIYOR", async () => {
    /**
     * BU TESTIN KORUDUGU SEY, FAZIN TAMAMININ SEBEBI.
     *
     * Better Auth'un twoFactor eklentisi ikinci faktoru yalnizca
     * /sign-in/email, /sign-in/username ve /sign-in/phone-number yollarinda
     * soruyor. Bizim BIRINCIL giris yolumuz olan /sign-in/email-otp listede
     * YOK. Kendi kancamiz (better-auth.ts) olmasaydi kullanici 2FA'yi acar,
     * her zamanki gibi e-posta koduyla girer ve IKINCI FAKTOR HIC SORULMAZDI:
     * korundugunu sanan ama korunmayan bir kullanici.
     *
     * Kanca kaldirilirsa bu test duser - ve dusme bicimi de dogru: yanit 200
     * olur.
     */
    await clearRateLimits();
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post("/api/auth/sign-in/email-otp", {
        data: { email: EMAIL, otp: "000000" },
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "TWO_FACTOR_REQUIRES_PASSWORD",
      });
    } finally {
      await api.dispose();
    }
  });

  test("giriste ikinci faktor soruluyor ve uygulama koduyla geciliyor", async ({
    browser,
  }) => {
    const page = await freshSignInPage(browser);

    // PAROLA DOGRUYDU AMA ICERIDE DEGILIZ. Eklenti oturumu yaratip hemen
    // siliyor ve yerine imzali bir "meydan okuma" cerezi birakiyor.
    await expect(
      page.getByText("Kimlik doğrulayıcı uygulamandaki 6 haneli kodu gir."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Doğrulama kodu").fill(await authenticatorCode());
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();
  });

  test("telefon yoksa yedek kodla giriliyor", async ({ browser }) => {
    const page = await freshSignInPage(browser);

    await page.getByRole("button", { name: "Yedek kod kullan" }).click();
    await page.getByLabel("Yedek kod").fill(backupCodes[0]);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();
  });

  test("yedek kod TEK KULLANIMLIK", async ({ browser }) => {
    // Ayni kodu ikinci kez denemek REDDEDILMELI. Olmasaydi, bir kez sizan
    // yedek kod sonsuza kadar gecerli olurdu.
    const page = await freshSignInPage(browser);

    await page.getByRole("button", { name: "Yedek kod kullan" }).click();
    await page.getByLabel("Yedek kod").fill(backupCodes[0]);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

    await expect(page.getByText("Kod doğrulanamadı. Tekrar dener misin?")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("bu cihazi hatirla: ayni tarayicida ikinci faktor bir daha sorulmuyor", async ({
    browser,
  }) => {
    /**
     * Ozellik IMZALI BIR CEREZLE yuruyor (verify-two-factor.mjs) - yani
     * arayuzun verdigi "30 gun" sozunu tutan sey, tarayicida kalan bir cerez.
     * Test AYNI baglamda kaliyor; her testte oldugu gibi yeni bir baglam
     * acsaydi cerez zaten olmazdi ve test hicbir sey olcmezdi.
     *
     * CIKIS YAPMAK CEREZI SILMIYOR - olculdu: deleteSessionCookie yalnizca
     * oturum cerezlerine dokunuyor (cookies/index.mjs:241), guven cerezine
     * degil. Yani soz, cikis yapan kullanici icin de gecerli.
     */
    const context = await browser.newContext();
    trackContext(context);
    const page = await context.newPage();

    await submitPasswordSignIn(page);
    await page.getByRole("checkbox", { name: "Bu cihazı 30 gün hatırla" }).check();
    await page.getByLabel("Doğrulama kodu").fill(await authenticatorCode());
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    // Cikis - AMA AYNI TARAYICIDA.
    await page.getByRole("button", { name: DISPLAY_NAME }).click();
    await page.getByRole("button", { name: "Çıkış yap" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // ASIL KONTROL: ikinci faktor SORULMADAN iceri giriliyor.
    await submitPasswordSignIn(page);
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();
  });

  test("kapatilinca e-posta koduyla giris yeniden calisiyor", async ({ browser }) => {
    const page = await freshSignInPage(browser);
    await page.getByLabel("Doğrulama kodu").fill(await authenticatorCode());
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await openSecurityDialog(page);
    await page.getByLabel("Parola").fill(PASSWORD);
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
    await expect(page.getByText("İki adımlı doğrulama kapatıldı")).toBeVisible();

    // ASIL KONTROL: kanca artik SUSUYOR. Ayni istek yukarida 400 +
    // TWO_FACTOR_REQUIRES_PASSWORD donuyordu; simdi kodun kendisi
    // degerlendiriliyor (yanlis kod, ama BASKA bir sebeple).
    await clearRateLimits();
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post("/api/auth/sign-in/email-otp", {
        data: { email: EMAIL, otp: "000000" },
      });
      const body = await response.json();
      expect(body.code).not.toBe("TWO_FACTOR_REQUIRES_PASSWORD");
    } finally {
      await api.dispose();
    }
  });
});
