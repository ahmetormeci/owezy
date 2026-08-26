import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetOrCreateCurrentUser, mockMarkRead, mockEnforceWriteLimit } = vi.hoisted(() => ({
  mockEnforceWriteLimit: vi.fn(),
  mockGetOrCreateCurrentUser: vi.fn(),
  mockMarkRead: vi.fn(),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  enforceWriteLimit: mockEnforceWriteLimit,
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/notifications", () => ({
  markNotificationRead: mockMarkRead,
}));

const { POST } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";

function callRoute() {
  return POST(new Request("http://localhost", { method: "POST" }), {
    params: Promise.resolve({ notificationId: NOTIFICATION_ID }),
  });
}

beforeEach(() => {
  // Hiz siniri bu testlerin konusu DEGIL: varsayilan "asilmadi".
  // Sinirin kendisi kendi olcumuyle dogrulandi (bkz. lib/api-rate-limit.ts).
  mockEnforceWriteLimit.mockReset();
  mockEnforceWriteLimit.mockResolvedValue(null);
  mockGetOrCreateCurrentUser.mockReset();
  mockMarkRead.mockReset();

  mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
  mockMarkRead.mockResolvedValue(1);
});

describe("POST /api/v1/notifications/[notificationId]/read", () => {
  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  // Servise kullanici kimligini gecirmek sart: yetki kontrolu orada, sorgunun
  // where kosulunda yapiliyor.
  it("servisi oturumdaki kullanici ve bildirim kimligiyle cagirir", async () => {
    await callRoute();

    expect(mockMarkRead).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
  });

  it("basarili istekte 200 doner", async () => {
    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, updated: 1 });
  });

  // Bilinmeyen kimlik, baskasinin bildirimi ve zaten okunmus kayit ayni cevabi
  // almali: 404 donseydik, gecerli bir kimlik denemesi "bu var" bilgisini verirdi.
  it("hicbir sey guncellenmese de 200 doner (kimlik sizdirmaz)", async () => {
    mockMarkRead.mockResolvedValue(0);

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, updated: 0 });
  });
});
