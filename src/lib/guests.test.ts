import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: hesapsiz uyenin (misafir) KIM OLDUGUNU ve NE
 * YAPAMAYACAGINI (ADR-057).
 *
 * En agir kusur sessiz olurdu: bir misafirin giris yapabilmesi. Misafirin
 * e-postasi posta almiyor, ama adres tahmin edilebilir olsaydi ya da oturum
 * kancasi misafiri tanimasaydi, kimse fark etmeden birinin grubuna
 * baskasinin adiyla girilebilirdi. Asagidaki testlerin yarisi bunu kapatiyor.
 */

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    group: { findUnique: vi.fn() },
    groupMember: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    user: { create: vi.fn(), update: vi.fn() },
  };
  return {
    mockTx: tx,
    mockPrisma: {
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  GUEST_REFERENCE_POLICY,
  MAX_GUESTS_PER_GROUP,
  addGuest,
  claimGuest,
  createGuestInvite,
  guestEmail,
  hashInviteToken,
  isGuestEmail,
  mayOpenSession,
  renameGuest,
} = await import("@/lib/guests");

const CALLER = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  for (const model of Object.values(mockTx)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  mockPrisma.user.findUnique.mockReset();
  mockTx.group.findUnique.mockResolvedValue({ id: GROUP, deletedAt: null });
  mockTx.groupMember.findFirst.mockResolvedValue({ id: "m-caller" });
  mockTx.groupMember.count.mockResolvedValue(0);
  mockTx.user.create.mockResolvedValue({ id: GUEST, displayName: "Selin" });
  mockTx.groupMember.create.mockResolvedValue({ id: "m-guest" });
});

describe("misafir e-postasi", () => {
  it("POSTA ALMAYAN ve TAHMIN EDILEMEYEN bir adres", () => {
    const email = guestEmail();

    // .invalid RFC 2606: hicbir zaman cozulmeyen alan adi. Veritabanindaki
    // CHECK tam olarak bu kalibi bekliyor.
    expect(email).toMatch(
      /^guest-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@guest\.invalid$/,
    );
    expect(guestEmail()).not.toBe(email);
  });

  it("misafir adresini buyuk-kucuk harf farkina bakmadan taniyor", () => {
    expect(isGuestEmail("guest-x@guest.invalid")).toBe(true);
    expect(isGuestEmail("GUEST-X@GUEST.INVALID")).toBe(true);
    expect(isGuestEmail("selin@example.com")).toBe(false);
    // Silinen hesaplarin alan adi AYRI; ikisi karismamali.
    expect(isGuestEmail("deleted+x@deleted.invalid")).toBe(false);
  });
});

describe("oturum", () => {
  it("MISAFIRE oturum ACILMIYOR", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isGuest: true });

    await expect(mayOpenSession(GUEST)).resolves.toBe(false);
  });

  it("gercek kullaniciya aciliyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isGuest: false });

    await expect(mayOpenSession(CALLER)).resolves.toBe(true);
  });
});

describe("addGuest", () => {
  it("misafiri KENDI GRUBUNA bagli, isaretli bir kullanici olarak yaratiyor", async () => {
    const result = await addGuest(CALLER, GROUP, { displayName: "Selin" });

    const data = mockTx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ displayName: "Selin", isGuest: true, guestGroupId: GROUP });
    expect(isGuestEmail(data.email)).toBe(true);
    expect(result).toEqual({ userId: GUEST, displayName: "Selin", isGuest: true });
  });

  it("uyeligi SIRADAN UYE ve EKLEYENE bagli - sahip DEGIL", async () => {
    await addGuest(CALLER, GROUP, { displayName: "Selin" });

    expect(mockTx.groupMember.create).toHaveBeenCalledWith({
      data: { groupId: GROUP, userId: GUEST, role: "MEMBER", invitedById: CALLER },
    });
  });

  it("uye olmayan EKLEYEMIYOR", async () => {
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(addGuest(CALLER, GROUP, { displayName: "Selin" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(mockTx.user.create).not.toHaveBeenCalled();
  });

  it("silinmis gruba EKLENEMIYOR", async () => {
    mockTx.group.findUnique.mockResolvedValue({ id: GROUP, deletedAt: new Date() });

    await expect(addGuest(CALLER, GROUP, { displayName: "Selin" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it(`TAVAN: grupta ${MAX_GUESTS_PER_GROUP} aktif misafir varken yenisi eklenmiyor`, async () => {
    mockTx.groupMember.count.mockResolvedValue(MAX_GUESTS_PER_GROUP);

    const error = await addGuest(CALLER, GROUP, { displayName: "Selin" }).catch((e) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe("guest.limit");
    expect(error.params).toEqual({ max: MAX_GUESTS_PER_GROUP });
    expect(mockTx.user.create).not.toHaveBeenCalled();
  });

  it("tavan YALNIZCA AKTIF MISAFIRLERI sayiyor", async () => {
    await addGuest(CALLER, GROUP, { displayName: "Selin" });

    // Cikarilmis misafirler ve gercek uyeler tavana girmemeli.
    expect(mockTx.groupMember.count).toHaveBeenCalledWith({
      where: { groupId: GROUP, leftAt: null, user: { isGuest: true } },
    });
  });
});

describe("renameGuest", () => {
  it("BU GRUBUN AKTIF MISAFIRINI ariyor - baska bir seyi degil", async () => {
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller" })
      .mockResolvedValueOnce({ id: "m-guest" });
    mockTx.user.update.mockResolvedValue({ id: GUEST, displayName: "Selin K." });

    await renameGuest(CALLER, GROUP, GUEST, { displayName: "Selin K." });

    // Gercek bir uyenin ya da baska grubun misafirinin adi buradan
    // DEGISTIRILEMEMELI; kosul sorgunun kendisinde.
    expect(mockTx.groupMember.findFirst).toHaveBeenLastCalledWith({
      where: {
        groupId: GROUP,
        userId: GUEST,
        leftAt: null,
        user: { isGuest: true, guestGroupId: GROUP },
      },
      select: { id: true },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: GUEST },
      data: { displayName: "Selin K." },
      select: { id: true, displayName: true },
    });
  });

  it("misafir degilse ya da baska gruptaysa BULUNAMADI - kimlik sizdirilmiyor", async () => {
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller" })
      .mockResolvedValueOnce(null);

    const error = await renameGuest(CALLER, GROUP, GUEST, { displayName: "X" }).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe("guest.not_found");
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("uye olmayan DEGISTIREMIYOR", async () => {
    mockTx.groupMember.findFirst.mockResolvedValue(null);

    await expect(
      renameGuest(CALLER, GROUP, GUEST, { displayName: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// SAHIPLENME (Faz 50b)
// ---------------------------------------------------------------------------

describe("siniflama - semadaki HER User iliskisi", () => {
  /**
   * EN ONEMLI TEST BU. Sahiplenme misafirin kayitlarini tasiyor; tasinmasi
   * unutulan bir tablo, misafirin o satirlarini SAHIPSIZ birakir ve bunu
   * hicbir sey haber vermez. Burada sema dosyasi okunuyor: "User"a baglanan
   * her alan GUEST_REFERENCE_POLICY'de olmak ZORUNDA, fazlasi da olamaz.
   * Yeni bir tablo eklenip siniflanmazsa bu test duser.
   */
  it("politika semadaki User iliskileriyle BIREBIR ayni", async () => {
    const { readFileSync } = await import("node:fs");
    const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

    const references: string[] = [];
    for (const model of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      for (const line of model[2].split("\n")) {
        const relation = line.trim().match(/^\w+\s+User\??\s+.*@relation\(([^)]*)\)/);
        const fields = relation?.[1].match(/fields:\s*\[([^\]]+)\]/);
        if (fields) references.push(`${model[1]}.${fields[1].trim()}`);
      }
    }

    // Kendini dogrulayan bir kontrol: ayristirici bir sey bulamazsa test
    // "ikisi de bos" diye sessizce gecmesin.
    expect(references.length).toBeGreaterThan(20);
    expect([...references].sort()).toEqual(Object.keys(GUEST_REFERENCE_POLICY).sort());
  });
});

describe("claimGuest", () => {
  const CLAIMER = "44444444-4444-4444-8444-444444444444";

  /** "never" sorgusunun "hic satir yok" cevabi: her alan icin sifir. */
  function zeroCounts(): Record<string, number> {
    return Object.fromEntries(
      Object.entries(GUEST_REFERENCE_POLICY)
        .filter(([, policy]) => policy === "never")
        .map(([key]) => [key, 0]),
    );
  }

  /** Politikadaki her model icin updateMany; ustune ozel sorgular. */
  function claimTx() {
    const tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
    for (const key of Object.keys(GUEST_REFERENCE_POLICY)) {
      const model = key.split(".")[0];
      const name = model.charAt(0).toLowerCase() + model.slice(1);
      tx[name] ??= { updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
    }
    tx.groupMember.findFirst = vi
      .fn()
      .mockResolvedValueOnce(null) // sahiplenen daha once uye olmamis
      .mockResolvedValueOnce({ id: "m-guest" }); // misafir hala grupta
    tx.user.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    (tx as unknown as { $queryRawUnsafe: ReturnType<typeof vi.fn> }).$queryRawUnsafe = vi
      .fn()
      .mockResolvedValue([zeroCounts()]);
    return tx;
  }

  function rawQuery(tx: ReturnType<typeof claimTx>) {
    return (tx as unknown as { $queryRawUnsafe: ReturnType<typeof vi.fn> }).$queryRawUnsafe;
  }

  const moveKeys = Object.entries(GUEST_REFERENCE_POLICY)
    .filter(([, policy]) => policy === "move")
    .map(([key]) => key);
  const neverKeys = Object.entries(GUEST_REFERENCE_POLICY)
    .filter(([, policy]) => policy === "never")
    .map(([key]) => key);

  function delegate(tx: ReturnType<typeof claimTx>, key: string) {
    const model = key.split(".")[0];
    return tx[model.charAt(0).toLowerCase() + model.slice(1)];
  }

  /**
   * SINIFLAMANIN KENDISI de sabitleniyor. Ustteki sema testi her alanin
   * siniflandigini tutuyor ama DOGRU siniflandigini tutmuyor: biri yarin
   * "ExpenseItemShare.userId"i "move"dan "keep"e cevirse, asagidaki test
   * onu artik tasinanlar arasinda aramaz ve hicbir sey dusmezdi. Bu liste
   * elle yazildi - degistirmek BILINCLI bir test degisikligi ister.
   */
  it("TASINAN alanlar tam olarak bunlar - misafirin parayla ilgili her izi", () => {
    expect([...moveKeys].sort()).toEqual(
      [
        "Expense.paidById",
        "ExpenseItemShare.userId",
        "ExpenseParticipant.userId",
        "GroupMember.userId",
        "RecurringExpense.paidById",
        "RecurringExpenseShare.userId",
        "Settlement.fromUserId",
        "Settlement.toUserId",
      ].sort(),
    );
  });

  it("'move' alanlarinin HER BIRINI sahiplenene tasiyor", async () => {
    const tx = claimTx();

    await claimGuest(tx as never, CLAIMER, GROUP, GUEST);

    for (const key of moveKeys) {
      const field = key.split(".")[1];
      expect(delegate(tx, key).updateMany, key).toHaveBeenCalledWith({
        where: { [field]: GUEST },
        data: { [field]: CLAIMER },
      });
    }
  });

  it("'never' alanlarinin HER BIRINDE misafire ait satir ariyor - TEK sorguda", async () => {
    const tx = claimTx();

    await claimGuest(tx as never, CLAIMER, GROUP, GUEST);

    // Tek gidis donus: ilk yazimdaki 19 ayri sorgu, uzak veritabaninda
    // transaction'in 5 saniyelik sinirini asti (E2E'de olculdu).
    expect(rawQuery(tx)).toHaveBeenCalledTimes(1);
    const [sql, param] = rawQuery(tx).mock.calls[0];
    expect(param).toBe(GUEST);
    for (const key of neverKeys) {
      const [model, field] = key.split(".");
      expect(sql, key).toContain(`FROM "${model}" WHERE "${field}" = $1::uuid`);
    }
    // Deger PARAMETRE: sorgu metninde misafirin kimligi yok.
    expect(sql).not.toContain(GUEST);
  });

  it("'never' alaninda misafire ait bir satir varsa DURUYOR ve HICBIR SEY tasinmiyor", async () => {
    const tx = claimTx();
    rawQuery(tx).mockResolvedValue([{ ...zeroCounts(), "ExpenseComment.userId": 1 }]);

    await expect(claimGuest(tx as never, CLAIMER, GROUP, GUEST)).rejects.toThrow(
      /ExpenseComment\.userId=1/,
    );
    expect(tx.expenseParticipant.updateMany).not.toHaveBeenCalled();
  });

  it("misafiri 'henuz devredilmediyse' KOSULUYLA isaretliyor - yaris burada kapaniyor", async () => {
    const tx = claimTx();

    await claimGuest(tx as never, CLAIMER, GROUP, GUEST);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: GUEST, isGuest: true, guestGroupId: GROUP, mergedIntoId: null },
      data: { mergedIntoId: CLAIMER, mergedAt: expect.any(Date) },
    });
  });

  it("baskasi once davrandiysa (kosul tutmadi) REDDEDILIYOR ve hicbir sey tasinmiyor", async () => {
    const tx = claimTx();
    tx.user.updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const error = await claimGuest(tx as never, CLAIMER, GROUP, GUEST).catch((e) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe("guest.already_claimed");
    expect(tx.expense.updateMany).not.toHaveBeenCalled();
    expect(tx.expenseParticipant.updateMany).not.toHaveBeenCalled();
  });

  it("gruba DAHA ONCE UYE OLMUS biri sahiplenemiyor - paylar cakisirdi", async () => {
    const tx = claimTx();
    tx.groupMember.findFirst = vi.fn().mockResolvedValue({ id: "eski-uyelik" });

    const error = await claimGuest(tx as never, CLAIMER, GROUP, GUEST).catch((e) => e);

    expect(error.code).toBe("guest.claim_already_member");
    // Ayrilmis uyelik de sayiliyor: sorguda leftAt kosulu YOK.
    expect(tx.groupMember.findFirst).toHaveBeenCalledWith({
      where: { groupId: GROUP, userId: CLAIMER },
      select: { id: true },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("gruptan cikarilmis misafir sahiplenilemiyor", async () => {
    const tx = claimTx();
    tx.groupMember.findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(claimGuest(tx as never, CLAIMER, GROUP, GUEST)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("misafirin dahil oldugu harcamalarin SURUM SAYACI artiyor - TASIMADAN ONCE", async () => {
    const tx = claimTx();

    await claimGuest(tx as never, CLAIMER, GROUP, GUEST);

    // Ilk cagri surum; sonra gelen, "Expense.paidById" tasimasi. Sira ters
    // olsaydi misafir artik hicbir harcamada gorunmez, sayac hic artmazdi.
    expect(tx.expense.updateMany.mock.calls[0][0]).toEqual({
      where: {
        groupId: GROUP,
        OR: [{ paidById: GUEST }, { participants: { some: { userId: GUEST } } }],
      },
      data: { version: { increment: 1 } },
    });
    expect(tx.expense.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.expenseParticipant.updateMany.mock.invocationCallOrder[0],
    );
  });
});

describe("createGuestInvite", () => {
  beforeEach(() => {
    (mockTx as Record<string, unknown>).groupInvite = {
      create: vi.fn().mockResolvedValue({ id: "inv-1", expiresAt: new Date() }),
    };
  });

  it("TEK KULLANIMLIK, 7 gunluk, misafire BAGLI bir davet uretiyor - ham kod saklanmiyor", async () => {
    mockTx.groupMember.findFirst
      .mockResolvedValueOnce({ id: "m-caller" })
      .mockResolvedValueOnce({ id: "m-guest" });

    const result = await createGuestInvite(CALLER, GROUP, GUEST);

    const create = (mockTx as unknown as { groupInvite: { create: ReturnType<typeof vi.fn> } })
      .groupInvite.create;
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ groupId: GROUP, invitedById: CALLER, maxUses: 1, guestUserId: GUEST });
    expect(data.tokenHash).toBe(hashInviteToken(result.token));
    expect(data.tokenHash).not.toBe(result.token);
    const days = (data.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("devralinmis, cikarilmis ya da baska grubun misafiri icin link URETILMIYOR", async () => {
    mockTx.groupMember.findFirst.mockResolvedValueOnce({ id: "m-caller" }).mockResolvedValueOnce(null);

    const error = await createGuestInvite(CALLER, GROUP, GUEST).catch((e) => e);

    expect(error.code).toBe("guest.not_found");
    expect(mockTx.groupMember.findFirst).toHaveBeenLastCalledWith({
      where: {
        groupId: GROUP,
        userId: GUEST,
        leftAt: null,
        user: { isGuest: true, guestGroupId: GROUP, mergedIntoId: null },
      },
      select: { id: true },
    });
  });
});
