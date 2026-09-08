import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: fis fotografinin GUVENLIK dallarini.
 *
 * Fotograf kisisel veri tasiyor - uzerinde isim, adres, kartin son hanesi
 * olabilir. Uc sey sessizce bozulabilir ve ucu de burada sinaniyor:
 *   1. Turun ISTEMCININ SOZUNE gore belirlenmesi (kendi alan adimizda
 *      calistirilabilecek bir belge depolamak demek),
 *   2. Yetkinin gevsemesi (grubun disindaki birinin fisi gormesi),
 *   3. Silme SIRASININ ters donmesi (nesne gider, kayit kalir -> kirik gorsel).
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    expense: { findUnique: vi.fn() },
    expenseReceipt: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { mockPut, mockGet, mockDelete } = vi.hoisted(() => ({
  mockPut: vi.fn(),
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  putObject: mockPut,
  getObject: mockGet,
  deleteObject: mockDelete,
}));

const { mockAssertMember, mockAssertModify } = vi.hoisted(() => ({
  mockAssertMember: vi.fn(),
  mockAssertModify: vi.fn(),
}));
vi.mock("@/lib/group-access", () => ({
  assertActiveMemberOfGroup: mockAssertMember,
  assertCanModifyRecord: mockAssertModify,
}));

const { attachReceipt, readReceipt, removeReceipt, sniffImageType, MAX_RECEIPT_BYTES } =
  await import("@/lib/receipts");

const USER = "u1";
const EXPENSE = "e1";

/** Gercek JPEG'in ilk baytlari. Gerisi konu degil - tur bunlardan okunuyor. */
function jpeg(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes.buffer;
}

function png(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes.buffer;
}

beforeEach(() => {
  /**
   * mockReset, clearAllMocks DEGIL. clearAllMocks cagrilari siliyor ama
   * mockRejectedValue ile konan UYGULAMAYI birakiyor - yani bir testte
   * konan "reddet" davranisi sonraki testlere sizip onlari yetki hatasiyla
   * dusuruyordu. Belirtisi yaniltici: dusen test, sizintiyi yapan test
   * DEGIL.
   */
  vi.clearAllMocks();
  mockAssertMember.mockReset().mockResolvedValue(undefined);
  mockAssertModify.mockReset().mockResolvedValue(undefined);
  mockPut.mockReset().mockResolvedValue(undefined);
  mockGet.mockReset().mockResolvedValue(new ArrayBuffer(8));
  mockPrisma.expense.findUnique.mockResolvedValue({
    id: EXPENSE,
    groupId: "g1",
    createdById: USER,
    deletedAt: null,
  });
  mockPrisma.expenseReceipt.findUnique.mockResolvedValue(null);
  mockPrisma.expenseReceipt.upsert.mockResolvedValue({});
  mockDelete.mockResolvedValue(true);
});

describe("tur baytlardan okunuyor", () => {
  it("JPEG ve PNG taniniyor", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
  });

  it("HTML gorsel SAYILMIYOR", async () => {
    // ASIL TEST BU. Content-Type basligi istemcinin YAZDIGI bir metin;
    // "image/jpeg" deyip HTML gonderen biri, sundugumuz adreste tarayicinin
    // calistiracagi bir belge birakabilirdi - kendi alan adimizda XSS.
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    await expect(attachReceipt(USER, EXPENSE, html.buffer as ArrayBuffer)).rejects.toThrow();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("PDF de reddediliyor", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    await expect(attachReceipt(USER, EXPENSE, pdf.buffer as ArrayBuffer)).rejects.toThrow();
  });
});

describe("boyut", () => {
  it("SINIRIN USTU reddediliyor ve DEPOYA HIC GIDILMIYOR", async () => {
    await expect(
      attachReceipt(USER, EXPENSE, jpeg(MAX_RECEIPT_BYTES + 1)),
    ).rejects.toThrow();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("bos govde reddediliyor", async () => {
    await expect(attachReceipt(USER, EXPENSE, new ArrayBuffer(0))).rejects.toThrow();
  });
});

describe("yetki", () => {
  it("EKLEMEK harcamayi degistirme yetkisi istiyor", async () => {
    // Odemis olmak yetki VERMEZ: paidById'nin kendisi duzenlenebilir bir
    // alan (expenses.ts'teki gerekce). Fis eklemek de kaydi degistirmektir.
    await attachReceipt(USER, EXPENSE, jpeg());
    expect(mockAssertModify).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
      expect.objectContaining({ createdById: USER }),
      USER,
      "expense",
    );
  });

  it("yetki reddedilirse DEPOYA YAZILMIYOR", async () => {
    mockAssertModify.mockRejectedValue(new ForbiddenError("access.expense_creator_only"));
    await expect(attachReceipt(USER, EXPENSE, jpeg())).rejects.toThrow();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("OKUMAK yalnizca grubun aktif uyesi olmayi istiyor", async () => {
    // Fis grubun ortak kaydinin parcasi; herkes harcamayi zaten goruyor.
    mockPrisma.expenseReceipt.findUnique.mockResolvedValue({
      contentType: "image/jpeg",
      storageKey: "receipts/e1/a.jpg",
      expense: { groupId: "g1" },
    });
    mockGet.mockResolvedValue(new ArrayBuffer(8));

    await readReceipt("baska-uye", EXPENSE);
    expect(mockAssertMember).toHaveBeenCalledWith("g1", "baska-uye");
  });

  it("uye degilse BAYTLAR HIC OKUNMUYOR", async () => {
    mockPrisma.expenseReceipt.findUnique.mockResolvedValue({
      contentType: "image/jpeg",
      storageKey: "receipts/e1/a.jpg",
      expense: { groupId: "g1" },
    });
    mockAssertMember.mockRejectedValue(new ForbiddenError("group.not_member"));

    await expect(readReceipt("yabanci", EXPENSE)).rejects.toThrow();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe("silme sirasi", () => {
  it("ONCE KAYIT, SONRA NESNE", async () => {
    // Tersi olsaydi nesne gider, kayit kalir ve arayuz KIRIK GORSEL
    // gosterirdi (ADR-046). Sira burada olculuyor.
    const order: string[] = [];
    mockPrisma.expenseReceipt.findUnique.mockResolvedValue({
      storageKey: "receipts/e1/a.jpg",
      expense: { groupId: "g1", createdById: USER },
    });
    mockPrisma.expenseReceipt.delete.mockImplementation(async () => {
      order.push("kayit");
      return {};
    });
    mockDelete.mockImplementation(async () => {
      order.push("nesne");
      return true;
    });

    await removeReceipt(USER, EXPENSE);
    expect(order).toEqual(["kayit", "nesne"]);
  });

  it("DEGISTIRIRKEN eski nesne siliniyor", async () => {
    mockPrisma.expenseReceipt.findUnique.mockResolvedValue({ storageKey: "eski.jpg" });

    await attachReceipt(USER, EXPENSE, png());

    expect(mockDelete).toHaveBeenCalledWith("eski.jpg");
    // Yeni nesne once yazilmis olmali: kayit isaret ettigi nesne yokken
    // yazilsaydi arayuz kirik gorsel gosterirdi.
    expect(mockPut).toHaveBeenCalled();
  });
});

describe("silinmis harcama", () => {
  it("silinmis harcamaya fis EKLENEMIYOR", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: EXPENSE,
      groupId: "g1",
      createdById: USER,
      deletedAt: new Date(),
    });
    await expect(attachReceipt(USER, EXPENSE, jpeg())).rejects.toThrow();
  });
});
