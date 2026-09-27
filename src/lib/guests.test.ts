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
  MAX_GUESTS_PER_GROUP,
  addGuest,
  guestEmail,
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
