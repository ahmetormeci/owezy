import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetOrCreateCurrentUser, mockUserUpdate } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: mockUserUpdate } },
}));

const { PATCH } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetOrCreateCurrentUser.mockReset();
  mockUserUpdate.mockReset();

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
