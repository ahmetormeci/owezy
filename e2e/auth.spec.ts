import { test, expect } from "./fixtures";
import { userByKey } from "./users";
import { createGroup, pageAs, uniqueGroupName } from "./helpers";

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

  test("tek grubu olan kullanici ana sayfadan dogrudan grubunun icine girer", async ({
    browser,
  }) => {
    // NEDEN BU TEST: Faz 16.4'te ana sayfa artik "her zaman listeye" degil,
    // "tek grubun varsa grubuna" yonlendiriyor. Ustteki test /groups deseniyle
    // eslestigi icin iki davranisi da kabul ediyor ve yeni kurali korumuyordu.
    //
    // DETERMINISTIK OLMASI DOSYA SIRASINA BAGLI: E2E veritabani kosu basina
    // temizleniyor, gruplar kosu boyunca birikiyor. auth.spec.ts alfabetik
    // olarak ilk dosya ve "outsider" kullanicisinin burada henuz hic grubu
    // yok. Once calisan yeni bir spec dosyasi outsider'a grup verirse bu test
    // duser - sessizce yanlis gecmez, bagirir.
    const page = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("tek-grup");
    await createGroup(page, groupName);

    await page.goto("/");

    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
  });

  test("api cerezsiz Bearer token ile calisiyor", async ({ browser, playwright }) => {
    // MOBIL SOZLESMESI. ADR-002 is mantigini /api/v1 altina koydu cunku
    // "mobil istemci de ayni uclari cagiracak" - ama bu bugune kadar bir
    // VARSAYIMDI. Web istemcisi oturumu cerezle tasiyor; mobil Bearer
    // kullanacak. Bu test o sozlesmeyi koruyor: biri ileride cerez varsayan
    // bir kontrol eklerse (CSRF, SameSite, origin dogrulamasi) mobil taraf
    // sessizce kirilirdi.
    const page = await pageAs(browser, "owner");
    await page.goto("/groups");

    // Clerk istemci tarafta yuklenmeden session yok.
    await page.waitForFunction(
      () => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; session?: unknown } })
          .Clerk;
        return Boolean(clerk?.loaded && clerk?.session);
      },
      undefined,
      { timeout: 20_000 },
    );

    const token = await page.evaluate(async () => {
      const clerk = (
        window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } }
      ).Clerk;
      return clerk?.session ? await clerk.session.getToken() : null;
    });
    expect(token).toBeTruthy();

    // TAMAMEN YENI bir istek baglami: cerez yok, tarayici durumu yok.
    // Mobil uygulamanin durumu tam olarak bu.
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
    try {
      // Once NEGATIF: token olmadan kapali oldugunu dogruluyoruz, yoksa
      // asagidaki 200 "ucu herkese acik" anlamina da gelebilirdi.
      expect((await api.get("/api/v1/groups")).status()).toBe(401);

      const cevap = await api.get("/api/v1/groups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(cevap.status()).toBe(200);
      expect(await cevap.json()).toMatchObject({ ok: true, groups: expect.any(Array) });
    } finally {
      await api.dispose();
    }
  });
});
