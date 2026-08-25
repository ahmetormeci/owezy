import { describe, expect, it } from "vitest";
import { diffExpenses, type ExpenseComparable } from "@/lib/expense-diff";

const USER_A = "user-a";
const USER_B = "user-b";
const USER_C = "user-c";

function expense(overrides: Partial<ExpenseComparable> = {}): ExpenseComparable {
  return {
    description: "Aksam yemegi",
    amount: 9000,
    category: "FOOD",
    splitType: "EQUAL",
    expenseDate: "2026-08-01",
    paidById: USER_A,
    participants: [
      { userId: USER_A, shareAmount: 4500, basisPoints: null },
      { userId: USER_B, shareAmount: 4500, basisPoints: null },
    ],
    ...overrides,
  };
}

describe("diffExpenses", () => {
  it("hicbir sey degismediyse bos dizi doner", () => {
    expect(diffExpenses(expense(), expense())).toEqual([]);
  });

  it("skaler alanlarin her birini onceki/sonraki degeriyle bildirir", () => {
    const changes = diffExpenses(
      expense(),
      expense({
        description: "Kahvalti",
        amount: 12000,
        category: "SHOPPING",
        splitType: "EXACT",
        expenseDate: "2026-08-09",
        paidById: USER_B,
      }),
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        { field: "description", before: "Aksam yemegi", after: "Kahvalti" },
        { field: "amount", before: 9000, after: 12000 },
        { field: "category", before: "FOOD", after: "SHOPPING" },
        { field: "splitType", before: "EQUAL", after: "EXACT" },
        { field: "expenseDate", before: "2026-08-01", after: "2026-08-09" },
        { field: "paidById", before: USER_A, after: USER_B },
      ]),
    );
  });

  // Tarih iki bicimde dolasiyor: sunucudan JSON'a cikarken tam ISO oluyor,
  // formlarda "YYYY-MM-DD" duruyor. Ayni gun, sirf bicim yuzunden degisiklik
  // gibi gorunmemeli - yoksa hicbir sey degismemis bir cakismada bile
  // "tarih degisti" yazardi.
  it("ayni gunun ISO ve kisa yazilisini ayni sayar", () => {
    const changes = diffExpenses(
      expense({ expenseDate: "2026-08-01" }),
      expense({ expenseDate: "2026-08-01T00:00:00.000Z" }),
    );

    expect(changes).toEqual([]);
  });

  it("eklenen ve cikarilan katilimcilari ayri ayri bildirir", () => {
    const changes = diffExpenses(
      expense(),
      expense({
        participants: [
          { userId: USER_A, shareAmount: 4500, basisPoints: null },
          { userId: USER_C, shareAmount: 4500, basisPoints: null },
        ],
      }),
    );

    expect(changes).toEqual([
      {
        field: "participants",
        addedUserIds: [USER_C],
        removedUserIds: [USER_B],
        sharesChanged: false,
      },
    ]);
  });

  // EN ONEMLI DURUM: EXACT bir bolusumde tutar da kisiler de ayni kalip
  // yalnizca dagilim degisebilir. Yakalamazsak cakisma "hicbir sey degismemis"
  // gibi gorunur ve kullanici neyin uzerine yazdigini goremez.
  it("kisiler ve tutar ayniyken pay dagilimi degistiyse bunu bildirir", () => {
    const changes = diffExpenses(
      expense(),
      expense({
        participants: [
          { userId: USER_A, shareAmount: 7000, basisPoints: null },
          { userId: USER_B, shareAmount: 2000, basisPoints: null },
        ],
      }),
    );

    expect(changes).toEqual([
      {
        field: "participants",
        addedUserIds: [],
        removedUserIds: [],
        sharesChanged: true,
      },
    ]);
  });

  it("paylar ayniyken yalnizca yuzde degistiyse de bildirir", () => {
    const changes = diffExpenses(
      expense({
        participants: [
          { userId: USER_A, shareAmount: 4500, basisPoints: 5000 },
          { userId: USER_B, shareAmount: 4500, basisPoints: 5000 },
        ],
      }),
      expense({
        participants: [
          { userId: USER_A, shareAmount: 4500, basisPoints: 4900 },
          { userId: USER_B, shareAmount: 4500, basisPoints: 5100 },
        ],
      }),
    );

    expect(changes).toEqual([
      { field: "participants", addedUserIds: [], removedUserIds: [], sharesChanged: true },
    ]);
  });

  // Mobil ekranin tipinde basisPoints yok (yalnizca esit bolusum duzenliyor).
  // Alani hic tasimayan bir istemcide undefined ile null farki sahte bir
  // "paylar degisti" uretmemeli.
  it("basisPoints hic gonderilmemesi ile null olmasi ayni sayilir", () => {
    const changes = diffExpenses(
      expense({
        participants: [
          { userId: USER_A, shareAmount: 4500 },
          { userId: USER_B, shareAmount: 4500 },
        ],
      }),
      expense(),
    );

    expect(changes).toEqual([]);
  });

  it("katilimci sirasi degisikligi tek basina fark sayilmaz", () => {
    const changes = diffExpenses(
      expense(),
      expense({
        participants: [
          { userId: USER_B, shareAmount: 4500, basisPoints: null },
          { userId: USER_A, shareAmount: 4500, basisPoints: null },
        ],
      }),
    );

    expect(changes).toEqual([]);
  });
});
