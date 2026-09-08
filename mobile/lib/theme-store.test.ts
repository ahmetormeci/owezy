import { beforeEach, describe, expect, it, vi } from "vitest";
import { __reset, __seed } from "../test/expo-secure-store.mock";
import { readStoredTheme, writeStoredTheme } from "./theme-store";

/**
 * BU DOSYA NEYI KORUYOR: cihazda duran metnin KORU KORUNE kullanilmamasini.
 *
 * Saklanan deger bozulmus, elle kurcalanmis ya da eski bir surumden kalmis
 * olabilir. Dogrulanmadan kullanilsaydi gecersiz bir deger "acik da degil
 * koyu da degil" bir duruma dusurur ve uygulama beklenmedik bir tema ile
 * cizilirdi. Ayni koruma dil tarafinda da var (locale-store.ts).
 */

beforeEach(() => {
  __reset();
  vi.restoreAllMocks();
});

describe("okuma", () => {
  it("gecerli tercihi oldugu gibi donuyor", async () => {
    __seed("owezy.theme", "dark");
    await expect(readStoredTheme()).resolves.toBe("dark");
  });

  it("hic yazilmamissa null - sistem ayari devreye girsin", async () => {
    await expect(readStoredTheme()).resolves.toBeNull();
  });

  it("BEYAZ LISTEDE OLMAYAN deger null sayiliyor", async () => {
    // "sepia" gibi bir deger uygulamada karsiligi olmayan bir temaya isaret
    // eder; olani sanip kullanmak, tanimsiz renklerle cizmek olurdu.
    __seed("owezy.theme", "sepia");
    await expect(readStoredTheme()).resolves.toBeNull();
  });

  it("bos metin de null", async () => {
    __seed("owezy.theme", "");
    await expect(readStoredTheme()).resolves.toBeNull();
  });

  it("DEPO PATLARSA null doner, firlatmaz", async () => {
    // Keychain erisilemiyor olabilir. Tercih okunamadi diye uygulamanin
    // acilmamasi kabul edilemez - tema bir tercih, on kosul degil.
    const store = await import("expo-secure-store");
    vi.spyOn(store, "getItemAsync").mockRejectedValue(new Error("keychain"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(readStoredTheme()).resolves.toBeNull();
  });
});

describe("yazma", () => {
  it("tercihi sakliyor", async () => {
    await writeStoredTheme("light");
    await expect(readStoredTheme()).resolves.toBe("light");
  });

  it("DEPO PATLARSA firlatmiyor - tercih bu oturumda yine gecerli", async () => {
    const store = await import("expo-secure-store");
    vi.spyOn(store, "setItemAsync").mockRejectedValue(new Error("keychain"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(writeStoredTheme("dark")).resolves.toBeUndefined();
  });
});
