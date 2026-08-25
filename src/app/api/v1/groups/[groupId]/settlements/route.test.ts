import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/errors";

const { mockGetOrCreateCurrentUser, mockCreateSettlement, mockListSettlements } = vi.hoisted(
  () => ({
    mockGetOrCreateCurrentUser: vi.fn(),
    mockCreateSettlement: vi.fn(),
    mockListSettlements: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/settlements", () => ({
  createSettlement: mockCreateSettlement,
  listSettlements: mockListSettlements,
}));

const { GET, POST } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

const validBody = {
  fromUserId: USER_ID,
  toUserId: OTHER_ID,
  amount: 15000,
};

function callPost(body: unknown) {
  const request = new NextRequest("http://localhost/api/v1/groups/x/settlements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ groupId: GROUP_ID }) });
}

function callGet(queryString = "") {
  const request = new NextRequest(
    `http://localhost/api/v1/groups/x/settlements${queryString}`,
    { method: "GET" },
  );
  return GET(request, { params: Promise.resolve({ groupId: GROUP_ID }) });
}

describe("POST /api/v1/groups/[groupId]/settlements", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockCreateSettlement.mockReset();
  });

  it("giris yapilmamissa 401 doner ve servis hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callPost(validBody);

    expect(response.status).toBe(401);
    expect(mockCreateSettlement).not.toHaveBeenCalled();
  });

  it("gecersiz body icin 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callPost({ fromUserId: USER_ID, amount: -5 });

    expect(response.status).toBe(400);
    expect(mockCreateSettlement).not.toHaveBeenCalled();
  });

  it("gecerli istekte servisi dogru argumanlarla cagirir ve 201 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateSettlement.mockResolvedValue({ id: "settlement-1" });

    const response = await callPost(validBody);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({ ok: true, settlement: { id: "settlement-1" } });
    expect(mockCreateSettlement).toHaveBeenCalledWith(USER_ID, GROUP_ID, validBody);
  });

  it("body'de currency gonderilse bile Zod tarafindan elenir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateSettlement.mockResolvedValue({ id: "settlement-2" });

    await callPost({ ...validBody, currency: "USD" });

    expect(mockCreateSettlement.mock.calls[0][2]).not.toHaveProperty("currency");
  });

  it("servis ForbiddenError firlatirsa 403 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateSettlement.mockRejectedValue(
      new ForbiddenError("settlement.party_only"),
    );

    const response = await callPost(validBody);

    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/groups/[groupId]/settlements", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockListSettlements.mockReset();
  });

  it("giris yapilmamissa 401 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callGet();

    expect(response.status).toBe(401);
    expect(mockListSettlements).not.toHaveBeenCalled();
  });

  it("parametresiz istekte bos secenekle cagirir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListSettlements.mockResolvedValue({ settlements: [], nextCursor: null });

    const response = await callGet();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, settlements: [], nextCursor: null });
    expect(mockListSettlements).toHaveBeenCalledWith(USER_ID, GROUP_ID, {});
  });

  it("includeCancelled=false true'ya donusmez", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListSettlements.mockResolvedValue({ settlements: [], nextCursor: null });

    await callGet("?includeCancelled=false");

    expect(mockListSettlements).toHaveBeenCalledWith(USER_ID, GROUP_ID, {
      includeCancelled: false,
    });
  });

  it("limit ust sinirin uzerindeyse 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callGet("?limit=5000");

    expect(response.status).toBe(400);
    expect(mockListSettlements).not.toHaveBeenCalled();
  });
});
