import { describe, expect, it } from "vitest";
import { readChallengeCookie } from "./two-factor-cookie";

/**
 * BU DOSYA NEYI KORUYOR: giris ikinci adima dustugunde, sunucunun verdigi
 * meydan okumanin dogru okunmasini.
 *
 * Yanlis okumanin belirtisi SESSIZ ve yaniltici. Kullanici parolasini dogru
 * girer, kod ekranini gorur, dogru kodu yazar - ve kod her seferinde
 * reddedilir. Ekranda "kodunuz yanlis" yazar; oysa yanlis olan kod degil, o
 * koda eslik eden cerezdir.
 *
 * Buradaki girdiler UYDURULMADI: sunucudan gelen gercek bir yanitin sekli.
 * Yanit UC Set-Cookie satiri tasiyor ve React Native bunlari TEK bir baslikta
 * ", " ile birlestirip veriyor.
 */

const NAME = "better-auth.two_factor";

describe("readChallengeCookie", () => {
  it("tek satirlik yanittan cerezi cikarir", () => {
    const header = `${NAME}=abc123.imza; Max-Age=600; Path=/; HttpOnly; SameSite=Lax`;

    // Donen deger "ad=deger" ciftinin TAMAMI - dogrudan Cookie basligina
    // konuyor, yani adiyla birlikte lazim.
    expect(readChallengeCookie(header)).toBe(`${NAME}=abc123.imza`);
  });

  it("RN'in BIRLESTIRDIGI uc satirdan yalnizca meydan okumayi alir", () => {
    /**
     * Gercek yanitin sekli: iki satir oturum cerezlerini SILIYOR (eklenti
     * once bir oturum yaratip sonra iptal ediyor), ucuncusu meydan okuma.
     *
     * "Gelen Set-Cookie'yi oldugu gibi geri gonder" demis olsaydik, silme
     * satirlarini da geri gondermis olurduk.
     */
    const header = [
      "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
      "better-auth.session_data=; Max-Age=0; Path=/; HttpOnly",
      `${NAME}=xyz789.imza; Max-Age=600; Path=/; HttpOnly; SameSite=Lax`,
    ].join(", ");

    expect(readChallengeCookie(header)).toBe(`${NAME}=xyz789.imza`);
  });

  it("imzada nokta ve yuzde isareti varsa DEGERI BOLMEZ", () => {
    // Deger imzali; icinde URL kodlamasi (%3D) ve nokta olabiliyor. Ayirici
    // olarak ";" secilmesinin sebebi tam olarak bu - degerin icinde ";"
    // olamiyor ama digerleri olabiliyor.
    const header = `${NAME}=a.b%3Dc.d%2Fe; Max-Age=600; Path=/`;

    expect(readChallengeCookie(header)).toBe(`${NAME}=a.b%3Dc.d%2Fe`);
  });

  it("SILME satirini meydan okuma sanmaz", () => {
    // Max-Age=0 ve BOS deger: sunucu cerezi siliyor. Bunu meydan okuma
    // sayarsak, ikinci adima bos bir cerezle gider ve kod hep reddedilirdi.
    const header = `${NAME}=; Max-Age=0; Path=/; HttpOnly`;

    expect(readChallengeCookie(header)).toBeNull();
  });

  it("meydan okuma yoksa null doner", () => {
    // 2FA kapali bir hesapta normal giris: yanit yalnizca oturum cerezi tasir.
    const header = "better-auth.session_token=oturum.imza; Max-Age=604800; Path=/";

    expect(readChallengeCookie(header)).toBeNull();
  });

  it("baslik hic yoksa null doner", () => {
    // fetch, baslik yoksa null donduruyor. Burada patlamak, giris akisini
    // anlamsiz bir cokmeyle bitirirdi.
    expect(readChallengeCookie(null)).toBeNull();
    expect(readChallengeCookie("")).toBeNull();
  });

  it("noktali virgulsuz biten satirda degerin SONUNA kadar gider", () => {
    // Ozniteliksiz Set-Cookie da gecerli. slice'in ikinci sinir durumu.
    expect(readChallengeCookie(`${NAME}=sondeger`)).toBe(`${NAME}=sondeger`);
  });
});
