import { test, expect } from "./fixtures";
import {
  createGroupAndOpen,
  createInviteLink,
  joinViaInvite,
  openGroup,
  pageAs,
  uniqueGroupName,
} from "./helpers";

/**
 * KALEM KALEM BOLUSUM (ADR-052).
 *
 * BURADA SINANAN SEY BIRIM TESTLERIN GOREMEDIGI: kusurat degismezinin
 * VERITABANINA KADAR tutmasi. splitByItems'in ciktisi zaten test ediliyor;
 * ama paylar veritabanina yazilirken bir tetikleyici bekliyor
 * (trg_expense_participant_sum_check) ve o tetikleyici ancak GERCEK bir
 * yazmada calisiyor. Toplam tutmasaydi harcama HIC kaydedilmezdi.
 *
 * IKINCI SINANAN SEY: kalemlerin DUZENLEMEDE GERI GELMESI. Yeni bir
 * SplitType tutmanin butun sebebi bu - "EXACT" olarak saklansaydi form
 * masayi unuturdu.
 *
 * BAHSIS: hesabin toplami kalemlerin toplamindan BUYUK giriliyor ve fark
 * herkesin payina ORANLA dagiliyor. Beklenen paylar elle hesaplandi ve
 * ekranda aranan sey o.
 */
test.describe("kalem kalem bolusum", () => {
  test("kalemler paya donuyor, bahsis oranla dagiliyor, duzenlemede geri geliyor", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("masa");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();

    /**
     * exact: true - kalem alanlarinin etiketleri ANA ALANLARIN etiketini
     * ICERIYOR ("Tutar" ile "Tutar 1") ve getByLabel varsayilan olarak ALT
     * DIZI ariyor. Kalemler cizildikten sonra exact'siz bir "Tutar", uc
     * alanla birden eslesirdi.
     */
    await owner.getByLabel("Açıklama", { exact: true }).fill("Akşam yemeği");
    // TOPLAM 330: kalemler 300, yani 30 bahsis.
    await owner.getByLabel("Tutar", { exact: true }).fill("330");
    await owner.getByLabel("Nasıl bölünecek?").selectOption("ITEMIZED");

    /**
     * KALEM SATIRINA, ICINDEKI ALANLA TUTUNUYORUZ - metinle DEGIL.
     * filter({ hasText: "Pizza" }) denendi ve tutmadi: "Pizza" bir input'un
     * DEGERI, satirin metni degil. filter({ has: locator }) bu belirsizligi
     * hic acmiyor.
     */
    const itemRow = (n: number) =>
      owner.getByRole("listitem").filter({ has: owner.getByLabel(`Kalem ${n}`, { exact: true }) });

    // --- KALEM 1: ikisi paylasiyor ---
    await owner.getByLabel("Kalem 1", { exact: true }).fill("Pizza");
    await owner.getByLabel("Tutar 1", { exact: true }).fill("200");
    await itemRow(1).getByRole("checkbox", { name: "testuser1" }).check();
    await itemRow(1).getByRole("checkbox", { name: "testuser2" }).check();

    // --- KALEM 2: yalnizca uye ---
    await owner.getByRole("button", { name: "Kalem ekle" }).click();
    await owner.getByLabel("Kalem 2", { exact: true }).fill("Tatlı");
    await owner.getByLabel("Tutar 2", { exact: true }).fill("100");
    await itemRow(2).getByRole("checkbox", { name: "testuser2" }).check();

    /**
     * ONIZLEME - HESABIN KENDISI.
     *   ara toplam: testuser1 = 100, testuser2 = 100 + 100 = 200
     *   olcek: 330 / 300 = 1.1
     *   testuser1 = 110,00   testuser2 = 220,00   TOPLAM = 330,00
     * Bahsis "herkesin yedigi kadar" dagildi: 10 ve 20.
     */
    await expect(owner.getByText("Kalem toplamı")).toBeVisible();
    await expect(owner.getByText("Bahşiş / servis")).toBeVisible();

    // Onizlemeye data-slot ile tutunuyoruz: kisi adlari kalem satirlarinda
    // da geciyor ve sayfa geneline bakan bir locator onlari da bulurdu.
    const preview = owner.locator('[data-slot="split-preview"]');
    await expect(preview.locator("li").filter({ hasText: "testuser1" })).toContainText(
      "110,00",
    );
    await expect(preview.locator("li").filter({ hasText: "testuser2" })).toContainText(
      "220,00",
    );

    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
    await owner.waitForURL(/\/groups\/[0-9a-f-]+/);

    /**
     * KAYIT GECTIYSE TOPLAM TUTMUS DEMEKTIR. Paylarin toplami tutara esit
     * degilse veritabanindaki tetikleyici COMMIT aninda patlar ve harcama
     * HIC olusmaz - yani bu satirin gorunmesi, degismezin veritabanina
     * kadar tuttugunun kanitidir.
     */
    await expect(owner.getByText("Akşam yemeği")).toBeVisible();

    // --- BAKIYE: uye 220 borclu degil, 220 - kendi odemedigi... ---
    // Sahip odedi (330), payi 110 -> alacagi 220. Uyenin borcu 220.
    await openGroup(member, groupName);
    await expect(member.getByText("Bu tutarı borçlusun")).toBeVisible();
    /**
     * BAKIYE KARTININ RAKAMI - sayfa genelinde DEGIL. Ayni tutar uyeler
     * listesinde de yaziyor (ikisi de dogru) ve sayfa geneline bakan bir
     * locator ikisini birden buluyor.
     */
    await expect(
      member.getByRole("paragraph").filter({ hasText: "−220,00 ₺" }),
    ).toBeVisible();
    /**
     * FIS SATIRINDAKI "senin payin" - kalem hesabinin bakiyeye DEGIL,
     * satirin kendisine de dogru ulastiginin kaniti. 220 = 100 (pizzanin
     * yarisi) + 100 (tatlinin tamami), sonra 1,1 ile olceklenmis.
     */
    await expect(member.getByText(/senin payın 220,00/)).toBeVisible();

    // --- DUZENLEME: KALEMLER GERI GELIYOR ---
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Düzenle" }).first().click();
    await owner.waitForURL(/\/edit$/);

    await expect(owner.getByLabel("Kalem 1", { exact: true })).toHaveValue("Pizza");
    // "200,00" DEGIL "200": formatMoneyForInput tam sayilarda kurus
    // basamaklarini yazmiyor - formda 200,00 yazmak kullaniciya silmesi
    // gereken bir sey birakirdi.
    await expect(owner.getByLabel("Tutar 1", { exact: true })).toHaveValue("200");
    await expect(owner.getByLabel("Kalem 2", { exact: true })).toHaveValue("Tatlı");
    // Atamalar da geri geldi: tatliyi yalnizca bir kisi paylasiyor.
    const editedSecond = owner
      .getByRole("listitem")
      .filter({ has: owner.getByLabel("Kalem 2", { exact: true }) });
    await expect(editedSecond.getByRole("checkbox", { name: "testuser2" })).toBeChecked();
    await expect(editedSecond.getByRole("checkbox", { name: "testuser1" })).not.toBeChecked();
  });
});
