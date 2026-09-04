import { describe, expect, it } from "vitest";
import { bridgedCookieHeader } from "./two-factor-cookie-bridge";

/**
 * BU DOSYA NEYI KORUYOR: magazadaki mobil 1.0'in ikinci adimi
 * tamamlayabilmesini.
 *
 * Buradaki adlar UYDURULMADI - Better Auth'un kendi createCookieGetter'ina
 * bizim yapilandirmamizla soruldu:
 *     http://localhost:3000  ->  better-auth.two_factor
 *     https://owezy.net      ->  __Secure-better-auth.two_factor
 */
const YENI = "__Secure-better-auth.two_factor";
const ESKI = "better-auth.two_factor";
const IMZA = "deger.imza%3D";

describe("bridgedCookieHeader", () => {
  it("eski adli cerezi yeni adla da yazar", () => {
    const header = `${ESKI}=${IMZA}`;

    expect(bridgedCookieHeader(header, YENI)).toBe(`${ESKI}=${IMZA}; ${YENI}=${IMZA}`);
  });

  it("ONEK YOKSA HIC DOKUNMAZ - gelistirme ve E2E bu daldan geciyor", () => {
    // Sunucu oneksiz adi bekliyorsa istemci zaten dogrusunu gonderiyor.
    // Kopru burada devreye girmemeli, yoksa hicbir ise yaramayan bir
    // kopyalama yapardik.
    expect(bridgedCookieHeader(`${ESKI}=${IMZA}`, ESKI)).toBeNull();
  });

  it("dogru adli cerez zaten geldiyse dokunmaz", () => {
    // Web istemcisi ve duzeltilmis mobil surumler. Basligi buyutmenin
    // anlami yok.
    expect(bridgedCookieHeader(`${YENI}=${IMZA}`, YENI)).toBeNull();
  });

  it("IKISI DE VARSA dogru olani korur, ikinci kez eklemez", () => {
    const header = `${ESKI}=eski; ${YENI}=dogru`;

    expect(bridgedCookieHeader(header, YENI)).toBeNull();
  });

  it("BASKA CEREZLERIN ARASINDAN dogru olani secer", () => {
    const header = `theme=dark; ${ESKI}=${IMZA}; locale=tr`;

    expect(bridgedCookieHeader(header, YENI)).toBe(
      `theme=dark; ${ESKI}=${IMZA}; locale=tr; ${YENI}=${IMZA}`,
    );
  });

  it("ADI TAM ESLESTIRIR - duzeltmeye calistigimiz hatanin kendisi", () => {
    /**
     * Bu testin varlik sebebi: koprunun kendisi ayni tuzaga dusebilirdi.
     *
     * indexOf ile arasaydik, ASAGIDAKI baslikta "better-auth.two_factor"
     * dizisi onekli adin ICINDE bulunurdu ve kopru "eski cerez var" sanip
     * onekli cerezi kendisinden turetirdi. Oysa burada eski adli bir cerez
     * YOK - yalnizca yeni adli var.
     */
    expect(bridgedCookieHeader(`${YENI}=${IMZA}`, YENI)).toBeNull();

    // Ters yon: adin SONUNA eklenmis bir sey de eslesmemeli.
    expect(bridgedCookieHeader(`${ESKI}_baska=${IMZA}`, YENI)).toBeNull();
  });

  it("BOS DEGERLI cerezi meydan okuma saymaz", () => {
    // Max-Age=0 ile silinmis cerez. Bunu koprulersek ikinci adima bos bir
    // cerezle gidilir ve kod yine reddedilirdi - yani hata AYNI kalir ama
    // sebebi daha da gizlenirdi.
    expect(bridgedCookieHeader(`${ESKI}=`, YENI)).toBeNull();
  });

  it("baslik yoksa null doner", () => {
    expect(bridgedCookieHeader(null, YENI)).toBeNull();
    expect(bridgedCookieHeader("", YENI)).toBeNull();
  });

  /**
   * ZINCIRIN TAMAMI - koprunun gercekten neyi kurtardigi.
   *
   * Asagidaki ayristirici, MAGAZADAKI 1.0'in tasidigi kodun birebir kopyasi
   * (mobile/lib/two-factor-cookie.ts, surum 1.0). BURADA DUZELTILMEYECEK:
   * o kopya artik kullanicilarin telefonunda ve degistirilemez. Kopru tam
   * olarak bu davranisi karsilamak icin var.
   */
  it("MAGAZADAKI 1.0'in gonderdigi basligi sunucunun aradigi hale getirir", () => {
    const uretimYaniti =
      `__Secure-better-auth.session_token=; Max-Age=0; Path=/; Secure, ` +
      `${YENI}=${IMZA}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`;

    // 1.0'in ayristiricisi: metin aramasi, tam eslesme degil.
    const start = uretimYaniti.indexOf(`${ESKI}=`);
    const end = uretimYaniti.indexOf(";", start);
    const mobilinOkudugu = uretimYaniti.slice(start, end);

    // Onek dusuyor - hatanin kendisi.
    expect(mobilinOkudugu).toBe(`${ESKI}=${IMZA}`);
    expect(mobilinOkudugu.startsWith("__Secure-")).toBe(false);

    // Mobil bunu Cookie basligi olarak geri gonderiyor; sunucu YENI adi
    // ariyor ve koprusuz bulamiyor.
    const koprulenmis = bridgedCookieHeader(mobilinOkudugu, YENI);

    expect(koprulenmis).not.toBeNull();
    expect(koprulenmis).toContain(`${YENI}=${IMZA}`);
  });

  it("bosluksuz ayrilmis basligi da okur", () => {
    // "a=1;b=2" da gecerli bir Cookie basligi.
    expect(bridgedCookieHeader(`theme=dark;${ESKI}=${IMZA}`, YENI)).toBe(
      `theme=dark;${ESKI}=${IMZA}; ${YENI}=${IMZA}`,
    );
  });
});
