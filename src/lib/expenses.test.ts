import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

// prisma.ts modulu gercek Neon baglantisi kurmaya calisir (DATABASE_URL okur).
// Servis-seviyesi testlerde gercek DB'ye dokunmamak icin $transaction'i, verdigimiz
// sahte "tx" nesnesini cagiran basit bir fonksiyona ceviriyoruz.
const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    group: { findUnique: vi.fn() },
    groupMember: { findMany: vi.fn() },
    expense: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    expenseParticipant: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
  },
}));

const { createExpense } = await import("@/lib/expenses");

const GROUP_ID = "group-1";
const CALLER_ID = "user-caller";
const PAYER_ID = "user-payer";
const PARTICIPANT_ID = "user-participant";

const baseEqualInput = {
  description: "Aksam yemegi",
  amount: 9000,
  paidById: PAYER_ID,
  splitType: "EQUAL" as const,
  participantUserIds: [PAYER_ID, PARTICIPANT_ID],
};

describe("createExpense", () => {
  beforeEach(() => {
    mockTx.group.findUnique.mockReset();
    mockTx.groupMember.findMany.mockReset();
    mockTx.expense.create.mockReset();
    mockTx.expenseParticipant.createMany.mockReset();
    mockTx.expense.findUniqueOrThrow.mockReset();
  });

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue(null);

    await expect(createExpense(CALLER_ID, GROUP_ID, baseEqualInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: new Date(),
    });

    await expect(createExpense(CALLER_ID, GROUP_ID, baseEqualInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("bir katilimci aktif uye degilse ForbiddenError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    // PARTICIPANT_ID kasitli olarak eksik birakildi.
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
    ]);

    await expect(createExpense(CALLER_ID, GROUP_ID, baseEqualInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.create).not.toHaveBeenCalled();
  });

  it("gecerli EQUAL bolusumde expense ve participant'lar dogru olusturulur", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "USD", deletedAt: null });
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);
    mockTx.expense.create.mockResolvedValue({ id: "expense-1" });
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: "expense-1", participants: [] });

    const result = await createExpense(CALLER_ID, GROUP_ID, baseEqualInput);

    expect(mockTx.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: GROUP_ID,
        paidById: PAYER_ID,
        createdById: CALLER_ID,
        amount: 9000,
        currency: "USD", // istemciden degil, grup kaydindan geldi
        category: "OTHER",
        splitType: "EQUAL",
      }),
    });

    expect(mockTx.expenseParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { expenseId: "expense-1", userId: PAYER_ID, shareAmount: 4500 },
        { expenseId: "expense-1", userId: PARTICIPANT_ID, shareAmount: 4500 },
      ],
    });

    expect(result).toEqual({ id: "expense-1", participants: [] });
  });

  it("EXACT bolusumde paylarin toplami tutmazsa ValidationError firlatir ve hicbir kayit olusturulmaz", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);

    const input = {
      description: "Market",
      amount: 10000,
      paidById: PAYER_ID,
      splitType: "EXACT" as const,
      shares: [
        { userId: PAYER_ID, amount: 6000 },
        { userId: PARTICIPANT_ID, amount: 3000 }, // toplam 9000, amount 10000
      ],
    };

    await expect(createExpense(CALLER_ID, GROUP_ID, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockTx.expense.create).not.toHaveBeenCalled();
    expect(mockTx.expenseParticipant.createMany).not.toHaveBeenCalled();
  });

  it("PERCENTAGE bolusumde yuzdeler %100 etmezse ValidationError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);

    const input = {
      description: "Otel",
      amount: 20000,
      paidById: PAYER_ID,
      splitType: "PERCENTAGE" as const,
      shares: [
        { userId: PAYER_ID, basisPoints: 5000 },
        { userId: PARTICIPANT_ID, basisPoints: 4000 }, // toplam %90
      ],
    };

    await expect(createExpense(CALLER_ID, GROUP_ID, input)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("expenseDate verilmezse bugunun tarihi kullanilir", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);
    mockTx.expense.create.mockResolvedValue({ id: "expense-3" });
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: "expense-3", participants: [] });

    const before = Date.now();
    await createExpense(CALLER_ID, GROUP_ID, baseEqualInput);
    const after = Date.now();

    const usedDate = mockTx.expense.create.mock.calls[0][0].data.expenseDate as Date;
    expect(usedDate.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(usedDate.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});
