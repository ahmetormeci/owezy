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

test.describe("bildirimler", () => {
  // Zincirin tamami: harcama kaydediliyor -> ayni transaction'da bildirim
  // yaziliyor -> API donduruyor -> zil rakami ve metin ekranda cikiyor.
  test("harcamanin katilimcisi bildirim alir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("bildirim");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await addEqualExpense(owner, { description: "Bildirim testi", amount: "100" });

    // Uye sayfayi harcamadan SONRA aciyor: rakam sunucudan geliyor.
    await member.goto("/groups");
    await member.getByRole("button", { name: /Bildirimler/ }).click();

    // Iddialari TEK BIR bildirim satirinin icine kilitliyoruz. Menu geneline
    // bakmak yetmez: onceki testler de bu kullaniciya ayni baslikta bildirim
    // birakiyor ve "yeni bir harcama ekledi" birden fazla satirda gecebiliyor.
    // Bu satiri benzersiz kilan sey, yalnizca bu teste ait olan aciklama.
    const popover = member.locator('[data-slot="popover-content"]');
    const item = popover.locator("li", { hasText: "Bildirim testi" });

    await expect(item.getByText(/yeni bir harcama ekledi/)).toBeVisible();
    await expect(item.getByText(groupName)).toBeVisible();
    await expect(item.getByText("az önce")).toBeVisible();
  });

  test("kendi islemi icin kendine bildirim gitmez", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const groupName = uniqueGroupName("kendi-islemi");

    await createGroupAndOpen(owner, groupName);
    await addEqualExpense(owner, { description: "Kendi harcamam", amount: "40" });

    await owner.goto("/groups");
    await owner.getByRole("button", { name: /Bildirimler/ }).click();

    await expect(owner.getByText("Kendi harcamam")).toHaveCount(0);
  });

  test("tumunu okundu isaretleyince rakam kaybolur", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("okundu");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await addEqualExpense(owner, { description: "Okundu testi", amount: "60" });

    await member.goto("/groups");
    // Okunmamis varken zilin erisilebilir adi sayiyi da icerir.
    await member.getByRole("button", { name: /Bildirimler \(\d+ okunmamış\)/ }).click();
    await member.getByRole("button", { name: "Tümünü okundu işaretle" }).click();

    // Sayi sifirlaninca ad sadece "Bildirimler" olur.
    await expect(
      member.getByRole("button", { name: "Bildirimler", exact: true }),
    ).toBeVisible();
  });
});
