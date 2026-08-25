import { test as setup, expect, request, type APIRequestContext } from "@playwright/test";
import { resetE2EDatabase } from "./db-cleanup";
import { E2E_USERS, type E2EUser } from "./users";

const BASE_URL = "http://localhost:3100";

// Onceki kosulardan kalan veriyi siliyoruz. Ayni dosyadaki setup'lar sirayla
// calistigi icin bu, oturum hazirligindan once biter.
setup("onceki kosulardan kalan test verisini temizle", async () => {
  await resetE2EDatabase();
});

/**
 * Test kullanicilarini YARATIR ve oturumlarini diske yazar.
 *
 * BU DOSYA 25.8'DE YENIDEN YAZILDI. Neyin gittigini saymak, gocun ne
 * kazandirdigini en iyi anlatan sey:
 *   - clerkSetup() + setupClerkTestingToken(): bot korumasini asmak icin.
 *   - window.Clerk uzerinden signIn.create(...): giris tarayicidaki SDK'dan
 *     yurutuluyordu.
 *   - "424242" sabit dogrulama kodu ve +clerk_test adresleri: Clerk'te Device
 *     Trust acikti, Playwright her testte sifir bir profil actigi icin her
 *     giris "yeni cihaz" sayiliyor ve e-posta kodu isteniyordu.
 *   - window.Clerk.user'in dolmasini beklemek.
 * Hicbiri kalmadi.
 *
 * KULLANICILAR HER KOSUDA SIFIRDAN YARATILIYOR. Eskiden Clerk panelinde elle
 * kurulmus uc hesap vardi ve veritabanindaki satirlari bilerek korunuyordu.
 * Artik kimligin kaynagi bizim veritabanimiz; onlari da temizleyip yeniden
 * yaratmak, E2E veritabanini ELLE HAZIRLIK GEREKTIRMEYEN bir yer yapiyor.
 * Yarim kalmis bir kullanici satirinin kosuyu bozmasi (25.1'de tam bu oldu)
 * artik mumkun degil.
 */
setup("test kullanicilarinin oturumlarini hazirla", async ({ browser }) => {
  for (const user of E2E_USERS) {
    await createUser(user);

    const context = await browser.newContext();
    const page = await context.newPage();

    // Giris UYGULAMANIN KENDI FORMUNDAN yapiliyor, bir API cagrisindan degil.
    // Boylece kurulum ayni zamanda giris ekraninin calistigini da kanitliyor;
    // form bozulursa testler "oturum hazirlanamadi" diye duser - kirk uc test
    // birden anlasilmaz sekilde degil.
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Parolayla gir" }).click();
    await page.getByLabel("E-posta").fill(user.email);
    await page.getByLabel("Parola").fill(user.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();

    // Yonlendirmenin TAMAMLANMASINI bekliyoruz. storageState'i cerez
    // yazilmadan alsaydik, kaydettigimiz dosya "giris yapilmamis" bir tarayici
    // durumu olurdu - ve butun testler giris ekraninda baslardi.
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await context.storageState({ path: user.storageStatePath });
    await context.close();
  }
});

/**
 * Kullaniciyi Better Auth'un kayit ucundan yaratir.
 *
 * NEDEN UCTAN, veritabanina dogrudan INSERT ile DEGIL: parola hash'ini Better
 * Auth uretiyor (scrypt) ve onu elle taklit etmek, kutuphanenin ic detayina
 * bel baglamak olurdu - degistigi gun testler "parola yanlis" der ve sebebi
 * hicbir yerde gorunmezdi.
 *
 * BAGLAM HER SEFERINDE ATILIYOR: kayit olan baglam cerez tutmaya basliyor ve
 * Better Auth'un CSRF kontrolu cerez GORDUGU anda Origin istiyor. Baglami
 * atmak, o kontrole hic girmemek demek (ayni gerekce ADR-038'de).
 */
async function createUser(user: E2EUser) {
  const api: APIRequestContext = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post("/api/auth/sign-up/email", {
      data: { name: user.displayName, email: user.email, password: user.password },
    });
    if (!response.ok()) {
      throw new Error(`${user.email} yaratilamadi: ${response.status()} ${await response.text()}`);
    }
  } finally {
    await api.dispose();
  }
}
