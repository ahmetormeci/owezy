import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: yorumun UC sessiz kusurunu.
 *
 *   1. YETKININ GEVSEMESI. Yorum grubun her aktif uyesine acik - ama YALNIZCA
 *      aktif uyesine, ve silmek YALNIZCA yazana.
 *   2. BILDIRIMIN YANLIS KISILERE GITMESI. Harcama bildirimlerinde kural
 *      "bakiyesi degisenler"; yorumda kimsenin bakiyesi degismiyor, yani
 *      alici kumesi baska bir kuraldan geliyor ve o kural buradan baska bir
 *      yerde yazili degil.
 *   3. SILINMIS YORUMUN GERI GORUNMESI. Yumusak silme, filtrenin
 *      unutulabilecegi her yerde bir risktir.
 */

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const tx = {
    expenseComment: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    expense: { findUniqueOrThrow: vi.fn() },
  };
  return {
    mockTx: tx,
    mockPrisma: {
      expense: { findUnique: vi.fn() },
      expenseComment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { mockAssertMember } = vi.hoisted(() => ({ mockAssertMember: vi.fn() }));
vi.mock("@/lib/group-access", () => ({ assertActiveMemberOfGroup: mockAssertMember }));

const { mockCreateNotifications } = vi.hoisted(() => ({ mockCreateNotifications: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: mockCreateNotifications }));

const { listComments, createComment, deleteComment, deleteCommentsWrittenBy } =
  await import("@/lib/comments");
const { MAX_COMMENTS_PER_EXPENSE } = await import("@/lib/comment-schemas");

const USER = "u1";
const EXPENSE = "e1";
const GROUP = "g1";

function liveExpense(overrides: Record<string, unknown> = {}) {
  mockPrisma.expense.findUnique.mockResolvedValue({
    id: EXPENSE,
    groupId: GROUP,
    deletedAt: null,
    description: "Market",
    group: { name: "Ev" },
    ...overrides,
  });
}

function commentRow(index: number, userId = USER) {
  return {
    id: `c${index}`,
    body: `yorum ${index}`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    user: { id: userId, displayName: "Ali", avatarUrl: null, hasImage: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertMember.mockResolvedValue(undefined);
  mockCreateNotifications.mockResolvedValue(null);
  mockTx.expense.findUniqueOrThrow.mockResolvedValue({
    paidById: "payer",
    createdById: "creator",
    participants: [{ userId: "p1" }, { userId: "p2" }],
  });
  mockTx.expenseComment.findMany.mockResolvedValue([]);
  mockTx.expenseComment.create.mockResolvedValue(commentRow(1));
});

describe("listComments", () => {
  it("harcama yoksa NotFoundError", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null);
    await expect(listComments(USER, EXPENSE)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("uyelik dogrulanmadan liste okunmaz", async () => {
    liveExpense();
    mockAssertMember.mockRejectedValue(new ForbiddenError("group.not_member"));
    await expect(listComments(USER, EXPENSE)).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockPrisma.expenseComment.findMany).not.toHaveBeenCalled();
  });

  it("SILINMIS yorumlar sorgunun disinda kaliyor", async () => {
    liveExpense();
    mockPrisma.expenseComment.findMany.mockResolvedValue([]);

    await listComments(USER, EXPENSE);

    expect(mockPrisma.expenseComment.findMany.mock.calls[0][0].where).toEqual({
      expenseId: EXPENSE,
      deletedAt: null,
    });
  });

  /**
   * SILINMIS HARCAMANIN YORUMLARI OKUNABILIYOR. Fis fotografiyla ayni karar:
   * silme geri alinabilir ve satir "silinenleri goster" acikken ekranda.
   */
  it("silinmis harcamanin yorumlari okunabiliyor", async () => {
    liveExpense({ deletedAt: new Date() });
    mockPrisma.expenseComment.findMany.mockResolvedValue([commentRow(1)]);

    const result = await listComments(USER, EXPENSE);

    expect(result.comments).toHaveLength(1);
  });

  it("sinira dayanilirsa liste kirpiliyor ve truncated doner", async () => {
    liveExpense();
    const rows = Array.from({ length: MAX_COMMENTS_PER_EXPENSE + 1 }, (_, i) => commentRow(i));
    mockPrisma.expenseComment.findMany.mockResolvedValue(rows);

    const result = await listComments(USER, EXPENSE);

    expect(result.comments).toHaveLength(MAX_COMMENTS_PER_EXPENSE);
    expect(result.truncated).toBe(true);
    // Kirpildigini anlamanin tek yolu bir fazla cekmek.
    expect(mockPrisma.expenseComment.findMany.mock.calls[0][0].take).toBe(
      MAX_COMMENTS_PER_EXPENSE + 1,
    );
  });

  it("sinira dayanilmadiysa truncated false", async () => {
    liveExpense();
    mockPrisma.expenseComment.findMany.mockResolvedValue([commentRow(1)]);

    const result = await listComments(USER, EXPENSE);

    expect(result.truncated).toBe(false);
  });
});

describe("createComment", () => {
  it("SILINMIS harcamaya yorum yazilamaz", async () => {
    liveExpense({ deletedAt: new Date() });

    await expect(createComment(USER, EXPENSE, "olur mu")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockTx.expenseComment.create).not.toHaveBeenCalled();
  });

  it("uyelik dogrulanmadan yazilmaz", async () => {
    liveExpense();
    mockAssertMember.mockRejectedValue(new ForbiddenError("group.not_member"));

    await expect(createComment(USER, EXPENSE, "olur mu")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.expenseComment.create).not.toHaveBeenCalled();
  });

  it("yazan sunucudan geliyor, govdeden degil", async () => {
    liveExpense();

    await createComment(USER, EXPENSE, "merhaba");

    expect(mockTx.expenseComment.create.mock.calls[0][0].data).toEqual({
      expenseId: EXPENSE,
      userId: USER,
      body: "merhaba",
    });
  });

  /**
   * ALICI KUMESI: katilimcilar + odeyen + olusturan + DAHA ONCE YORUM
   * YAPANLAR. Harcama bildirimlerindeki "yalnizca katilimcilar" kurali
   * burada gecmiyor - yorumda kimsenin bakiyesi degismiyor.
   */
  it("bildirim katilimcilara, odeyene, olusturana ve onceki yorumculara gidiyor", async () => {
    liveExpense();
    mockTx.expenseComment.findMany.mockResolvedValue([{ userId: "onceki" }]);

    await createComment(USER, EXPENSE, "merhaba");

    const call = mockCreateNotifications.mock.calls[0][1];
    expect(call.type).toBe("EXPENSE_COMMENTED");
    expect(call.actorId).toBe(USER);
    expect(new Set(call.recipientIds)).toEqual(
      new Set(["payer", "creator", "p1", "p2", "onceki"]),
    );
  });

  /**
   * ALICILAR YORUM YAZILMADAN ONCE hesaplaniyor. Sonra hesaplansaydi yazan
   * kisi de "onceki yorumcular" listesine girerdi. createNotifications onu
   * zaten eliyor, yani BUGUN sonuc degismezdi - ama liste yanlis olurdu ve
   * yarin baska bir kural eklendiginde sessizce bozulurdu.
   */
  it("alicilar yorum YAZILMADAN once hesaplaniyor", async () => {
    liveExpense();
    const order: string[] = [];
    mockTx.expenseComment.findMany.mockImplementation(async () => {
      order.push("recipients");
      return [];
    });
    mockTx.expenseComment.create.mockImplementation(async () => {
      order.push("create");
      return commentRow(1);
    });

    await createComment(USER, EXPENSE, "merhaba");

    expect(order).toEqual(["recipients", "create"]);
  });

  /**
   * PUSH'A GIREN SEY: grup adi ve olayin turu. Yorumun METNI payload'a hic
   * konmuyor (ADR-047 + ADR-049) - serbest metnin kilit ekraninda ne
   * yazacagini kimse onceden bilemez.
   */
  it("yorumun metni bildirim payload'ina girmiyor", async () => {
    liveExpense();

    await createComment(USER, EXPENSE, "gizli bir sey");

    const payload = mockCreateNotifications.mock.calls[0][1].payload;
    expect(JSON.stringify(payload)).not.toContain("gizli");
    expect(payload).toEqual({
      groupId: GROUP,
      groupName: "Ev",
      expenseId: EXPENSE,
      description: "Market",
    });
  });
});

describe("deleteComment", () => {
  function existingComment(userId: string) {
    mockPrisma.expenseComment.findUnique.mockResolvedValue({
      id: "c1",
      userId,
      deletedAt: null,
      expense: { groupId: GROUP },
    });
  }

  it("yorum yoksa NotFoundError", async () => {
    mockPrisma.expenseComment.findUnique.mockResolvedValue(null);
    await expect(deleteComment(USER, "c1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ZATEN SILINMIS yorum bulunamamis sayiliyor", async () => {
    mockPrisma.expenseComment.findUnique.mockResolvedValue({
      id: "c1",
      userId: USER,
      deletedAt: new Date(),
      expense: { groupId: GROUP },
    });
    await expect(deleteComment(USER, "c1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("BASKASININ yorumu silinemiyor", async () => {
    existingComment("baskasi");
    await expect(deleteComment(USER, "c1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockPrisma.expenseComment.update).not.toHaveBeenCalled();
  });

  it("gruptan ayrilmis biri KENDI yorumunu da silemiyor", async () => {
    existingComment(USER);
    mockAssertMember.mockRejectedValue(new ForbiddenError("group.not_member"));
    await expect(deleteComment(USER, "c1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockPrisma.expenseComment.update).not.toHaveBeenCalled();
  });

  it("yazan kendi yorumunu YUMUSAK siliyor", async () => {
    existingComment(USER);
    await deleteComment(USER, "c1");

    const call = mockPrisma.expenseComment.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "c1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});

describe("deleteCommentsWrittenBy", () => {
  /**
   * HESAP SILMEDE FIZIKSEL SILME - fis fotografiyla ayni gerekce (ADR-046).
   * Yumusak silme metni veritabaninda BIRAKIRDI ve giden sey tam da metnin
   * kendisi.
   */
  it("kullanicinin yorumlari fiziksel olarak siliniyor", async () => {
    mockTx.expenseComment.deleteMany.mockResolvedValue({ count: 3 });

    const count = await deleteCommentsWrittenBy(mockTx as never, USER);

    expect(mockTx.expenseComment.deleteMany).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(count).toBe(3);
  });
});
