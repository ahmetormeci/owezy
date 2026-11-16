import { readFileSync } from "node:fs";
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

test.describe("harcamalar", () => {
  test("esit bolusumlu harcama eklenir, listede ve bakiyede gorunur", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("harcama"));

    await addEqualExpense(page, { description: "Market alisverisi", amount: "120,50" });

    await expect(page.getByText("Market alisverisi")).toBeVisible();
    await expect(page.getByText("120,50 ₺").first()).toBeVisible();

    // Tek kisilik grupta harcamanin tamami kendine ait: net bakiye sifir.
    await expect(page.getByText("Ödeştin")).toBeVisible();
  });

  test("bolusum onizlemesi kalan kurusu gosterir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("onizleme"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Onizleme testi");
    await page.getByLabel("Tutar").fill("100");

    // Tek kisilik grupta tamami tek katilimciya dusuyor.
    await expect(page.getByText("Bölüşüm önizlemesi")).toBeVisible();
    await expect(page.getByText("100,00 ₺").first()).toBeVisible();
  });

  test("gecersiz tutar girildiginde uyari gosterilir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("gecersiz-tutar"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Bozuk tutar");
    await page.getByLabel("Tutar").fill("abc");

    await expect(page.getByText("Tutarı anlayamadım")).toBeVisible();
  });

  test("EXACT bolusumde paylarin toplami tutmazsa hata gosterilir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("exact-hata"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Eksik pay");
    await page.getByLabel("Tutar").fill("150");
    await page.getByLabel("Nasıl bölünecek?").selectOption("EXACT");

    // Tutar 150 TL ama paya 100 TL yaziyoruz: toplam tutmuyor.
    await page.locator('input[aria-label$="tutarı"]').first().fill("100");

    await expect(page.getByText(/toplamı .* eşit değil/)).toBeVisible();
  });

  test("harcama silinir, onay penceresi kapanir ve kayit listeden kalkar", async ({
    browser,
  }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("silme"));

    await addEqualExpense(page, { description: "Silinecek harcama", amount: "80" });
    await expect(page.getByText("Silinecek harcama")).toBeVisible();

    await page.getByRole("button", { name: "Sil", exact: true }).click();

    // Once pencerenin ACILDIGINI dogruluyoruz. Bunu atlarsak asagidaki
    // "kapandi mi" kontrolu, pencere hic acilmamis olsa da gecerdi.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sil", exact: true }).click();

    // Onay penceresinin KAPANDIGINI dogruluyoruz: acik kalirsa kullanici
    // islemi basarisiz saniyor ve tekrar deneyince "bulunamadi" aliyor.
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Geri alinacak harcama")).toBeHidden();
  });

  test("harcama duzenlenir ve yeni tutar bakiyeye yansir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("duzenleme"));

    await addEqualExpense(page, { description: "Duzenlenecek", amount: "50" });

    await page.getByRole("link", { name: "Düzenle" }).click();
    await page.getByLabel("Tutar").fill("75");
    await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

    await expect(page.getByText("75,00 ₺").first()).toBeVisible();
  });

  // Bu testin varlik sebebi bir hata: duzenleme formu yuzde alanlarini BOS
  // aciyordu, cunku yuzdeler hicbir yerde saklanmiyordu. Kullanici yalnizca
  // aciklamayi degistirmek istese bile butun yuzdeleri yeniden yazmak
  // zorunda kaliyordu - ve yaklasik yazarsa paylar sessizce degisiyordu.
  test("yuzdeli harcama duzenlenirken yuzdeler dolu gelir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("yuzde-duzenleme");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Yuzdeli harcama");
    await owner.getByLabel("Tutar").fill("100");
    await owner.getByLabel("Nasıl bölünecek?").selectOption("PERCENTAGE");

    const percentageInputs = owner.locator('input[aria-label$="yüzdesi"]');
    await percentageInputs.nth(0).fill("30");
    await percentageInputs.nth(1).fill("70");
    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();

    await expect(owner.getByText("Yuzdeli harcama")).toBeVisible();

    await owner.getByRole("link", { name: "Düzenle" }).first().click();

    // Asil iddia: alanlar dolu geliyor.
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(0)).toHaveValue("30");
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(1)).toHaveValue("70");

    // Ve yuzdelere hic dokunmadan yalnizca aciklamayi degistirip kaydetmek
    // bolusumu bozmuyor: form tekrar acildiginda ayni yuzdeler duruyor.
    await owner.getByLabel("Açıklama").fill("Yuzdeli harcama (aciklama degisti)");
    await owner.getByRole("button", { name: "Değişiklikleri kaydet" }).click();

    await expect(owner.getByText("Yuzdeli harcama (aciklama degisti)")).toBeVisible();

    await owner.getByRole("link", { name: "Düzenle" }).first().click();
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(0)).toHaveValue("30");
    await expect(owner.locator('input[aria-label$="yüzdesi"]').nth(1)).toHaveValue("70");
  });

  // Ozet ve ay basliklari (Faz 13). Buradaki asil iddia toplamlarin DOGRU
  // olmasi: ay basligindaki tutar ekrandaki satirlardan degil, grubun
  // tamamindan geliyor.
  test("ozet blogu ve ay basliklari dogru tutarlari gosterir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("ozet"));

    async function addExpense(input: {
      description: string;
      amount: string;
      date: string;
      category: string;
    }) {
      await page.getByRole("link", { name: "Harcama ekle" }).click();
      await page.getByLabel("Açıklama").fill(input.description);
      await page.getByLabel("Tutar").fill(input.amount);
      await page.getByLabel("Kategori").selectOption({ label: input.category });
      await page.getByLabel("Tarih").fill(input.date);
      await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(page.getByText(input.description)).toBeVisible();
    }

    await addExpense({
      description: "Villa kirasi",
      amount: "3000",
      date: "2026-08-10",
      category: "Konaklama",
    });
    await addExpense({
      description: "Aksam yemegi",
      amount: "1000",
      date: "2026-07-15",
      category: "Yemek",
    });

    // Ozet: toplam ve kategori kirilimi.
    await expect(page.getByText("4.000,00 ₺").first()).toBeVisible();
    await expect(page.getByText("3.000,00 ₺ · %75")).toBeVisible();
    await expect(page.getByText("1.000,00 ₺ · %25")).toBeVisible();

    // Ay adi IKI yerde geciyor: ozetteki aylik sutunun etiketinde ve listenin
    // ay basliginda. Faz 16'da baslik ".label" yerine ".cap" tasiyor (fisin
    // perfore cizgisi); sutun etiketi hicbirini tasimiyor - iddiayi ".cap"e
    // cipaliyoruz ki dogru olani olctugumuzden emin olalim.
    await expect(page.locator(".cap", { hasText: "Ağustos 2026" })).toBeVisible();
    await expect(page.locator(".cap", { hasText: "Temmuz 2026" })).toBeVisible();

    // Ay ara toplamlari. Faz 16'da tek metin olmaktan cikti: adet satirin
    // solunda, tutar saginda. Iki ay da tek harcamali oldugu icin ikisinin de
    // etiketi "1 harcama" - o yuzden tutarlariyla birlikte, ayni satirda
    // olduklarini dogruluyoruz.
    const ayToplamlari = page
      .locator("div", { has: page.locator(".cap", { hasText: "1 harcama" }) })
      .filter({ hasText: "harcama" });
    await expect(ayToplamlari.filter({ hasText: "3.000,00 ₺" }).last()).toBeVisible();
    await expect(ayToplamlari.filter({ hasText: "1.000,00 ₺" }).last()).toBeVisible();

    // Bakiyenin acilimi artik FISIN KENDISINDE: cift cizginin altindaki
    // toplamlar bloğu. "Bakiyen nasil olustu" denklemi kaldirildi cunku ayni
    // sayilari sayfada ikinci kez gosteriyordu (Faz 16).
    await expect(page.locator(".cap", { hasText: "Ödediğin" })).toBeVisible();
    await expect(page.locator(".cap", { hasText: "Payın" })).toBeVisible();

    await page.screenshot({ path: "test-results/faz13-ozet.png", fullPage: true });

    // Duzen hatalari normalde E2E'den kaciyor: testler metnin VARLIGINA
    // bakiyor, sayfanin kaydigina degil. 11.5'te mobilde yatay kayma tam da
    // bu yuzden ancak ekran goruntusuyle yakalanmisti. Ozet blogu yeni bir
    // grid ve sabit genislikli cubuklar getirdigi icin olcumu buraya aliyoruz.
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 800 });
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflows, `${width}px genisliginde sayfa yatay kayiyor`).toBe(false);
    }
  });

  // Arama ve filtre (Faz 13.3a). Filtre SUNUCUDA calisiyor; bu test onun
  // gorunur sonucunu dogruluyor - ozellikle "yalnizca beni ilgilendirenler"in
  // odeyene degil KATILIMCILIGA baktigini.
  test("arama ve filtreler listeyi daraltir", async ({ browser }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("filtre");

    await createGroupAndOpen(owner, groupName);
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);

    async function addExpense(input: {
      description: string;
      amount: string;
      category: string;
      /** true ise ODEYEN kisi bolusumden cikarilir. */
      unselectPayer?: boolean;
    }) {
      await owner.getByRole("link", { name: "Harcama ekle" }).click();
      await owner.getByLabel("Açıklama").fill(input.description);
      await owner.getByLabel("Tutar").fill(input.amount);
      await owner.getByLabel("Kategori").selectOption({ label: input.category });
      if (input.unselectPayer) {
        // Katilimci kutusunun etiketi kullanicinin GORUNEN ADI (displayName:
        // ad soyad, yoksa e-posta). Testin e-postayi sabit yazmasi, Clerk
        // hesabina bir ad girildigi gun sessizce kiriliyordu - nitekim
        // kirildi. Adi sayfanin kendisinden okuyoruz: "Kim odedi?"
        // secimindeki secili secenek, cikarmak istedigimiz kisinin ta kendisi.
        const payerName = await owner
          .getByLabel("Kim ödedi?")
          .locator("option:checked")
          .innerText();
        await owner.getByRole("checkbox", { name: payerName.trim() }).uncheck();
      }
      await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(owner.getByText(input.description)).toBeVisible();
    }

    await addExpense({ description: "Market alisverisi", amount: "100", category: "Alışveriş" });
    // Owner bu bolusumden CIKARILIYOR: parayi o odedi ama payi yok.
    await addExpense({
      description: "Havaalani taksisi",
      amount: "200",
      category: "Ulaşım",
      unselectPayer: true,
    });

    const search = owner.getByLabel("Harcama ara");

    // 1) Metin aramasi.
    await search.fill("market");
    await expect(owner.getByText("Havaalani taksisi")).toBeHidden();
    await expect(owner.getByText("Market alisverisi")).toBeVisible();
    await expect(owner.getByText("1 sonuç · 100,00 ₺")).toBeVisible();

    // 2) Kategori filtresi.
    await search.fill("");
    await owner.getByLabel("Kategori").selectOption({ label: "Ulaşım" });
    await expect(owner.getByText("Market alisverisi")).toBeHidden();
    await expect(owner.getByText("Havaalani taksisi")).toBeVisible();
    await expect(owner.getByText("1 sonuç · 200,00 ₺")).toBeVisible();

    // 3) "Yalnizca beni ilgilendirenler": taksi owner'in payinda olmadigi icin
    //    dusmeli, market kalmali.
    await owner.getByLabel("Kategori").selectOption({ label: "Tüm kategoriler" });
    await owner.getByLabel("Yalnızca beni ilgilendirenler").check();
    await expect(owner.getByText("Havaalani taksisi")).toBeHidden();
    await expect(owner.getByText("Market alisverisi")).toBeVisible();

    await owner.screenshot({ path: "test-results/faz13-filtre.png", fullPage: true });

    // 4) Filtre kalkinca liste geri geliyor ve ay toplamlari yeniden yaziliyor.
    await owner.getByLabel("Yalnızca beni ilgilendirenler").uncheck();
    await expect(owner.getByText("Havaalani taksisi")).toBeVisible();
    // Faz 16: ay ara toplami tek metin degil artik - adet satirin solunda,
    // tutar saginda, arada noktali ayrac var. Ikisinin AYNI SATIRDA oldugunu
    // dogruluyoruz; ayri ayri "gorunur mu" demek daha zayif bir iddia olurdu
    // (300,00 ₺ fisin toplamlar blogunda da geciyor).
    const ayToplami = owner
      .locator("div", { has: owner.locator(".cap", { hasText: "2 harcama" }) })
      .last();
    await expect(ayToplami).toContainText("300,00 ₺");
  });

  // Turkce arama katlamasi. 13.3a'da olculmus sinir buydu: veritabani
  // collation'i C.UTF-8 ve buyuk "I" kucultuldugunde "i" oluyor, "ı" degil -
  // yani "Isik" yazan harcama "ışık" aramasiyla BULUNMUYORDU.
  test("Turkce arama noktali/noktasiz i ayrimina takilmaz", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("katlama"));

    async function addExpense(description: string, amount: string) {
      await page.getByRole("link", { name: "Harcama ekle" }).click();
      await page.getByLabel("Açıklama").fill(description);
      await page.getByLabel("Tutar").fill(amount);
      await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(page.getByText(description)).toBeVisible();
    }

    await addExpense("Isik faturasi", "100");
    await addExpense("Çay ocagi", "50");

    const search = page.getByLabel("Harcama ara");

    // Asil hata: noktasiz "ı" ile aranan noktali "I".
    await search.fill("ışık");
    await expect(page.getByText("Isik faturasi")).toBeVisible();
    await expect(page.getByText("Çay ocagi")).toBeHidden();

    // Ters yon de calismali.
    await search.fill("ISIK");
    await expect(page.getByText("Isik faturasi")).toBeVisible();

    // Aksana duyarsizlik: "cay" ile "Çay" eslesiyor.
    await search.fill("cay");
    await expect(page.getByText("Çay ocagi")).toBeVisible();
    await expect(page.getByText("Isik faturasi")).toBeHidden();
  });

  /**
   * SILINEN HARCAMAYI GERI ALMA (Faz 39).
   *
   * Uc bastan beri vardi (POST .../restore) ve liste zaten
   * ?includeDeleted=true kabul ediyordu; eksik olan ikisini GORUNUR kilan
   * arayuzdu. Destek sayfasi bunu "silinen bir harcamayi geri alma arayuzu
   * yok" diye yaziyordu.
   *
   * IDDIA UC ADIMLI: silinen kayit normalde GORUNMUYOR, kutu isaretlenince
   * GORUNUYOR, ve geri alininca kutu olmadan da duruyor. Ortadaki adim
   * olmasa test "silme calisiyor mu"yu olcerdi.
   */
  test("silinen harcama gosterilebiliyor ve geri alinabiliyor", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("geri-al"));

    await page.getByRole("link", { name: "Harcama ekle" }).click();
    await page.getByLabel("Açıklama").fill("Geri alinacak harcama");
    await page.getByLabel("Tutar").fill("300");
    await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
    await expect(page.getByText("Geri alinacak harcama")).toBeVisible();

    await page.getByRole("button", { name: "Sil", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sil", exact: true }).click();

    // Silindikten sonra listede YOK. Bu satir olmasa sonraki adim bir sey
    // kanitlamazdi - kayit zaten gorunuyor olabilirdi.
    await expect(page.getByText("Silinecek harcama")).toBeHidden();

    await page.getByLabel("Silinenleri de göster").check();
    await expect(page.getByText("Geri alinacak harcama")).toBeVisible();
    // Rozet, satirin neden soluk oldugunu SOYLUYOR; yalnizca ustu cizili
    // olmasi ekran okuyucuya hicbir sey anlatmazdi.
    await expect(page.getByText("silindi", { exact: false }).first()).toBeVisible();

    await page.getByRole("button", { name: "Geri al" }).click();
    await expect(page.getByText("Harcama geri alındı")).toBeVisible();

    // ASIL IDDIA: kutu KAPATILINCA da duruyor, yani kayit gercekten geri
    // geldi - yalnizca "silinenleri goster" sayesinde gorunmuyor.
    await page.getByLabel("Silinenleri de göster").uncheck();
    await expect(page.getByText("Geri alinacak harcama")).toBeVisible();
  });

  // CSV disa aktarma (Faz 13.3b). Iddia dosyanin INDIGI degil, ICERIGI:
  // Excel'in okuyabilmesi icin BOM, Turkce yerelde ";" ayrac, ve ayrac iceren
  // bir aciklamanin tirnaklanmasi.
  test("CSV disa aktarma Excel'in okuyabilecegi bicimde ve filtreyi izler", async ({
    browser,
  }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("csv"));

    async function addExpense(description: string, amount: string) {
      await page.getByRole("link", { name: "Harcama ekle" }).click();
      await page.getByLabel("Açıklama").fill(description);
      await page.getByLabel("Tutar").fill(amount);
      await page.getByRole("button", { name: "Harcamayı kaydet" }).click();
      await expect(page.getByText(description)).toBeVisible();
    }

    // Aciklamada NOKTALI VIRGUL var: Turkce dosyada ayracin ta kendisi.
    // Tirnaklanmazsa satiri iki hucreye boler ve tablo kayar.
    // Ondalikli tutar bilerek: Turkce dosyada ondalik ayraci VIRGUL olmali ve
    // ayrac noktali virgul oldugu icin ikisi cakismamali.
    await addExpense("Market; alisveris", "120,50");
    await addExpense("Taksi", "200");

    async function downloadCsv() {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("link", { name: "Dışa aktar" }).click();
      const download = await downloadPromise;
      const path = await download.path();
      return { text: readFileSync(path, "utf8"), name: download.suggestedFilename() };
    }

    const all = await downloadCsv();

    // Excel UTF-8'i ancak BOM ile taniyor; onsuz Turkce harfler bozuluyor.
    expect(all.text.startsWith("﻿")).toBe(true);
    expect(all.name).toMatch(/\.csv$/);

    const lines = all.text.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Tarih;Açıklama;Kategori;Ödeyen;Tutar (TRY);Payın (TRY)");

    // Ayrac iceren aciklama tirnakli; tutarlar Turkce ondalikla ve para birimi
    // simgesi olmadan (simgeli olsa Excel metin okurdu).
    expect(all.text).toContain('"Market; alisveris"');
    // Ondalik VIRGUL, ayrac NOKTALI VIRGUL - Turkce Excel ikisini de dogru
    // okuyor. Tam sayida ondalik hic yazilmiyor; Excel yine sayi goruyor.
    expect(all.text).toContain(";120,50;120,50");
    expect(all.text).toContain(";200;200");
    expect(lines).toHaveLength(3);

    // Filtre acikken indirilen dosya da suzulmus olmali.
    await page.getByLabel("Harcama ara").fill("taksi");
    await expect(page.getByText("1 sonuç · 200,00 ₺")).toBeVisible();

    const filtered = await downloadCsv();
    const filteredLines = filtered.text.replace("﻿", "").split("\r\n");

    expect(filteredLines).toHaveLength(2);
    expect(filtered.text).toContain("Taksi");
    expect(filtered.text).not.toContain("Market");
  });

  test("satir ici giris harcamayi sayfadan cikmadan ekler", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("satirici"));

    // Bos halde fis tek temiz satir: varsayimlar da gonder dugmesi de yok.
    // Bu, tasarimin bir gerekcesi - yazmadan once soylenecek bir sey yok.
    await expect(page.getByText("Eşit bölünür")).toBeHidden();

    await page.getByLabel("Ne aldın?").fill("Satir ici market");
    await page.getByLabel("Ne kadar?").fill("480,50");

    // Yazmaya baslayinca NE OLACAGI yaziyor. Sessizce varsayim yapan bir hizli
    // giris, yanlis kaydedilmis bir harcamadan daha kotu.
    await expect(page.getByText("Eşit bölünür · sen ödedin · bugün")).toBeVisible();

    await page.getByRole("button", { name: "Ekle" }).click();

    await expect(page.getByText("Satir ici market")).toBeVisible();
    await expect(page.getByText("480,50 ₺").first()).toBeVisible();

    // Alanlar temizleniyor: ayni harcamayi iki kez eklemek kolay olmamali.
    await expect(page.getByLabel("Ne aldın?")).toHaveValue("");
    await expect(page.getByText("Eşit bölünür")).toBeHidden();
  });

  // BU TESTIN SEBEBI (16 Kasim): satir ici giris kayittan sonra kullaniciyi
  // grubun BU AYINA gonderiyor. Adres zaten oradaysa bu AYNI adrese bir
  // gezinme. Next 16 o durumda da sayfayi taze cekiyor - olculdu, o yuzden
  // ardindan gelen router.refresh() kaldirildi (sayfayi ikinci kez
  // urettiriyordu). Bir onceki test adreste ay OLMAYAN durumu siniyor; Next
  // bir gun ayni adrese gezinmede sayfayi cekmeyi birakirsa yalnizca bu
  // test duser.
  test("satir ici giris, ay zaten aciksa da yeni satiri gosterir", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("satirici-ay"));

    // Bilesen ayi UTC'den uretiyor (toISOString) - test de ayni yoldan.
    const thisMonth = new Date().toISOString().slice(0, 7);
    await page.goto(`${page.url().split("?")[0]}?month=${thisMonth}`);

    await page.getByLabel("Ne aldın?").fill("Ayni ay satiri");
    await page.getByLabel("Ne kadar?").fill("75,00");
    await page.getByRole("button", { name: "Ekle" }).click();

    await expect(page.getByText("Ayni ay satiri")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`month=${thisMonth}$`));
  });

  test("satir ici giris bozuk tutari reddeder", async ({ browser }) => {
    const page = await pageAs(browser, "owner");
    await createGroupAndOpen(page, uniqueGroupName("satirici-hata"));

    await page.getByLabel("Ne aldın?").fill("Bozuk tutar");
    await page.getByLabel("Ne kadar?").fill("abc");
    await page.getByRole("button", { name: "Ekle" }).click();

    // Mesaj tam formdakiyle AYNI: iki ayri yerde ayni hatanin iki farkli
    // sesle konusmamasi icin ayni sozluk anahtari kullaniliyor.
    await expect(page.getByText("Tutarı anlayamadım")).toBeVisible();

    // Yazilan sey KAYBOLMUYOR: hatali gonderimde alanlari temizlemek,
    // kullaniciya her seyi bastan yazdirmak demek.
    await expect(page.getByLabel("Ne aldın?")).toHaveValue("Bozuk tutar");
    await expect(page.getByLabel("Ne kadar?")).toHaveValue("abc");
  });

  /**
   * BIRDEN FAZLA ODEYEN (ADR-067). Uc iddia, uc katman:
   *   - Bakiye ODEYENLER tablosundan okunuyor: 100'u 30/70 odeyip esit
   *     bolen iki kiside 70 odeyen 20 alacakli. paidById'den okunsaydi
   *     tamamini o odemis sayilir, 50 alacakli gorunurdu.
   *   - Ilk satirin tutari GIRILMIYOR: "kalan" olarak hesaplaniyor.
   *   - Eski govde (yalnizca paidById) cok odeyenli bir harcamayi
   *     ezemiyor: magazadaki 1.0.7 onu tek odeyene cevirirdi.
   */
  test("iki kisi odeyen harcama bakiyeye dogru yansir, eski govde onu ezemez", async ({
    browser,
  }) => {
    const owner = await pageAs(browser, "owner");
    const member = await pageAs(browser, "member");
    const groupName = uniqueGroupName("iki-odeyen");

    await createGroupAndOpen(owner, groupName);
    const groupId = new URL(owner.url()).pathname.split("/")[2];
    const inviteLink = await createInviteLink(owner, groupName);
    await joinViaInvite(member, inviteLink, groupName);

    await openGroup(owner, groupName);
    await owner.getByRole("link", { name: "Harcama ekle" }).click();
    await owner.getByLabel("Açıklama").fill("Iki odeyenli yemek");
    await owner.getByLabel("Tutar").fill("100");

    // Tek odeyenken tekrarlama sunuluyor...
    const repeat = owner.getByRole("checkbox", { name: "Bunu tekrarla" });
    await expect(repeat).toBeVisible();

    // Ikinci satir bos olan ilk uyeyle aciliyor: owner zaten ilk satirda.
    await owner.getByRole("button", { name: "Başka ödeyen ekle" }).click();
    await owner.getByLabel("testuser2 ödediği tutar").fill("70");

    // Ilk satir HESAPLANIYOR - kimse 30 yazmadi.
    await expect(owner.locator('[data-slot="payer-rest"]')).toHaveText("30,00 ₺");

    // ...ikinci odeyen varken sunulmuyor (sablon tek odeyenli, S3).
    await expect(repeat).toBeHidden();

    await owner.getByRole("button", { name: "Harcamayı kaydet" }).click();
    await expect(owner.getByText("Iki odeyenli yemek")).toBeVisible();

    // owner: 30 odedi, payi 50 -> 20 borclu. member: 70 odedi, payi 50 -> 20 alacakli.
    await expect(owner.getByText("Bu tutarı borçlusun")).toBeVisible();
    await expect(owner.getByText("20,00 ₺").first()).toBeVisible();
    // Ana odeyen daha cok odeyen: satirda once o.
    await expect(owner.getByText(/testuser2 ve testuser1 ödedi/)).toBeVisible();

    await openGroup(member, groupName);
    await expect(member.getByText("Bu tutar sana borçlu")).toBeVisible();

    // Duzenleme formu dagilimi geri getiriyor: ana odeyen (member) ilk
    // satirda kalan olarak, owner'in 30'u ikinci satirda.
    await owner.getByRole("link", { name: "Düzenle" }).first().click();
    // Tam sayi tutar alana kurussuz yaziliyor (formatMoneyForInput).
    await expect(owner.getByLabel("testuser1 ödediği tutar")).toHaveValue("30");
    await expect(owner.locator('[data-slot="payer-rest"]')).toHaveText("70,00 ₺");

    // --- Eski govde: magazadaki 1.0.7'nin gonderdigi sekil ---
    const list = await owner.request.get(`/api/v1/groups/${groupId}/expenses`);
    const { expenses } = (await list.json()) as {
      expenses: {
        id: string;
        description: string;
        paidById: string;
        version: number;
        payers: { userId: string; amount: number }[];
        participants: { userId: string }[];
      }[];
    };
    const expense = expenses.find((item) => item.description === "Iki odeyenli yemek");
    expect(expense).toBeTruthy();
    expect(expense!.payers.map((payer) => payer.amount).sort((a, b) => a - b)).toEqual([
      3000, 7000,
    ]);

    const legacy = await owner.request.put(`/api/v1/groups/${groupId}/expenses/${expense!.id}`, {
      data: {
        splitType: "EQUAL",
        description: "Iki odeyenli yemek",
        amount: 10000,
        paidById: expense!.paidById,
        participantUserIds: expense!.participants.map((participant) => participant.userId),
        version: expense!.version,
      },
    });
    expect(legacy.status()).toBe(409);
    expect(await legacy.json()).toMatchObject({ ok: false, code: "expense.multiple_payers" });

    // Ve hicbir sey degismedi: bakiye ayni.
    await openGroup(owner, groupName);
    await expect(owner.getByText("Bu tutarı borçlusun")).toBeVisible();
    await expect(owner.getByText("20,00 ₺").first()).toBeVisible();
  });
});
