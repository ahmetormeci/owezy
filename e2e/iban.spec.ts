import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { test, expect } from "./fixtures";
import {
  addEqualExpense,
  createGroupAndOpen,
  createInviteLink,
  joinViaInvite,
  openGroup,
  pageAs,
  uniqueGroupName,
} from "./helpers";
import { userByKey } from "./users";

/**
 * BU DOSYA NEYI KORUYOR: IBAN ile odemenin GERCEK YIGINDA calismasini
 * (ADR-059, Faz 52a) - alacakli IBAN'ini ekliyor, borclu onu odeme aninda
 * kopyaliyor.
 *
 * IBAN SAHIBI "member", BORCLU "owner". "outsider" KULLANILMIYOR: auth.spec
 * onun hic grubu olmadigini varsayiyor. Test sonunda IBAN KALDIRILIYOR -
 * hem kaldirma yolunu olcuyor hem de paralel kosan testlere kalici bir
 * durum birakmiyor.
 *
 * Ornek IBAN SWIFT kaydindaki TR ornegi; gercek bir hesap degil.
 */
const IBAN = "TR330006100519786457841326";
const IBAN_SPACED = "TR33 0006 1005 1978 6457 8413 26";

test.describe("IBAN ile odeme", () => {
  test("alacakli IBAN'ini ekler, borclu odeme aninda kopyalar, kaldirilinca kaybolur", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("iban");
    await createGroupAndOpen(owner, groupName);
    const link = await createInviteLink(owner, groupName);
    await joinViaInvite(member, link, groupName);

    // member oduyor, esit bolunuyor: owner member'a 150 borclu.
    await openGroup(member, groupName);
    await addEqualExpense(member, { description: "Market", amount: "300" });

    // --- IPUCU: alacaklinin IBAN'i yok ---
    await expect(member.getByText("Sana ödenecekler")).toBeVisible();
    await expect(member.getByText("IBAN'ını eklersen")).toBeVisible();
    await member.getByRole("button", { name: "IBAN ekle" }).click();
    const ibanDialog = member.getByRole("dialog");

    // Kontrol hanesi tutmayan IBAN (son hane 6 -> 7) formda reddediliyor.
    await ibanDialog.getByLabel("IBAN", { exact: true }).fill("TR33 0006 1005 1978 6457 8413 27");
    await ibanDialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(ibanDialog.getByText("Bu geçerli bir IBAN değil")).toBeVisible();

    // Kucuk harf ve bosluk sorun degil - kayda normalize ediliyor.
    await ibanDialog.getByLabel("IBAN", { exact: true }).fill(IBAN_SPACED.toLowerCase());
    await ibanDialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(member.getByText("IBAN kaydedildi")).toBeVisible();
    await expect(member.getByText("IBAN'ını eklersen")).toHaveCount(0);

    // --- BORCLU KOPYALIYOR ---
    await owner.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openGroup(owner, groupName);
    await expect(owner.getByText("Ödemen gerekenler")).toBeVisible();
    await owner.getByRole("button", { name: "IBAN'ı kopyala" }).click();
    await expect(owner.getByText("IBAN kopyalandı")).toBeVisible();
    // Az once degisti: uyari KOPYALAMA ANINDA gorunuyor.
    await expect(owner.getByText("son 7 gün içinde değişti")).toBeVisible();
    // Panoya giden BOSLUKSUZ kayit - bankanin alanina oldugu gibi yapisir.
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toBe(IBAN);

    // --- ODEME DIYALOGU: giden odemede alicinin IBAN'i ---
    await owner.getByRole("button", { name: "Ödeme kaydet" }).click();
    const payDialog = owner.getByRole("dialog");
    await expect(payDialog.getByText("Alıcının IBAN'ı")).toBeVisible();
    await expect(payDialog.getByText(IBAN_SPACED)).toBeVisible();
    // Gelen odemede alici SENSIN - karsi tarafin IBAN'i gosterilmez.
    await payDialog.getByLabel("İşlem yönü").selectOption("incoming");
    await expect(payDialog.getByText("Alıcının IBAN'ı")).toHaveCount(0);
    await owner.keyboard.press("Escape");

    // --- KALDIRMA: kullanici menusunden ---
    // Menu satiri: etiket ve durum ("IBAN" + "Ekli"). Tam desen - sayfadaki
    // baska IBAN dugmeleriyle karismasin.
    await member.getByRole("button", { name: userByKey("member").displayName }).click();
    const menuRow = member.getByRole("button", { name: /^IBAN\s*Ekli$/ });
    await expect(menuRow).toBeVisible();
    await menuRow.click();
    await member.getByRole("dialog").getByRole("button", { name: "IBAN'ı kaldır" }).click();
    await expect(member.getByText("IBAN kaldırıldı")).toBeVisible();

    // Borclu artik kopyalama goremiyor. Once satirin GERCEKTEN orada oldugu
    // goruluyor: "dugme yok" iddiasi sayfa yuklenmemisken de dogru olurdu.
    await openGroup(owner, groupName);
    await expect(owner.getByText("Ödemen gerekenler")).toBeVisible();
    await expect(owner.getByRole("button", { name: "IBAN'ı kopyala" })).toHaveCount(0);
  });

  test("grupta olmayan biri IBAN'i uye listesinden goremiyor", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const groupName = uniqueGroupName("iban-yabanci");
    await createGroupAndOpen(owner, groupName);
    const groupId = owner.url().split("/groups/")[1]?.split(/[/?#]/)[0];
    expect(groupId).toBeTruthy();

    // IBAN'in cikabildigi TEK uc uye listesi; uye olmayana 404/403.
    const outsider = await pageAs(browser, "outsider");
    const response = await outsider.request.get(`/api/v1/groups/${groupId}/members`);
    expect([403, 404]).toContain(response.status());
    expect(await response.text()).not.toContain("iban");
  });

  /**
   * VERITABANI SON KATMAN. Uygulama bu durumlarin hicbirini uretmiyor; bu
   * test uygulama ATLANSA BILE tutanin veritabani oldugunu gosteriyor.
   * Olumlu kontrol de var: dogru bicimdeki IBAN YAZILABILIYOR - yoksa
   * reddin "yanlis sebepten" olup olmadigi bilinemezdi.
   */
  test("veritabani bozuk bicimi, eksik degisiklik anini, misafirde ve silinmis hesapta IBAN'i reddeder", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: process.env.E2E_DATABASE_URL! }),
    });
    try {
      const real = await prisma.user.create({
        data: { id: randomUUID(), email: `e2e-${randomUUID()}@example.com`, displayName: "Gercek" },
      });
      const group = await prisma.group.create({
        data: { name: uniqueGroupName("db-iban"), currency: "TRY", createdById: real.id },
      });
      const guest = await prisma.user.create({
        data: {
          id: randomUUID(),
          email: `guest-${randomUUID()}@guest.invalid`,
          displayName: "Misafir",
          isGuest: true,
          guestGroupId: group.id,
        },
      });
      const now = new Date();

      // Olumlu kontrol: kurulum saglam, dogru bicim yaziliyor.
      await expect(
        prisma.user.update({ where: { id: real.id }, data: { iban: IBAN, ibanUpdatedAt: now } }),
      ).resolves.toBeTruthy();

      // Bosluklu / kucuk harfli kayit: bicim tek.
      await expect(
        prisma.user.update({ where: { id: real.id }, data: { iban: IBAN_SPACED } }),
      ).rejects.toThrow(/User_iban_shape/);
      await expect(
        prisma.user.update({ where: { id: real.id }, data: { iban: IBAN.toLowerCase() } }),
      ).rejects.toThrow(/User_iban_shape/);

      // IBAN ile degisiklik ani BIRLIKTE.
      await expect(
        prisma.user.update({ where: { id: real.id }, data: { ibanUpdatedAt: null } }),
      ).rejects.toThrow(/User_iban_updated_pair/);

      // Misafirin IBAN'i olamaz.
      await expect(
        prisma.user.update({ where: { id: guest.id }, data: { iban: IBAN, ibanUpdatedAt: now } }),
      ).rejects.toThrow(/User_guest_no_iban/);

      // Silinmis hesap IBAN'ini tasiyamaz - hesap silme unutursa DUSER.
      await expect(
        prisma.user.update({ where: { id: real.id }, data: { deletedAt: now } }),
      ).rejects.toThrow(/User_deleted_no_iban/);
    } finally {
      await prisma.$disconnect();
    }
  });
});
