import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  DEFAULT_EXPENSE_PAGE_SIZE,
  MAX_EXPENSE_PAGE_SIZE,
} from "@/lib/expense-schemas";

// prisma.ts modulu gercek Neon baglantisi kurmaya calisir (DATABASE_URL okur).
// Servis-seviyesi testlerde gercek DB'ye dokunmamak icin $transaction'i, verdigimiz
// sahte "tx" nesnesini cagiran basit bir fonksiyona ceviriyoruz.
const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    group: { findUnique: vi.fn() },
    groupMember: { findMany: vi.fn(), findFirst: vi.fn() },
    expense: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    expenseParticipant: { createMany: vi.fn(), deleteMany: vi.fn() },
    expenseEdit: { create: vi.fn() },
    // Bildirimler harcamayla AYNI transaction'da yaziliyor; createNotifications
    // islemi yapanin adini okumak icin user.findUnique de cagiriyor.
    user: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}));

// listExpenses transaction kullanmaz (salt okuma), dogrudan prisma uzerinden
// calisir - o yuzden mock'ta hem $transaction hem de duz model erisimi var.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn() },
    expense: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
    group: mockPrisma.group,
    groupMember: mockPrisma.groupMember,
    expense: mockPrisma.expense,
  },
}));

const {
  createExpense,
  updateExpense,
  deleteExpense,
  restoreExpense,
  listExpenses,
  getExpenseForUser,
} = await import("@/lib/expenses");

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

function resetMocks() {
  mockTx.group.findUnique.mockReset();
  mockTx.groupMember.findMany.mockReset();
  mockTx.groupMember.findFirst.mockReset();
  mockTx.expense.create.mockReset();
  mockTx.expense.update.mockReset();
  mockTx.expense.findUnique.mockReset();
  mockTx.expense.findUniqueOrThrow.mockReset();
  mockTx.expenseParticipant.createMany.mockReset();
  mockTx.expenseParticipant.deleteMany.mockReset();
  mockTx.expenseEdit.create.mockReset();
  mockPrisma.group.findUnique.mockReset();
  mockPrisma.groupMember.findFirst.mockReset();
  mockPrisma.expense.findMany.mockReset();
  mockPrisma.expense.findUnique.mockReset();
}

function allMembersActive() {
  mockTx.groupMember.findMany.mockResolvedValue([
    { userId: CALLER_ID },
    { userId: PAYER_ID },
    { userId: PARTICIPANT_ID },
  ]);
  // assertCanModifyExpense'in cagiran kisi uyelik sorgusu icin.
  mockTx.groupMember.findFirst.mockResolvedValue({
    id: "membership-caller",
    userId: CALLER_ID,
    role: "MEMBER",
  });
}

describe("createExpense", () => {
  beforeEach(() => {
    resetMocks();
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
        { expenseId: "expense-1", userId: PAYER_ID, shareAmount: 4500, basisPoints: null },
        { expenseId: "expense-1", userId: PARTICIPANT_ID, shareAmount: 4500, basisPoints: null },
      ],
    });

    expect(result).toEqual({ id: "expense-1", participants: [] });
  });

  // Yuzdeli bolusumde kullanicinin GIRDIGI yuzde saklanmali. Paylardan geri
  // hesaplamak her zaman mumkun degil (yuvarlama kayipli), o yuzden girdi
  // kaybolursa duzenleme ekrani kullaniciya yuzdeleri yeniden yazdirir.
  it("PERCENTAGE bolusumde girilen yuzdeler paylarla birlikte saklanir", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);
    mockTx.expense.create.mockResolvedValue({ id: "expense-1" });
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: "expense-1", participants: [] });

    await createExpense(CALLER_ID, GROUP_ID, {
      description: "Yuzdeli",
      amount: 10000,
      paidById: PAYER_ID,
      splitType: "PERCENTAGE",
      shares: [
        { userId: PAYER_ID, basisPoints: 3333 },
        { userId: PARTICIPANT_ID, basisPoints: 6667 },
      ],
    });

    expect(mockTx.expenseParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { expenseId: "expense-1", userId: PAYER_ID, shareAmount: 3333, basisPoints: 3333 },
        { expenseId: "expense-1", userId: PARTICIPANT_ID, shareAmount: 6667, basisPoints: 6667 },
      ],
    });
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

const EXPENSE_ID = "expense-1";

// Guncellenmeden onceki hali: 9000 kurus, EQUAL, iki kisiye 4500/4500.
function existingExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE_ID,
    groupId: GROUP_ID,
    paidById: PAYER_ID,
    createdById: CALLER_ID,
    description: "Aksam yemegi",
    amount: 9000,
    currency: "TRY",
    category: "FOOD",
    splitType: "EQUAL",
    expenseDate: new Date("2026-08-01T00:00:00.000Z"),
    deletedAt: null,
    deletedById: null,
    // EQUAL bolusum: yuzde diye bir sey yok, kolon null.
    participants: [
      { userId: PARTICIPANT_ID, shareAmount: 4500, basisPoints: null },
      { userId: PAYER_ID, shareAmount: 4500, basisPoints: null },
    ],
    ...overrides,
  };
}

const updateInput = {
  description: "Aksam yemegi (duzeltildi)",
  amount: 12000,
  paidById: PAYER_ID,
  splitType: "EQUAL" as const,
  participantUserIds: [PAYER_ID, PARTICIPANT_ID],
};

describe("updateExpense", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("harcama bulunamazsa NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(null);

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockTx.expenseParticipant.deleteMany).not.toHaveBeenCalled();
  });

  it("soft-delete edilmis harcama guncellenemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: new Date() }),
    );

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("harcama baska bir gruba aitse NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ groupId: "baska-grup" }),
    );

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: new Date(),
    });

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("harcamayi olusturmayan bir uye guncelleyemez", async () => {
    // Kayit PAYER_ID tarafindan olusturulmus; CALLER_ID grubun uyesi ama sahibi degil.
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "MEMBER" }, { userId: PAYER_ID });

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.expenseParticipant.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("paidById olmak duzenleme yetkisi vermez", async () => {
    // CALLER_ID parayi odeyen kisi ama kaydi PAYER_ID girmis.
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ createdById: PAYER_ID, paidById: CALLER_ID }),
    );
    liveGroup();
    membershipLookups({ role: "MEMBER" }, { userId: PAYER_ID });

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("olusturan kisi hala gruptaysa OWNER bile guncelleyemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "OWNER" }, { userId: PAYER_ID });

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("olusturan kisi gruptan ayrildiysa OWNER guncelleyebilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "OWNER" }, null); // olusturan kisi artik aktif uye degil
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
      { userId: PARTICIPANT_ID },
    ]);
    mockTx.expense.update.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    expect(mockTx.expense.update).toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).toHaveBeenCalled();
  });

  it("olusturan kisi gruptan ayrildiysa siradan bir uye yine de guncelleyemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "MEMBER" }, null);

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("yeni katilimci aktif uye degilse ForbiddenError firlatir ve hicbir yazma olmaz", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    // PARTICIPANT_ID kasitli olarak eksik.
    mockTx.groupMember.findMany.mockResolvedValue([
      { userId: CALLER_ID },
      { userId: PAYER_ID },
    ]);

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.expenseParticipant.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("gecersiz bolusumde ValidationError firlatir ve hicbir yazma olmaz", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();

    const invalidInput = {
      description: "Bozuk EXACT",
      amount: 10000,
      paidById: PAYER_ID,
      splitType: "EXACT" as const,
      shares: [
        { userId: PAYER_ID, amount: 6000 },
        { userId: PARTICIPANT_ID, amount: 3000 }, // toplam 9000
      ],
    };

    await expect(
      updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, invalidInput),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockTx.expenseParticipant.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("gecerli guncellemede eski paylar silinip yenileri yazilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(
      existingExpense({ description: updateInput.description, amount: 12000 }),
    );
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    expect(mockTx.expenseParticipant.deleteMany).toHaveBeenCalledWith({
      where: { expenseId: EXPENSE_ID },
    });
    expect(mockTx.expenseParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { expenseId: EXPENSE_ID, userId: PAYER_ID, shareAmount: 6000, basisPoints: null },
        { expenseId: EXPENSE_ID, userId: PARTICIPANT_ID, shareAmount: 6000, basisPoints: null },
      ],
    });

    // Silme, yeniden yazmadan once gerceklesmeli.
    expect(mockTx.expenseParticipant.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockTx.expenseParticipant.createMany.mock.invocationCallOrder[0],
    );
  });

  it("audit kaydi UPDATE action'i ve dogru previousData/newData ile yazilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(
      existingExpense({ description: updateInput.description, amount: 12000 }),
    );
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    const auditArgs = mockTx.expenseEdit.create.mock.calls[0][0].data;

    expect(auditArgs.action).toBe("UPDATE");
    expect(auditArgs.expenseId).toBe(EXPENSE_ID);
    expect(auditArgs.changedById).toBe(CALLER_ID);

    // previousData eski hali, participants dahil, userId'ye gore sirali tutar.
    expect(auditArgs.previousData).toEqual({
      description: "Aksam yemegi",
      amount: 9000,
      currency: "TRY",
      category: "FOOD",
      splitType: "EQUAL",
      expenseDate: "2026-08-01",
      paidById: PAYER_ID,
      deletedAt: null,
      deletedById: null,
      participants: [
        { userId: PARTICIPANT_ID, shareAmount: 4500, basisPoints: null },
        { userId: PAYER_ID, shareAmount: 4500, basisPoints: null },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    });

    expect(auditArgs.newData).toMatchObject({
      description: updateInput.description,
      amount: 12000,
      currency: "TRY",
    });
    expect(auditArgs.newData.participants).toEqual(
      [
        { userId: PAYER_ID, shareAmount: 6000, basisPoints: null },
        { userId: PARTICIPANT_ID, shareAmount: 6000, basisPoints: null },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    );
  });

  it("splitType degistirilebilir (EQUAL -> EXACT)", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(existingExpense({ splitType: "EXACT" }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, {
      description: "EXACT'e cevrildi",
      amount: 10000,
      paidById: PAYER_ID,
      splitType: "EXACT",
      shares: [
        { userId: PAYER_ID, amount: 7000 },
        { userId: PARTICIPANT_ID, amount: 3000 },
      ],
    });

    expect(mockTx.expense.update.mock.calls[0][0].data.splitType).toBe("EXACT");
    expect(mockTx.expenseParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { expenseId: EXPENSE_ID, userId: PAYER_ID, shareAmount: 7000, basisPoints: null },
        { expenseId: EXPENSE_ID, userId: PARTICIPANT_ID, shareAmount: 3000, basisPoints: null },
      ],
    });
  });

  // Yuzdeli bir harcama EQUAL'a cevrildiginde eski yuzdeler ARTIK GECERSIZ.
  // Satirda kalirlarsa duzenleme ekrani bir daha acildiginda gecmiste kalmis
  // bir yuzdeyi bugunun bolusumu gibi gosterirdi.
  it("PERCENTAGE'dan EQUAL'a gecince eski yuzdeler kaydedilmez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({
        splitType: "PERCENTAGE",
        participants: [
          { userId: PAYER_ID, shareAmount: 3000, basisPoints: 3333 },
          { userId: PARTICIPANT_ID, shareAmount: 6000, basisPoints: 6667 },
        ],
      }),
    );
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(existingExpense({ amount: 12000 }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    expect(mockTx.expenseParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { expenseId: EXPENSE_ID, userId: PAYER_ID, shareAmount: 6000, basisPoints: null },
        { expenseId: EXPENSE_ID, userId: PARTICIPANT_ID, shareAmount: 6000, basisPoints: null },
      ],
    });

    // Eski yuzdeler tamamen kaybolmuyor: audit kaydinda duruyorlar.
    const auditArgs = mockTx.expenseEdit.create.mock.calls[0][0].data;
    expect(auditArgs.previousData.participants).toEqual(
      [
        { userId: PAYER_ID, shareAmount: 3000, basisPoints: 3333 },
        { userId: PARTICIPANT_ID, shareAmount: 6000, basisPoints: 6667 },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    );
  });

  it("paidById degistirilebilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(existingExpense({ paidById: PARTICIPANT_ID }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, {
      ...updateInput,
      paidById: PARTICIPANT_ID,
    });

    expect(mockTx.expense.update.mock.calls[0][0].data.paidById).toBe(PARTICIPANT_ID);
  });

  it("category ve expenseDate gonderilmezse mevcut degerler korunur", async () => {
    const existing = existingExpense();
    mockTx.expense.findUnique.mockResolvedValue(existing);
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(existing);
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    const updateData = mockTx.expense.update.mock.calls[0][0].data;
    expect(updateData.category).toBe("FOOD");
    expect(updateData.expenseDate).toBe(existing.expenseDate);
  });

  it("currency istemciden degil mevcut kayittan gelir, guncellenmez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
    allMembersActive();
    mockTx.expense.update.mockResolvedValue(existingExpense());
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await updateExpense(CALLER_ID, GROUP_ID, EXPENSE_ID, updateInput);

    expect(mockTx.expense.update.mock.calls[0][0].data).not.toHaveProperty("currency");
  });
});

const DELETED_AT = new Date("2026-08-05T10:30:00.000Z");

// assertCanModifyExpense en fazla iki findFirst yapar:
//   1. cagiran kisinin uyeligi
//   2. (yalnizca cagiran kisi kayit sahibi degilse) olusturan kisinin uyeligi
function callerIsActiveMember(role: "OWNER" | "MEMBER" = "MEMBER") {
  mockTx.groupMember.findFirst.mockResolvedValue({
    id: "membership-1",
    userId: CALLER_ID,
    role,
  });
}

function membershipLookups(
  caller: { role: "OWNER" | "MEMBER" } | null,
  creator: { userId: string } | null,
) {
  mockTx.groupMember.findFirst
    .mockResolvedValueOnce(caller ? { id: "membership-caller", ...caller } : null)
    .mockResolvedValueOnce(creator ? { id: "membership-creator", ...creator } : null);
}

function liveGroup() {
  mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
}

describe("deleteExpense", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("harcama bulunamazsa NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(null);

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("zaten silinmis harcama tekrar silinemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ deletedAt: DELETED_AT }));

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("harcama baska bir gruba aitse NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ groupId: "baska-grup" }));

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("cagiran kisi aktif uye degilse ForbiddenError firlatir ve hicbir yazma olmaz", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    liveGroup();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("harcamayi olusturmayan bir uye silemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "MEMBER" }, { userId: PAYER_ID });

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("olusturan kisi hala gruptaysa OWNER bile silemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "OWNER" }, { userId: PAYER_ID });

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("olusturan kisi gruptan ayrildiysa OWNER silebilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "OWNER" }, null); // olusturan kisi artik aktif uye degil
    mockTx.expense.update.mockResolvedValue(existingExpense({ deletedAt: DELETED_AT }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    expect(mockTx.expense.update.mock.calls[0][0].data.deletedById).toBe(CALLER_ID);
    expect(mockTx.expenseEdit.create).toHaveBeenCalled();
  });

  it("olusturan kisi gruptan ayrildiysa siradan bir uye yine de silemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    liveGroup();
    membershipLookups({ role: "MEMBER" }, null);

    await expect(deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("fiziksel silme yapmaz, sadece deletedAt/deletedById doldurur", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    liveGroup();
    callerIsActiveMember();
    mockTx.expense.update.mockResolvedValue(existingExpense({ deletedAt: DELETED_AT }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    const updateData = mockTx.expense.update.mock.calls[0][0].data;
    expect(updateData.deletedById).toBe(CALLER_ID);
    expect(updateData.deletedAt).toBeInstanceOf(Date);

    // ExpenseParticipant satirlari korunmali - paylar kaybolmamali.
    expect(mockTx.expenseParticipant.deleteMany).not.toHaveBeenCalled();
  });

  it("DELETE audit kaydini yalnizca previousData ile yazar", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense());
    liveGroup();
    callerIsActiveMember();
    mockTx.expense.update.mockResolvedValue(existingExpense({ deletedAt: DELETED_AT }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await deleteExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    const auditData = mockTx.expenseEdit.create.mock.calls[0][0].data;

    expect(auditData.action).toBe("DELETE");
    expect(auditData.expenseId).toBe(EXPENSE_ID);
    expect(auditData.changedById).toBe(CALLER_ID);
    expect(auditData).not.toHaveProperty("newData");

    // previousData silinmeden onceki tam hali icermeli (paylar dahil).
    expect(auditData.previousData).toMatchObject({
      description: "Aksam yemegi",
      amount: 9000,
      currency: "TRY",
      deletedAt: null,
      deletedById: null,
    });
    expect(auditData.previousData.participants).toHaveLength(2);
  });
});

describe("restoreExpense", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("harcama bulunamazsa NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(null);

    await expect(restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("silinmemis harcama restore edilemez (ConflictError)", async () => {
    mockTx.expense.findUnique.mockResolvedValue(existingExpense({ deletedAt: null }));

    await expect(restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("harcama baska bir gruba aitse NotFoundError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, groupId: "baska-grup" }),
    );

    await expect(restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("cagiran kisi aktif uye degilse ForbiddenError firlatir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, deletedById: PAYER_ID }),
    );
    liveGroup();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
  });

  it("harcamayi olusturmayan bir uye geri yukleyemez", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, createdById: PAYER_ID }),
    );
    liveGroup();
    membershipLookups({ role: "MEMBER" }, { userId: PAYER_ID });

    await expect(restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expense.update).not.toHaveBeenCalled();
    expect(mockTx.expenseEdit.create).not.toHaveBeenCalled();
  });

  it("olusturan kisi gruptan ayrildiysa OWNER geri yukleyebilir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, deletedById: PAYER_ID, createdById: PAYER_ID }),
    );
    liveGroup();
    membershipLookups({ role: "OWNER" }, null);
    mockTx.expense.update.mockResolvedValue(existingExpense({ createdById: PAYER_ID }));
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    expect(mockTx.expense.update).toHaveBeenCalledWith({
      where: { id: EXPENSE_ID },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it("deletedAt ve deletedById temizlenir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, deletedById: PAYER_ID }),
    );
    liveGroup();
    callerIsActiveMember();
    mockTx.expense.update.mockResolvedValue(existingExpense());
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    expect(mockTx.expense.update).toHaveBeenCalledWith({
      where: { id: EXPENSE_ID },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it("RESTORE audit kaydinda previousData silinmis, newData geri yuklenmis hali gosterir", async () => {
    mockTx.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: DELETED_AT, deletedById: PAYER_ID }),
    );
    liveGroup();
    callerIsActiveMember();
    mockTx.expense.update.mockResolvedValue(existingExpense());
    mockTx.expense.findUniqueOrThrow.mockResolvedValue({ id: EXPENSE_ID, participants: [] });

    await restoreExpense(CALLER_ID, GROUP_ID, EXPENSE_ID);

    const auditData = mockTx.expenseEdit.create.mock.calls[0][0].data;

    expect(auditData.action).toBe("RESTORE");
    expect(auditData.changedById).toBe(CALLER_ID);

    // Iki snapshot yalnizca silinme durumunda farklilasmali.
    expect(auditData.previousData.deletedAt).toBe(DELETED_AT.toISOString());
    expect(auditData.previousData.deletedById).toBe(PAYER_ID);
    expect(auditData.newData.deletedAt).toBeNull();
    expect(auditData.newData.deletedById).toBeNull();

    // Paylar degismedigi icin iki snapshot'ta da ayni kalmali.
    expect(auditData.newData.participants).toEqual(auditData.previousData.participants);
  });
});

describe("listExpenses", () => {
  beforeEach(() => {
    resetMocks();
  });

  function readableGroup() {
    mockPrisma.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: null,
    });
    mockPrisma.groupMember.findFirst.mockResolvedValue({
      id: "membership-1",
      userId: CALLER_ID,
      role: "MEMBER",
    });
  }

  function fakeExpenses(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      id: `expense-${index}`,
      participants: [],
    }));
  }

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(listExpenses(CALLER_ID, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: new Date() });

    await expect(listExpenses(CALLER_ID, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aktif uye olmayan kullanici listeleyemez", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: null });
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(listExpenses(CALLER_ID, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("olusturan kisi olmasa da grubun her aktif uyesi listeleyebilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue(fakeExpenses(2));

    const result = await listExpenses(CALLER_ID, GROUP_ID);

    expect(result.expenses).toHaveLength(2);
  });

  it("varsayilan olarak silinmis harcamalari haric tutar", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID);

    expect(mockPrisma.expense.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      deletedAt: null,
    });
  });

  it("includeDeleted ile silinmis harcamalar da dahil edilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID, { includeDeleted: true });

    expect(mockPrisma.expense.findMany.mock.calls[0][0].where).toEqual({ groupId: GROUP_ID });
  });

  it("katilimcilar cevaba dahil edilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID);

    expect(mockPrisma.expense.findMany.mock.calls[0][0].include).toEqual({ participants: true });
  });

  it("siralama benzersiz olacak sekilde id ile kesinlestirilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID);

    expect(mockPrisma.expense.findMany.mock.calls[0][0].orderBy).toEqual([
      { expenseDate: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("limit verilmezse varsayilan sayfa boyutu kullanilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID);

    expect(mockPrisma.expense.findMany.mock.calls[0][0].take).toBe(
      DEFAULT_EXPENSE_PAGE_SIZE + 1,
    );
  });

  it("limit ust sinirin uzerine cikamaz", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID, { limit: 5000 });

    expect(mockPrisma.expense.findMany.mock.calls[0][0].take).toBe(MAX_EXPENSE_PAGE_SIZE + 1);
  });

  it("daha fazla kayit varsa nextCursor doner ve fazladan kayit kirpilir", async () => {
    readableGroup();
    // limit=2 istendiginde servis 3 kayit ceker; ucuncusu "daha var" isaretidir.
    mockPrisma.expense.findMany.mockResolvedValue(fakeExpenses(3));

    const result = await listExpenses(CALLER_ID, GROUP_ID, { limit: 2 });

    expect(result.expenses).toHaveLength(2);
    expect(result.nextCursor).toBe("expense-1");
  });

  it("son sayfada nextCursor null doner", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue(fakeExpenses(2));

    const result = await listExpenses(CALLER_ID, GROUP_ID, { limit: 5 });

    expect(result.expenses).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("cursor verilmezse sorguda cursor/skip kullanilmaz", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID);

    const args = mockPrisma.expense.findMany.mock.calls[0][0];
    expect(args).not.toHaveProperty("cursor");
    expect(args).not.toHaveProperty("skip");
  });

  it("cursor verilirse kendisi haric sonraki kayitlardan devam eder", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);

    await listExpenses(CALLER_ID, GROUP_ID, { cursor: "expense-42" });

    const args = mockPrisma.expense.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "expense-42" });
    expect(args.skip).toBe(1);
  });
});

describe("getExpenseForUser", () => {
  beforeEach(() => {
    resetMocks();
  });

  function readableGroup() {
    mockPrisma.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: null,
    });
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1", userId: CALLER_ID });
  }

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(
      getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aktif uye olmayan kullanici goremez", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: null });
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(
      getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("harcama bulunamazsa NotFoundError firlatir", async () => {
    readableGroup();
    mockPrisma.expense.findUnique.mockResolvedValue(null);

    await expect(
      getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("silinmis harcama getirilmez", async () => {
    readableGroup();
    mockPrisma.expense.findUnique.mockResolvedValue(
      existingExpense({ deletedAt: new Date() }),
    );

    await expect(
      getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("baska gruba ait harcama getirilmez", async () => {
    readableGroup();
    mockPrisma.expense.findUnique.mockResolvedValue(
      existingExpense({ groupId: "baska-grup" }),
    );

    await expect(
      getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("harcamayi katilimcilariyla birlikte doner", async () => {
    readableGroup();
    mockPrisma.expense.findUnique.mockResolvedValue(existingExpense());

    const expense = await getExpenseForUser(CALLER_ID, GROUP_ID, EXPENSE_ID);

    expect(expense.id).toBe(EXPENSE_ID);
    expect(expense.participants).toHaveLength(2);
    expect(mockPrisma.expense.findUnique.mock.calls[0][0].include).toEqual({
      participants: true,
    });
  });
});
