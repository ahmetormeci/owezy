import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { mockTx, mockPrisma } = vi.hoisted(() => ({
  mockTx: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    groupMember: { findMany: vi.fn(), update: vi.fn() },
    group: { updateMany: vi.fn() },
  },
  mockPrisma: {
    user: { updateMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
    user: mockPrisma.user,
  },
}));

const { syncUserFromClerk, markUserDeletedFromClerk } = await import("@/lib/clerk-sync");

const CLERK_ID = "user_clerk_1";
const USER_ID = "db-user-1";
const UPDATED_AT = Date.UTC(2026, 7, 11, 12, 0, 0);

function clerkPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: CLERK_ID,
    email_addresses: [
      { id: "email-0", email_address: "eski@example.com" },
      { id: "email-1", email_address: "ahmet@example.com" },
    ],
    primary_email_address_id: "email-1",
    first_name: "Ahmet",
    last_name: "Ormeci",
    image_url: "https://img.example.com/a.png",
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.9.0",
    meta: { modelName: "User", target: ["clerkId"] },
  });
}

beforeEach(() => {
  for (const model of Object.values(mockTx)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  for (const model of Object.values(mockPrisma)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
});

describe("syncUserFromClerk", () => {
  it("kayit yoksa birincil e-posta ile olusturur", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: USER_ID });

    await syncUserFromClerk(clerkPayload());

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        clerkId: CLERK_ID,
        // Listedeki ilk e-posta degil, primary_email_address_id ile eslesen.
        email: "ahmet@example.com",
        displayName: "Ahmet Ormeci",
        avatarUrl: "https://img.example.com/a.png",
        hasImage: null,
        clerkUpdatedAt: new Date(UPDATED_AT),
      },
    });
  });

  // NEDEN AYRI BIR ALAN: Clerk, fotograf YUKLEMEMIS kullaniciya da bir
  // image_url veriyor (kendi urettigi bas-harf gorseli). Yani image_url'in
  // varligi "fotografi var" demek degil; arayuz bu ayrimi hasImage'den
  // ogreniyor ve olmayanlara BIZIM bas-harf dairemizi gosteriyor.
  it("fotograf bilgisini oldugu gibi tasir", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await syncUserFromClerk(clerkPayload({ has_image: true }));
    expect(mockPrisma.user.updateMany.mock.calls[0][0].data.hasImage).toBe(true);

    mockPrisma.user.updateMany.mockClear();
    await syncUserFromClerk(clerkPayload({ has_image: false }));
    expect(mockPrisma.user.updateMany.mock.calls[0][0].data.hasImage).toBe(false);
  });

  it("olay bu alani hic tasimiyorsa 'bilmiyorum' yazar", async () => {
    // Clerk'in eski bir surumunden gelen olayda has_image olmayabilir.
    // false yazsaydik "fotografi yok" demis olurduk; null "bilmiyorum".
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await syncUserFromClerk(clerkPayload());

    expect(mockPrisma.user.updateMany.mock.calls[0][0].data.hasImage).toBeNull();
  });

  it("kayit varsa gunceller ve olusturmaya calismaz", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await syncUserFromClerk(clerkPayload({ first_name: "Yeni", last_name: "Ad" }));

    expect(mockPrisma.user.updateMany.mock.calls[0][0].data).toEqual({
      email: "ahmet@example.com",
      displayName: "Yeni Ad",
      avatarUrl: "https://img.example.com/a.png",
      hasImage: null,
      clerkUpdatedAt: new Date(UPDATED_AT),
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  // Sirasiz teslimat korumasi: bu iki kural tek bir where kosuluna gomulu,
  // o yuzden kosulun icerigini dogruluyoruz.
  it("guncelleme kosulu silinmis kaydi ve eski olayi disarida birakir", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await syncUserFromClerk(clerkPayload());

    expect(mockPrisma.user.updateMany.mock.calls[0][0].where).toEqual({
      clerkId: CLERK_ID,
      deletedAt: null,
      OR: [{ clerkUpdatedAt: null }, { clerkUpdatedAt: { lt: new Date(UPDATED_AT) } }],
    });
  });

  it("kayit varken guncelleme uygulanmadiysa (silinmis ya da eski olay) yeni kayit acmaz", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID });

    await syncUserFromClerk(clerkPayload());

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("olusturma sirasinda yaris kaybedilirse (P2002) hata firlatmaz", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(syncUserFromClerk(clerkPayload())).resolves.toBeUndefined();
  });

  it("P2002 disindaki hatalari yutmaz", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError("FK hatasi", {
      code: "P2003",
      clientVersion: "7.9.0",
    });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(failure);

    await expect(syncUserFromClerk(clerkPayload())).rejects.toBe(failure);
  });

  it("ad soyad yoksa gorunen ad olarak e-postayi kullanir", async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    await syncUserFromClerk(clerkPayload({ first_name: null, last_name: null }));

    expect(mockPrisma.user.updateMany.mock.calls[0][0].data.displayName).toBe(
      "ahmet@example.com",
    );
  });

  it("e-postasi olmayan kullaniciyi sessizce atlar", async () => {
    await syncUserFromClerk(
      clerkPayload({ email_addresses: [], primary_email_address_id: null }),
    );

    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});

describe("markUserDeletedFromClerk", () => {
  /**
   * groupMember.findMany iki kez cagriliyor: once silinen kullanicinin
   * uyelikleri, sonra her grup icin DIGER aktif uyeler. Ikisini ayirt eden
   * isaret, ikinci sorgunun userId'yi "not" ile disarida birakmasi.
   */
  function setupMemberships(
    own: { id: string; groupId: string; role: "OWNER" | "MEMBER" }[],
    others: { id: string }[] = [],
  ) {
    mockTx.groupMember.findMany.mockImplementation(
      (args: { where: { userId?: string | { not: string } } }) => {
        const userId = args.where.userId;
        const isOthersQuery = typeof userId === "object" && userId !== null;
        return Promise.resolve(isOthersQuery ? others : own);
      },
    );
  }

  it("hic gormedigimiz kullanici icin hicbir sey yapmaz", async () => {
    mockTx.user.findUnique.mockResolvedValue(null);

    await markUserDeletedFromClerk(CLERK_ID);

    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("zaten silinmis kullanici icin tekrar islem yapmaz", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: new Date() });

    await markUserDeletedFromClerk(CLERK_ID);

    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("kisisel bilgileri temizler ama satiri ve clerkId'yi korur", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships([]);

    await markUserDeletedFromClerk(CLERK_ID);

    const call = mockTx.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: USER_ID });
    expect(call.data.email).toBe(`deleted+${USER_ID}@deleted.invalid`);
    expect(call.data.displayName).toBe("Silinmiş kullanıcı");
    expect(call.data.avatarUrl).toBeNull();
    // Fotograf da anonimlestirmenin parcasi: avatarUrl silinip hasImage true
    // kalsaydi arayuz olmayan bir goruntuyu gostermeye calisirdi.
    expect(call.data.hasImage).toBeNull();
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    // clerkId'ye dokunulmamali: tekrar gelen silme olayi satiri bulabilmeli.
    expect(call.data).not.toHaveProperty("clerkId");
  });

  it("OWNER ise sahipligi en eski aktif uyeye devreder", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships([{ id: "membership-1", groupId: "group-1", role: "OWNER" }], [
      { id: "membership-2" },
      { id: "membership-3" },
    ]);

    await markUserDeletedFromClerk(CLERK_ID);

    expect(mockTx.groupMember.update).toHaveBeenCalledWith({
      where: { id: "membership-2" },
      data: { role: "OWNER" },
    });
  });

  it("devralacak uye sorgusu joinedAt ve id'ye gore siralanir", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships(
      [{ id: "membership-1", groupId: "group-1", role: "OWNER" }],
      [{ id: "membership-2" }],
    );

    await markUserDeletedFromClerk(CLERK_ID);

    const otherMembersQuery = mockTx.groupMember.findMany.mock.calls[1][0];
    expect(otherMembersQuery.orderBy).toEqual([{ joinedAt: "asc" }, { id: "asc" }]);
  });

  it("uye (OWNER degil) ise sahiplik devri yapmaz", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships(
      [{ id: "membership-1", groupId: "group-1", role: "MEMBER" }],
      [{ id: "membership-2" }],
    );

    await markUserDeletedFromClerk(CLERK_ID);

    const roleUpdates = mockTx.groupMember.update.mock.calls.filter(
      (call) => call[0].data.role,
    );
    expect(roleUpdates).toHaveLength(0);
  });

  it("aktif uyeliklerini kapatir", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships(
      [{ id: "membership-1", groupId: "group-1", role: "MEMBER" }],
      [{ id: "membership-2" }],
    );

    await markUserDeletedFromClerk(CLERK_ID);

    const leftUpdate = mockTx.groupMember.update.mock.calls.find(
      (call) => call[0].data.leftAt,
    );
    expect(leftUpdate?.[0].where).toEqual({ id: "membership-1" });
  });

  it("gruptaki son aktif uyeyse grubu arsivler", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships([{ id: "membership-1", groupId: "group-1", role: "OWNER" }], []);

    await markUserDeletedFromClerk(CLERK_ID);

    expect(mockTx.group.updateMany).toHaveBeenCalledWith({
      // deletedAt: null kosulu, zaten arsivlenmis grubun tarihini ezmesin diye.
      where: { id: "group-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("baska aktif uye varken grubu arsivlemez", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });
    setupMemberships(
      [{ id: "membership-1", groupId: "group-1", role: "OWNER" }],
      [{ id: "membership-2" }],
    );

    await markUserDeletedFromClerk(CLERK_ID);

    expect(mockTx.group.updateMany).not.toHaveBeenCalled();
  });
});
