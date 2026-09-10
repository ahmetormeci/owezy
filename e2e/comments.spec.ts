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
 * HARCAMAYA YORUM (ADR-049).
 *
 * BURADA SINANAN SEY BIRIM TESTLERIN GOREMEDIGI: yorum IKI KISI arasinda
 * calisiyor mu. Servis testleri (lib/comments.test.ts) kurallari tek tek
 * dogruluyor - kim yazabilir, kim silebilir, bildirim kime gider. Ama
 * "baskasinin yazdigi yorum benim ekranima geliyor mu" sorusu ancak iki
 * gercek oturumla cevaplanir, ve bu ozelligin varlik sebebi tam olarak o.
 */
test.describe("harcamaya yorum", () => {
  test("iki kisi ayni harcama uzerinde yazisir, silmeyi yalnizca yazan yapar", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("yorum");

    await createGroupAndOpen(owner, groupName);
    await addEqualExpense(owner, { description: "Aksam yemegi", amount: "240" });

    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    // --- SAHIP YAZIYOR ---
    await openGroup(owner, groupName);
    const ownerPopup = owner.locator('[data-slot="dialog-content"]');

    // Yorum yokken tetikleyici DAVET ediyor, sayi gostermiyor.
    await owner.getByRole("button", { name: "Yorum yaz" }).first().click();
    await expect(ownerPopup.getByText("Henüz yorum yok.")).toBeVisible();

    await owner
      .getByPlaceholder("Bu harcama hakkında bir not…")
      .fill("Bahşiş dahil değil, ayrı ekledim.");
    await owner.getByRole("button", { name: "Gönder" }).click();

    /**
     * KANIT "Sil" DUGMESI, yazdigimiz METIN DEGIL. Playwright textarea'nin
     * DEGERINI de metin sayiyor: getByText ile aramak, taslak alanda
     * durdugu icin gonderim HIC olmasa da gecerdi. Bu tuzaga bir kez
     * dusuldu ve ekran goruntusu ortaya cikardi.
     */
    await expect(ownerPopup.getByRole("button", { name: "Sil" })).toBeVisible();
    await expect(owner.getByPlaceholder("Bu harcama hakkında bir not…")).toHaveValue("");

    await owner.keyboard.press("Escape");
    // Satirdaki sayi guncellendi mi - listeye donen tek bilgi bu.
    await expect(owner.getByRole("button", { name: "1 yorum" })).toBeVisible();

    // --- UYE OKUYOR ---
    await openGroup(member, groupName);
    const memberPopup = member.locator('[data-slot="dialog-content"]');

    await expect(member.getByRole("button", { name: "1 yorum" })).toBeVisible();
    await member.getByRole("button", { name: "1 yorum" }).click();
    await expect(memberPopup.getByText("Bahşiş dahil değil, ayrı ekledim.")).toBeVisible();

    // BASKASININ yorumunda silme YOK - ekran sunucunun kuralini aynaliyor.
    await expect(memberPopup.getByRole("button", { name: "Sil" })).toHaveCount(0);

    // --- UYE DE YAZIYOR ---
    await member.getByPlaceholder("Bu harcama hakkında bir not…").fill("Anladım, sağ ol.");
    await member.getByRole("button", { name: "Gönder" }).click();
    // Uye ARTIK kendi yorumunu silebiliyor: tam olarak bir tane silme dugmesi.
    await expect(memberPopup.getByRole("button", { name: "Sil" })).toHaveCount(1);

    // --- SAHIP KENDI YORUMUNU SILIYOR ---
    await openGroup(owner, groupName);
    await owner.getByRole("button", { name: "2 yorum" }).click();
    await expect(ownerPopup.getByText("Anladım, sağ ol.")).toBeVisible();
    await ownerPopup.getByRole("button", { name: "Sil" }).click();

    // Kendi yorumu gitti, UYENINKI DURUYOR.
    await expect(ownerPopup.getByText("Bahşiş dahil değil, ayrı ekledim.")).toHaveCount(0);
    await expect(ownerPopup.getByText("Anladım, sağ ol.")).toBeVisible();

    await owner.keyboard.press("Escape");
    await expect(owner.getByRole("button", { name: "1 yorum" })).toBeVisible();
  });
});
