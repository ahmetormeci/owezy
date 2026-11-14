import { describe, expect, it } from "vitest";
import { expenseBodySchema, templateExpenseBodySchema } from "@/lib/expense-schemas";
import { MAX_EXPENSE_PAYERS } from "@/lib/payers";

/**
 * Odeyenlerin IKI GOVDE BICIMI (ADR-067).
 *
 * Magazadaki 1.0.7 yalnizca paidById gonderiyor ve gondermeye devam edecek;
 * yeni istemciler payers gonderiyor. Ikisinin de gecmesi, ikisinin birden
 * ya da hicbirinin gelmemesinin reddedilmesi API sozlesmesinin parcasi.
 */

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const base = {
  description: "Market",
  amount: 12000,
  splitType: "EQUAL" as const,
  participantUserIds: [A, B],
};

describe("expenseBodySchema - odeyenler", () => {
  it("ESKI govde (yalnizca paidById) geciyor", () => {
    const result = expenseBodySchema.safeParse({ ...base, paidById: A });
    expect(result.success).toBe(true);
  });

  it("YENI govde (yalnizca payers) geciyor", () => {
    const result = expenseBodySchema.safeParse({
      ...base,
      payers: [
        { userId: A, amount: 8000 },
        { userId: B, amount: 4000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("ikisi BIRDEN reddediliyor - hangisinin kazandigi sozlesmede yok", () => {
    const result = expenseBodySchema.safeParse({
      ...base,
      paidById: A,
      payers: [{ userId: A, amount: 12000 }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      message: "validation.invalid",
      path: ["payers"],
    });
  });

  it("HICBIRI yoksa reddediliyor", () => {
    const result = expenseBodySchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("bos payers listesi reddediliyor", () => {
    const result = expenseBodySchema.safeParse({ ...base, payers: [] });
    expect(result.success).toBe(false);
  });

  it(`en fazla ${MAX_EXPENSE_PAYERS} odeyen`, () => {
    const payers = Array.from({ length: MAX_EXPENSE_PAYERS + 1 }, () => ({
      userId: A,
      amount: 1,
    }));
    const result = expenseBodySchema.safeParse({ ...base, payers });
    expect(result.success).toBe(false);
  });

  it("kesirli odeyen tutari reddediliyor - para kurus cinsinden tam sayi", () => {
    const result = expenseBodySchema.safeParse({
      ...base,
      payers: [
        { userId: A, amount: 11999.5 },
        { userId: B, amount: 0.5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("kalem kalem bolusum de payers kabul ediyor", () => {
    const result = expenseBodySchema.safeParse({
      description: "Restoran",
      amount: 12000,
      splitType: "ITEMIZED",
      items: [{ description: "Pizza", amount: 12000, userIds: [A, B] }],
      payers: [
        { userId: A, amount: 6000 },
        { userId: B, amount: 6000 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("templateExpenseBodySchema - sablon TEK odeyenli (S3)", () => {
  it("paidById ile geciyor", () => {
    const result = templateExpenseBodySchema.safeParse({ ...base, paidById: A });
    expect(result.success).toBe(true);
  });

  it("yalnizca payers ile REDDEDILIYOR", () => {
    const result = templateExpenseBodySchema.safeParse({
      ...base,
      payers: [
        { userId: A, amount: 8000 },
        { userId: B, amount: 4000 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
