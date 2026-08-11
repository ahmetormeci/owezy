import { test as base, expect, type BrowserContext } from "@playwright/test";

// pageAs her cagrisinda yeni bir tarayici context'i (ayri profil) acar.
// Bunlari kapatmazsak worker bitene kadar acik kalirlar: bellek sisirir,
// dev sunucusuna bos yere baglanti tutarlar ve hata ciktisinda Playwright'in
// "hangi sayfa patladi" bilgisini karistirirlar - nitekim ilk kosuda hatali
// testin ekran goruntusu bambaska bir testin sayfasini gosterdi.
const openContexts: BrowserContext[] = [];

export function trackContext(context: BrowserContext) {
  openContexts.push(context);
}

/**
 * Projedeki testler bu `test`i kullanmali: her testten sonra o test sirasinda
 * acilan butun context'leri otomatik kapatir.
 */
export const test = base.extend<{ closeTrackedContexts: void }>({
  closeTrackedContexts: [
    async ({}, use) => {
      await use();
      await Promise.all(openContexts.splice(0).map((context) => context.close()));
    },
    { auto: true },
  ],
});

export { expect };
