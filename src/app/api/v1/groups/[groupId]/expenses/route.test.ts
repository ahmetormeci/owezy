import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/errors";

// Route'un kendi sorumlulugunu (auth kontrolu, Zod dogrulama, cevap sekli, hata
// esleme) izole test etmek icin auth ve expenses servislerini mock'luyoruz.
// createExpense'in ic mantigi zaten src/lib/expenses.test.ts'te test edildi.
const { mockGetOrCreateCurrentUser, mockCreateExpense, mockListExpenses } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockCreateExpense: vi.fn(),
  mockListExpenses: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/expenses", () => ({
  createExpense: mockCreateExpense,
  listExpenses: mockListExpenses,
}));

const { POST, GET } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PARTICIPANT_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/groups/x/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callRoute(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({ groupId: GROUP_ID }) });
}

describe("POST /api/v1/groups/[groupId]/expenses", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockCreateExpense.mockReset();
  });

  it("giris yapilmamissa 401 doner ve createExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute({});

    expect(response.status).toBe(401);
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  it("gecersiz body (eksik alanlar) icin 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callRoute({ splitType: "EQUAL" });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  it("gecersiz splitType icin 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callRoute({
      splitType: "UNKNOWN",
      description: "Test",
      amount: 1000,
      paidById: USER_ID,
    });

    expect(response.status).toBe(400);
    expect(mockCreateExpense).not.toHaveBeenCalled();
  });

  it("gecerli EQUAL istegi createExpense'i dogru argumanlarla cagirir ve 201 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateExpense.mockResolvedValue({ id: "expense-1", participants: [] });

    const body = {
      splitType: "EQUAL",
      description: "Aksam yemegi",
      amount: 10000,
      paidById: USER_ID,
      participantUserIds: [USER_ID, PARTICIPANT_ID],
    };

    const response = await callRoute(body);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({ ok: true, expense: { id: "expense-1", participants: [] } });
    expect(mockCreateExpense).toHaveBeenCalledWith(USER_ID, GROUP_ID, body);
  });

  it("body'de currency gonderilse bile Zod tarafindan elenir, createExpense'e ulasmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateExpense.mockResolvedValue({ id: "expense-2", participants: [] });

    await callRoute({
      splitType: "EQUAL",
      description: "Market",
      amount: 5000,
      paidById: USER_ID,
      participantUserIds: [USER_ID],
      currency: "USD", // istemci gondermeye calisiyor
    });

    const forwardedInput = mockCreateExpense.mock.calls[0][2];
    expect(forwardedInput).not.toHaveProperty("currency");
  });

  it("createExpense bir AppError firlatirsa handleApiError dogru status'e cevirir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockCreateExpense.mockRejectedValue(new ForbiddenError("Bu grubun uyesi degilsiniz"));

    const response = await callRoute({
      splitType: "EQUAL",
      description: "Market",
      amount: 5000,
      paidById: USER_ID,
      participantUserIds: [USER_ID],
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({ ok: false, error: "Bu grubun uyesi degilsiniz" });
  });
});

function callGetRoute(queryString = "") {
  const request = new NextRequest(
    `http://localhost/api/v1/groups/x/expenses${queryString}`,
    { method: "GET" },
  );
  return GET(request, { params: Promise.resolve({ groupId: GROUP_ID }) });
}

describe("GET /api/v1/groups/[groupId]/expenses", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockListExpenses.mockReset();
  });

  it("giris yapilmamissa 401 doner ve listExpenses hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callGetRoute();

    expect(response.status).toBe(401);
    expect(mockListExpenses).not.toHaveBeenCalled();
  });

  it("parametresiz istekte bos secenekle cagirir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListExpenses.mockResolvedValue({ expenses: [], nextCursor: null });

    const response = await callGetRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, expenses: [], nextCursor: null });
    expect(mockListExpenses).toHaveBeenCalledWith(USER_ID, GROUP_ID, {});
  });

  it("limit ve cursor parametreleri servise aktarilir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListExpenses.mockResolvedValue({ expenses: [], nextCursor: null });

    await callGetRoute(`?limit=10&cursor=${PARTICIPANT_ID}`);

    expect(mockListExpenses).toHaveBeenCalledWith(USER_ID, GROUP_ID, {
      limit: 10,
      cursor: PARTICIPANT_ID,
    });
  });

  it("includeDeleted=true boolean'a cevrilir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListExpenses.mockResolvedValue({ expenses: [], nextCursor: null });

    await callGetRoute("?includeDeleted=true");

    expect(mockListExpenses).toHaveBeenCalledWith(USER_ID, GROUP_ID, { includeDeleted: true });
  });

  it("includeDeleted=false true'ya donusmez", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListExpenses.mockResolvedValue({ expenses: [], nextCursor: null });

    await callGetRoute("?includeDeleted=false");

    expect(mockListExpenses).toHaveBeenCalledWith(USER_ID, GROUP_ID, { includeDeleted: false });
  });

  it("limit ust sinirin uzerindeyse 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callGetRoute("?limit=5000");

    expect(response.status).toBe(400);
    expect(mockListExpenses).not.toHaveBeenCalled();
  });

  it("gecersiz cursor (UUID olmayan) icin 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callGetRoute("?cursor=not-a-uuid");

    expect(response.status).toBe(400);
    expect(mockListExpenses).not.toHaveBeenCalled();
  });

  it("nextCursor cevaba aktarilir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockListExpenses.mockResolvedValue({
      expenses: [{ id: "e1" }],
      nextCursor: "e1",
    });

    const json = await (await callGetRoute("?limit=1")).json();

    expect(json.nextCursor).toBe("e1");
  });
});
