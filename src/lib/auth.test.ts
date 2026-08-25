import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockPrisma } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

// Better Auth ornegi TAKLIT EDILIYOR, gercegi yuklenmiyor: o modul Resend'i
// ve Prisma adaptorunu de getiriyor, yani bir birim testi icin butun kimlik
// yiginini ayaga kaldirmak gerekirdi.
vi.mock("@/lib/better-auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

// findCurrentUser istegin basliklarini okuyor (cerez ya da Bearer).
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: mockPrisma.user },
}));

const { findCurrentUser } = await import("@/lib/auth");

beforeEach(() => {
  mockGetSession.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.create.mockReset();
});

/**
 * BU DOSYA 25.7'DE KUCULDU: on iki testten uce indi ve bu bir kayip degil,
 * silinen KODUN olcusu. Giden testlerin tamami Clerk'in "lazy sync"
 * yolunu koruyordu - birincil e-postanin secilmesi, ad soyad yoksa
 * e-postaya dusulmesi, P2002'nin yaris sinyali olarak ele alinmasi,
 * clerkId ile e-posta cakismasinin birbirinden ayrilmasi. Hicbiri artik
 * mumkun degil cunku "oturum var ama satir yok" durumu olusamiyor: Better
 * Auth satiri kendisi yaziyor ve yazdigi tablo bizim User tablomuz.
 *
 * Geriye kalan uc test, kalan uc davranisin tamami.
 */
describe("findCurrentUser", () => {
  it("oturum yoksa null doner ve veritabanina dokunmaz", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(findCurrentUser()).resolves.toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("oturum varsa kaydi id ILE ceker", async () => {
    const user = { id: "db-42", email: "ahmet@example.com" };
    mockGetSession.mockResolvedValue({ user: { id: "db-42" } });
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await expect(findCurrentUser()).resolves.toBe(user);

    // ESAS IDDIA BU: arama id ile yapilmali. Faz 25 oncesinde burada bir
    // esleme sutunu vardi (clerkId) ve gocun amaci onu ortadan kaldirmakti
    // (ADR-007). session.user.id dogrudan bizim User.id'miz.
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "db-42" } });
  });

  it("oturum var ama satir yoksa KAYIT OLUSTURMAZ", async () => {
    // Bu durum normalde olusamaz; yine de olusursa sessizce bir kullanici
    // uretmek yanlis olurdu - cagiran taraf "oturum yok" cevabini almali.
    mockGetSession.mockResolvedValue({ user: { id: "db-yok" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(findCurrentUser()).resolves.toBeNull();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
