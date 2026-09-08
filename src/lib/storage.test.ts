import { describe, expect, it } from "vitest";
import { storageHost } from "@/lib/storage";

/**
 * BU DOSYA NEYI KORUYOR: yapilandirma degerinin BIRDEN COK BICIMDE
 * gelebilecegini.
 *
 * Cloudflare paneli hesap kimligini bir ADRESIN icinde gosteriyor, yani
 * "yalnizca kimligi al" beklentisi kullanicidan fazladan bir adim istiyor.
 * Ilk kurulumda deger "https://<kimlik>" olarak yapistirildi ve istek
 * "https://https://..." adresine gidip ENOTFOUND ile dustu - hatanin
 * metninde sebep YOKTU.
 */
describe("storageHost", () => {
  const ID = "0123456789abcdef0123456789abcdef";

  it("ciplak hesap kimligine varsayilan alan adini ekliyor", () => {
    expect(storageHost(ID)).toBe(`${ID}.r2.cloudflarestorage.com`);
  });

  it('"https://<kimlik>" bicimini de kabul ediyor', () => {
    // Ilk kurulumda gerceklesen hata tam olarak buydu.
    expect(storageHost(`https://${ID}`)).toBe(`${ID}.r2.cloudflarestorage.com`);
  });

  it("TAM ADRES yapistirilmissa OLDUGU GIBI kullaniyor", () => {
    expect(storageHost(`https://${ID}.r2.cloudflarestorage.com`)).toBe(
      `${ID}.r2.cloudflarestorage.com`,
    );
  });

  it("YARGI BOLGESI adresini BOZMUYOR", () => {
    // ASIL TEST BU. Kimligi ayiklayip varsayilan alan adini ekleseydik, AB
    // kovasi olan birinin istekleri SESSIZCE yanlis yere giderdi.
    expect(storageHost(`https://${ID}.eu.r2.cloudflarestorage.com`)).toBe(
      `${ID}.eu.r2.cloudflarestorage.com`,
    );
  });

  it("sondaki egik cizgiyi ve yolu atiyor", () => {
    expect(storageHost(`https://${ID}.r2.cloudflarestorage.com/owezy-receipts`)).toBe(
      `${ID}.r2.cloudflarestorage.com`,
    );
  });

  it("bosluklara takilmiyor", () => {
    expect(storageHost(`  ${ID}  `)).toBe(`${ID}.r2.cloudflarestorage.com`);
  });
});
