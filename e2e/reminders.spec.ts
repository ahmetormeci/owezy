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
 * ODEME HATIRLATMASI (ADR-050).
 *
 * BURADA SINANAN SEY BIRIM TESTLERIN GOREMEDIGI: hatirlatma IKI KISI
 * arasinda calisiyor mu. Servis testleri (lib/reminders.test.ts) kurallari
 * tek tek dogruluyor - kime gonderilebilir, yon ne, soguma nasil isliyor.
 * Ama "alacaklinin bastigi dugme borclunun ekraninda bir bildirime donuyor
 * mu" sorusu ancak iki gercek oturumla cevaplanir, ve bu ozelligin varlik
 * sebebi tam olarak o.
 *
 * AYRICA: YONUN EKRANDA DOGRU DURDUGU. Alacakli "Hatirlat" goruyor, borclu
 * GORMUYOR - ikisi ayni sayfaya bakiyor ve fark yalnizca kimin baktigi.
 *
 * ---------------------------------------------------------------------------
 * BURADA BIR TUZAGA DUSULDU VE COZUMU KODDA DURUYOR: exact: true.
 *
 * Ilk yazilisinda grup adi uniqueGroupName("hatirlatma") ile uretiliyordu ve
 * test dustu - borclunun ekraninda "Hatirlat" dugmesi bulundu, oysa yoktu.
 * Bulunan sey BASLIKTAKI GRUP ADI dugmesiydi.
 *
 * SEBEP OLCULDU (playwright-core, matchesAttributePart): getByRole'un name
 * karsilastirmasi buyuk/kucuk harf duyarsizligini toUpperCase() ile yapiyor
 * ve exact verilmediginde ALT DIZI ariyor ("*="). Turkcede noktali i ile
 * noktasiz i BUYUK HARFTE AYNI harfe cikiyor:
 *
 *     "Hatirlat".toUpperCase()   -> "HATIRLAT"
 *     "hatirlatma".toUpperCase() -> "HATIRLATMA"   <- ilkini ICERIYOR
 *
 * Ayni tuzak "Hatirlatildi"da da var: o metin "Hatirlat" ile BASLIYOR.
 * Bu yuzden dugme aramalari exact: true - ve grup adi da artik ekrandaki
 * hicbir etiketle akraba degil.
 * ---------------------------------------------------------------------------
 */
test.describe("odeme hatirlatmasi", () => {
  test("alacakli hatirlatir, borclunun bildirimine duser, ikincisi reddedilir", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("durtme");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    /**
     * SAHIP ODUYOR, ikisi de paylasiyor: sahip ALACAKLI, uye BORCLU olur.
     * Harcama davetten SONRA giriliyor - uye o an gruba katilmis olmali ki
     * bolusume dahil edilebilsin.
     */
    await openGroup(owner, groupName);
    await addEqualExpense(owner, { description: "Otel", amount: "300" });

    // --- BORCLU "HATIRLAT" GORMUYOR ---
    // Kendi odemesi gereken satirda hatirlatma yok; yon sabit.
    await openGroup(member, groupName);
    await expect(member.getByText("Sana ödenecekler")).toHaveCount(0);
    await expect(
      member.getByRole("button", { name: "Hatırlat", exact: true }),
    ).toHaveCount(0);

    // --- ALACAKLI HATIRLATIYOR ---
    await openGroup(owner, groupName);
    const remind = owner.getByRole("button", { name: "Hatırlat", exact: true });
    await expect(remind).toBeVisible();
    await remind.click();

    /**
     * KANIT DUGMENIN YERINI ALAN METIN. Toast'a bakmak kirilgan olurdu
     * (kendiliginden kayboluyor); "Hatirlatildi" ise satirin kalici hali ve
     * yalnizca sunucu 201 donduyse yaziliyor.
     */
    await expect(owner.getByText("Hatırlatıldı")).toBeVisible();
    await expect(
      owner.getByRole("button", { name: "Hatırlat", exact: true }),
    ).toHaveCount(0);

    // --- BORCLUNUN BILDIRIMI ---
    await member.goto("/groups");
    await member.getByRole("button", { name: /Bildirimler/ }).click();

    // Iddia TEK BIR satirin icine kilitleniyor: bu kullaniciya baska
    // testlerden de bildirim dusuyor ve grup adi bu satiri benzersiz kiliyor.
    const popover = member.locator('[data-slot="popover-content"]');
    const item = popover.locator("li", { hasText: groupName });
    await expect(item.getByText(/ödemeni hatırlattı/)).toBeVisible();

    // --- SOGUMA: SAYFA YENILENSE DE DUGME ACILMIYOR ---
    // Durum sunucudan geliyor, istemcinin hafizasindan degil.
    await openGroup(owner, groupName);
    await expect(owner.getByText("Hatırlatıldı")).toBeVisible();
    await expect(
      owner.getByRole("button", { name: "Hatırlat", exact: true }),
    ).toHaveCount(0);
  });
});
