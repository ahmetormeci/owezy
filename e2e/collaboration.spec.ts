import { test, expect } from "./fixtures";
import {
  createGroupAndOpen,
  createInviteLink,
  joinViaInvite,
  openGroup,
  pageAs,
  uniqueGroupName,
} from "./helpers";

test.describe("cok kullanicili akislar", () => {
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
    await owner.getByLabel("Aciklama").fill("Ortak yemek");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByRole("button", { name: "Harcamayi kaydet" }).click();

    await expect(owner.getByText("Bu tutar sana borclu")).toBeVisible();
    await expect(owner.getByText("50,00 ₺").first()).toBeVisible();

    await openGroup(member, groupName);
    await expect(member.getByText("Bu tutari borclusun")).toBeVisible();
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
    await owner.getByLabel("Aciklama").fill("Tasi tasi");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByRole("button", { name: "Harcamayi kaydet" }).click();
    await expect(owner.getByText("Bu tutar sana borclu")).toBeVisible();

    // Borclu olan uye "ben odedim" kaydi giriyor.
    await openGroup(member, groupName);
    await member.getByRole("button", { name: "Odeme kaydet" }).click();
    await member.getByLabel("Islem yonu").selectOption("outgoing");
    await member.getByText(/Onerilen tutari kullan/).click();
    await member.getByRole("button", { name: "Kaydet", exact: true }).click();

    await expect(member.getByText("Odestin")).toBeVisible();

    await openGroup(owner, groupName);
    await expect(owner.getByText("Odestin")).toBeVisible();
  });

  test("uc kisilik esit bolusumde kalan kurus dagitilir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("uc-kisi");

    await createGroupAndOpen(owner, groupName);

    // Iki kisilik davet linkiyle iki kullaniciyi da ekliyoruz.
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Uyeleri yonet" }).click();
    await owner.getByLabel("Kac kisi kullanabilsin?").selectOption("5");
    await owner.getByRole("button", { name: "Davet linki olustur" }).click();
    const inviteLink = await owner.locator("input[readonly]").inputValue();

    await joinViaInvite(member, inviteLink, groupName);
    await joinViaInvite(outsider, inviteLink, groupName);

    // 100 TL / 3 kisi -> 33,34 + 33,33 + 33,33 (toplam tam 100 TL)
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Aciklama").fill("Uce bolunen");
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
    await owner.getByLabel("Aciklama").fill("Owner harcamasi");
    await owner.getByLabel("Tutar").fill("60");
    await owner.getByRole("button", { name: "Harcamayi kaydet" }).click();
    await expect(owner.getByText("Owner harcamasi")).toBeVisible();

    // Uye harcamayi GORUYOR ama duzenleyemiyor/silemiyor.
    await openGroup(member, groupName);
    await expect(member.getByText("Owner harcamasi")).toBeVisible();
    await expect(member.getByRole("link", { name: "Duzenle" })).toHaveCount(0);
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
    await expect(member.getByRole("button", { name: "Duzenle" })).toHaveCount(0);
  });

  test("iptal edilen davet linki kullanilamaz", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("iptal");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);

    await owner.getByRole("button", { name: "Iptal et" }).click();
    await expect(owner.getByText("Aktif bir davet linki yok")).toBeVisible();

    await outsider.goto(inviteLink);

    await expect(outsider.getByRole("heading", { name: "Davet kullanilamiyor" })).toBeVisible();
    await expect(outsider.getByText("Bu davet iptal edilmis")).toBeVisible();
  });
});
