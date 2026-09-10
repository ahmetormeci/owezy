import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const { mockGetOrCreateCurrentUser, mockGetGroupBalances, mockListRecentReminders } =
  vi.hoisted(() => ({
    mockGetOrCreateCurrentUser: vi.fn(),
    mockGetGroupBalances: vi.fn(),
    mockListRecentReminders: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/balances", () => ({
  getGroupBalances: mockGetGroupBalances,
}));

// TAKLIT SART, yalnizca kolaylik degil: reminders.ts prisma'yi import
// ediyor ve prisma modulu yuklenirken DATABASE_URL yoksa firlatiyor.
// Taklitsiz bu dosya hic yuklenemiyor.
vi.mock("@/lib/reminders", () => ({
  listRecentReminders: mockListRecentReminders,
}));

const { GET } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function callRoute() {
  const request = new NextRequest("http://localhost/api/v1/groups/x/balances", {
    method: "GET",
  });
  return GET(request, { params: Promise.resolve({ groupId: GROUP_ID }) });
}

describe("GET /api/v1/groups/[groupId]/balances", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockGetGroupBalances.mockReset();
    mockListRecentReminders.mockReset().mockResolvedValue([]);
  });

  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockGetGroupBalances).not.toHaveBeenCalled();
  });

  it("gecerli istekte servisi dogru argumanlarla cagirir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupBalances.mockResolvedValue({
      currency: "TRY",
      balances: [{ userId: USER_ID, amount: 15000, displayName: "Ali", avatarUrl: null, hasLeft: false }],
      suggestedTransfers: [{ fromUserId: "can", toUserId: USER_ID, amount: 15000 }],
    });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.currency).toBe("TRY");
    expect(json.balances).toHaveLength(1);
    expect(json.suggestedTransfers).toHaveLength(1);
    expect(mockGetGroupBalances).toHaveBeenCalledWith(USER_ID, GROUP_ID);
  });

  it("hatirlatmalari da AYNI cevapta donuyor (ADR-050)", async () => {
    // Odesme plani ile "kime hatirlattim" ayni satirda ciziliyor; ikisi ayri
    // uctan gelseydi telefon her grup acilisinda bir gidis-donus daha
    // yapardi. Bu test o sozlesmeyi tutuyor.
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupBalances.mockResolvedValue({
      currency: "TRY",
      balances: [],
      suggestedTransfers: [],
    });
    mockListRecentReminders.mockResolvedValue([
      { toUserId: "can", amount: 15000, sentAt: new Date("2026-09-10T09:00:00Z") },
    ]);

    const response = await callRoute();
    const json = await response.json();

    expect(json.reminders).toHaveLength(1);
    expect(json.reminders[0].toUserId).toBe("can");
    expect(mockListRecentReminders).toHaveBeenCalledWith(USER_ID, GROUP_ID);
  });

  it("grup bulunamazsa 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupBalances.mockRejectedValue(new NotFoundError("group.not_found"));

    const response = await callRoute();

    expect(response.status).toBe(404);
  });

  it("uye olmayan kullanici icin 403 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetGroupBalances.mockRejectedValue(new ForbiddenError("group.not_member"));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({ ok: false, code: "group.not_member" });
  });
});
