import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

const { mockTx, mockPrisma } = vi.hoisted(() => ({
  mockTx: {
    group: { findUnique: vi.fn(), update: vi.fn() },
    groupMember: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    groupInvite: { findUnique: vi.fn(), update: vi.fn() },
    expense: { findMany: vi.fn() },
    settlement: { findMany: vi.fn() },
  },
  mockPrisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn(), findMany: vi.fn() },
    groupInvite: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
    group: mockPrisma.group,
    groupMember: mockPrisma.groupMember,
    groupInvite: mockPrisma.groupInvite,
  },
}));

const { listGroupInvites, revokeGroupInvite, listGroupMembers, leaveGroup, removeGroupMember } =
  await import("@/lib/groups");

const GROUP_ID = "group-1";
const OWNER = "user-owner";
const MEMBER = "user-member";
const OTHER = "user-other";
const INVITE_ID = "invite-1";

function resetMocks() {
  for (const model of Object.values(mockTx)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  for (const model of Object.values(mockPrisma)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
}

function liveGroupTx() {
  mockTx.group.findUnique.mockResolvedValue({ id: GROUP_ID, currency: "TRY", deletedAt: null });
}

function liveGroupPrisma() {
  mockPrisma.group.findUnique.mockResolvedValue({
    id: GROUP_ID,
    currency: "TRY",
    deletedAt: null,
  });
}

// Bakiyesi sifir olan bir grup: hic harcama ve odeme yok.
function noOutstandingBalances() {
  mockTx.expense.findMany.mockResolvedValue([]);
  mockTx.settlement.findMany.mockResolvedValue([]);
}

// MEMBER'in 5000 kurus borcu olan bir grup.
function memberOwesMoney() {
  mockTx.expense.findMany.mockResolvedValue([
    {
      paidById: OWNER,
      amount: 5000,
      participants: [{ userId: MEMBER, shareAmount: 5000 }],
    },
  ]);
  mockTx.settlement.findMany.mockResolvedValue([]);
}

describe("listGroupInvites", () => {
  beforeEach(resetMocks);

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(listGroupInvites(OWNER, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aktif uye olmayan kullanici listeleyemez", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(listGroupInvites(OWNER, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("tokenHash'i ASLA disari vermez", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "OWNER" });
    mockPrisma.groupInvite.findMany.mockResolvedValue([]);

    await listGroupInvites(OWNER, GROUP_ID);

    const select = mockPrisma.groupInvite.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("tokenHash");
    expect(select.id).toBe(true);
  });

  it("yalnizca iptal edilmemis ve suresi dolmamis davetleri getirir", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "OWNER" });
    mockPrisma.groupInvite.findMany.mockResolvedValue([]);

    await listGroupInvites(OWNER, GROUP_ID);

    const where = mockPrisma.groupInvite.findMany.mock.calls[0][0].where;
    expect(where.groupId).toBe(GROUP_ID);
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });
});

describe("revokeGroupInvite", () => {
  beforeEach(resetMocks);

  function existingInvite(overrides: Record<string, unknown> = {}) {
    return {
      id: INVITE_ID,
      groupId: GROUP_ID,
      invitedById: MEMBER,
      revokedAt: null,
      ...overrides,
    };
  }

  it("davet bulunamazsa NotFoundError firlatir", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(null);

    await expect(revokeGroupInvite(OWNER, GROUP_ID, INVITE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("davet baska bir gruba aitse NotFoundError firlatir", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(existingInvite({ groupId: "baska-grup" }));

    await expect(revokeGroupInvite(OWNER, GROUP_ID, INVITE_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("zaten iptal edilmis davet tekrar iptal edilemez", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(existingInvite({ revokedAt: new Date() }));

    await expect(revokeGroupInvite(OWNER, GROUP_ID, INVITE_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockTx.groupInvite.update).not.toHaveBeenCalled();
  });

  it("daveti olusturan kisi iptal edebilir", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(existingInvite());
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });
    mockTx.groupInvite.update.mockResolvedValue({ id: INVITE_ID, revokedAt: new Date() });

    await revokeGroupInvite(MEMBER, GROUP_ID, INVITE_ID);

    expect(mockTx.groupInvite.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
  });

  it("grup sahibi, baskasinin olusturdugu daveti de iptal edebilir", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(existingInvite({ invitedById: MEMBER }));
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    mockTx.groupInvite.update.mockResolvedValue({ id: INVITE_ID, revokedAt: new Date() });

    await revokeGroupInvite(OWNER, GROUP_ID, INVITE_ID);

    expect(mockTx.groupInvite.update).toHaveBeenCalled();
  });

  it("ne olusturan ne sahip olan uye iptal edemez", async () => {
    mockTx.groupInvite.findUnique.mockResolvedValue(existingInvite({ invitedById: MEMBER }));
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-other", role: "MEMBER" });

    await expect(revokeGroupInvite(OTHER, GROUP_ID, INVITE_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.groupInvite.update).not.toHaveBeenCalled();
  });
});

describe("listGroupMembers", () => {
  beforeEach(resetMocks);

  it("yalnizca aktif uyeleri getirir", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1" });
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    await listGroupMembers(OWNER, GROUP_ID);

    expect(mockPrisma.groupMember.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      leftAt: null,
    });
  });

  it("kullanici bilgilerini duzlestirerek doner", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1" });
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        userId: OWNER,
        role: "OWNER",
        joinedAt: new Date("2026-08-01"),
        user: { displayName: "Ali", avatarUrl: null },
      },
    ]);

    const members = await listGroupMembers(OWNER, GROUP_ID);

    expect(members).toEqual([
      {
        userId: OWNER,
        role: "OWNER",
        joinedAt: new Date("2026-08-01"),
        displayName: "Ali",
        avatarUrl: null,
      },
    ]);
  });
});

describe("leaveGroup", () => {
  beforeEach(resetMocks);

  it("uye olmayan kullanici ayrilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(leaveGroup(MEMBER, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("acik borcu olan uye ayrilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });
    memberOwesMoney();

    await expect(leaveGroup(MEMBER, GROUP_ID)).rejects.toBeInstanceOf(ConflictError);
    expect(mockTx.groupMember.update).not.toHaveBeenCalled();
  });

  it("acik alacagi olan uye de ayrilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });
    mockTx.expense.findMany.mockResolvedValue([
      {
        paidById: MEMBER,
        amount: 5000,
        participants: [{ userId: OTHER, shareAmount: 5000 }],
      },
    ]);
    mockTx.settlement.findMany.mockResolvedValue([]);

    await expect(leaveGroup(MEMBER, GROUP_ID)).rejects.toBeInstanceOf(ConflictError);
  });

  it("bakiyesi kapali siradan uye ayrilabilir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });
    noOutstandingBalances();
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: OWNER }]);
    mockTx.groupMember.update.mockResolvedValue({ id: "m1", leftAt: new Date() });

    await leaveGroup(MEMBER, GROUP_ID);

    expect(mockTx.groupMember.update.mock.calls[0][0].data.leftAt).toBeInstanceOf(Date);
    // Baska uye kaldigi icin grup arsivlenmemeli.
    expect(mockTx.group.update).not.toHaveBeenCalled();
  });

  it("grup sahibi, arkasinda uye birakiyorsa sahiplik devretmeden ayrilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    noOutstandingBalances();
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: MEMBER }]);

    await expect(leaveGroup(OWNER, GROUP_ID)).rejects.toBeInstanceOf(ConflictError);
    expect(mockTx.groupMember.update).not.toHaveBeenCalled();
  });

  it("sahipligin devredilecegi kisi aktif uye degilse hata verir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    noOutstandingBalances();
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: MEMBER }]);

    await expect(leaveGroup(OWNER, GROUP_ID, OTHER)).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockTx.groupMember.updateMany).not.toHaveBeenCalled();
  });

  it("grup sahibi sahipligi devrederek ayrilabilir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    noOutstandingBalances();
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: MEMBER }]);
    mockTx.groupMember.update.mockResolvedValue({ id: "m-owner", leftAt: new Date() });

    await leaveGroup(OWNER, GROUP_ID, MEMBER);

    expect(mockTx.groupMember.updateMany).toHaveBeenCalledWith({
      where: { groupId: GROUP_ID, userId: MEMBER, leftAt: null },
      data: { role: "OWNER" },
    });
    expect(mockTx.groupMember.update).toHaveBeenCalled();
  });

  it("son aktif uye ayrilirsa grup arsivlenir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    noOutstandingBalances();
    mockTx.groupMember.findMany.mockResolvedValue([]); // baska aktif uye yok
    mockTx.groupMember.update.mockResolvedValue({ id: "m-owner", leftAt: new Date() });
    mockTx.group.update.mockResolvedValue({ id: GROUP_ID, deletedAt: new Date() });

    await leaveGroup(OWNER, GROUP_ID);

    expect(mockTx.group.update).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      data: { deletedAt: expect.any(Date) },
    });
    // Tek kisi kaldiysa sahiplik devri istenmemeli.
    expect(mockTx.groupMember.updateMany).not.toHaveBeenCalled();
  });
});

describe("removeGroupMember", () => {
  beforeEach(resetMocks);

  it("uye olmayan kullanici kimseyi cikaramaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(removeGroupMember(OTHER, GROUP_ID, MEMBER)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("OWNER olmayan uye kimseyi cikaramaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });

    await expect(removeGroupMember(MEMBER, GROUP_ID, OTHER)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.groupMember.update).not.toHaveBeenCalled();
  });

  it("grup sahibi kendini cikaramaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });

    await expect(removeGroupMember(OWNER, GROUP_ID, OWNER)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("aktif uye olmayan biri cikarilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-owner", role: "OWNER" })
      .mockResolvedValueOnce(null);

    await expect(removeGroupMember(OWNER, GROUP_ID, MEMBER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("acik bakiyesi olan uye cikarilamaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-owner", role: "OWNER" })
      .mockResolvedValueOnce({ id: "m-target", role: "MEMBER" });
    memberOwesMoney();

    await expect(removeGroupMember(OWNER, GROUP_ID, MEMBER)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(mockTx.groupMember.update).not.toHaveBeenCalled();
  });

  it("bakiyesi kapali uye cikarilabilir ve fiziksel silme yapilmaz", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-owner", role: "OWNER" })
      .mockResolvedValueOnce({ id: "m-target", role: "MEMBER" });
    noOutstandingBalances();
    mockTx.groupMember.update.mockResolvedValue({ id: "m-target", leftAt: new Date() });

    await removeGroupMember(OWNER, GROUP_ID, MEMBER);

    expect(mockTx.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m-target" },
      data: { leftAt: expect.any(Date) },
    });
  });
});
