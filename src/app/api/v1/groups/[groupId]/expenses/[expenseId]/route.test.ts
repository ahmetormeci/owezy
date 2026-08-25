import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

// Route'un kendi sorumlulugunu (auth kontrolu, Zod dogrulama, cevap sekli, hata
// esleme) izole test ediyoruz. updateExpense'in ic mantigi src/lib/expenses.test.ts'te.
const {
  mockGetOrCreateCurrentUser,
  mockGetExpenseForUser,
  mockUpdateExpense,
  mockDeleteExpense,
} = vi.hoisted(() => ({
  mockGetOrCreateCurrentUser: vi.fn(),
  mockGetExpenseForUser: vi.fn(),
  mockUpdateExpense: vi.fn(),
  mockDeleteExpense: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOrCreateCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/expenses", () => ({
  getExpenseForUser: mockGetExpenseForUser,
  updateExpense: mockUpdateExpense,
  deleteExpense: mockDeleteExpense,
}));

const { GET, PUT, DELETE } = await import("./route");

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PARTICIPANT_ID = "33333333-3333-4333-8333-333333333333";

// Optimistic locking surumu (ADR-032). Govdede ZORUNLU: gonderilmezse istek
// 400 ile reddediliyor, cunku "atlanabilen kontrol" kontrol degildir.
const CURRENT_VERSION = 3;

// Harcamanin kendisi ve surum AYRI tutuluyor: sunucu da onlari ayri ayri
// cozumluyor (govde semasi POST ile paylasiliyor, surum ayri bir sema).
const expenseBody = {
  splitType: "EQUAL",
  description: "Guncellenmis aciklama",
  amount: 12000,
  paidById: USER_ID,
  participantUserIds: [USER_ID, PARTICIPANT_ID],
};

const validBody = { ...expenseBody, version: CURRENT_VERSION };

function callRoute(body: unknown) {
  const request = new NextRequest("http://localhost/api/v1/groups/x/expenses/y", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PUT(request, {
    params: Promise.resolve({ groupId: GROUP_ID, expenseId: EXPENSE_ID }),
  });
}

describe("PUT /api/v1/groups/[groupId]/expenses/[expenseId]", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockUpdateExpense.mockReset();
  });

  it("giris yapilmamissa 401 doner ve updateExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callRoute(validBody);

    expect(response.status).toBe(401);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("gecersiz body icin 400 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callRoute({ splitType: "EQUAL", amount: -5 });

    expect(response.status).toBe(400);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("gecerli istek updateExpense'i dogru argumanlarla cagirir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockUpdateExpense.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    const response = await callRoute(validBody);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, expense: { id: EXPENSE_ID, participants: [] } });

    // version, HARCAMA GOVDESINDEN AYRI bir arguman olarak geciyor: Zod onu
    // govdeden eliyor, cunku o sema olusturma (POST) ile paylasiliyor.
    expect(mockUpdateExpense).toHaveBeenCalledWith(
      USER_ID,
      GROUP_ID,
      EXPENSE_ID,
      expenseBody,
      CURRENT_VERSION,
    );
  });

  it("version gonderilmezse 400 doner ve updateExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callRoute(expenseBody);

    expect(response.status).toBe(400);
    expect(mockUpdateExpense).not.toHaveBeenCalled();
  });

  it("updateExpense ConflictError firlatirsa 409 ve cakisma kodu doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockUpdateExpense.mockRejectedValue(new ConflictError("expense.version_conflict"));

    const response = await callRoute(validBody);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ ok: false, code: "expense.version_conflict" });
  });

  it("body'de currency gonderilse bile Zod tarafindan elenir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockUpdateExpense.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await callRoute({ ...validBody, currency: "USD" });

    expect(mockUpdateExpense.mock.calls[0][3]).not.toHaveProperty("currency");
  });

  it("updateExpense NotFoundError firlatirsa 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockUpdateExpense.mockRejectedValue(new NotFoundError("expense.not_found"));

    const response = await callRoute(validBody);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ ok: false, code: "expense.not_found" });
  });
});

// DELETE'te surum QUERY STRING'ten geliyor: DELETE'in govdesi yok (ADR-032).
// version === null cagrilirsa hic gonderilmemis oluyor.
function callDeleteRoute(version: number | null = CURRENT_VERSION) {
  const query = version === null ? "" : `?version=${version}`;
  const request = new NextRequest(`http://localhost/api/v1/groups/x/expenses/y${query}`, {
    method: "DELETE",
  });
  return DELETE(request, {
    params: Promise.resolve({ groupId: GROUP_ID, expenseId: EXPENSE_ID }),
  });
}

describe("DELETE /api/v1/groups/[groupId]/expenses/[expenseId]", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockDeleteExpense.mockReset();
  });

  it("giris yapilmamissa 401 doner ve deleteExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callDeleteRoute();

    expect(response.status).toBe(401);
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });

  it("gecerli istekte deleteExpense dogru argumanlarla cagrilir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockDeleteExpense.mockResolvedValue({ id: EXPENSE_ID, deletedAt: "2026-08-05T10:30:00.000Z" });

    const response = await callDeleteRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockDeleteExpense).toHaveBeenCalledWith(
      USER_ID,
      GROUP_ID,
      EXPENSE_ID,
      CURRENT_VERSION,
    );
  });

  it("version gonderilmezse 400 doner ve deleteExpense hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });

    const response = await callDeleteRoute(null);

    expect(response.status).toBe(400);
    expect(mockDeleteExpense).not.toHaveBeenCalled();
  });

  it("deleteExpense ConflictError firlatirsa 409 ve cakisma kodu doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockDeleteExpense.mockRejectedValue(new ConflictError("expense.version_conflict"));

    const response = await callDeleteRoute();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ ok: false, code: "expense.version_conflict" });
  });

  it("deleteExpense NotFoundError firlatirsa 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockDeleteExpense.mockRejectedValue(new NotFoundError("expense.not_found"));

    const response = await callDeleteRoute();

    expect(response.status).toBe(404);
  });
});

function callGetRoute() {
  const request = new NextRequest("http://localhost/api/v1/groups/x/expenses/y");
  return GET(request, {
    params: Promise.resolve({ groupId: GROUP_ID, expenseId: EXPENSE_ID }),
  });
}

describe("GET /api/v1/groups/[groupId]/expenses/[expenseId]", () => {
  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockReset();
    mockGetExpenseForUser.mockReset();
  });

  it("giris yapilmamissa 401 doner ve getExpenseForUser hic cagrilmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await callGetRoute();

    expect(response.status).toBe(401);
    expect(mockGetExpenseForUser).not.toHaveBeenCalled();
  });

  it("gecerli istekte getExpenseForUser dogru argumanlarla cagrilir ve 200 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetExpenseForUser.mockResolvedValue({ id: EXPENSE_ID, amount: 12000, participants: [] });

    const response = await callGetRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      expense: { id: EXPENSE_ID, amount: 12000, participants: [] },
    });
    expect(mockGetExpenseForUser).toHaveBeenCalledWith(USER_ID, GROUP_ID, EXPENSE_ID);
  });

  it("grubun uyesi degilse 403 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetExpenseForUser.mockRejectedValue(new ForbiddenError("group.not_member"));

    const response = await callGetRoute();
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe("group.not_member");
  });

  it("silinmis ya da baska gruba ait harcama icin 404 doner", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
    mockGetExpenseForUser.mockRejectedValue(new NotFoundError("expense.not_found"));

    const response = await callGetRoute();
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.code).toBe("expense.not_found");
  });
});
