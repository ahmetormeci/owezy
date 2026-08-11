import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { mockAuth, mockCurrentUser, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: mockPrisma.user },
}));

const { getOrCreateCurrentUser } = await import("@/lib/auth");

const CLERK_ID = "user_clerk_1";

/** Gercek Prisma'nin benzersizlik ihlalinde firlattigi hatanin aynisi. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.9.0",
    meta: { modelName: "User", target: ["clerkId"] },
  });
}

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    primaryEmailAddressId: "email-1",
    emailAddresses: [
      { id: "email-0", emailAddress: "eski@example.com" },
      { id: "email-1", emailAddress: "ahmet@example.com" },
    ],
    firstName: "Ahmet",
    lastName: "Ormeci",
    imageUrl: "https://img.example.com/a.png",
    ...overrides,
  };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
  mockPrisma.user.findUnique.mockReset();
  mockPrisma.user.create.mockReset();

  mockAuth.mockResolvedValue({ userId: CLERK_ID });
  mockCurrentUser.mockResolvedValue(clerkUser());
});

describe("getOrCreateCurrentUser", () => {
  it("oturum yoksa null doner ve veritabanina dokunmaz", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(getOrCreateCurrentUser()).resolves.toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("kayit zaten varsa onu doner ve yeni kayit olusturmaz", async () => {
    const existing = { id: "db-1", clerkId: CLERK_ID };
    mockPrisma.user.findUnique.mockResolvedValue(existing);

    await expect(getOrCreateCurrentUser()).resolves.toBe(existing);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("kayit yoksa birincil e-posta ile olusturur", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "db-1" });

    await getOrCreateCurrentUser();

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        clerkId: CLERK_ID,
        // Listedeki ilk e-posta degil, primaryEmailAddressId ile eslesen secilmeli.
        email: "ahmet@example.com",
        displayName: "Ahmet Ormeci",
        avatarUrl: "https://img.example.com/a.png",
      },
    });
  });

  it("ad soyad yoksa gorunen ad olarak e-postayi kullanir", async () => {
    mockCurrentUser.mockResolvedValue(clerkUser({ firstName: null, lastName: null }));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "db-1" });

    await getOrCreateCurrentUser();

    expect(mockPrisma.user.create.mock.calls[0][0].data.displayName).toBe(
      "ahmet@example.com",
    );
  });

  it("hic e-posta yoksa anlamli bir hata firlatir", async () => {
    mockCurrentUser.mockResolvedValue(
      clerkUser({ emailAddresses: [], primaryEmailAddressId: null }),
    );
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(getOrCreateCurrentUser()).rejects.toThrow(/e-posta adresi bulunamadı/);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  // Asil senaryo: ayni kullanicinin iki istegi ayni anda gelir, ikisi de
  // "kayit yok" gorur, ikisi de olusturmaya calisir. Kaybeden istek patlamamali.
  it("es zamanli istek kaydi once olusturduysa P2002'yi yutup mevcut kaydi doner", async () => {
    const winner = { id: "db-1", clerkId: CLERK_ID };
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // ilk kontrol: henuz yok
      .mockResolvedValueOnce(winner); // yaristan sonra: rakip olusturmus
    mockPrisma.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(getOrCreateCurrentUser()).resolves.toBe(winner);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("P2002 sonrasi kayit yine bulunamazsa hatayi gizlemez", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(uniqueConstraintError());

    await expect(getOrCreateCurrentUser()).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("P2002 disindaki veritabani hatalarini oldugu gibi firlatir", async () => {
    const foreignKeyError = new Prisma.PrismaClientKnownRequestError("FK hatasi", {
      code: "P2003",
      clientVersion: "7.9.0",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(foreignKeyError);

    await expect(getOrCreateCurrentUser()).rejects.toBe(foreignKeyError);
    // Baska bir hatada ikinci okuma yapilmamali.
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
