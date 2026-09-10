import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: calistiricinin DORT sessiz kusurunu.
 *
 *   1. CIFT URETIM. Iki kosu ayni donemi alirsa grup ayni kirayi iki kez
 *      oder. Koruma bir compare-and-set ve JS'te "if" ile yapilmiyor.
 *   2. PARANIN SESSIZCE YENIDEN DAGILMASI. Katilimcilardan biri gruptan
 *      ayrildiysa sablon DURUYOR - o kisiyi bolusumden cikarmak, kalanlarin
 *      uzerine pay bindirmek olurdu.
 *   3. YANLIS TARIH. Uretilen harcamanin tarihi DONEMIN tarihi, bugun degil;
 *      yakalama sirasinda gecmis donemler dogru aya dusmeli.
 *   4. YAKALAMANIN SONSUZ DONMESI. Sinir olmasa, yillar once baslamis bir
 *      sablon tek cagrida yuzlerce harcama uretirdi.
 */

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const tx = {
    recurringExpense: { updateMany: vi.fn(), create: vi.fn() },
    expense: { create: vi.fn() },
    expenseParticipant: { createMany: vi.fn() },
    group: { findUnique: vi.fn() },
    groupMember: { findMany: vi.fn() },
  };
  return {
    mockTx: tx,
    mockPrisma: {
      recurringExpense: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      groupMember: { findMany: vi.fn() },
      group: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { mockAssertMember, mockAssertCanModify } = vi.hoisted(() => ({
  mockAssertMember: vi.fn(),
  mockAssertCanModify: vi.fn(),
}));
vi.mock("@/lib/group-access", () => ({
  assertActiveMemberOfGroup: mockAssertMember,
  assertCanModifyRecord: mockAssertCanModify,
}));

const { mockCreateNotifications } = vi.hoisted(() => ({ mockCreateNotifications: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: mockCreateNotifications }));

const {
  runDueRecurringExpenses,
  createRecurringExpense,
  setRecurringPaused,
  deleteRecurringExpense,
  deactivateRecurringFor,
} = await import("@/lib/recurring");

const USER = "u1";
const OTHER = "u2";
const GROUP = "g1";
const ID = "r1";
const d = (iso: string) => new Date(iso + "T00:00:00.000Z");

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    groupId: GROUP,
    description: "Kira",
    amount: 500000,
    currency: "TRY",
    category: "BILLS",
    splitType: "EQUAL",
    interval: "MONTHLY",
    startsOn: d("2026-09-01"),
    nextRunOn: d("2026-09-01"),
    pausedAt: null,
    lastRunAt: null,
    paidById: USER,
    createdById: USER,
    shares: [
      { userId: USER, shareAmount: 250000, basisPoints: null },
      { userId: OTHER, shareAmount: 250000, basisPoints: null },
    ],
    group: { name: "Ev", deletedAt: null },
    ...overrides,
  };
}

/** Sablonu bir kez uretime hazir gosterir, sonra "vadesi gecmedi" der. */
function dueOnce(overrides: Record<string, unknown> = {}) {
  mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
  mockPrisma.recurringExpense.findUnique
    .mockResolvedValueOnce(template(overrides))
    .mockResolvedValue(template({ ...overrides, nextRunOn: d("2027-01-01") }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.recurringExpense.findMany.mockResolvedValue([]);
  mockPrisma.groupMember.findMany.mockResolvedValue([
    { userId: USER },
    { userId: OTHER },
  ]);
  mockTx.recurringExpense.updateMany.mockResolvedValue({ count: 1 });
  mockTx.expense.create.mockResolvedValue({ id: "e1" });
  mockPrisma.recurringExpense.updateMany.mockResolvedValue({ count: 1 });
});

describe("uretim", () => {
  it("vadesi gelen sablondan bir harcama uretiyor", async () => {
    dueOnce();
    const report = await runDueRecurringExpenses(d("2026-09-10"));

    expect(report.created).toBe(1);
    expect(mockTx.expense.create).toHaveBeenCalledTimes(1);
  });

  it("uretilen harcamanin TARIHI DONEMIN tarihi, bugun DEGIL", async () => {
    // Yakalama sirasinda gecmis donemler dogru aya dusmeli; bugunu yazsaydik
    // uc aylik bir yakalama uc harcamayi da bu aya yigardi.
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));

    const data = mockTx.expense.create.mock.calls[0][0].data;
    expect(data.expenseDate.toISOString()).toBe(d("2026-09-01").toISOString());
  });

  it("uretilen harcama SABLONA baglaniyor", async () => {
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));
    expect(mockTx.expense.create.mock.calls[0][0].data.recurringExpenseId).toBe(ID);
  });

  it("OLUSTURAN sablonu kuran kisi - duzenleme yetkisi orada kalsin", async () => {
    dueOnce({ createdById: OTHER });
    await runDueRecurringExpenses(d("2026-09-10"));
    expect(mockTx.expense.create.mock.calls[0][0].data.createdById).toBe(OTHER);
  });

  it("paylar sablondan AYNEN geciyor - yeniden hesaplanmiyor", async () => {
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));

    const rows = mockTx.expenseParticipant.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userId: USER, shareAmount: 250000 });
  });

  it("bildirim EXPENSE_RECURRED ve olusturan HARIC herkese", async () => {
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));

    const input = mockCreateNotifications.mock.calls[0][1];
    expect(input.type).toBe("EXPENSE_RECURRED");
    // actorId olusturan: createNotifications onu zaten eliyor, yani kendi
    // kurdugu takvim icin ona haber gitmiyor.
    expect(input.actorId).toBe(USER);
    expect(input.recipientIds).toEqual([USER, OTHER]);
  });

  it("vadesi GELMEMIS sablon icin hicbir sey uretmiyor", async () => {
    mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
    mockPrisma.recurringExpense.findUnique.mockResolvedValue(
      template({ nextRunOn: d("2026-10-01") }),
    );

    const report = await runDueRecurringExpenses(d("2026-09-10"));
    expect(report.created).toBe(0);
    expect(mockTx.expense.create).not.toHaveBeenCalled();
  });
});

describe("cift uretim korumasi", () => {
  it("donemi baska bir kosu almissa HICBIR SEY yazilmiyor", async () => {
    // NEGATIF KONTROL: compare-and-set kaldirilirsa bu test duser ve grup
    // ayni kirayi iki kez oder.
    dueOnce();
    mockTx.recurringExpense.updateMany.mockResolvedValue({ count: 0 });

    const report = await runDueRecurringExpenses(d("2026-09-10"));

    expect(report.created).toBe(0);
    expect(mockTx.expense.create).not.toHaveBeenCalled();
  });

  it("sahiplenme kosulu DONEMIN KENDISINE bakiyor", async () => {
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));

    const where = mockTx.recurringExpense.updateMany.mock.calls[0][0].where;
    expect(where.id).toBe(ID);
    expect(where.nextRunOn.toISOString()).toBe(d("2026-09-01").toISOString());
    expect(where.pausedAt).toBeNull();
    expect(where.deletedAt).toBeNull();
  });

  it("sahiplenirken nextRunOn BIR SONRAKI doneme ilerliyor", async () => {
    dueOnce();
    await runDueRecurringExpenses(d("2026-09-10"));

    const data = mockTx.recurringExpense.updateMany.mock.calls[0][0].data;
    expect(data.nextRunOn.toISOString()).toBe(d("2026-10-01").toISOString());
  });
});

describe("katilimci gruptan ayrildiysa", () => {
  it("sablon DURUYOR ve harcama URETILMIYOR", async () => {
    // NEGATIF KONTROL: bu dal duserse ayrilan kisinin payi sessizce
    // kalanlarin uzerine biner.
    dueOnce();
    mockPrisma.groupMember.findMany.mockResolvedValue([{ userId: USER }]);

    const report = await runDueRecurringExpenses(d("2026-09-10"));

    expect(report.created).toBe(0);
    expect(report.paused).toBe(1);
    expect(mockTx.expense.create).not.toHaveBeenCalled();
    // Duraklatma da bir TRANSACTION icinde: duraklatma ile bildirim ya
    // birlikte olur ya hic. Yalnizca biri yazilsaydi ya sessizce durur ya
    // da durmadigi halde "durduruldu" denirdi.
    expect(mockTx.recurringExpense.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: ID }) }),
    );
  });

  it("sablonu KURAN kisiye haber veriyor", async () => {
    dueOnce();
    mockPrisma.groupMember.findMany.mockResolvedValue([{ userId: USER }]);

    await runDueRecurringExpenses(d("2026-09-10"));

    const input = mockCreateNotifications.mock.calls[0][1];
    expect(input.type).toBe("RECURRING_PAUSED");
    expect(input.recipientIds).toEqual([USER]);
    // Cumlenin OZNESI ayrilan kisi: "Ayse gruptan ayrildigi icin ...".
    expect(input.actorId).toBe(OTHER);
  });

  it("ODEYEN ayrildiysa da duruyor - yalnizca katilimcilara bakmiyor", async () => {
    dueOnce({ paidById: "u3" });
    mockPrisma.groupMember.findMany.mockResolvedValue([
      { userId: USER },
      { userId: OTHER },
    ]);

    const report = await runDueRecurringExpenses(d("2026-09-10"));
    expect(report.paused).toBe(1);
  });

  it("ZATEN duraklatilmissa ikinci bir bildirim gondermiyor", async () => {
    dueOnce();
    mockPrisma.groupMember.findMany.mockResolvedValue([{ userId: USER }]);
    mockTx.recurringExpense.updateMany.mockResolvedValue({ count: 0 });

    await runDueRecurringExpenses(d("2026-09-10"));
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });
});

describe("yakalama", () => {
  it("kacirilan donemleri sirayla uretiyor", async () => {
    // Uc ay once baslamis bir sablon: her turda bir donem ilerliyor.
    mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
    mockPrisma.recurringExpense.findUnique
      .mockResolvedValueOnce(template({ nextRunOn: d("2026-07-01") }))
      .mockResolvedValueOnce(template({ nextRunOn: d("2026-08-01") }))
      .mockResolvedValueOnce(template({ nextRunOn: d("2026-09-01") }))
      .mockResolvedValue(template({ nextRunOn: d("2026-10-01") }));

    const report = await runDueRecurringExpenses(d("2026-09-10"));

    expect(report.created).toBe(3);
    const dates = mockTx.expense.create.mock.calls.map(
      (call) => call[0].data.expenseDate.toISOString(),
    );
    expect(dates).toEqual([
      d("2026-07-01").toISOString(),
      d("2026-08-01").toISOString(),
      d("2026-09-01").toISOString(),
    ]);
  });

  it("SINIRI ASMIYOR - tek cagrida en fazla 12 donem", async () => {
    // NEGATIF KONTROL: sinir kalkarsa yillar once baslamis bir sablon tek
    // cagrida yuzlerce harcama uretir.
    mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
    // Her okumada hep vadesi gecmis bir sablon donduruyoruz: dongu ancak
    // sinir yuzunden duruyor.
    mockPrisma.recurringExpense.findUnique.mockResolvedValue(
      template({ nextRunOn: d("2020-01-01") }),
    );

    const report = await runDueRecurringExpenses(d("2026-09-10"));
    expect(report.created).toBe(12);
  });

  it("arada DURAKLATILIRSA donguyu birakiyor", async () => {
    mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
    mockPrisma.recurringExpense.findUnique
      .mockResolvedValueOnce(template({ nextRunOn: d("2026-07-01") }))
      .mockResolvedValue(template({ nextRunOn: d("2026-08-01"), pausedAt: new Date() }));

    const report = await runDueRecurringExpenses(d("2026-09-10"));
    expect(report.created).toBe(1);
  });

  it("grup arada SILINDIYSE donguyu birakiyor", async () => {
    mockPrisma.recurringExpense.findMany.mockResolvedValue([{ id: ID }]);
    mockPrisma.recurringExpense.findUnique.mockResolvedValue(
      template({ group: { name: "Ev", deletedAt: new Date() } }),
    );

    const report = await runDueRecurringExpenses(d("2026-09-10"));
    expect(report.created).toBe(0);
  });
});

describe("kurma", () => {
  beforeEach(() => {
    mockTx.group.findUnique.mockResolvedValue({
      id: GROUP,
      currency: "TRY",
      deletedAt: null,
    });
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: USER }, { userId: OTHER }]);
    mockTx.recurringExpense.create.mockResolvedValue(template());
  });

  it("para birimi GRUPTAN geliyor, istemciden degil", async () => {
    await createRecurringExpense(USER, GROUP, {
      description: "Kira",
      amount: 500000,
      paidById: USER,
      splitType: "EQUAL",
      participantUserIds: [USER, OTHER],
      interval: "MONTHLY",
      startsOn: d("2026-09-01"),
    });

    expect(mockTx.recurringExpense.create.mock.calls[0][0].data.currency).toBe("TRY");
  });

  it("ILK DONEM startsOn'un KENDISI - gecmis tarih yakalamaya birakiliyor", async () => {
    await createRecurringExpense(USER, GROUP, {
      description: "Kira",
      amount: 500000,
      paidById: USER,
      splitType: "EQUAL",
      participantUserIds: [USER, OTHER],
      interval: "MONTHLY",
      startsOn: d("2026-08-01"),
    });

    const data = mockTx.recurringExpense.create.mock.calls[0][0].data;
    expect(data.nextRunOn.toISOString()).toBe(d("2026-08-01").toISOString());
  });

  it("aktif olmayan bir katilimci REDDEDILIYOR", async () => {
    mockTx.groupMember.findMany.mockResolvedValue([{ userId: USER }]);

    await expect(
      createRecurringExpense(USER, GROUP, {
        description: "Kira",
        amount: 500000,
        paidById: USER,
        splitType: "EQUAL",
        participantUserIds: [USER, OTHER],
        interval: "MONTHLY",
        startsOn: d("2026-09-01"),
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("duraklat / devam / sil", () => {
  beforeEach(() => {
    mockPrisma.recurringExpense.findUnique.mockResolvedValue({
      id: ID,
      groupId: GROUP,
      createdById: USER,
      pausedAt: null,
      deletedAt: null,
    });
    mockPrisma.recurringExpense.update.mockResolvedValue(template());
  });

  it("duraklatiyor", async () => {
    await setRecurringPaused(USER, GROUP, ID, true);
    expect(mockPrisma.recurringExpense.update.mock.calls[0][0].data.pausedAt).toBeInstanceOf(
      Date,
    );
  });

  it("zaten duraklatilmissa 409", async () => {
    mockPrisma.recurringExpense.findUnique.mockResolvedValue({
      id: ID,
      groupId: GROUP,
      createdById: USER,
      pausedAt: new Date(),
      deletedAt: null,
    });
    await expect(setRecurringPaused(USER, GROUP, ID, true)).rejects.toThrow(ConflictError);
  });

  it("BASKA BIR GRUBUN sablonu 404 - varligini sizdirmiyor", async () => {
    mockPrisma.recurringExpense.findUnique.mockResolvedValue({
      id: ID,
      groupId: "baska-grup",
      createdById: USER,
      pausedAt: null,
      deletedAt: null,
    });
    await expect(setRecurringPaused(USER, GROUP, ID, true)).rejects.toThrow(NotFoundError);
  });

  it("silme YUMUSAK - uretilmisler duruyor", async () => {
    // Fiziksel silme zaten imkansiz (uretilen harcamalar sablona isaret
    // ediyor, onDelete: Restrict). Test o niyeti kayda geciriyor.
    await deleteRecurringExpense(USER, GROUP, ID);
    expect(mockPrisma.recurringExpense.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(
      Date,
    );
  });

  it("yetki kontrolu assertCanModifyRecord'a BIRAKILIYOR", async () => {
    await setRecurringPaused(USER, GROUP, ID, true);
    expect(mockAssertCanModify).toHaveBeenCalledWith(
      mockTx,
      GROUP,
      expect.objectContaining({ createdById: USER }),
      USER,
      "recurring",
    );
  });
});

describe("hesap silme", () => {
  it("kullanicinin ICINDE OLDUGU her sablonu durduruyor", async () => {
    mockPrisma.recurringExpense.updateMany.mockResolvedValue({ count: 2 });

    const count = await deactivateRecurringFor(
      mockPrisma as unknown as Parameters<typeof deactivateRecurringFor>[0],
      USER,
    );

    expect(count).toBe(2);
    const where = mockPrisma.recurringExpense.updateMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { createdById: USER },
      { paidById: USER },
      { shares: { some: { userId: USER } } },
    ]);
  });
});
