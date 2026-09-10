import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: hatirlatmanin DORT sessiz kusurunu.
 *
 *   1. OLMAYAN BIR BORCUN HATIRLATILMASI. Olcut odesme plani; "negatif
 *      bakiyesi olan herkes" deseydik, parayi baskasina odemesi gereken
 *      birine yanlis bilgi giderdi.
 *   2. YONUN TERSINE DONMESI. Borclu alacakliya hatirlatamaz. Filtrenin tek
 *      bir yarisi unutulursa bu sessizce mumkun olur.
 *   3. SOGUMANIN KACMASI. 24 saat kurali kayitli degilse ozellik bir
 *      taciz araci olur.
 *   4. TUTARIN ISTEMCIDEN GELMESI. Sunucu tutari HER ZAMAN kendi hesapladigi
 *      plandan okuyor - currency kuralinin (ADR-006) aynisi.
 */

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const tx = {
    paymentReminder: { findFirst: vi.fn(), create: vi.fn() },
  };
  return {
    mockTx: tx,
    mockPrisma: {
      group: { findUnique: vi.fn() },
      paymentReminder: { findMany: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { mockGetGroupBalances } = vi.hoisted(() => ({ mockGetGroupBalances: vi.fn() }));
vi.mock("@/lib/balances", () => ({ getGroupBalances: mockGetGroupBalances }));

const { mockCreateNotifications } = vi.hoisted(() => ({ mockCreateNotifications: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: mockCreateNotifications }));

const { sendPaymentReminder, listRecentReminders, deleteRemindersInvolving } =
  await import("@/lib/reminders");
const { REMINDER_COOLDOWN_HOURS } = await import("@/lib/reminder-schemas");

/** ME alacakli, DEBTOR borclu. */
const ME = "me";
const DEBTOR = "debtor";
const GROUP = "g1";

function planSays(transfers: { fromUserId: string; toUserId: string; amount: number }[]) {
  mockGetGroupBalances.mockResolvedValue({
    currency: "TRY",
    balances: [],
    suggestedTransfers: transfers,
  });
}

function created(at = new Date("2026-09-10T09:00:00Z")) {
  mockTx.paymentReminder.create.mockResolvedValue({
    toUserId: DEBTOR,
    amount: 25000,
    createdAt: at,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.group.findUnique.mockResolvedValue({ name: "Ev" });
  mockTx.paymentReminder.findFirst.mockResolvedValue(null);
  planSays([{ fromUserId: DEBTOR, toUserId: ME, amount: 25000 }]);
  created();
});

describe("kime hatirlatilabilir", () => {
  it("odesme planinda BANA odemesi gereken kisiye hatirlatiliyor", async () => {
    const reminder = await sendPaymentReminder(ME, GROUP, DEBTOR);

    expect(reminder.toUserId).toBe(DEBTOR);
    expect(mockTx.paymentReminder.create).toHaveBeenCalledTimes(1);
  });

  it("planda BOYLE BIR TRANSFER YOKSA reddediliyor", async () => {
    // NEGATIF KONTROL: bu dal duserse olmayan bir borc icin hatirlatma
    // gonderilebilir hale gelir.
    planSays([]);

    await expect(sendPaymentReminder(ME, GROUP, DEBTOR)).rejects.toThrow(ValidationError);
    expect(mockTx.paymentReminder.create).not.toHaveBeenCalled();
  });

  it("YON TERS OLDUGUNDA reddediliyor - borclu alacakliya hatirlatamaz", async () => {
    // Planda "ben DEBTOR'a odemeliyim" yaziyor; yine de DEBTOR'a hatirlatmayi
    // deniyoruz. Filtrenin iki yarisi da calisiyorsa bu istek gecmemeli.
    planSays([{ fromUserId: ME, toUserId: DEBTOR, amount: 25000 }]);

    await expect(sendPaymentReminder(ME, GROUP, DEBTOR)).rejects.toThrow(ValidationError);
    expect(mockTx.paymentReminder.create).not.toHaveBeenCalled();
  });

  it("ucuncu bir kisinin transferi BANA yetki vermiyor", async () => {
    // Grubun geri kalanindaki bir transfer ("Ayse -> Can") planda duruyor
    // ama alicisi ben degilim.
    planSays([{ fromUserId: DEBTOR, toUserId: "someone-else", amount: 25000 }]);

    await expect(sendPaymentReminder(ME, GROUP, DEBTOR)).rejects.toThrow(ValidationError);
  });

  it("kendine hatirlatma reddediliyor ve PLANA HIC BAKILMIYOR", async () => {
    await expect(sendPaymentReminder(ME, GROUP, ME)).rejects.toThrow(ValidationError);
    expect(mockGetGroupBalances).not.toHaveBeenCalled();
  });

  it("grup ve uyelik kontrolu getGroupBalances'a BIRAKILIYOR", async () => {
    // Kontrolu burada tekrarlamiyoruz; tekrarlansaydi ikinci kopya ilki
    // degistiginde sessizce ayrisirdi. Bu test o devrin gercekten
    // yapildigini tutuyor: servis firlatirsa hatirlatma da firlar.
    mockGetGroupBalances.mockRejectedValue(new ValidationError("group.not_found"));

    await expect(sendPaymentReminder(ME, GROUP, DEBTOR)).rejects.toThrow();
    expect(mockTx.paymentReminder.create).not.toHaveBeenCalled();
  });
});

describe("tutar", () => {
  it("PLANDAN okunuyor, cagirandan degil", async () => {
    planSays([{ fromUserId: DEBTOR, toUserId: ME, amount: 74321 }]);

    await sendPaymentReminder(ME, GROUP, DEBTOR);

    expect(mockTx.paymentReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 74321, currency: "TRY" }),
      }),
    );
  });

  it("para birimi de PLANDAN geliyor - istemci gonderemiyor", async () => {
    mockGetGroupBalances.mockResolvedValue({
      currency: "USD",
      balances: [],
      suggestedTransfers: [{ fromUserId: DEBTOR, toUserId: ME, amount: 900 }],
    });

    await sendPaymentReminder(ME, GROUP, DEBTOR);

    expect(mockTx.paymentReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: "USD" }) }),
    );
  });
});

describe("soguma penceresi", () => {
  it("pencere icinde ikinci hatirlatma 409 ile reddediliyor", async () => {
    mockTx.paymentReminder.findFirst.mockResolvedValue({
      createdAt: new Date("2026-09-10T08:00:00Z"),
    });

    await expect(sendPaymentReminder(ME, GROUP, DEBTOR)).rejects.toThrow(ConflictError);
    expect(mockTx.paymentReminder.create).not.toHaveBeenCalled();
  });

  it("kontrol AYNI UCLUYE bakiyor: grup + gonderen + alici", async () => {
    // Yalnizca alicisina bakan bir sorgu, baska bir gruptaki hatirlatmayi da
    // sayardi - yani grubu degistiren kullanici hatirlatamaz olurdu.
    await sendPaymentReminder(ME, GROUP, DEBTOR);

    const where = mockTx.paymentReminder.findFirst.mock.calls[0][0].where;
    expect(where.groupId).toBe(GROUP);
    expect(where.fromUserId).toBe(ME);
    expect(where.toUserId).toBe(DEBTOR);
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("pencerenin genisligi REMINDER_COOLDOWN_HOURS kadar", async () => {
    const before = Date.now();
    await sendPaymentReminder(ME, GROUP, DEBTOR);
    const after = Date.now();

    const gte: Date = mockTx.paymentReminder.findFirst.mock.calls[0][0].where.createdAt.gte;
    const windowMs = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
    expect(gte.getTime()).toBeGreaterThanOrEqual(before - windowMs);
    expect(gte.getTime()).toBeLessThanOrEqual(after - windowMs);
  });
});

describe("bildirim", () => {
  it("YALNIZCA hatirlatilan kisiye gidiyor", async () => {
    // Gruptaki digerleri haber almiyor: "Ali, Veli'ye borcunu hatirlatti"
    // herkese giden bir bildirim olsaydi ozellik bir durtmeden bir TESHIRE
    // donerdi.
    await sendPaymentReminder(ME, GROUP, DEBTOR);

    const input = mockCreateNotifications.mock.calls[0][1];
    expect(input.type).toBe("PAYMENT_REMINDED");
    expect(input.actorId).toBe(ME);
    expect(input.recipientIds).toEqual([DEBTOR]);
  });

  it("payload tutari tasiyor ama HARCAMA ACIKLAMASI tasimiyor", async () => {
    await sendPaymentReminder(ME, GROUP, DEBTOR);

    const payload = mockCreateNotifications.mock.calls[0][1].payload;
    expect(payload.amount).toBe(25000);
    expect(payload.currency).toBe("TRY");
    expect(payload.groupName).toBe("Ev");
    expect(payload.description).toBeUndefined();
    expect(payload.expenseId).toBeUndefined();
  });

  it("bildirim ile kayit AYNI transaction'da", async () => {
    // Ayri olsalardi biri yazilip digeri yazilmayabilirdi: ya hatirlatildi
    // sayilip kimseye haber gitmezdi, ya da haber gidip soguma sayaci
    // baslamazdi.
    await sendPaymentReminder(ME, GROUP, DEBTOR);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockCreateNotifications).toHaveBeenCalledWith(mockTx, expect.anything());
  });
});

describe("listRecentReminders", () => {
  it("yalnizca CAGIRANIN gonderdiklerini soruyor", async () => {
    mockPrisma.paymentReminder.findMany.mockResolvedValue([]);

    await listRecentReminders(ME, GROUP);

    const where = mockPrisma.paymentReminder.findMany.mock.calls[0][0].where;
    expect(where.fromUserId).toBe(ME);
    expect(where.groupId).toBe(GROUP);
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("ayni kisiye birden fazla kayit varsa EN YENISINI donuyor", async () => {
    mockPrisma.paymentReminder.findMany.mockResolvedValue([
      { toUserId: DEBTOR, amount: 300, createdAt: new Date("2026-09-10T09:00:00Z") },
      { toUserId: DEBTOR, amount: 100, createdAt: new Date("2026-09-10T01:00:00Z") },
      { toUserId: "other", amount: 500, createdAt: new Date("2026-09-10T05:00:00Z") },
    ]);

    const rows = await listRecentReminders(ME, GROUP);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.toUserId === DEBTOR)?.amount).toBe(300);
  });
});

describe("hesap silme", () => {
  it("IKI YONU DE siliyor - gonderdikleri ve kendisine gonderilenler", async () => {
    // Yalnizca biri silinseydi silinmis bir hesabin adi hala bir satirin
    // ucunda dururdu ve "hesabini silersen yukledigin her sey gider" cumlesi
    // yarim kalirdi.
    mockPrisma.paymentReminder.deleteMany.mockResolvedValue({ count: 3 });

    const count = await deleteRemindersInvolving(
      mockPrisma as unknown as Parameters<typeof deleteRemindersInvolving>[0],
      ME,
    );

    expect(count).toBe(3);
    expect(mockPrisma.paymentReminder.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ fromUserId: ME }, { toUserId: ME }] },
    });
  });
});
