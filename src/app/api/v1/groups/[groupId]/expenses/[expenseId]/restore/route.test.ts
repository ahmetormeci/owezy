import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, ForbiddenError } from "@/lib/errors";

const { mockGetOrCreateCurrentUser, mockRestoreExpense } = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockRestoreExpense: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/expenses", () => ({
  restoreExpense: mockRestoreExpense,
}));

const { POST } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function callRoute() {
  const request = new NextRequest(
    "http://localhost/api/v1/groups/x/expenses/y/restore",
    { method: "POST" },
  );
  return POST(request, {
    params: Promise.resolve({ groupId: GROUP_ID, expenseId: EXPENSE_ID }),
  });
}

describe("POST /api/v1/groups/[groupId]/expenses/[expenseId]/restore", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockRestoreExpense.mockReset();
  });

  it("giris yapilmamissa 401 doner ve restoreExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mockRestoreExpense).not.toHaveBeenCalled();
  });

  it("gecerli istekte restoreExpense dogru argumanlarla cagrilir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockRestoreExpense.mockResolvedValue({ id: EXPENSE_ID, deletedAt: null });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, expense: { id: EXPENSE_ID, deletedAt: null } });
    expect(mockRestoreExpense).toHaveBeenCalledWith(USER_ID, GROUP_ID, EXPENSE_ID);
  });

  it("silinmemis harcama icin ConflictError 409'a cevrilir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockRestoreExpense.mockRejectedValue(new ConflictError("expense.not_deleted"));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ ok: false, code: "expense.not_deleted" });
  });

  it("uye olmayan kullanici icin ForbiddenError 403'e cevrilir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockRestoreExpense.mockRejectedValue(new ForbiddenError("group.not_member"));

    const response = await callRoute();

    expect(response.status).toBe(403);
  });
});
