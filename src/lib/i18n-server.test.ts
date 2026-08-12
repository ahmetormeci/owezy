import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockFindCurrentUser, mockGetOrCreateCurrentUser } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockFindCurrentUser: vi.fn(),
  mockGetOrCreateCurrentUser: vi.fn(),
}));

// "server-only" paketi, istemci ortaminda import edilirse bilerek patliyor.
// Vitest node ortaminda calisiyor ve o kosulu saglamiyor; modulu bos gecmek
// testin konusu degil - konu dilin nasil cozuldugu.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mockCookies }));
// auth.ts prisma'yi cekiyor; veritabani bu testin konusu degil.
vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockFindCurrentUser,
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

const { getLocale, getTranslate } = await import("@/lib/i18n-server");

/** cookies()'in dondurdugu magazanin testte ihtiyac duyulan kadari. */
function withCookie(value?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === "locale" && value !== undefined ? { name, value } : undefined,
  });
}

/** Oturumdaki kullanicinin kaydi; null = giris yapilmamis. */
function withAccount(locale: string | null, signedIn = true) {
  mockFindCurrentUser.mockResolvedValue(signedIn ? { id: "u1", locale } : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  withAccount(null, false);
});

describe("getLocale - cerez", () => {
  it("cerezdeki dili okur", async () => {
    withCookie("en");
    await expect(getLocale()).resolves.toBe("en");
  });

  it("cerez varsa hesaba HIC bakmaz", async () => {
    // Cerez "bu cihazda, su an" cevabidir. Hesap once gelseydi, kullanicinin
    // bu cihazda yaptigi secim her sayfa yenilemesinde geri alinirdi.
    withCookie("tr");
    withAccount("en");

    await expect(getLocale()).resolves.toBe("tr");
    expect(mockFindCurrentUser).not.toHaveBeenCalled();
  });

  it("cerezdeki bozuk degere guvenmez", async () => {
    // Ham deger Intl'e gitseydi RangeError firlatir ve sunucuda render
    // edilen sayfa 500 verirdi.
    withCookie("zz");
    await expect(getLocale()).resolves.toBe("tr");
  });
});

describe("getLocale - hesap tercihi", () => {
  it("cerez yoksa hesaptaki dile duser", async () => {
    withCookie(undefined);
    withAccount("en");
    await expect(getLocale()).resolves.toBe("en");
  });

  it("hesapta tercih yoksa varsayilana duser", async () => {
    // locale kolonu nullable: "hic secmedi" gecerli bir durum.
    withCookie(undefined);
    withAccount(null);
    await expect(getLocale()).resolves.toBe("tr");
  });

  it("hesaptaki bozuk degere de guvenmez", async () => {
    // Kolon String; veritabanina elle bir sey yazilmis olabilir.
    withCookie(undefined);
    withAccount("klingon");
    await expect(getLocale()).resolves.toBe("tr");
  });

  it("giris yapilmamissa varsayilan", async () => {
    withCookie(undefined);
    withAccount(null, false);
    await expect(getLocale()).resolves.toBe("tr");
  });

  // BU TESTIN SEBEBI: getOrCreateCurrentUser() kayit OLUSTURUYOR. getLocale
  // kok layout'ta, yani her istekte calisiyor - o fonksiyonu cagirsaydi
  // karsilama sayfasinin render'i kullanici satiri uretirdi.
  it("kullanici kaydi OLUSTURMAZ", async () => {
    withCookie(undefined);
    withAccount("en");

    await getLocale();

    expect(mockGetOrCreateCurrentUser).not.toHaveBeenCalled();
  });
});

describe("getTranslate", () => {
  it("calisir bir cevirici dondurur", async () => {
    withCookie("tr");
    const t = await getTranslate();
    expect(t("group.not_found")).toBe("Grup bulunamadı");
  });

  it("dil Ingilizceyse Ingilizce metin dondurur", async () => {
    withCookie("en");
    const t = await getTranslate();
    expect(t("group.not_found")).toBe("Group not found");
  });

  it("hesaptan gelen dil de cevirmene yansir", async () => {
    withCookie(undefined);
    withAccount("en");
    const t = await getTranslate();
    expect(t("group.not_found")).toBe("Group not found");
  });

  it("parametreleri doldurur", async () => {
    withCookie("tr");
    const t = await getTranslate();
    expect(t("ui.paid_by", { name: "Ayşe" })).toContain("Ayşe");
  });
});
