import { describe, expect, it } from "vitest";
import {
  extraPayerDrafts,
  netOnExpense,
  payerFormState,
  payersBody,
} from "./payer-form";

/**
 * Mobil formlarin odeyen satirlari (ADR-067). Ekrandaki "kalan" ile
 * gonderilen tutar ayni fonksiyondan geciyor; burada o kurallar
 * sabitleniyor. Ekranlarin kendisi test/screens/*-payers.test.tsx'te.
 */

describe("extraPayerDrafts", () => {
  it("ana odeyen DISINDAKILER, tutar azalan, alana yazildigi bicimde", () => {
    const drafts = extraPayerDrafts(
      [
        { userId: "a", amount: 1000 },
        { userId: "main", amount: 6000 },
        { userId: "b", amount: 3050 },
      ],
      "main",
      "tr",
    );
    expect(drafts).toEqual([
      { userId: "b", amountText: "30,50" },
      { userId: "a", amountText: "10" },
    ]);
  });

  it("alan gelmediyse (eski cevap) ek satir yok", () => {
    expect(extraPayerDrafts(undefined, "main", "tr")).toEqual([]);
  });
});

describe("payerFormState", () => {
  it("tek odeyende kalan tutarin tamami, hata yok", () => {
    expect(payerFormState(10000, [])).toEqual({ rest: 10000, error: null, exceeds: false });
  });

  it("ilk satir digerlerinden kalani aliyor", () => {
    const state = payerFormState(10000, [{ userId: "b", amountText: "70" }]);
    expect(state).toEqual({ rest: 3000, error: null, exceeds: false });
  });

  it("bos ya da okunamayan satir: eksik tutar, canli hata DEGIL", () => {
    const state = payerFormState(10000, [{ userId: "b", amountText: "" }]);
    expect(state.error).toBe("ui.each_payer_amount_required");
    expect(state.exceeds).toBe(false);
  });

  it("SIFIR yazilan satir da eksik sayiliyor - hicbir sey odememis biri odeyen degil", () => {
    expect(payerFormState(10000, [{ userId: "b", amountText: "0" }]).error).toBe(
      "ui.each_payer_amount_required",
    );
  });

  it("digerleri tutari doldurursa ilk satira kalan yok", () => {
    const state = payerFormState(10000, [{ userId: "b", amountText: "100" }]);
    expect(state).toEqual({ rest: 0, error: "ui.payers_exceed", exceeds: true });
  });

  it("tutar okunamiyorsa kalan bilinmiyor, asma da soylenmiyor", () => {
    const state = payerFormState(null, [{ userId: "b", amountText: "70" }]);
    expect(state).toEqual({ rest: null, error: null, exceeds: false });
  });
});

describe("payersBody", () => {
  it("tek odeyende de LISTE: tutarin tamami", () => {
    expect(payersBody("me", 10000, [])).toEqual([{ userId: "me", amount: 10000 }]);
  });

  it("ana odeyen kalani, digerleri yazdiklarini", () => {
    expect(payersBody("me", 10000, [{ userId: "b", amountText: "70" }])).toEqual([
      { userId: "me", amount: 3000 },
      { userId: "b", amount: 7000 },
    ]);
  });
});

describe("netOnExpense", () => {
  const participants = [
    { userId: "me", shareAmount: 5000 },
    { userId: "b", shareAmount: 5000 },
  ];

  it("tek odeyen ben: tutarin tamami eksi payim (alacak)", () => {
    expect(
      netOnExpense({ amount: 10000, paidById: "me", participants }, "me"),
    ).toBe(5000);
  });

  it("tek odeyen baskasi: eksi payim (borc)", () => {
    expect(netOnExpense({ amount: 10000, paidById: "b", participants }, "me")).toBe(-5000);
  });

  it("iki odeyen: odeyenlerden biri olsam da az odediysem borcluyum", () => {
    const expense = {
      amount: 10000,
      paidById: "b",
      payers: [
        { userId: "b", amount: 7000 },
        { userId: "me", amount: 3000 },
      ],
      participants,
    };
    expect(netOnExpense(expense, "me")).toBe(-2000);
    expect(netOnExpense(expense, "b")).toBe(2000);
  });

  it("tam payim kadar odediysem net sifir", () => {
    const expense = {
      amount: 10000,
      paidById: "b",
      payers: [
        { userId: "b", amount: 5000 },
        { userId: "me", amount: 5000 },
      ],
      participants,
    };
    expect(netOnExpense(expense, "me")).toBe(0);
  });

  it("bolusumde yoksam yalnizca odedigim", () => {
    expect(
      netOnExpense(
        { amount: 10000, paidById: "me", participants: [{ userId: "b", shareAmount: 10000 }] },
        "me",
      ),
    ).toBe(10000);
  });
});
