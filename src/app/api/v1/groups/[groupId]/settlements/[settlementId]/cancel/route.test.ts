import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

const { mockGetOrCreateCurrentUser, mockCancelSettlement } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockCancelSettlement: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/settlements", () => ({
  cancelSettlement: mockCancelSettlement,
}));

const { POST } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const SETTLEMENT_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function callRoute() {
  const request = new NextRequest(
    "http://localhost/api/v1/groups/x/settlements/y/cancel",
    { method: "POST" },
  );
  return POST(request, {
    params: Promise.resolve({ groupId: GROUP_ID, settlementId: SETTLEMENT_ID }),
  });
}

describe("POST /api/v1/groups/[groupId]/settlements/[settlementId]/cancel", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockCancelSettlement.mockReset();
  });

  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockCancelSettlement).not.toHaveBeenCalled();
  });

  it("gecerli istekte servisi dogru argumanlarla cagirir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCancelSettlement.mockResolvedValue({ id: SETTLEMENT_ID, cancelledAt: "2026-08-10" });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockCancelSettlement).toHaveBeenCalledWith(USER_ID, GROUP_ID, SETTLEMENT_ID);
  });

  it("zaten iptal edilmis kayit icin 409 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCancelSettlement.mockRejectedValue(
      new ConflictError("settlement.already_cancelled"),
    );

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ ok: false, code: "settlement.already_cancelled" });
  });

  it("kayit bulunamazsa 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCancelSettlement.mockRejectedValue(new NotFoundError("settlement.not_found"));

    const response = await callRoute();

    expect(response.status).toBe(404);
  });

  it("yetkisiz kullanici icin 403 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCancelSettlement.mockRejectedValue(
      new ForbiddenError("access.settlement_creator_only"),
    );

    const response = await callRoute();

    expect(response.status).toBe(403);
  });
});
