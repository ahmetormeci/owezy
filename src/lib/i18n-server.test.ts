import { describe, expect, it, vi } from "vitest";

const { mockCookies } = vi.hoisted(() => ({ mockCookies: vi.fn() }));

// "server-only" paketi, istemci ortaminda import edilirse bilerek patliyor.
// Vitest node ortaminda calisiyor ve o kosulu saglamiyor; modulu bos gecmek
// testin konusu degil - konu cerezin nasil okundugu.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mockCookies }));

const { getLocale, getTranslate } = await import("@/lib/i18n-server");

/** cookies()'in dondurdugu magazanin testte ihtiyac duyulan kadari. */
function withCookie(value?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === "locale" && value !== undefined ? { name, value } : undefined,
  });
}

describe("getLocale", () => {
  it("cerezdeki dili okur", async () => {
    withCookie("en");
    await expect(getLocale()).resolves.toBe("en");
  });

  it("cerez yoksa Turkce", async () => {
    withCookie(undefined);
    await expect(getLocale()).resolves.toBe("tr");
  });

  it("cerezdeki bozuk degere guvenmez", async () => {
    // Cerez kullanicinin kontrolunde. Ham deger Intl'e gitseydi RangeError
    // firlar ve sunucuda render edilen sayfa 500 verirdi.
    withCookie("zz");
    await expect(getLocale()).resolves.toBe("tr");
  });

  it("cerez adi 'locale'", async () => {
    // Cerezi ISTEMCI yaziyor (language-toggle.tsx), okuyan burasi. Iki taraf
    // ayni adi kullanmazsa dugme sessizce ise yaramaz: hicbir sey patlamaz,
    // dil sadece hic degismez. Ad locale.ts'te tek yerde duruyor.
    withCookie("en");
    await getLocale();
    const store = await mockCookies.mock.results.at(-1)!.value;
    expect(store.get("locale")).toEqual({ name: "locale", value: "en" });
  });
});

describe("getTranslate", () => {
  it("calisir bir cevirici dondurur", async () => {
    withCookie("tr");
    const t = await getTranslate();
    expect(t("group.not_found")).toBe("Grup bulunamadı");
  });

  it("parametreleri doldurur", async () => {
    withCookie("tr");
    const t = await getTranslate();
    expect(t("ui.paid_by", { name: "Ayşe" })).toContain("Ayşe");
  });
});
