import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetOrCreateCurrentUser,
  mockUserUpdate,
  mockEnforceWriteLimit,
  mockAccountFindFirst,
} = vi.hoisted(() => ({
  mockEnforceWriteLimit: vi.fn(),
  mockGetOrCreateCurrentUser: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockAccountFindFirst: vi.fn(),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  enforceWriteLimit: mockEnforceWriteLimit,
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mockUserUpdate },
    account: { findFirst: mockAccountFindFirst },
  },
}));

const { GET, PATCH } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // Hiz siniri bu testlerin konusu DEGIL: varsayilan "asilmadi".
  // Sinirin kendisi kendi olcumuyle dogrulandi (bkz. lib/api-rate-limit.ts).
  mockEnforceWriteLimit.mockReset();
  mockEnforceWriteLimit.mockResolvedValue(null);
  mockGetOrCreateCurrentUser.mockReset();
  mockUserUpdate.mockReset();
  mockAccountFindFirst.mockReset();
  mockAccountFindFirst.mockResolvedValue(null);

  mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
  mockUserUpdate.mockImplementation(async ({ data }: { data: { locale: string } }) => ({
    id: USER_ID,
    locale: data.locale,
  }));
});

describe("PATCH /api/v1/me", () => {
  it("giris yapilmamissa 401 doner ve veritabanina yazmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ locale: "en" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "auth.not_signed_in" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("dil tercihini kaydeder", async () => {
    const response = await PATCH(patchRequest({ locale: "en" }));

    expect(response.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { locale: "en" },
    });
  });

  it("yalnizca OTURUMDAKI kullaniciyi gunceller", async () => {
    // Govdeden gelen bir userId'ye ITIBAR EDILMEMELI; kimin guncellendigi
    // yalnizca oturumdan belirlenir.
    await PATCH(patchRequest({ locale: "en", userId: "baskasi" }));

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { locale: "en" },
    });
  });

  it("desteklenmeyen dili reddeder", async () => {
    const response = await PATCH(patchRequest({ locale: "klingon" }));

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("locale alani yoksa reddeder", async () => {
    const response = await PATCH(patchRequest({}));

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("hata METNI degil KOD doner", async () => {
    // API sozlesmesi: metni okuyan taraf uretiyor (ADR-017).
    const response = await PATCH(patchRequest({ locale: "klingon" }));
    const json = await response.json();

    expect(json.ok).toBe(false);
    expect(typeof json.code).toBe("string");
    expect(json.code).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
});

/**
 * GET'in hasPassword alani ARAYUZ ICIN KRITIK, o yuzden testi var.
 *
 * Guvenlik ekrani buna bakip "2FA'yi ac" dugmesini gosteriyor ya da yerine
 * "once parola belirle" diyor. Yanlis hesaplanirsa iki yonde de kotu:
 * parolasiz kullanici basip INVALID_PASSWORD aliyor ("dugme calismiyor"),
 * ya da parolasi olan kullanici hic acamiyor.
 */
describe("GET /api/v1/me", () => {
  it("giris yapilmamissa 401 doner ve hesap tablosuna hic bakmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "auth.not_signed_in" });
    expect(mockAccountFindFirst).not.toHaveBeenCalled();
  });

  it("parolali hesapta hasPassword true doner", async () => {
    mockAccountFindFirst.mockResolvedValue({ id: "hesap-1" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, hasPassword: true });
  });

  it("parolasiz hesapta hasPassword false doner", async () => {
    mockAccountFindFirst.mockResolvedValue(null);

    expect(await (await GET()).json()).toMatchObject({ hasPassword: false });
  });

  it("yalnizca OTURUMDAKI kullanicinin parolali hesabini arar", async () => {
    // Uc kosulun ucu de onemli: baskasinin satiri sayilmamali, sosyal
    // saglayici hesabi parola sayilmamali, ve parolasi NULL olan bir
    // credential satiri da parola sayilmamali.
    await GET();

    expect(mockAccountFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, providerId: "credential", password: { not: null } },
      select: { id: true },
    });
  });

  it("hesap satirini DEGIL, yalnizca 'var mi' bilgisini doner", async () => {
    // Yanitin ALANLARI sayiliyor, icerigi degil: boylece ileride biri
    // findFirst'un sonucunu dogrudan yanita eklerse (icinde parola hash'i
    // olabilecek bir nesne) bu test duser.
    mockAccountFindFirst.mockResolvedValue({ id: "hesap-1" });

    const json = await (await GET()).json();

    expect(Object.keys(json).sort()).toEqual(["hasPassword", "ok", "user"]);
    expect(json.hasPassword).toBe(true);
  });
});
