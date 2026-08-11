import { test as setup, expect } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { resetE2EDatabase } from "./db-cleanup";
import { E2E_USERS } from "./users";

// Clerk'te "Device Trust" acik: bilinmeyen bir cihazdan giriste sifre tek
// basina yetmiyor, e-postaya gonderilen kodun da girilmesi gerekiyor. Playwright
// her testte sifir bir tarayici profili actigi icin her giris "yeni cihaz"
// sayiliyor ve bu adim her seferinde cikiyor.
//
// Test kullanicilarimizin adresleri Clerk'in test e-postalari (+clerk_test)
// oldugu icin gercek bir e-posta gonderilmiyor; dogrulama kodu her zaman
// asagidaki sabit deger oluyor.
const CLERK_TEST_CODE = "424242";

// Onceki kosulardan kalan gruplari/harcamalari siliyoruz. Ayni dosyadaki
// setup'lar sirayla calistigi icin bu, oturum hazirligindan once biter.
setup("onceki kosulardan kalan test verisini temizle", async () => {
  await resetE2EDatabase();
});

// Her test dosyasinda tekrar giris yapmak yavas olurdu. Burada bir kez giris
// yapip her kullanicinin oturumunu diske kaydediyoruz; testler bu kayitli
// oturumu yukleyerek dogrudan giris yapmis halde basliyor.
setup("test kullanicilarinin oturumlarini hazirla", async ({ browser }) => {
  // Clerk'in bot korumasini test ortaminda asmak icin gereken token'i alir.
  await clerkSetup();

  for (const user of E2E_USERS) {
    const context = await browser.newContext();
    // Token'i sayfayi acmadan once kuruyoruz ki Clerk'e giden butun istekler
    // bot korumasini gecebilsin.
    await setupClerkTestingToken({ context });

    const page = await context.newPage();

    // Giris islemi tarayicidaki Clerk nesnesi uzerinden yurutuluyor; once
    // Clerk'in yuklendigi korumasiz bir sayfada olmamiz gerekiyor.
    await page.goto("/");
    await clerk.loaded({ page });

    const result = await page.evaluate(
      async ({ identifier, password, code }) => {
        try {
          const client = window.Clerk.client;
          if (!client) {
            return { ok: false as const, reason: "Clerk istemcisi yuklenmedi" };
          }

          let attempt = await client.signIn.create({
            strategy: "password",
            identifier,
            password,
          });

          // Sifre dogrulandi ama cihaz taninmadi: ikinci adim olarak e-posta
          // koduyla dogrulama isteniyor.
          if (
            attempt.status === "needs_client_trust" ||
            attempt.status === "needs_second_factor"
          ) {
            const emailFactor = attempt.supportedSecondFactors?.find(
              (factor) => factor.strategy === "email_code",
            );
            if (!emailFactor || !("emailAddressId" in emailFactor)) {
              return {
                ok: false as const,
                reason: `email_code ikinci adimi bulunamadi (durum: ${attempt.status})`,
              };
            }

            await attempt.prepareSecondFactor({
              strategy: "email_code",
              emailAddressId: emailFactor.emailAddressId,
            });
            attempt = await attempt.attemptSecondFactor({
              strategy: "email_code",
              code,
            });
          }

          if (attempt.status !== "complete" || !attempt.createdSessionId) {
            return {
              ok: false as const,
              reason: `Giris tamamlanmadi (durum: ${attempt.status})`,
            };
          }

          await window.Clerk.setActive({ session: attempt.createdSessionId });
          return { ok: true as const };
        } catch (error) {
          return {
            ok: false as const,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
      { identifier: user.email, password: user.password, code: CLERK_TEST_CODE },
    );

    if (!result.ok) {
      throw new Error(`${user.email} icin giris basarisiz: ${result.reason}`);
    }

    // Oturum cerezleri yazilmadan storageState alirsak kaydettigimiz dosya
    // "giris yapilmamis" bir tarayici durumu olurdu.
    await page.waitForFunction(() => window.Clerk?.user != null);

    await page.goto("/groups");
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await context.storageState({ path: user.storageStatePath });
    await context.close();
  }
});
