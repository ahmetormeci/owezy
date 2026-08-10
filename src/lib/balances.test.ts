import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

// balances.ts artik prisma'yi import ediyor (servis katmani icin); gercek Neon
// baglantisi kurulmasin diye mock'luyoruz.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn(), findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    settlement: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  calculateBalances,
  simplifyDebts,
  getGroupBalances,
} = await import("@/lib/balances");

type ExpenseForBalance = Parameters<typeof calculateBalances>[0][number];
type SettlementForBalance = Parameters<typeof calculateBalances>[1][number];
type UserBalance = ReturnType<typeof calculateBalances>[number];

const ALI = "ali";
const BERK = "berk";
const CAN = "can";
const DENIZ = "deniz";

// Tasarim asamasinda konustugumuz ornek senaryo:
//   Market  : Ali 300 TL odedi, 3 kisiye esit bolundu (100 TL each)
//   Internet: Berk 150 TL odedi, 3 kisiye esit bolundu (50 TL each)
// Beklenen net: Ali +150 TL, Berk 0, Can -150 TL
const marketExpense: ExpenseForBalance = {
  paidById: ALI,
  amount: 30000,
  participants: [
    { userId: ALI, shareAmount: 10000 },
    { userId: BERK, shareAmount: 10000 },
    { userId: CAN, shareAmount: 10000 },
  ],
};

const internetExpense: ExpenseForBalance = {
  paidById: BERK,
  amount: 15000,
  participants: [
    { userId: ALI, shareAmount: 5000 },
    { userId: BERK, shareAmount: 5000 },
    { userId: CAN, shareAmount: 5000 },
  ],
};

function sumOf(balances: UserBalance[]) {
  return balances.reduce((sum, balance) => sum + balance.amount, 0);
}

describe("calculateBalances", () => {
  it("girdi bossa bos liste doner", () => {
    expect(calculateBalances([], [])).toEqual([]);
  });

  it("tek harcamayi esit bolusumde dogru dagitir", () => {
    expect(calculateBalances([marketExpense], [])).toEqual([
      { userId: ALI, amount: 20000 },
      { userId: BERK, amount: -10000 },
      { userId: CAN, amount: -10000 },
    ]);
  });

  it("odeyen kisi katilimci degilse tutarin tamamini alacak yazar", () => {
    const expense: ExpenseForBalance = {
      paidById: ALI,
      amount: 10000,
      participants: [
        { userId: BERK, shareAmount: 5000 },
        { userId: CAN, shareAmount: 5000 },
      ],
    };

    expect(calculateBalances([expense], [])).toEqual([
      { userId: ALI, amount: 10000 },
      { userId: BERK, amount: -5000 },
      { userId: CAN, amount: -5000 },
    ]);
  });

  it("iki harcamayi birlestirir (tasarimdaki ornek senaryo)", () => {
    expect(calculateBalances([marketExpense, internetExpense], [])).toEqual([
      { userId: ALI, amount: 15000 },
      { userId: BERK, amount: 0 },
      { userId: CAN, amount: -15000 },
    ]);
  });

  it("odesmis kullaniciyi sifir bakiyeyle listede tutar", () => {
    const balances = calculateBalances([marketExpense, internetExpense], []);
    expect(balances.find((balance) => balance.userId === BERK)).toEqual({
      userId: BERK,
      amount: 0,
    });
  });

  it("odeme kaydi borclunun borcunu azaltir, alacaklinin alacagini", () => {
    const settlement: SettlementForBalance = {
      fromUserId: CAN,
      toUserId: ALI,
      amount: 15000,
    };

    const balances = calculateBalances([marketExpense, internetExpense], [settlement]);

    expect(balances).toEqual([
      { userId: ALI, amount: 0 },
      { userId: BERK, amount: 0 },
      { userId: CAN, amount: 0 },
    ]);
  });

  it("kismi odeme borcun yalnizca bir kismini kapatir", () => {
    const settlement: SettlementForBalance = {
      fromUserId: CAN,
      toUserId: ALI,
      amount: 5000,
    };

    const balances = calculateBalances([marketExpense, internetExpense], [settlement]);

    expect(balances).toEqual([
      { userId: ALI, amount: 10000 },
      { userId: BERK, amount: 0 },
      { userId: CAN, amount: -10000 },
    ]);
  });

  it("odeme, harcamasi olmayan kullanicilar arasinda da bakiye olusturur", () => {
    const settlement: SettlementForBalance = {
      fromUserId: ALI,
      toUserId: BERK,
      amount: 7500,
    };

    expect(calculateBalances([], [settlement])).toEqual([
      { userId: ALI, amount: 7500 },
      { userId: BERK, amount: -7500 },
    ]);
  });

  it("bakiyelerin toplami her zaman tam olarak sifirdir (genis tarama)", () => {
    const scenarios: { expenses: ExpenseForBalance[]; settlements: SettlementForBalance[] }[] = [
      { expenses: [marketExpense], settlements: [] },
      { expenses: [marketExpense, internetExpense], settlements: [] },
      {
        expenses: [marketExpense, internetExpense],
        settlements: [{ fromUserId: CAN, toUserId: ALI, amount: 3333 }],
      },
      {
        // Tam bolunmeyen tutar: 10000 / 3 -> 3334 + 3333 + 3333
        expenses: [
          {
            paidById: ALI,
            amount: 10000,
            participants: [
              { userId: ALI, shareAmount: 3334 },
              { userId: BERK, shareAmount: 3333 },
              { userId: CAN, shareAmount: 3333 },
            ],
          },
        ],
        settlements: [],
      },
      {
        expenses: [
          { paidById: DENIZ, amount: 1, participants: [{ userId: ALI, shareAmount: 1 }] },
        ],
        settlements: [],
      },
    ];

    for (const scenario of scenarios) {
      expect(sumOf(calculateBalances(scenario.expenses, scenario.settlements))).toBe(0);
    }
  });

  it("alacakliden borcluya siralar, esitlikte userId'ye gore kesinlestirir", () => {
    // Berk ve Can'in bakiyeleri esit (-5000); siralamada berk once gelmeli.
    const expense: ExpenseForBalance = {
      paidById: ALI,
      amount: 10000,
      participants: [
        { userId: CAN, shareAmount: 5000 },
        { userId: BERK, shareAmount: 5000 },
      ],
    };

    expect(calculateBalances([expense], []).map((balance) => balance.userId)).toEqual([
      ALI,
      BERK,
      CAN,
    ]);
  });

  it("ayni girdi her zaman ayni sonucu uretir (deterministik)", () => {
    const first = calculateBalances([marketExpense, internetExpense], []);
    const second = calculateBalances([marketExpense, internetExpense], []);
    expect(first).toEqual(second);
  });
});

describe("simplifyDebts", () => {
  it("herkes odesmisse hic transfer uretmez", () => {
    expect(
      simplifyDebts([
        { userId: ALI, amount: 0 },
        { userId: BERK, amount: 0 },
      ]),
    ).toEqual([]);
  });

  it("bos bakiye listesinde hic transfer uretmez", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("tek borclu ve tek alacakliyi tek transferle eslestirir", () => {
    expect(
      simplifyDebts([
        { userId: ALI, amount: 15000 },
        { userId: CAN, amount: -15000 },
      ]),
    ).toEqual([{ fromUserId: CAN, toUserId: ALI, amount: 15000 }]);
  });

  it("tasarimdaki ornek senaryoyu tek transfere indirger", () => {
    const balances = calculateBalances([marketExpense, internetExpense], []);

    // Ikili bakiyede 3 odeme gerekirdi; netlestirme tek odemeye indiriyor.
    expect(simplifyDebts(balances)).toEqual([
      { fromUserId: CAN, toUserId: ALI, amount: 15000 },
    ]);
  });

  it("bir borclunun borcunu birden fazla alacakliya boler", () => {
    const transfers = simplifyDebts([
      { userId: ALI, amount: 10000 },
      { userId: BERK, amount: 5000 },
      { userId: CAN, amount: -15000 },
    ]);

    expect(transfers).toEqual([
      { fromUserId: CAN, toUserId: ALI, amount: 10000 },
      { fromUserId: CAN, toUserId: BERK, amount: 5000 },
    ]);
  });

  it("birden fazla borcluyu tek alacakliyla eslestirir", () => {
    const transfers = simplifyDebts([
      { userId: ALI, amount: 15000 },
      { userId: BERK, amount: -10000 },
      { userId: CAN, amount: -5000 },
    ]);

    expect(transfers).toEqual([
      { fromUserId: BERK, toUserId: ALI, amount: 10000 },
      { fromUserId: CAN, toUserId: ALI, amount: 5000 },
    ]);
  });

  it("sifir bakiyeli kullanicilar hicbir transferde yer almaz", () => {
    const transfers = simplifyDebts([
      { userId: ALI, amount: 15000 },
      { userId: BERK, amount: 0 },
      { userId: CAN, amount: -15000 },
    ]);

    const involved = transfers.flatMap((transfer) => [transfer.fromUserId, transfer.toUserId]);
    expect(involved).not.toContain(BERK);
  });

  it("hic sifir tutarli transfer uretmez", () => {
    const transfers = simplifyDebts([
      { userId: ALI, amount: 7000 },
      { userId: BERK, amount: 3000 },
      { userId: CAN, amount: -4000 },
      { userId: DENIZ, amount: -6000 },
    ]);

    for (const transfer of transfers) {
      expect(transfer.amount).toBeGreaterThan(0);
    }
  });

  it("her borclunun toplam odemesi borcuna, her alacaklininki alacagina esittir", () => {
    const balances: UserBalance[] = [
      { userId: ALI, amount: 12345 },
      { userId: BERK, amount: 6655 },
      { userId: CAN, amount: -9000 },
      { userId: DENIZ, amount: -10000 },
    ];

    const transfers = simplifyDebts(balances);

    for (const balance of balances) {
      const sent = transfers
        .filter((transfer) => transfer.fromUserId === balance.userId)
        .reduce((sum, transfer) => sum + transfer.amount, 0);
      const received = transfers
        .filter((transfer) => transfer.toUserId === balance.userId)
        .reduce((sum, transfer) => sum + transfer.amount, 0);

      expect(received - sent).toBe(balance.amount);
    }
  });

  it("transfer sayisi en fazla (kisi sayisi - 1) olur", () => {
    const scenarios: UserBalance[][] = [
      [
        { userId: ALI, amount: 15000 },
        { userId: CAN, amount: -15000 },
      ],
      [
        { userId: ALI, amount: 15000 },
        { userId: BERK, amount: 0 },
        { userId: CAN, amount: -15000 },
      ],
      [
        { userId: ALI, amount: 12345 },
        { userId: BERK, amount: 6655 },
        { userId: CAN, amount: -9000 },
        { userId: DENIZ, amount: -10000 },
      ],
      [
        { userId: ALI, amount: 1 },
        { userId: BERK, amount: 1 },
        { userId: CAN, amount: -1 },
        { userId: DENIZ, amount: -1 },
      ],
    ];

    for (const balances of scenarios) {
      const transfers = simplifyDebts(balances);
      expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);
    }
  });

  it("1 kurusluk bakiyeleri de dogru eslestirir", () => {
    expect(
      simplifyDebts([
        { userId: ALI, amount: 1 },
        { userId: CAN, amount: -1 },
      ]),
    ).toEqual([{ fromUserId: CAN, toUserId: ALI, amount: 1 }]);
  });

  it("bakiyelerin toplami sifir degilse hata firlatir", () => {
    expect(() =>
      simplifyDebts([
        { userId: ALI, amount: 15000 },
        { userId: CAN, amount: -10000 },
      ]),
    ).toThrow();
  });

  it("ayni girdi her zaman ayni transfer listesini uretir (deterministik)", () => {
    const balances: UserBalance[] = [
      { userId: ALI, amount: 5000 },
      { userId: BERK, amount: 5000 },
      { userId: CAN, amount: -5000 },
      { userId: DENIZ, amount: -5000 },
    ];

    expect(simplifyDebts(balances)).toEqual(simplifyDebts(balances));
  });

  it("girdi olarak verilen bakiye listesini degistirmez", () => {
    const balances: UserBalance[] = [
      { userId: ALI, amount: 15000 },
      { userId: CAN, amount: -15000 },
    ];
    const snapshot = structuredClone(balances);

    simplifyDebts(balances);

    expect(balances).toEqual(snapshot);
  });
});

const GROUP_ID = "group-1";

describe("getGroupBalances", () => {
  beforeEach(() => {
    mockPrisma.group.findUnique.mockReset();
    mockPrisma.groupMember.findFirst.mockReset();
    mockPrisma.groupMember.findMany.mockReset();
    mockPrisma.expense.findMany.mockReset();
    mockPrisma.settlement.findMany.mockReset();
  });

  function member(userId: string, displayName: string, leftAt: Date | null = null) {
    return {
      userId,
      leftAt,
      user: { displayName, avatarUrl: null },
    };
  }

  function readableGroup() {
    mockPrisma.group.findUnique.mockResolvedValue({
      id: GROUP_ID,
      currency: "TRY",
      deletedAt: null,
    });
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "m1", userId: ALI });
  }

  it("grup bulunamazsa NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(getGroupBalances(ALI, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("grup soft-delete edilmisse NotFoundError firlatir", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: new Date() });

    await expect(getGroupBalances(ALI, GROUP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("aktif uye olmayan kullanici bakiyeleri goremez", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: GROUP_ID, deletedAt: null });
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(getGroupBalances(ALI, GROUP_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
  });

  it("yalnizca silinmemis harcamalari ve iptal edilmemis odemeleri hesaba katar", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    await getGroupBalances(ALI, GROUP_ID);

    expect(mockPrisma.expense.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      deletedAt: null,
    });
    expect(mockPrisma.settlement.findMany.mock.calls[0][0].where).toEqual({
      groupId: GROUP_ID,
      cancelledAt: null,
    });
  });

  it("bakiyeleri kullanici bilgileriyle zenginlestirir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([marketExpense, internetExpense]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      member(ALI, "Ali"),
      member(BERK, "Berk"),
      member(CAN, "Can"),
    ]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    expect(result.currency).toBe("TRY");
    expect(result.balances).toEqual([
      { userId: ALI, amount: 15000, displayName: "Ali", avatarUrl: null, hasLeft: false },
      { userId: BERK, amount: 0, displayName: "Berk", avatarUrl: null, hasLeft: false },
      { userId: CAN, amount: -15000, displayName: "Can", avatarUrl: null, hasLeft: false },
    ]);
    expect(result.suggestedTransfers).toEqual([
      { fromUserId: CAN, toUserId: ALI, amount: 15000 },
    ]);
  });

  it("hic hareketi olmayan aktif uyeyi sifir bakiyeyle listeler", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([member(ALI, "Ali"), member(BERK, "Berk")]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    expect(result.balances).toEqual([
      { userId: ALI, amount: 0, displayName: "Ali", avatarUrl: null, hasLeft: false },
      { userId: BERK, amount: 0, displayName: "Berk", avatarUrl: null, hasLeft: false },
    ]);
  });

  it("gruptan ayrilmis ama borcu duran uye listede kalir ve isaretlenir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([
      {
        paidById: ALI,
        amount: 10000,
        participants: [{ userId: CAN, shareAmount: 10000 }],
      },
    ]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      member(ALI, "Ali"),
      member(CAN, "Can", new Date("2026-08-01T00:00:00.000Z")),
    ]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    const can = result.balances.find((balance) => balance.userId === CAN);
    expect(can).toEqual({
      userId: CAN,
      amount: -10000,
      displayName: "Can",
      avatarUrl: null,
      hasLeft: true,
    });
    // Ayrilmis uyenin borcu hala netlestirmeye dahil - para kaybolmamali.
    expect(result.suggestedTransfers).toEqual([
      { fromUserId: CAN, toUserId: ALI, amount: 10000 },
    ]);
  });

  it("gruptan ayrilmis ve bakiyesi kapanmis uyeyi listeden cikarir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      member(ALI, "Ali"),
      member(CAN, "Can", new Date("2026-08-01T00:00:00.000Z")),
    ]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    expect(result.balances.map((balance) => balance.userId)).toEqual([ALI]);
  });

  it("ayrilip tekrar katilan uye aktif kabul edilir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([]);
    mockPrisma.settlement.findMany.mockResolvedValue([]);
    // Once ayrilmis, sonra tekrar katilmis: iki uyelik satiri var.
    mockPrisma.groupMember.findMany.mockResolvedValue([
      member(CAN, "Can", new Date("2026-07-01T00:00:00.000Z")),
      member(CAN, "Can"),
    ]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    expect(result.balances).toEqual([
      { userId: CAN, amount: 0, displayName: "Can", avatarUrl: null, hasLeft: false },
    ]);
  });

  it("odemeler bakiyeye yansir", async () => {
    readableGroup();
    mockPrisma.expense.findMany.mockResolvedValue([marketExpense, internetExpense]);
    mockPrisma.settlement.findMany.mockResolvedValue([
      { fromUserId: CAN, toUserId: ALI, amount: 15000 },
    ]);
    mockPrisma.groupMember.findMany.mockResolvedValue([
      member(ALI, "Ali"),
      member(BERK, "Berk"),
      member(CAN, "Can"),
    ]);

    const result = await getGroupBalances(ALI, GROUP_ID);

    expect(result.balances.every((balance) => balance.amount === 0)).toBe(true);
    expect(result.suggestedTransfers).toEqual([]);
  });
});
