import { test, expect } from "./fixtures";
import { userByKey } from "./users";
import {
  addEqualExpense,
  createGroupAndOpen,
  createInviteLink,
  joinViaInvite,
  openGroup,
  pageAs,
  uniqueGroupName,
} from "./helpers";

test.describe("cok kullanicili akislar", () => {
  /**
   * CIKIS YAPMIS BIRI DAVET LINKINE TIKLARSA.
   *
   * BU TEST BIR URETIM HATASINDAN SONRA YAZILDI. Davet sayfasi girisi olmayan
   * ziyaretciyi /sign-in?redirect_url=/join/<token> adresine gonderiyor, ama
   * giris formu redirect_url'i OKUMUYORDU: giris calisiyor, kullanici
   * uygulamanin ana ekranina dusuyor ve "Gruba katil" dugmesini HIC gormuyordu.
   * Yani davet linki, girisi olmayan biri icin ise yaramiyordu - ve gruba
   * katilmanin tek yolu o.
   *
   * NEDEN KACTI: diger butun davet testleri daveti ZATEN GIRISLI bir
   * tarayiciyla aciyor (storageState). "Cikisken tikla -> giris yap -> geri
   * don" yolunu hicbiri yurumuyordu.
   *
   * Clerk'in <SignIn /> bileseni redirect_url'i kendisi hallediyordu; 25.4'te
   * yerine kendi formumuzu koyduk ve davranis tasinmadi.
   */
  test("cikis yapmis kullanici davet linkinden girip gruba katilir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const groupName = uniqueGroupName("cikisli-davet");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);

    // KAYITLI OTURUM YUKLENMIYOR: testin konusu tam olarak bu.
    const context = await browser.newContext();
    const guest = await context.newPage();
    const outsider = userByKey("outsider");

    await guest.goto(inviteLink);
    await guest.getByRole("link", { name: "Giriş yap" }).click();

    // Adres redirect_url tasimali - zincirin ilk halkasi.
    await expect(guest).toHaveURL(/redirect_url=/);

    await guest.getByRole("button", { name: "Parolayla gir" }).click();
    await guest.getByLabel("E-posta").fill(outsider.email);
    await guest.getByLabel("Parola").fill(outsider.password);
    await guest.getByRole("button", { name: "Giriş yap", exact: true }).click();

    // ESAS IDDIA: giristen sonra DAVET SAYFASINA donulmus olmali.
    await expect(guest).toHaveURL(new RegExp(inviteLink.replace(/^https?:\/\/[^/]+/, "") + "$"));
    await guest.getByRole("button", { name: "Gruba katıl" }).click();

    await expect(guest).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
    await expect(guest.getByRole("heading", { name: groupName })).toBeVisible();

    await context.close();
  });


  test("davet linkiyle gruba katilinir ve borc bakiyeye yansir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("davet");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);

    await joinViaInvite(member, inviteLink, groupName);

    // Owner 100 TL odeyip iki kisiye esit boluyor -> uye 50 TL borclu.
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Ortak yemek");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();

    await expect(owner.getByText("Bu tutar sana borçlu")).toBeVisible();
    await expect(owner.getByText("50,00 ₺").first()).toBeVisible();

    await openGroup(member, groupName);
    await expect(member.getByText("Bu tutarı borçlusun")).toBeVisible();
  });

  test("odeme kaydedilince bakiyeler sifirlanir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("odeme");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Tasi tasi");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
    await expect(owner.getByText("Bu tutar sana borçlu")).toBeVisible();

    // Borclu olan uye "ben odedim" kaydi giriyor.
    await openGroup(member, groupName);
    await member.getByRole("button", { name: "Ödeme kaydet" }).click();
    await member.getByLabel("İşlem yönü").selectOption("outgoing");
    await member.getByText(/Önerilen tutarı kullan/).click();
    await member.getByRole("button", { name: "Kaydet", exact: true }).click();

    await expect(member.getByText("Ödeştin")).toBeVisible();

    await openGroup(owner, groupName);
    await expect(owner.getByText("Ödeştin")).toBeVisible();
  });

  test("uc kisilik esit bolusumde kalan kurus dagitilir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("uc-kisi");

    await createGroupAndOpen(owner, groupName);

    // Iki kisilik davet linkiyle iki kullaniciyi da ekliyoruz.
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await owner.getByLabel("Kaç kişi kullanabilsin?").selectOption("5");
    await owner.getByRole("button", { name: "Davet linki oluştur" }).click();
    const inviteLink = await owner.locator("input[readonly]").inputValue();

    await joinViaInvite(member, inviteLink, groupName);
    await joinViaInvite(outsider, inviteLink, groupName);

    // 100 TL / 3 kisi -> 33,34 + 33,33 + 33,33 (toplam tam 100 TL)
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Uce bolunen");
    await owner.getByLabel("Tutar").fill("100");

    await expect(owner.getByText("33,34 ₺")).toBeVisible();
    await expect(owner.getByText("33,33 ₺").first()).toBeVisible();
  });

  test("baskasinin harcamasi duzenlenemez ve silinemez", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("yetki");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Owner harcamasi");
    await owner.getByLabel("Tutar").fill("60");
    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
    await expect(owner.getByText("Owner harcamasi")).toBeVisible();

    // Uye harcamayi GORUYOR ama duzenleyemiyor/silemiyor.
    await openGroup(member, groupName);
    await expect(member.getByText("Owner harcamasi")).toBeVisible();
    await expect(member.getByRole("link", { name: "Düzenle" })).toHaveCount(0);
    await expect(member.getByRole("button", { name: "Sil", exact: true })).toHaveCount(0);
  });

  test("uye olmayan kisi grup sayfasina erisemez", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("erisim");

    await createGroupAndOpen(owner, groupName);
    const groupUrl = owner.url();

    await outsider.goto(groupUrl);

    // Yetkisiz erisimde 404 donuyoruz: grubun VAR OLDUGUNU bile sizdirmiyoruz.
    await expect(outsider.getByRole("heading", { name: groupName })).toHaveCount(0);
  });

  test("uye olmayan kisi grubu duzenleme butonunu gormez", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("owner-yetki");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(member, groupName);
    await expect(member.getByRole("button", { name: "Düzenle" })).toHaveCount(0);
  });

  test("iptal edilen davet linki kullanilamaz", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("iptal");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);

    await owner.getByRole("button", { name: "İptal et" }).click();
    await expect(owner.getByText("Aktif bir davet linki yok")).toBeVisible();

    await outsider.goto(inviteLink);

    await expect(outsider.getByRole("heading", { name: "Davet kullanılamıyor" })).toBeVisible();
    await expect(outsider.getByText("Bu davet iptal edilmiş")).toBeVisible();
  });

  /**
   * Optimistic locking (ADR-032).
   *
   * IKI TARAYICI DA AYNI KISI, cunku gercek senaryo bu: harcamayi yalnizca
   * onu giren kisi duzenleyebiliyor, yani cakisma "ayni kullanici, iki cihaz"
   * halinde yasaniyor - telefon ile tarayici acik unutulmus.
   *
   * Test uc seyi birden kanitliyor: ikinci kaydetme sessizce gecmiyor, neyin
   * degistigi yaziyor, ve kullanicinin yazdigi formda duruyor.
   */
  test("ayni harcamayi iki cihazdan duzenleyen kullanici cakismayi gorur", async ({
    browser,
  }) => {
    const laptop = await pageAs(browser, "owner");
    const phone = await pageAs(browser, "owner");
    const groupName = uniqueGroupName("cakisma");

    await createGroupAndOpen(laptop, groupName);
    await addEqualExpense(laptop, { description: "Kira", amount: "100" });

    // Iki cihaz da duzenleme formunu ACIYOR: ikisi de surum 1'i gordu.
    await laptop.getByRole("link", { name: "Düzenle" }).click();
    await openGroup(phone, groupName);
    await phone.getByRole("link", { name: "Düzenle" }).click();

    // Laptop once kaydediyor -> sunucuda surum 2.
    await laptop.getByLabel("Tutar").fill("500");
    await laptop.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
    await expect(laptop.getByText("500,00 ₺").first()).toBeVisible();

    // Telefon elindeki ESKI surumle kaydetmeye calisiyor.
    await phone.getByLabel("Açıklama").fill("Kira (Agustos)");
    await phone.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

    // 1) Sessizce gecmedi, uyari cikti.
    await expect(phone.getByText("Bu harcama sen düzenlerken değişti")).toBeVisible();
    // 2) NE degistigi yaziyor.
    await expect(phone.getByText("Tutar: 100,00 ₺ → 500,00 ₺")).toBeVisible();
    // 3) Kullanicinin yazdigi kaybolmadi.
    await expect(phone.getByLabel("Açıklama")).toHaveValue("Kira (Agustos)");

    // Ikinci kaydetme artik guncel surumle gidiyor ve GECIYOR.
    await phone.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
    await expect(phone.getByText("Kira (Agustos)")).toBeVisible();

    // Tutar 100'e DONUYOR - telefonun formunda hala 100 yaziyordu, yani
    // laptop'un 500'unun uzerine yazildi. Bu bir hata degil, uyarinin
    // ("tekrar kaydedersen uzerine yazacaksin") tam olarak soyledigi sey.
    // Optimistic locking uzerine yazmayi ENGELLEMIYOR; SESSIZ olmasini
    // engelliyor. Bu satir o ayrimin bekcisi: bir gun "cakismada kaydetme"
    // davranisi degisirse burasi kirilir ve karar bilerek verilir.
    await expect(phone.getByText("100,00 ₺").first()).toBeVisible();
  });
});
