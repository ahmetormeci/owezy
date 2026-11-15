import { test, expect } from "./fixtures";
import { userByKey } from "./users";

// Bu dosya 11.4d-1 ile geldi. Oncesinde dil degistirmek GOZLEMLENEMIYORDU:
// iki sozluk de Turkce metin donduruyordu, yani dugmeye basmak hicbir sey
// degistirmiyor gibi gorunurdu. Ingilizce sozluk geldigi anda sinanabilir
// hale geldi.
//
// Giris GEREKMIYOR: dugme artik karsilama sayfasinda da var. Bu testin
// hizli olmasinin sebebi bu - kayitli oturumu yuklemiyor.
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

  // BU TESTIN SEBEBI: dugme hesaba yazma istegini eskiden HERKES icin
  // atiyordu. Cikis yapmis ziyaretcide sunucu dogru olarak 401 donuyordu;
  // kod bunu yutuyordu ama istek bosunaydi ve tarayici konsoluna her
  // seferinde bir hata satiri dusuyordu - gercek bir hatayi ararken gurultu.
  // Artik oturum yoksa istek hic gitmiyor.
  test("cikis yapmis ziyaretcide dil degisir ama hesaba istek gitmez", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    /**
     * BAGLAM DUZEYINDE dinliyoruz, sayfa duzeyinde degil: istek keepalive ile
     * gidiyor ve hemen ardindan sayfa yeniden yukleniyor (asagidaki testin
     * yorumu). Baglamin dinleyicisi sayfanin yikimindan etkilenmiyor.
     *
     * Yalnizca PATCH sayiliyor: olcmek istedigimiz sey "hesaba yazma
     * denemesi". Baska bir bilesenin ileride GET atmasi bu testi ilgilendirmez.
     */
    const accountWrites: string[] = [];
    context.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === "/api/v1/me") {
        accountWrites.push(request.url());
      }
    });

    // Karsilama sayfasi: dugme dogrudan basligin icinde ve "hesaba yazma"
    // orada SABIT olarak kapali (giris yapmis kullanici / adresinde kalmiyor).
    await page.goto("/");
    await page.getByRole("button", { name: "İngilizceye geç" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Giris sayfasi: dugme ortak kosede (PublicControls). Oturumu SUNUCUDA
    // soran yol bu - karsilama sayfasindakinden farkli bir kod yolu.
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Switch to Turkish" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");

    // Iki tiklamanin istegi de (gidecek olsaydi) yeniden yuklemeden ONCE
    // cikiyordu; dil degistiyse yeniden yukleme olmus, yani artik gelmez.
    expect(accountWrites).toEqual([]);

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

    /**
     * KAYDIN DUSTUGUNU API'DEN OKUYARAK dogruluyoruz, ag olayini izleyerek
     * DEGIL - ve bu ayrim bir hatadan sonra ogrenildi.
     *
     * Once page.waitForResponse ile PATCH'in cevabi bekleniyordu. Ama dil
     * dugmesi istegi BILEREK "gonder ve unut" yapiyor: fetch(..., keepalive)
     * hemen ardindan window.location.reload() geliyor (ADR-023). keepalive
     * istegin GONDERILMESINI garanti ediyor, sayfanin cevabi GORECEK KADAR
     * YASAMASINI degil. Yani test bastan beri sayfanin yikimiyla yarisiyordu
     * ve genelde kazaniyordu.
     *
     * Yarisi 26.4 bozdu: /api/v1/me PATCH'ine hiz siniri kontrolu eklendi,
     * yani cevaba bir veritabani gidis-donusu bindi. Istek yavasladi,
     * yeniden yukleme one gecti, test dustu.
     *
     * Buradaki okuma AYRI bir istek baglamindan gidiyor (context.request,
     * ayni cerezleri tasiyor), yani sayfanin omruyle ilgisi yok. Ustelik
     * dogru seyi olcuyor: tercih GERCEKTEN kaydedildi mi.
     */
    await page.getByRole("button", { name: "İngilizceye geç" }).click();
    await expect
      .poll(async () => {
        const response = await context.request.get("/api/v1/me");
        return (await response.json()).user.locale;
      })
      .toBe("en");

    await expect(page.getByRole("heading", { name: "My groups" })).toBeVisible();

    // Yeni bir cihazi taklit ediyoruz: YALNIZCA dil cerezini siliyoruz.
    // Hepsini silseydik oturum cerezi de giderdi ve test giris ekranina
    // duserdi - olcmek istedigimiz sey o degil.
    await context.clearCookies({ name: "locale" });
    await page.reload();

    // Cerez yok, dil yine de Ingilizce: bu bilgi yalnizca veritabanindan
    // gelebilir.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "My groups" })).toBeVisible();

    // Sonraki kosular Turkce baslasin diye tercihi geri aliyoruz: bu test
    // KALICI bir kayit birakiyor ve diger testler Turkce metin bekliyor.
    // Geri alma adimi dusen bir kosu, ardindan gelen kosulari da dusurur -
    // nitekim dusurdu.
    await page.getByRole("button", { name: "Switch to Turkish" }).click();
    await expect
      .poll(async () => {
        const response = await context.request.get("/api/v1/me");
        return (await response.json()).user.locale;
      })
      .toBe("tr");
    await expect(page.getByRole("heading", { name: "Gruplarım" })).toBeVisible();

    await context.close();
  });

  // BU TESTIN SEBEBI: "cikis yapmis ziyaretcide istek gitmez" testinin TERSI.
  // Dugmenin durdugu herkese acik sayfalara giris yapmis kullanici da geliyor
  // (gizlilik, destek, davet linki). Orada tercih hesaba YAZILMALI. Karari
  // sayfanin turune gore veren bir duzeltme ("herkese acik sayfada istek
  // atma") burada duser - karar oturuma gore verilmeli.
  test("giris yapmis kullanici herkese acik sayfada dili degistirince tercih hesaba yazilir", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: userByKey("outsider").storageStatePath,
    });
    const page = await context.newPage();

    await page.goto("/privacy");

    // Kaydi API'den okuyarak dogruluyoruz - neden ag olayini beklemedigimiz
    // bir onceki testin yorumunda.
    await page.getByRole("button", { name: "İngilizceye geç" }).click();
    await expect
      .poll(async () => {
        const response = await context.request.get("/api/v1/me");
        return (await response.json()).user.locale;
      })
      .toBe("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Geri al: bu test de KALICI bir kayit birakiyor (bkz. bir onceki test).
    await page.getByRole("button", { name: "Switch to Turkish" }).click();
    await expect
      .poll(async () => {
        const response = await context.request.get("/api/v1/me");
        return (await response.json()).user.locale;
      })
      .toBe("tr");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");

    await context.close();
  });
});
