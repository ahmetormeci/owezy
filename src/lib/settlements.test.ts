import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  DEFAULT_SETTLEMENT_PAGE_SIZE,
  MAX_SETTLEMENT_PAGE_SIZE,
} from "@/lib/settlement-schemas";

const { mockTx, mockPrisma } = vi.hoisted(() => ({
  mockTx: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn(), findMany: vi.fn() },
    settlement: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    // Bildirimler odemeyle AYNI transaction'da yaziliyor.
    user: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
  },
  mockPrisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn() },
    settlement: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
    group: mockPrisma.group,
    groupMember: mockPrisma.groupMember,
    settlement: mockPrisma.settlement,
  },
}));

const { createSettlement, listSettlements, cancelSettlement } = await import(
  "@/lib/settlements"
);

const GROUP_ID = "group-1";
const ALI = "user-ali";
const CAN = "user-can";
const BERK = "user-berk";
const SETTLEMENT_ID = "settlement-1";

const validInput = {
  fromUserId: CAN,
  toUserId: ALI,
  amount: 15000,
};

function resetMocks() {
  mockTx.group.findUnique.mockReset();
  mockTx.groupMember.findFirst.mockReset();
  mockTx.groupMember.findMany.mockReset();
  mockTx.settlement.create.mockReset();
  mockTx.settlement.findUnique.mockReset();
  mockTx.settlement.update.mockReset();
  mockPrisma.group.findUnique.mockReset();
  mockPrisma.groupMember.findFirst.mockReset();
  mockPrisma.settlement.findMany.mockReset();
}

function liveGroup() {
  mockTx.group.findUnique.mockResolvedValue({
    id: GROUP_ID,
    currency: "TRY",
    deletedAt: null,
  });
}

function callerIsActiveMember(role: "OWNER" | "MEMBER" = "MEMBER") {
  mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-caller", role });
}

function bothPartiesAreMembers() {
  mockTx.groupMember.findMany.mockResolvedValue([{ userId: CAN }, { userId: ALI }]);
}

describe("createSettlement", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue(null);

    await expect(createSettlement(CAN, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockTx.settlement.create).not.toHaveBeenCalled();
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: new Date() });

    await expect(createSettlement(CAN, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("kendine odeme kaydi girilemez", async () => {
    liveGroup();

    await expect(
      createSettlement(ALI, GROUP_ID, { fromUserId: ALI, toUserId: ALI, amount: 10000 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockTx.settlement.create).not.toHaveBeenCalled();
  });

  it("aktif uye olmayan kullanici odeme kaydedemez", async () => {
    liveGroup();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(createSettlement(CAN, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.settlement.create).not.toHaveBeenCalled();
  });

  it("odemenin taraflarindan biri olmayan uye kayit olusturamaz", async () => {
    liveGroup();
    callerIsActiveMember();

    // BERK grubun uyesi ama odemenin taraflarindan biri degil.
    await expect(createSettlement(BERK, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.settlement.create).not.toHaveBeenCalled();
  });

  it("odemeyi yapan taraf kendi odemesini kaydedebilir", async () => {
    liveGroup();
    callerIsActiveMember();
    bothPartiesAreMembers();
    mockTx.settlement.create.mockResolvedValue({ id: SETTLEMENT_ID });

    await createSettlement(CAN, GROUP_ID, validInput);

    expect(mockTx.settlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: GROUP_ID,
        fromUserId: CAN,
        toUserId: ALI,
        amount: 15000,
        currency: "TRY",
        createdById: CAN,
      }),
    });
  });

  it("odemeyi alan taraf da kaydi olusturabilir", async () => {
    liveGroup();
    callerIsActiveMember();
    bothPartiesAreMembers();
    mockTx.settlement.create.mockResolvedValue({ id: SETTLEMENT_ID });

    await createSettlement(ALI, GROUP_ID, validInput);

    expect(mockTx.settlement.create.mock.calls[0][0].data.createdById).toBe(ALI);
  });

  it("taraflardan biri grubun uyesi degilse ForbiddenError firlatir", async () => {
    liveGroup();
    callerIsActiveMember();
    // ALI eksik: yalnizca CAN uye olarak donuyor.
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: CAN }]);

    await expect(createSettlement(CAN, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.settlement.create).not.toHaveBeenCalled();
  });

  it("gruptan ayrilmis bir uyeyle odeme kaydedilebilir (borc kapatilabilmeli)", async () => {
    liveGroup();
    callerIsActiveMember();
    // Uyelik sorgusu leftAt filtresi ICERMEMELI - ayrilmis uye de donmeli.
    bothPartiesAreMembers();
    mockTx.settlement.create.mockResolvedValue({ id: SETTLEMENT_ID });

    await createSettlement(ALI, GROUP_ID, validInput);

    expect(mockTx.groupMember.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      userId: { in: [CAN, ALI] },
    });
    expect(mockTx.settlement.create).toHaveBeenCalled();
  });

  it("currency istemciden degil gruptan alinir", async () => {
    mockTx.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "USD",
      deletedAt: null,
    });
    callerIsActiveMember();
    bothPartiesAreMembers();
    mockTx.settlement.create.mockResolvedValue({ id: SETTLEMENT_ID });

    await createSettlement(CAN, GROUP_ID, validInput);

    expect(mockTx.settlement.create.mock.calls[0][0].data.currency).toBe("USD");
  });

  it("settledAt verilmezse bugunun tarihi kullanilir", async () => {
    liveGroup();
    callerIsActiveMember();
    bothPartiesAreMembers();
    mockTx.settlement.create.mockResolvedValue({ id: SETTLEMENT_ID });

    const before = Date.now();
    await createSettlement(CAN, GROUP_ID, validInput);
    const after = Date.now();

    const usedDate = mockTx.settlement.create.mock.calls[0][0].data.settledAt as Date;
    expect(usedDate.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(usedDate.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});

describe("listSettlements", () => {
  beforeEach(() => {
    resetMocks();
  });

  function readableGroup() {
    mockPrisma.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: null,
    });
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m-caller" });
  }

  function fakeSettlements(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `settlement-${index}` }));
  }

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(listSettlements(ALI, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockPrisma.settlement.findMany).not.toHaveBeenCalled();
  });

  it("aktif uye olmayan kullanici listeleyemez", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: null });
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(listSettlements(ALI, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("varsayilan olarak iptal edilmis kayitlari haric tutar", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID);

    expect(mockPrisma.settlement.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      cancelledAt: null,
    });
  });

  it("includeCancelled ile iptal edilmisler de dahil edilir", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID, { includeCancelled: true });

    expect(mockPrisma.settlement.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
    });
  });

  it("siralama benzersiz olacak sekilde id ile kesinlestirilir", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID);

    expect(mockPrisma.settlement.findMany.mock.calls[0][0].orderBy).toEqual([
      { settledAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("limit verilmezse varsayilan sayfa boyutu kullanilir", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID);

    expect(mockPrisma.settlement.findMany.mock.calls[0][0].take).toBe(
      DEFAULT_SETTLEMENT_PAGE_SIZE + 1,
    );
  });

  it("limit ust sinirin uzerine cikamaz", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID, { limit: 5000 });

    expect(mockPrisma.settlement.findMany.mock.calls[0][0].take).toBe(
      MAX_SETTLEMENT_PAGE_SIZE + 1,
    );
  });

  it("daha fazla kayit varsa nextCursor doner ve fazlalik kirpilir", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue(fakeSettlements(3));

    const result = await listSettlements(ALI, GROUP_ID, { limit: 2 });

    expect(result.settlements).toHaveLength(2);
    expect(result.nextCursor).toBe("settlement-1");
  });

  it("son sayfada nextCursor null doner", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue(fakeSettlements(2));

    const result = await listSettlements(ALI, GROUP_ID, { limit: 5 });

    expect(result.nextCursor).toBeNull();
  });

  it("cursor verilirse kendisi haric sonraki kayitlardan devam eder", async () => {
    readableGroup();
    mockPrisma.settlement.findMany.mockResolvedValue([]);

    await listSettlements(ALI, GROUP_ID, { cursor: "settlement-42" });

    const args = mockPrisma.settlement.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "settlement-42" });
    expect(args.skip).toBe(1);
  });
});

describe("cancelSettlement", () => {
  beforeEach(() => {
    resetMocks();
  });

  function existingSettlement(overrides: Record<string, unknown> = {}) {
    return {
      id: SETTLEMENT_ID,
      groupId: GROUP_ID,
      fromUserId: CAN,
      toUserId: ALI,
      amount: 15000,
      createdById: CAN,
      cancelledAt: null,
      ...overrides,
    };
  }

  it("kayit bulunamazsa NotFoundError firlatir", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(null);

    await expect(cancelSettlement(CAN, GROUP_ID, SETTLEMENT_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockTx.settlement.update).not.toHaveBeenCalled();
  });

  it("kayit baska bir gruba aitse NotFoundError firlatir", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(
      existingSettlement({ groupId: "baska-grup" }),
    );

    await expect(cancelSettlement(CAN, GROUP_ID, SETTLEMENT_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("zaten iptal edilmis kayit tekrar iptal edilemez", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(
      existingSettlement({ cancelledAt: new Date() }),
    );

    await expect(cancelSettlement(CAN, GROUP_ID, SETTLEMENT_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockTx.settlement.update).not.toHaveBeenCalled();
  });

  it("kaydi olusturmayan uye iptal edemez", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(existingSettlement());
    liveGroup();
    // Cagiran ALI (odemenin tarafi ama kaydi CAN olusturmus), CAN hala aktif uye.
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller", role: "MEMBER" })
      .mockResolvedValueOnce({ id: "m-creator" });

    await expect(cancelSettlement(ALI, GROUP_ID, SETTLEMENT_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.settlement.update).not.toHaveBeenCalled();
  });

  it("olusturan kisi hala gruptaysa OWNER bile iptal edemez", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(existingSettlement());
    liveGroup();
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller", role: "OWNER" })
      .mockResolvedValueOnce({ id: "m-creator" });

    await expect(cancelSettlement(ALI, GROUP_ID, SETTLEMENT_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("olusturan kisi gruptan ayrildiysa OWNER iptal edebilir", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(existingSettlement());
    liveGroup();
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller", role: "OWNER" })
      .mockResolvedValueOnce(null); // olusturan kisi artik aktif uye degil
    mockTx.settlement.update.mockResolvedValue(existingSettlement({ cancelledAt: new Date() }));

    await cancelSettlement(ALI, GROUP_ID, SETTLEMENT_ID);

    expect(mockTx.settlement.update.mock.calls[0][0].data.cancelledById).toBe(ALI);
  });

  it("olusturan kisi kaydi iptal edebilir, fiziksel silme yapilmaz", async () => {
    mockTx.settlement.findUnique.mockResolvedValue(existingSettlement());
    liveGroup();
    callerIsActiveMember();
    mockTx.settlement.update.mockResolvedValue(existingSettlement({ cancelledAt: new Date() }));

    await cancelSettlement(CAN, GROUP_ID, SETTLEMENT_ID);

    const updateData = mockTx.settlement.update.mock.calls[0][0].data;
    expect(updateData.cancelledById).toBe(CAN);
    expect(updateData.cancelledAt).toBeInstanceOf(Date);
  });
});
