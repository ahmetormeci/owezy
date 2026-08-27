import { describe, expect, it } from "vitest";
import { canRenderAvatar } from "./person-avatar";

/**
 * BU TESTIN VARLIK SEBEBI KULLANICI TARAFINDAN BULUNAN BIR HATA.
 *
 * Uye listesinde bir kullanicinin yerinde KIRIK BIR GORSEL KUTUSU duruyordu.
 * Sebep iki katliydi: adres Clerk'in sokulmus CDN'ini gosteriyordu, ve
 * sokulmasaydi bile CSP gecirmezdi - img-src yalnizca 'self', data: ve blob:
 * kabul ediyor (next.config.ts).
 *
 * Kural tersine dondugu an - yani biri "https://..." adreslere de izin
 * verdigini sanip burayi gevsettiginde - kullanicinin gordugu sey yine kirik
 * bir kutu olur. O yuzden kural testle sabitleniyor.
 *
 * CSP DEGISIRSE BU TEST DE DEGISMELI, ve bu bilincli: ikisi ayni karari
 * anlatiyor, birlikte hareket etmeleri gerekiyor.
 */
describe("canRenderAvatar", () => {
  it("ayni kokenden gelen goreli adresi kabul eder", () => {
    expect(canRenderAvatar("/uploads/abc.webp")).toBe(true);
  });

  it("gomulu veriyi kabul eder", () => {
    expect(canRenderAvatar("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(canRenderAvatar("blob:http://localhost/9f2a")).toBe(true);
  });

  it("UZAK adresi reddeder - CSP zaten gecirmiyor", () => {
    // Gercek ornek: Clerk'in eski satirlarda biraktigi adres.
    expect(canRenderAvatar("https://img.clerk.com/eyJ0eXBlIjoi")).toBe(false);
    expect(canRenderAvatar("http://example.com/a.png")).toBe(false);
    expect(canRenderAvatar("//example.com/a.png")).toBe(false);
  });

  it("bos ya da anlamsiz degeri reddeder", () => {
    expect(canRenderAvatar("")).toBe(false);
    expect(canRenderAvatar("abc.png")).toBe(false);
  });
});
