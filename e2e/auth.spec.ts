import { test, expect } from "./fixtures";
import { userByKey } from "./users";

test.describe("kimlik dogrulama", () => {
  test("giris yapmamis kullanici korumali sayfaya erisemez", async ({ browser }) => {
    // Kayitli oturum YUKLEMEDEN yeni bir baglam aciyoruz.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/groups");

    await expect(page).toHaveURL(/\/sign-in/);
    await context.close();
  });

  test("giris yapmis kullanici gruplar sayfasini gorur", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: userByKey("owner").storageStatePath,
    });
    const page = await context.newPage();

    await page.goto("/groups");

    // Bu kontrol, bilesen agacini cokerten "bos sayfa" hatasini yakalar:
    // sayfa acilmis ama icerik hic render edilmemisse burada patlar.
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();
    await context.close();
  });

  test("ana sayfa giris yapmis kullaniciyi gruplara yonlendirir", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: userByKey("owner").storageStatePath,
    });
    const page = await context.newPage();

    await page.goto("/");

    await expect(page).toHaveURL(/\/groups/);
    await context.close();
  });
});
