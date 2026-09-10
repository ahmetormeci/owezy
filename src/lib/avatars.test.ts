import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * BU DOSYA NEYI KORUYOR: profil fotografinin GUVENLIK ve DAYANIKLILIK
 * dallarini (ADR-054).
 *
 * Bir avatar bir YUZ. Fisle ayni aileden ama yetkisi FARKLI: fis bir gruba
 * ait, avatar bir kisiye. Burada sinanan dort sey:
 *   1. Turun ISTEMCININ SOZUNE gore belirlenmemesi,
 *   2. Yetkinin gevsemesi - ortak grubu OLMAYAN birinin fotografi gormesi,
 *   3. Silme SIRASI (once kayit, sonra nesne) - tersi kirik gorsel birakir,
 *   4. Yazma SIRASI (once nesne, sonra kayit) - tersi de kirik gorsel birakir.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    groupMember: { findFirst: vi.fn() },
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

const { setAvatar, readAvatar, removeAvatar, contentTypeForKey, MAX_AVATAR_BYTES } =
  await import("@/lib/avatars");

const ME = "u1";
const OTHER = "u2";

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

/** Gercek bir GIF. Kabul edilmemeli - yalnizca JPEG ve PNG geciyor. */
function gif(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  return bytes.buffer;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPut.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(true);
  mockPrisma.user.update.mockResolvedValue({});
});

describe("fotograf koyma", () => {
  it("JPEG kabul ediliyor ve ONCE DEPOYA sonra veritabanina yaziliyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      avatarStorageKey: null,
      deletedAt: null,
    });

    const order: string[] = [];
    mockPut.mockImplementation(async () => {
      order.push("depo");
    });
    mockPrisma.user.update.mockImplementation(async () => {
      order.push("veritabani");
      return {};
    });

    await setAvatar(ME, jpeg());

    // Ters sira, isaret ettigi nesne yokken yazilmis bir kayit demek olurdu.
    expect(order).toEqual(["depo", "veritabani"]);
  });

  it("HER YUKLEME YENI BIR ANAHTAR aliyor - eskinin ustune yazmiyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      avatarStorageKey: "avatars/u1/eski.jpg",
      deletedAt: null,
    });

    await setAvatar(ME, jpeg());

    const key = mockPut.mock.calls[0][0] as string;
    expect(key).not.toBe("avatars/u1/eski.jpg");
    expect(key.startsWith("avatars/u1/")).toBe(true);

    // Adres de anahtarla birlikte degisiyor: tarayicidaki eski fotograf
    // boylece onbellekten gelmeye devam etmiyor.
    const written = mockPrisma.user.update.mock.calls[0][0].data;
    expect(written.avatarUrl).toContain("/api/v1/users/u1/avatar?v=");
    expect(written.hasImage).toBe(true);

    // Eskisi de temizleniyor.
    expect(mockDelete).toHaveBeenCalledWith("avatars/u1/eski.jpg");
  });

  it("PNG kabul ediliyor ve uzanti turu tasiyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarStorageKey: null, deletedAt: null });

    await setAvatar(ME, png());

    const key = mockPut.mock.calls[0][0] as string;
    expect(key.endsWith(".png")).toBe(true);
    expect(contentTypeForKey(key)).toBe("image/png");
  });

  it("GIF REDDEDILIYOR - tur baytlardan okunuyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarStorageKey: null, deletedAt: null });

    await expect(setAvatar(ME, gif())).rejects.toMatchObject({
      code: "avatar.unsupported_type",
    });
    // Reddedilen bir dosya DEPOYA HIC GITMIYOR.
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("bos dosya reddediliyor", async () => {
    await expect(setAvatar(ME, new ArrayBuffer(0))).rejects.toBeInstanceOf(ValidationError);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("sinirin USTUNDEKI dosya reddediliyor", async () => {
    await expect(setAvatar(ME, jpeg(MAX_AVATAR_BYTES + 1))).rejects.toMatchObject({
      code: "avatar.too_large",
    });
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe("fotograf okuma - YETKI", () => {
  const OWNER_ROW = {
    avatarStorageKey: "avatars/u2/abc.jpg",
    hasImage: true,
    deletedAt: null,
  };

  it("KENDI fotografini ortak grup aranmadan gorebiliyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...OWNER_ROW,
      avatarStorageKey: "avatars/u1/abc.jpg",
    });
    mockGet.mockResolvedValue(new ArrayBuffer(8));

    await readAvatar(ME, ME);

    expect(mockPrisma.groupMember.findFirst).not.toHaveBeenCalled();
  });

  it("ORTAK GRUBU OLAN gorebiliyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(OWNER_ROW);
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "gm1" });
    mockGet.mockResolvedValue(new ArrayBuffer(8));

    const result = await readAvatar(ME, OTHER);

    expect(result.contentType).toBe("image/jpeg");
  });

  it("ORTAK GRUBU OLMAYAN GOREMIYOR", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(OWNER_ROW);
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(readAvatar(ME, OTHER)).rejects.toBeInstanceOf(ForbiddenError);
    // Yetkisiz istek DEPOYA HIC GITMIYOR.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("AYRILMIS uyelik yetki VERMIYOR - sorgu leftAt: null ariyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(OWNER_ROW);
    mockPrisma.groupMember.findFirst.mockResolvedValue(null);

    await expect(readAvatar(ME, OTHER)).rejects.toBeInstanceOf(ForbiddenError);

    const where = mockPrisma.groupMember.findFirst.mock.calls[0][0].where;
    expect(where.leftAt).toBeNull();
    expect(where.group.deletedAt).toBeNull();
    expect(where.group.members.some.leftAt).toBeNull();
  });

  it("hasImage false ise fotograf YOK - yetki bile sorulmuyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      avatarStorageKey: "avatars/u2/abc.jpg",
      hasImage: false,
      deletedAt: null,
    });

    await expect(readAvatar(ME, OTHER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("SILINMIS hesabin fotografi gorunmuyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...OWNER_ROW, deletedAt: new Date() });

    await expect(readAvatar(ME, OTHER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("kayit var nesne yok ise 'fotograf yok' donuyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(OWNER_ROW);
    mockPrisma.groupMember.findFirst.mockResolvedValue({ id: "gm1" });
    mockGet.mockResolvedValue(null);

    await expect(readAvatar(ME, OTHER)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("fotograf kaldirma", () => {
  it("ONCE KAYIT sonra nesne siliniyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      avatarStorageKey: "avatars/u1/abc.jpg",
      deletedAt: null,
    });

    const order: string[] = [];
    mockPrisma.user.update.mockImplementation(async () => {
      order.push("kayit");
      return {};
    });
    mockDelete.mockImplementation(async () => {
      order.push("nesne");
      return true;
    });

    await removeAvatar(ME);

    // Ters sira, depoda olmayan bir nesneye isaret eden kayit birakirdi.
    expect(order).toEqual(["kayit", "nesne"]);

    const written = mockPrisma.user.update.mock.calls[0][0].data;
    expect(written.avatarStorageKey).toBeNull();
    expect(written.avatarUrl).toBeNull();
    expect(written.hasImage).toBe(false);
  });

  it("fotografi olmayanda 'yok' donuyor, kayda dokunmuyor", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarStorageKey: null, deletedAt: null });

    await expect(removeAvatar(ME)).rejects.toBeInstanceOf(NotFoundError);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
