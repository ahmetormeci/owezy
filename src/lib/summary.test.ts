import { describe, expect, it, vi } from "vitest";

// summary.ts servis katmani icin prisma'yi import ediyor (balances.ts uzerinden
// de geliyor); gercek Neon baglantisi kurulmasin diye mock'luyoruz.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn(), findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    settlement: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { calculateGroupSummary } = await import("@/lib/summary");
const { calculateBalances } = await import("@/lib/balances");

type ExpenseForSummary = Parameters<typeof calculateGroupSummary>[0][number];
type SettlementForSummary = Parameters<typeof calculateGroupSummary>[1][number];

const ALI = "ali";
const BERK = "berk";
const CAN = "can";

function expense(
  overrides: Partial<ExpenseForSummary> & Pick<ExpenseForSummary, "amount">,
): ExpenseForSummary {
  return {
    paidById: ALI,
    expenseDate: new Date("2026-08-12T00:00:00.000Z"),
    category: "OTHER",
    participants: [],
    ...overrides,
  };
}

describe("calculateGroupSummary - toplamlar", () => {
  it("bos grupta her sey sifir", () => {
    const summary = calculateGroupSummary([], [], ALI);

    expect(summary.totalAmount).toBe(0);
    expect(summary.expenseCount).toBe(0);
    expect(summary.myBalance).toBe(0);
    expect(summary.byCategory).toEqual([]);
    expect(summary.byMonth).toEqual([]);
  });

  it("toplam tutar ve harcama sayisi", () => {
    const summary = calculateGroupSummary(
      [expense({ amount: 30000 }), expense({ amount: 15000 })],
      [],
      ALI,
    );

    expect(summary.totalAmount).toBe(45000);
    expect(summary.expenseCount).toBe(2);
  });

  it("odedigim ve payim ayri ayri toplaniyor", () => {
    const summary = calculateGroupSummary(
      [
        expense({
          amount: 30000,
          paidById: ALI,
          participants: [
            { userId: ALI, shareAmount: 10000 },
            { userId: BERK, shareAmount: 20000 },
          ],
        }),
        expense({
          amount: 10000,
          paidById: BERK,
          participants: [{ userId: ALI, shareAmount: 10000 }],
        }),
      ],
      [],
      ALI,
    );

    // Ali 30000 odedi; payi 10000 + 10000.
    expect(summary.myPaid).toBe(30000);
    expect(summary.myShare).toBe(20000);
  });

  it("odemeler yon ayirt ederek toplaniyor", () => {
    const settlements: SettlementForSummary[] = [
      { fromUserId: ALI, toUserId: BERK, amount: 5000 },
      { fromUserId: CAN, toUserId: ALI, amount: 2000 },
      { fromUserId: BERK, toUserId: CAN, amount: 9000 },
    ];

    const summary = calculateGroupSummary([], settlements, ALI);

    expect(summary.mySettlementsOut).toBe(5000);
    expect(summary.mySettlementsIn).toBe(2000);
  });
});

// Bu blok ozetin varlik sebebini koruyor: ekranda "bakiyen neden bu" diye dort
// sayi gosterecegiz ve bu dort sayi bakiyenin KENDISINI vermek zorunda. Ozet
// ile bakiye ayri kod yollarindan geliyor; birbirinden sessizce ayrilirlarsa
// kullaniciya birbirini tutmayan iki rakam gosteririz.
describe("calculateGroupSummary - bakiye acilimi", () => {
  const expenses: ExpenseForSummary[] = [
    expense({
      amount: 30000,
      paidById: ALI,
      participants: [
        { userId: ALI, shareAmount: 10000 },
        { userId: BERK, shareAmount: 10000 },
        { userId: CAN, shareAmount: 10000 },
      ],
    }),
    expense({
      amount: 15000,
      paidById: BERK,
      participants: [
        { userId: ALI, shareAmount: 5000 },
        { userId: BERK, shareAmount: 5000 },
        { userId: CAN, shareAmount: 5000 },
      ],
    }),
  ];

  const settlements: SettlementForSummary[] = [
    { fromUserId: CAN, toUserId: ALI, amount: 7000 },
  ];

  it("dort sayi toplandiginda myBalance cikiyor", () => {
    const summary = calculateGroupSummary(expenses, settlements, ALI);

    expect(
      summary.myPaid - summary.myShare + summary.mySettlementsOut - summary.mySettlementsIn,
    ).toBe(summary.myBalance);
  });

  it("myBalance, calculateBalances'in ayni kisi icin verdigiyle birebir ayni", () => {
    for (const userId of [ALI, BERK, CAN]) {
      const summary = calculateGroupSummary(expenses, settlements, userId);
      const fromBalances = calculateBalances(expenses, settlements).find(
        (balance) => balance.userId === userId,
      );

      expect(summary.myBalance).toBe(fromBalances?.amount);
    }
  });
});

describe("calculateGroupSummary - kategori kirilimi", () => {
  it("buyukten kucuge siralanir ve payi basis point olarak tasir", () => {
    const summary = calculateGroupSummary(
      [
        expense({ amount: 10000, category: "FOOD" }),
        expense({ amount: 30000, category: "ACCOMMODATION" }),
        expense({ amount: 10000, category: "FOOD" }),
      ],
      [],
      ALI,
    );

    expect(summary.byCategory).toEqual([
      { category: "ACCOMMODATION", amount: 30000, basisPoints: 6000 },
      { category: "FOOD", amount: 20000, basisPoints: 4000 },
    ]);
  });

  it("esit tutarli kategoriler her zaman ayni sirada (deterministik)", () => {
    const input = [
      expense({ amount: 10000, category: "TRANSPORT" }),
      expense({ amount: 10000, category: "BILLS" }),
    ];

    const first = calculateGroupSummary(input, [], ALI).byCategory;
    const second = calculateGroupSummary([...input].reverse(), [], ALI).byCategory;

    expect(first.map((slice) => slice.category)).toEqual(["BILLS", "TRANSPORT"]);
    expect(second).toEqual(first);
  });

  it("yuzde hesabinda float araya girmiyor - ucte bir yakina yuvarlaniyor", () => {
    const summary = calculateGroupSummary(
      [
        expense({ amount: 100, category: "FOOD" }),
        expense({ amount: 200, category: "TRANSPORT" }),
      ],
      [],
      ALI,
    );

    // 100/300 = %33,333... -> 3333 (asagi), 200/300 = %66,666... -> 6667 (yukari)
    expect(summary.byCategory).toEqual([
      { category: "TRANSPORT", amount: 200, basisPoints: 6667 },
      { category: "FOOD", amount: 100, basisPoints: 3333 },
    ]);
  });
});

describe("calculateGroupSummary - ay kirilimi", () => {
  it("aya gore gruplanir, yeniden eskiye siralanir", () => {
    const summary = calculateGroupSummary(
      [
        expense({ amount: 1000, expenseDate: new Date("2026-06-30T00:00:00.000Z") }),
        expense({ amount: 2000, expenseDate: new Date("2026-08-12T00:00:00.000Z") }),
        expense({ amount: 3000, expenseDate: new Date("2026-08-01T00:00:00.000Z") }),
      ],
      [],
      ALI,
    );

    expect(summary.byMonth).toEqual([
      { month: "2026-08", amount: 5000, count: 2 },
      { month: "2026-06", amount: 1000, count: 1 },
    ]);
  });

  it("yil siniri dogru siralanir", () => {
    const summary = calculateGroupSummary(
      [
        expense({ amount: 1000, expenseDate: new Date("2025-12-31T00:00:00.000Z") }),
        expense({ amount: 2000, expenseDate: new Date("2026-01-01T00:00:00.000Z") }),
      ],
      [],
      ALI,
    );

    expect(summary.byMonth.map((slice) => slice.month)).toEqual(["2026-01", "2025-12"]);
  });

  // expenseDate kolonu @db.Date ve Prisma bunu UTC gece yarisi olarak
  // donduruyor. getMonth() kullansaydik UTC'nin gerisindeki bir saat diliminde
  // ayin ilk gunu bir onceki aya duserdi.
  it("ayin ilk gunu dogru aya dusuyor", () => {
    const summary = calculateGroupSummary(
      [expense({ amount: 1000, expenseDate: new Date("2026-08-01T00:00:00.000Z") })],
      [],
      ALI,
    );

    expect(summary.byMonth).toEqual([{ month: "2026-08", amount: 1000, count: 1 }]);
  });

  it("ay toplamlarinin toplami grubun toplamina esit", () => {
    const expenses = [
      expense({ amount: 1234, expenseDate: new Date("2026-06-30T00:00:00.000Z") }),
      expense({ amount: 5678, expenseDate: new Date("2026-07-15T00:00:00.000Z") }),
      expense({ amount: 9012, expenseDate: new Date("2026-08-01T00:00:00.000Z") }),
    ];
    const summary = calculateGroupSummary(expenses, [], ALI);

    expect(summary.byMonth.reduce((sum, slice) => sum + slice.amount, 0)).toBe(
      summary.totalAmount,
    );
    expect(summary.byMonth.reduce((sum, slice) => sum + slice.count, 0)).toBe(
      summary.expenseCount,
    );
  });
});
