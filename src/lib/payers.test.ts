import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  describePayers,
  orderPayers,
  payerLine,
  payerRemainder,
  primaryPayerId,
  resolvePayers,
} from "@/lib/payers";

/**
 * Birden fazla odeyen (ADR-067) - saf kurallar.
 *
 * Bu modulu hem sunucu (dogrulama) hem web formu ("kalan" satiri) hem mobil
 * agac kullaniyor. Buradaki bir kayma ekranda gorunen ile kaydedilen
 * arasinda bir fark demek; o yuzden her kural ayri ayri sabitleniyor.
 */

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.code;
    }
    throw error;
  }
  return undefined;
}

describe("resolvePayers", () => {
  it("ESKI govde: paidById tek odeyen, tutarin tamami", () => {
    expect(resolvePayers({ amount: 12000, paidById: "a" })).toEqual([
      { userId: "a", amount: 12000 },
    ]);
  });

  it("ikisi de yoksa payer.none", () => {
    expect(codeOf(() => resolvePayers({ amount: 12000 }))).toBe("payer.none");
  });

  it("bos liste payer.none - 'kimse odemedi' diye bir harcama yok", () => {
    expect(codeOf(() => resolvePayers({ amount: 12000, payers: [] }))).toBe("payer.none");
  });

  it("YENI govde: liste aynen donuyor, sira korunuyor", () => {
    const payers = [
      { userId: "b", amount: 4000 },
      { userId: "a", amount: 8000 },
    ];
    expect(resolvePayers({ amount: 12000, payers })).toEqual(payers);
  });

  it("ikisi birden gelirse payers kazaniyor (sema bunu zaten reddediyor)", () => {
    const result = resolvePayers({
      amount: 12000,
      paidById: "x",
      payers: [{ userId: "a", amount: 12000 }],
    });
    expect(result).toEqual([{ userId: "a", amount: 12000 }]);
  });

  it("ayni kisi iki kez yazilamaz", () => {
    const code = codeOf(() =>
      resolvePayers({
        amount: 12000,
        payers: [
          { userId: "a", amount: 6000 },
          { userId: "a", amount: 6000 },
        ],
      }),
    );
    expect(code).toBe("payer.duplicate");
  });

  it("SIFIR tutar gecersiz - hicbir sey odememis biri odeyen degil", () => {
    const code = codeOf(() =>
      resolvePayers({
        amount: 12000,
        payers: [
          { userId: "a", amount: 12000 },
          { userId: "b", amount: 0 },
        ],
      }),
    );
    expect(code).toBe("payer.amount_invalid");
  });

  it("KESIRLI tutar gecersiz - para kurus cinsinden tam sayi", () => {
    const code = codeOf(() =>
      resolvePayers({
        amount: 12000,
        payers: [
          { userId: "a", amount: 11999.5 },
          { userId: "b", amount: 0.5 },
        ],
      }),
    );
    expect(code).toBe("payer.amount_invalid");
  });

  it("toplam tutara esit degilse payer.sum_mismatch ve iki sayiyi da tasiyor", () => {
    let caught: unknown;
    try {
      resolvePayers({
        amount: 12000,
        payers: [
          { userId: "a", amount: 8000 },
          { userId: "b", amount: 3000 },
        ],
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).code).toBe("payer.sum_mismatch");
    expect((caught as ValidationError).params).toEqual({ total: 11000, amount: 12000 });
  });

  it("donen liste girdiyle ayni nesneler degil - fazladan alan sizmiyor", () => {
    const input = [{ userId: "a", amount: 12000, extra: true }];
    const [only] = resolvePayers({ amount: 12000, payers: input });
    expect(only).toEqual({ userId: "a", amount: 12000 });
  });
});

describe("primaryPayerId", () => {
  it("en cok odeyen", () => {
    expect(
      primaryPayerId([
        { userId: "a", amount: 4000 },
        { userId: "b", amount: 8000 },
      ]),
    ).toBe("b");
  });

  it("ESITLIKTE listede ilk siradaki", () => {
    expect(
      primaryPayerId([
        { userId: "b", amount: 6000 },
        { userId: "a", amount: 6000 },
      ]),
    ).toBe("b");
  });
});

describe("orderPayers", () => {
  it("ana odeyen basta, sonra tutar azalan, esitlikte kimlik", () => {
    const ordered = orderPayers(
      [
        { userId: "c", amount: 1000 },
        { userId: "b", amount: 1000 },
        { userId: "main", amount: 500 },
        { userId: "d", amount: 3000 },
      ],
      "main",
    );
    expect(ordered.map((payer) => payer.userId)).toEqual(["main", "d", "b", "c"]);
  });

  it("girdiyi degistirmiyor", () => {
    const input = [
      { userId: "b", amount: 1000 },
      { userId: "a", amount: 2000 },
    ];
    orderPayers(input, "a");
    expect(input[0].userId).toBe("b");
  });
});

describe("payerRemainder", () => {
  it("tutardan digerlerini cikariyor", () => {
    expect(payerRemainder(12000, [3000, 2000])).toBe(7000);
  });

  it("okunamayan (null) satir sifir sayiliyor", () => {
    expect(payerRemainder(12000, [3000, null])).toBe(9000);
  });

  it("digerleri tutari asarsa NEGATIF - karari cagiran veriyor", () => {
    expect(payerRemainder(12000, [13000])).toBe(-1000);
  });
});

describe("payerLine", () => {
  const t = (code: string, params?: Record<string, unknown>) =>
    `${code}${params ? JSON.stringify(params) : ""}`;
  const nameOf = (id: string) => id.toUpperCase();

  it("tek odeyen", () => {
    expect(payerLine([{ userId: "a", amount: 100 }], "a", nameOf, t)).toBe(
      'ui.paid_by{"name":"A"}',
    );
  });

  it("alan gelmemisse (eski cevap) paidById'ye dusuyor", () => {
    expect(payerLine([], "a", nameOf, t)).toBe('ui.paid_by{"name":"A"}');
  });

  it("iki odeyen: ana odeyen once", () => {
    const line = payerLine(
      [
        { userId: "b", amount: 100 },
        { userId: "a", amount: 200 },
      ],
      "a",
      nameOf,
      t,
    );
    expect(line).toBe('ui.paid_by_two{"first":"A","second":"B"}');
  });

  it("uc ve fazlasi: ana odeyen ve SAYI", () => {
    const line = payerLine(
      [
        { userId: "a", amount: 300 },
        { userId: "b", amount: 200 },
        { userId: "c", amount: 100 },
      ],
      "a",
      nameOf,
      t,
    );
    expect(line).toBe('ui.paid_by_many{"first":"A","count":2}');
  });
});

describe("describePayers", () => {
  const nameOf = (id: string) => id.toUpperCase();
  const formatAmount = (amount: number) => (amount / 100).toFixed(2);

  it("tek odeyende yalnizca ad - tutar zaten yaninda", () => {
    expect(describePayers([{ userId: "a", amount: 12000 }], "a", nameOf, formatAmount)).toBe(
      "A",
    );
  });

  it("birden fazlasinda ad ve tutar, ana odeyen once", () => {
    const text = describePayers(
      [
        { userId: "b", amount: 4000 },
        { userId: "a", amount: 8000 },
      ],
      "a",
      nameOf,
      formatAmount,
    );
    expect(text).toBe("A 80.00 · B 40.00");
  });

  it("ayirici verilebiliyor (CSV ' + ' kullaniyor)", () => {
    const text = describePayers(
      [
        { userId: "a", amount: 8000 },
        { userId: "b", amount: 4000 },
      ],
      "a",
      nameOf,
      formatAmount,
      " + ",
    );
    expect(text).toBe("A 80.00 + B 40.00");
  });
});
