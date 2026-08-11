import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const { mockGetOrCreateCurrentUser, mockGetGroupBalances } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockGetGroupBalances: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/balances", () => ({
  getGroupBalances: mockGetGroupBalances,
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
