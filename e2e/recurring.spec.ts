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
 * TEKRARLAYAN HARCAMA (ADR-051).
 *
 * BURADA SINANAN SEY BIRIM TESTLERIN GOREMEDIGI: zincirin TAMAMI.
 * Servis testleri (lib/recurring.test.ts) calistiricinin kurallarini tek tek
 * dogruluyor - cift uretim korumasi, ayrilan uye, yakalama siniri. Ama
 * "formdaki bir onay kutusu, gunler sonra grubun fisinde bir satira donuyor
 * mu" sorusu ancak gercek bir tarayici, gercek bir uc ve gercek bir
 * veritabaniyla cevaplanir.
 *
 * ZAMANLANMIS IS ELLE TETIKLENIYOR: testin gun beklemesi mumkun degil, ama
 * BEKLEMESI DE GEREKMIYOR - baslangic tarihi BUGUN oldugu icin ilk donem
 * zaten vadesinde. Tetikleyen cagri, Vercel'in her gun yaptigi cagrinin
 * AYNISI: ayni adres, ayni baslik, ayni yetki yolu.
 *
 * TURKCE ALT DIZI TUZAGI (bkz. reminders.spec.ts): grup adi basliktaki
 * dugmenin erisilebilir adi ve getByRole'un name karsilastirmasi
 * toUpperCase() ile ALT DIZI ariyor. Bu yuzden dugme aramalarinda
 * exact: true.
 */

const CRON_URL = "/api/cron/recurring";
const CRON_SECRET = "e2e-cron-secret";

test.describe("tekrarlayan harcama", () => {
  test("kurulan sablon zamanlanmis iste harcamaya donuyor, duraklatilinca duruyor", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("abonelik");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    // --- SABLONU KURUYORUZ (ayri bir form YOK: harcama formunun anahtari) ---
    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Kira");
    await owner.getByLabel("Tutar").fill("500");
    await owner.getByLabel("Bunu tekrarla").check();
    await owner.getByLabel("Ne sıklıkla").selectOption("MONTHLY");
    await owner.getByRole("button", { name: "Tekrarlayan olarak kaydet" }).click();

    await owner.waitForURL(/\/groups\/[0-9a-f-]+/);
    await expect(owner.getByText("Tekrarlayan harcamalar")).toBeVisible();
    await expect(owner.getByText("Kira")).toBeVisible();

    /**
     * SABLON HENUZ BAKIYEYE GIRMIYOR ve bu ADR-051'in en onemli ayrimi.
     * Kurmak, gelecekteki bir kayda onay vermek - bugunku hesaba degil.
     * Grup hala BOS: uretim henuz yapilmadi.
     */
    await expect(
      owner.getByText("Bu grupta henüz harcama yok.", { exact: false }),
    ).toBeVisible();

    // --- ZAMANLANMIS IS: YETKISIZ CAGRI REDDEDILIYOR ---
    // Once yetki yolunun KAPALI oldugunu goruyoruz; acik olsaydi bu uc,
    // adresi bilen herkese harcama urettirirdi.
    const unauthorized = await owner.request.get(CRON_URL);
    expect(unauthorized.status()).toBe(401);

    // --- ZAMANLANMIS IS: DOGRU SIRLA ---
    const run = await owner.request.get(CRON_URL, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(run.status()).toBe(200);
    expect(await run.json()).toMatchObject({ ok: true, created: 1 });

    // --- URETILEN HARCAMA FISTE VE BAKIYEDE ---
    await openGroup(owner, groupName);
    await expect(owner.getByText("Kira")).toHaveCount(2); // fiste + sablon listesinde
    // Sahip odedi, ikisi bolustu: uyenin 250 borcu var.
    await expect(owner.getByText("Sana ödenecekler")).toBeVisible();

    await openGroup(member, groupName);
    await expect(member.getByText("Bu tutarı borçlusun")).toBeVisible();

    // --- IKINCI CAGRI HICBIR SEY URETMIYOR ---
    // Donem ilerledi; ayni gun tekrar calisan bir cron ikinci bir kira
    // yazmamali. Cift uretim korumasinin CANLI kaniti.
    const again = await owner.request.get(CRON_URL, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(await again.json()).toMatchObject({ ok: true, created: 0 });

    // --- DURAKLATMA ---
    await openGroup(owner, groupName);
    /**
     * BOLUME TUTUNUYORUZ, SAYFAYA DEGIL. Uretilen harcama artik fiste ve
     * onun da bir "Sil" dugmesi var; sayfa geneline bakan bir locator iki
     * dugme buluyor ve Playwright hakli olarak reddediyor. Testin hangi
     * "Sil"e bastigi belirsiz kalamaz - yanlisina basmak, sablonu degil
     * HARCAMAYI silmek olurdu.
     */
    const recurring = owner.locator('[data-slot="recurring"]');
    await recurring.getByRole("button", { name: "Duraklat", exact: true }).click();
    await expect(
      recurring.getByRole("button", { name: "Devam ettir", exact: true }),
    ).toBeVisible();
    await expect(recurring.getByText(/Duraklatıldı/)).toBeVisible();

    // --- SILME: URETILMIS HARCAMA KALIYOR ---
    await recurring.getByRole("button", { name: "Sil", exact: true }).click();
    await owner
      .locator('[data-slot="alert-dialog-content"]')
      .getByRole("button", { name: "Sil", exact: true })
      .click();
    await expect(owner.getByText("Henüz tekrarlayan bir harcama yok.")).toBeVisible();

    /**
     * SABLON GITTI, HARCAMA DURUYOR. Bu, "silme yumusak" kararinin
     * kullaniciya gorunen yuzu: gecmis kayitlar bir takvimin silinmesiyle
     * kaybolamaz.
     */
    await expect(owner.getByText("Kira")).toHaveCount(1);
  });
});
