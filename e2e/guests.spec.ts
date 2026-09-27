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

/**
 * BU DOSYA NEYI KORUYOR: hesapsiz uyenin (misafir) GERCEK YIGINDA calismasini
 * (ADR-057, Faz 50a) - tarayici, API, servis ve veritabani birlikte.
 *
 * Ozelligin butun vaadi tek cumle: grubu kuran kisi TEK BASINA baslayabilir.
 * Birinci test tam olarak bunu yapiyor - ikinci bir hesap hic acilmiyor.
 */

test.describe("hesapsiz uye (misafir)", () => {
  test("tek basina baslanir: misafir eklenir, harcamada kullanilir, hatirlatilamaz, odesilir, cikarilir", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const groupName = uniqueGroupName("misafir");
    await createGroupAndOpen(owner, groupName);

    // --- MISAFIR EKLENIYOR: yalnizca bir ad ---
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await owner.getByLabel("Misafir ekle").fill("Selin");
    await owner.getByRole("button", { name: "Misafir ekle" }).click();

    const selin = owner.locator("li", { hasText: "Selin" });
    await expect(selin.getByText("misafir", { exact: true })).toBeVisible();

    // --- HARCAMADA HERKES GIBI SECILIYOR ---
    // Varsayilan esit bolusum butun uyeleri kapsiyor; misafir de uye.
    await openGroup(owner, groupName);
    await addEqualExpense(owner, { description: "Market", amount: "300" });
    await expect(owner.getByText("Bu tutar sana borçlu")).toBeVisible();

    // --- HATIRLATILAMIYOR ---
    // Once satirin GERCEKTEN orada oldugu goruluyor: "dugme yok" iddiasi,
    // sayfa henuz yuklenmemisken de dogru olurdu.
    await expect(owner.getByText("Sana ödenecekler")).toBeVisible();
    await expect(owner.getByText("Selin").first()).toBeVisible();
    await expect(owner.getByRole("button", { name: "Hatırlat", exact: true })).toHaveCount(0);

    // --- ADI DEGISIYOR ---
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await selin.getByRole("button", { name: "Adını değiştir" }).click();
    await owner.getByLabel("Misafirin adı").fill("Selin K.");
    await owner.getByRole("button", { name: "Kaydet", exact: true }).click();
    const renamed = owner.locator("li", { hasText: "Selin K." });
    await expect(renamed).toBeVisible();

    // --- BORCLUYKEN CIKARILAMIYOR - borc kaybolmaz ---
    await renamed.getByRole("button", { name: "Çıkar", exact: true }).click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "Çıkar", exact: true }).click();
    await expect(owner.getByText(/borcu var/)).toBeVisible();
    await expect(renamed).toBeVisible();

    // --- ODESILIYOR: tarafi olan uye kaydediyor ---
    await openGroup(owner, groupName);
    await owner.getByRole("button", { name: "Ödeme kaydet" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByLabel("İşlem yönü").selectOption("incoming");
    await dialog.getByLabel("Kim ödedi?").selectOption({ label: "Selin K." });
    await dialog.getByText(/Önerilen tutarı kullan/).click();
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(owner.getByText("Ödeştin")).toBeVisible();

    // --- ARTIK CIKARILABILIYOR ---
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await renamed.getByRole("button", { name: "Çıkar", exact: true }).click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "Çıkar", exact: true }).click();
    await expect(owner.locator("li", { hasText: "Selin K." })).toHaveCount(0);
  });

  /**
   * SAHIPLENME (Faz 50b). Ozelligin ikinci yarisi: misafir sonradan hesap
   * acinca kayitlari ONA geciyor. Iddia GERCEK YIGINDA: bakiye devraliniyor,
   * misafir listeden kalkiyor, ve gercek bir uye oldugu icin artik
   * hatirlatilabiliyor - o dugme, tasimanin gercekten oldugunun en dogrudan
   * kaniti.
   */
  test("misafir sahipleniliyor: linki acan kisi misafirin borcunu devraliyor, link ikinci kez calismiyor", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("sahiplen");
    await createGroupAndOpen(owner, groupName);

    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await owner.getByLabel("Misafir ekle").fill("Selin");
    await owner.getByRole("button", { name: "Misafir ekle" }).click();
    const selin = owner.locator("li", { hasText: "Selin" });
    await expect(selin.getByText("misafir", { exact: true })).toBeVisible();

    await openGroup(owner, groupName);
    await addEqualExpense(owner, { description: "Market", amount: "300" });
    await expect(owner.getByText("Sana ödenecekler")).toBeVisible();
    await expect(owner.getByRole("button", { name: "Hatırlat", exact: true })).toHaveCount(0);

    // --- MISAFIRE OZEL LINK ---
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await selin.getByRole("button", { name: "Davet et" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByRole("button", { name: "Davet linki oluştur" }).click();
    const link = await dialog.getByRole("textbox", { name: "Selin için link hazır" }).inputValue();
    expect(link).toContain("/join/");
    await owner.keyboard.press("Escape");
    await expect(owner.getByText("Selin için")).toBeVisible();

    // --- SELIN OLARAK KATILMA: once NE OLACAGI soyleniyor ---
    await member.goto(link);
    await expect(member.getByRole("heading", { name: /Selin olarak katılıyorsun/ })).toBeVisible();
    await member.getByRole("button", { name: "Selin olarak katıl" }).click();
    await member.waitForURL(/\/groups\/[0-9a-f-]{36}/);
    // Misafirin 150'lik borcu artik bu kisinin.
    await expect(member.getByText("Bu tutarı borçlusun")).toBeVisible();

    // --- SAHIBIN GORDUGU: misafir gitti, gercek uye geldi ---
    await openGroup(owner, groupName);
    await expect(owner.getByText("testuser2").first()).toBeVisible();
    // Gercek bir uye: artik hatirlatilabiliyor.
    await expect(owner.getByRole("button", { name: "Hatırlat", exact: true })).toBeVisible();
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await expect(owner.getByText("misafir", { exact: true })).toHaveCount(0);

    // --- LINK IKINCI KEZ CALISMIYOR ---
    await outsider.goto(link);
    await expect(outsider.getByRole("heading", { name: "Davet kullanılamıyor" })).toBeVisible();
  });

  test("gruba ZATEN UYE olan biri misafiri sahiplenemiyor", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("sahiplen-uye");
    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Üyeleri yönet" }).click();
    await owner.getByLabel("Misafir ekle").fill("Deniz");
    await owner.getByRole("button", { name: "Misafir ekle" }).click();
    await owner.locator("li", { hasText: "Deniz" }).getByRole("button", { name: "Davet et" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByRole("button", { name: "Davet linki oluştur" }).click();
    const link = await dialog.getByRole("textbox", { name: "Deniz için link hazır" }).inputValue();

    await member.goto(link);
    await member.getByRole("button", { name: "Deniz olarak katıl" }).click();
    await expect(member.getByText("Zaten bu grubun üyesisiniz")).toBeVisible();

    // Misafir yerinde duruyor - hicbir sey tasinmadi.
    await owner.keyboard.press("Escape");
    await owner.reload();
    await expect(
      owner.locator("li", { hasText: "Deniz" }).getByText("misafir", { exact: true }),
    ).toBeVisible();
  });

  test("grubun uyesi olmayan misafir EKLEYEMIYOR", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const outsider = await pageAs(browser, "outsider");
    const groupName = uniqueGroupName("misafir-disari");
    await createGroupAndOpen(owner, groupName);
    const groupId = new URL(owner.url()).pathname.split("/")[2];

    const response = await outsider.request.post(`/api/v1/groups/${groupId}/guests`, {
      data: { displayName: "Sizma" },
    });

    expect(response.status()).toBe(403);
  });

  /**
   * VERITABANI SON KATMAN. Uygulama misafire oturum acmiyor (Better Auth
   * kancasi, findCurrentUser); bu test UYGULAMA ATLANSA BILE tutanin
   * veritabani oldugunu gosteriyor. Olumlu kontrol de var: ayni kurulum
   * gercek bir kullaniciya oturum YAZABILIYOR - yoksa reddin "yanlis
   * sebepten" olup olmadigi bilinemezdi.
   */
  test("veritabani misafire OTURUM, SAHIPLIK ve cok kullanimlik link yazdirmiyor", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: process.env.E2E_DATABASE_URL! }),
    });
    try {
      const real = await prisma.user.create({
        data: { id: randomUUID(), email: `e2e-${randomUUID()}@example.com`, displayName: "Gercek" },
      });
      const group = await prisma.group.create({
        data: { name: uniqueGroupName("db-misafir"), currency: "TRY", createdById: real.id },
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
      const session = (userId: string) => ({
        id: randomUUID(),
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      // Olumlu kontrol: kurulum saglam.
      await expect(prisma.session.create({ data: session(real.id) })).resolves.toBeTruthy();

      await expect(prisma.session.create({ data: session(guest.id) })).rejects.toThrow(
        /Misafir kullanici icin Session/,
      );
      await expect(
        prisma.groupMember.create({
          data: { id: randomUUID(), groupId: group.id, userId: guest.id, role: "OWNER" },
        }),
      ).rejects.toThrow(/grup sahibi olamaz/);
      // Gercek birinin misafir alan adiyla kaydi da reddediliyor.
      await expect(
        prisma.user.create({
          data: { id: randomUUID(), email: `guest-${randomUUID()}@guest.invalid`, displayName: "X" },
        }),
      ).rejects.toThrow(/User_guest_shape/);

      // --- SAHIPLENME (Faz 50b) ---
      // Misafir linki TEK KULLANIMLIK: iki kullanim, ayni misafiri iki
      // kisinin sahiplenmeye calismasi demekti.
      const invite = (maxUses: number) => ({
        groupId: group.id,
        invitedById: real.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
        maxUses,
        guestUserId: guest.id,
      });
      await expect(prisma.groupInvite.create({ data: invite(1) })).resolves.toBeTruthy();
      await expect(prisma.groupInvite.create({ data: invite(2) })).rejects.toThrow(
        /GroupInvite_guest_single_use/,
      );
      // Yalnizca MISAFIR devredilir; devir "kime" ve "ne zaman" ile BIRLIKTE.
      await expect(
        prisma.user.update({
          where: { id: real.id },
          data: { mergedIntoId: guest.id, mergedAt: new Date() },
        }),
      ).rejects.toThrow(/User_merge_shape/);
      await expect(
        prisma.user.update({ where: { id: guest.id }, data: { mergedIntoId: real.id } }),
      ).rejects.toThrow(/User_merge_shape/);
    } finally {
      await prisma.$disconnect();
    }
  });
});
