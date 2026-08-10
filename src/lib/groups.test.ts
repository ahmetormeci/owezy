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
    groupInvite: { findMany: vi.fn(), findUnique: vi.fn() },
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

const {
  getGroupForUser,
  updateGroup,
  getInviteStatus,
  listGroupInvites,
  revokeGroupInvite,
  listGroupMembers,
  leaveGroup,
  removeGroupMember,
} = await import("@/lib/groups");

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

describe("getGroupForUser", () => {
  beforeEach(resetMocks);

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(getGroupForUser(OWNER, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: new Date() });

    await expect(getGroupForUser(OWNER, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aktif uye olmayan kullanici gruba erisemez", async () => {
    liveGroupPrisma();
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(getGroupForUser(OTHER, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("grubu cagiran kisinin roluyle birlikte doner", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      name: "Ev Arkadaslari",
      description: null,
      currency: "TRY",
      deletedAt: null,
    });
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "OWNER" });

    await expect(getGroupForUser(OWNER, GROUP_ID)).resolves.toEqual({
      id: GROUP_ID,
      name: "Ev Arkadaslari",
      description: null,
      currency: "TRY",
      role: "OWNER",
    });
  });
});

describe("updateGroup", () => {
  beforeEach(resetMocks);

  const validInput = { name: "Yeni ad", description: "Yeni aciklama" };

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockTx.group.findUnique.mockResolvedValue(null);

    await expect(updateGroup(OWNER, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("uye olmayan kullanici guncelleyemez", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(updateGroup(OTHER, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.group.update).not.toHaveBeenCalled();
  });

  it("OWNER olmayan uye guncelleyemez", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m1", role: "MEMBER" });

    await expect(updateGroup(MEMBER, GROUP_ID, validInput)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.group.update).not.toHaveBeenCalled();
  });

  it("grup sahibi ad ve aciklamayi guncelleyebilir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    mockTx.group.update.mockResolvedValue({ id: GROUP_ID, name: "Yeni ad" });

    await updateGroup(OWNER, GROUP_ID, validInput);

    expect(mockTx.group.update).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      data: { name: "Yeni ad", description: "Yeni aciklama" },
    });
  });

  it("currency guncellenmez", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    mockTx.group.update.mockResolvedValue({ id: GROUP_ID });

    await updateGroup(OWNER, GROUP_ID, validInput);

    expect(mockTx.group.update.mock.calls[0][0].data).not.toHaveProperty("currency");
  });

  it("aciklama gonderilmezse temizlenir", async () => {
    liveGroupTx();
    mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-owner", role: "OWNER" });
    mockTx.group.update.mockResolvedValue({ id: GROUP_ID });

    await updateGroup(OWNER, GROUP_ID, { name: "Yeni ad" });

    expect(mockTx.group.update.mock.calls[0][0].data.description).toBeNull();
  });
});

describe("getInviteStatus", () => {
  beforeEach(resetMocks);

  function invite(overrides: Record<string, unknown> = {}) {
    return {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      maxUses: 1,
      useCount: 0,
      group: { name: "Ev Arkadaslari", deletedAt: null },
      ...overrides,
    };
  }

  it("bulunamayan token icin NOT_FOUND doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(null);

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: false,
      reason: "NOT_FOUND",
    });
  });

  it("grubu silinmis davet icin NOT_FOUND doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(
      invite({ group: { name: "Ev", deletedAt: new Date() } }),
    );

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: false,
      reason: "NOT_FOUND",
    });
  });

  it("iptal edilmis davet icin REVOKED doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(invite({ revokedAt: new Date() }));

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: false,
      reason: "REVOKED",
    });
  });

  it("suresi dolmus davet icin EXPIRED doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(
      invite({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("kullanim limiti dolmus davet icin EXHAUSTED doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(
      invite({ maxUses: 1, useCount: 1 }),
    );

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: false,
      reason: "EXHAUSTED",
    });
  });

  it("gecerli davet icin grup adini doner", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(invite());

    await expect(getInviteStatus("token")).resolves.toEqual({
      valid: true,
      groupName: "Ev Arkadaslari",
    });
  });

  it("token'i hash'leyerek arar, ham token ile degil", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(null);

    await getInviteStatus("ham-token");

    const where = mockPrisma.groupInvite.findUnique.mock.calls[0][0].where;
    expect(where.tokenHash).not.toBe("ham-token");
    expect(where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

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
