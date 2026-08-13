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

  // Once elle basilan bir "tumunu okundu isaretle" dugmesi vardi ve bu test onu
  // olcuyordu. Artik zile bakmak "gordum" sayiliyor: menuyu acmak bildirimleri
  // okundu isaretliyor, dugme de kalkti.
  test("zile tiklayinca bildirimler okundu sayilir ve rakam kaybolur", async ({
    browser,
  }) => {
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

    // Bildirim listeye dustu ve rakam gitti - hicbir seye tiklamadan.
    await expect(member.getByText("Okundu testi")).toBeVisible();
    await expect(
      member.getByRole("button", { name: "Bildirimler", exact: true }),
    ).toBeVisible();

    // Asil iddia: sayfayi yeniden yukleyince de geri gelmiyor. Yalnizca yerel
    // state sifirlansaydi rakam burada tekrar belirirdi.
    await member.reload();
    await expect(
      member.getByRole("button", { name: "Bildirimler", exact: true }),
    ).toBeVisible();
  });
});
