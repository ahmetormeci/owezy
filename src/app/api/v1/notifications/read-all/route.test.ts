import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetOrCreateCurrentUser, mockMarkAllRead, mockEnforceWriteLimit } = vi.hoisted(() => ({
  mockEnforceWriteLimit: vi.fn(),
  mockGetOrCreateCurrentUser: vi.fn(),
  mockMarkAllRead: vi.fn(),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  enforceWriteLimit: mockEnforceWriteLimit,
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/notifications", () => ({
  markAllNotificationsRead: mockMarkAllRead,
}));

const { POST } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  // Hiz siniri bu testlerin konusu DEGIL: varsayilan "asilmadi".
  // Sinirin kendisi kendi olcumuyle dogrulandi (bkz. lib/api-rate-limit.ts).
  mockEnforceWriteLimit.mockReset();
  mockEnforceWriteLimit.mockResolvedValue(null);
  mockGetOrCreateCurrentUser.mockReset();
  mockMarkAllRead.mockReset();

  mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
  mockMarkAllRead.mockResolvedValue(3);
});

describe("POST /api/v1/notifications/read-all", () => {
  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mockMarkAllRead).not.toHaveBeenCalled();
  });

  it("yalnizca oturumdaki kullanicinin bildirimlerini isaretler", async () => {
    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, updated: 3 });
    expect(mockMarkAllRead).toHaveBeenCalledWith(USER_ID);
  });

  it("okunmamis bildirim yoksa da 200 doner", async () => {
    mockMarkAllRead.mockResolvedValue(0);

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.updated).toBe(0);
  });
});
