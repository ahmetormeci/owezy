import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __failNextCall,
  __peek,
  __reset,
  __seed,
} from "../test/expo-secure-store.mock";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session-store";

/**
 * BU DOSYA NEYI KORUYOR: Keychain PATLADIGINDA uygulamanin ne yaptigini.
 *
 * Uc fonksiyonun da govdesi try/catch ve ucu de hatayi YUTUYOR. Bu, ilk
 * bakista "hatalari gizleme" gibi gorunen ama bilincli alinmis bir karar -
 * sebepleri session-store.ts'in icinde yazili. Boyle bir karar tam olarak
 * testle sabitlenmesi gereken seydir: sonradan gelen biri "hata yutulmamali"
 * diye dusunup throw eklerse, kirilan sey KULLANICININ GIRIS AKISI olur ve
 * bunu ancak Keychain'in patladigi bir cihazda fark ederiz.
 *
 * expo-secure-store NATIVE bir modul; test/expo-secure-store.mock.ts ile
 * degistiriliyor (vitest.config.mts'teki takma ad).
 */

const KEY = "owezy.session-token";

beforeEach(() => {
  __reset();
  // Yutulan hata konsola dusuyor; testte gurultu yapmasin ama cagrildigini
  // dogrulayabilelim.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("normal calisma", () => {
  it("yazilan belirteci okur", async () => {
    await writeSessionToken("tok-123");

    expect(await readSessionToken()).toBe("tok-123");
  });

  it("belirtec yoksa null doner", async () => {
    expect(await readSessionToken()).toBeNull();
  });

  it("silinen belirtec bir daha okunmaz", async () => {
    await writeSessionToken("tok-123");
    await clearSessionToken();

    expect(await readSessionToken()).toBeNull();
  });

  it("HEP AYNI ANAHTARI kullanir", async () => {
    /**
     * Anahtar degisirse kimse hata almaz - herkes sessizce CIKIS YAPMIS olur,
     * cunku eski anahtardaki belirtec artik aranmaz. Belirtisi "kullanicilar
     * bir guncellemeden sonra yeniden giris yapmak zorunda kaldi" seklinde,
     * yani sebebi bulunmasi zor. O yuzden anahtar burada sabitleniyor.
     */
    await writeSessionToken("tok-123");

    expect(__peek(KEY)).toBe("tok-123");
  });
});

describe("Keychain patladiginda", () => {
  it("OKUMA firlatmaz, null doner", async () => {
    __seed(KEY, "tok-123");
    __failNextCall();

    // "Oturum yok" saymak guvenli tarafta kalmak: kullanici yeniden giris
    // yapar. Firlatsaydi uygulama acilista cokerdi.
    await expect(readSessionToken()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("YAZMA firlatmaz - girisi yarida kesmez", async () => {
    __failNextCall();

    /**
     * Firlatsaydi: kullanici dogru parolayi girmis, sunucu belirteci vermis,
     * ve uygulama "bir seyler ters gitti" diyerek onu disarida birakmis olurdu.
     * Sonucu bunun yerine su: oturum BU acilista calisir, uygulama kapaninca
     * gider. Kotu ama sessiz bir kilitlenmeden iyi.
     */
    await expect(writeSessionToken("tok-123")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("SILME firlatmaz - cikisi yarida kesmez", async () => {
    __seed(KEY, "tok-123");
    __failNextCall();

    // Firlatsaydi kullanici cikis dugmesine basar, hicbir sey soylenmez ve
    // ICERIDE kalirdi.
    await expect(clearSessionToken()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("hatayi YUTMUYOR - loga birakiyor", async () => {
    __failNextCall("Keychain kilitli");

    await readSessionToken();

    // Sessizce yutmak ile loga birakmak arasindaki fark, bir hatayi
    // arastirabilmek ile arastiramamak arasindaki fark.
    expect(console.error).toHaveBeenCalledWith(
      "Oturum belirteci okunamadı",
      expect.objectContaining({ message: "Keychain kilitli" }),
    );
  });
});
