import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const { mockTx, mockPrisma } = vi.hoisted(() => ({
  mockTx: {
    user: { findUnique: vi.fn() },
    notification: { createMany: vi.fn() },
  },
  mockPrisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: mockPrisma.notification },
}));

const {
  createNotifications,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = await import("@/lib/notifications");

// mockTx yalnizca createNotifications'in gercekten kullandigi iki modeli
// tasiyor; Prisma'nin tam TransactionClient tipini karsilamiyor. Testin
// ilgilendigi davranis icin bu yeterli.
const tx = mockTx as unknown as Prisma.TransactionClient;

const ACTOR = "user-actor";
const ALI = "user-ali";
const BERK = "user-berk";

const BASE_PAYLOAD = { groupId: "group-1", groupName: "Ev" };

beforeEach(() => {
  mockTx.user.findUnique.mockReset();
  mockTx.notification.createMany.mockReset();
  for (const fn of Object.values(mockPrisma.notification)) fn.mockReset();

  mockTx.user.findUnique.mockResolvedValue({ displayName: "Ahmet" });
});

describe("createNotifications", () => {
  it("her alici icin bir kayit olusturur", async () => {
    await createNotifications(tx, {
      type: "EXPENSE_ADDED",
      actorId: ACTOR,
      recipientIds: [ALI, BERK],
      payload: BASE_PAYLOAD,
    });

    const rows = mockTx.notification.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows.map((row: { userId: string }) => row.userId)).toEqual([ALI, BERK]);
    expect(rows[0].type).toBe("EXPENSE_ADDED");
  });

  // Kendi yaptigin islem icin bildirim almak, bildirim sisteminin en hizli
  // guven kaybettigi yoldur: liste kendi eylemlerinle dolar.
  it("islemi yapan kisiye kendi islemi icin bildirim gondermez", async () => {
    await createNotifications(tx, {
      type: "EXPENSE_ADDED",
      actorId: ACTOR,
      recipientIds: [ACTOR, ALI],
      payload: BASE_PAYLOAD,
    });

    const rows = mockTx.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((row: { userId: string }) => row.userId)).toEqual([ALI]);
  });

  it("ayni kisi listede birden fazla gecse de tek bildirim gonderir", async () => {
    await createNotifications(tx, {
      type: "EXPENSE_UPDATED",
      actorId: ACTOR,
      // Ornegin hem eski hem yeni katilimci listesinde olan biri.
      recipientIds: [ALI, ALI, BERK, ALI],
      payload: BASE_PAYLOAD,
    });

    const rows = mockTx.notification.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
  });

  it("gonderilecek kimse kalmazsa veritabanina hic yazmaz", async () => {
    await createNotifications(tx, {
      type: "EXPENSE_ADDED",
      actorId: ACTOR,
      recipientIds: [ACTOR],
      payload: BASE_PAYLOAD,
    });

    expect(mockTx.notification.createMany).not.toHaveBeenCalled();
    // Alici yoksa islemi yapanin adini okumaya da gerek yok.
    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
  });

  it("payload'a islemi yapanin adini anlik goruntu olarak yazar", async () => {
    mockTx.user.findUnique.mockResolvedValue({ displayName: "Ali Veli" });

    await createNotifications(tx, {
      type: "EXPENSE_ADDED",
      actorId: ACTOR,
      recipientIds: [BERK],
      payload: { ...BASE_PAYLOAD, description: "Market", amount: 12050, currency: "TRY" },
    });

    const rows = mockTx.notification.createMany.mock.calls[0][0].data;
    expect(rows[0].payload).toEqual({
      groupId: "group-1",
      groupName: "Ev",
      actorName: "Ali Veli",
      description: "Market",
      // Tutar kurus cinsinden tam sayi olarak saklanir, formatlanmis metin degil.
      amount: 12050,
      currency: "TRY",
    });
  });

  it("islemi yapan kullanici bulunamazsa bile bildirim gonderir", async () => {
    mockTx.user.findUnique.mockResolvedValue(null);

    await createNotifications(tx, {
      type: "MEMBER_JOINED",
      actorId: ACTOR,
      recipientIds: [ALI],
      payload: BASE_PAYLOAD,
    });

    const rows = mockTx.notification.createMany.mock.calls[0][0].data;
    expect(rows[0].payload.actorName).toBe("Bilinmeyen kullanıcı");
  });
});

describe("listNotifications", () => {
  it("yeniden eskiye siralar ve siralamayi id ile benzersizlestirir", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await listNotifications(ALI);

    const args = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(args.where).toEqual({ userId: ALI });
  });

  it("unreadOnly verildiginde yalnizca okunmamislari getirir", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await listNotifications(ALI, { unreadOnly: true });

    expect(mockPrisma.notification.findMany.mock.calls[0][0].where).toEqual({
      userId: ALI,
      readAt: null,
    });
  });

  it("limitten bir fazla kayit cekip nextCursor uretir", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `n${i}` }));
    mockPrisma.notification.findMany.mockResolvedValue(rows);

    const result = await listNotifications(ALI, { limit: 2 });

    expect(mockPrisma.notification.findMany.mock.calls[0][0].take).toBe(3);
    expect(result.notifications).toHaveLength(2);
    expect(result.nextCursor).toBe("n1");
  });

  it("son sayfada nextCursor null doner", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: "n0" }]);

    const result = await listNotifications(ALI, { limit: 2 });

    expect(result.nextCursor).toBeNull();
  });

  it("limit ust sinirin uzerine cikamaz", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await listNotifications(ALI, { limit: 500 });

    expect(mockPrisma.notification.findMany.mock.calls[0][0].take).toBe(51);
  });
});

describe("okundu isaretleme", () => {
  it("okunmamis sayisini sorar", async () => {
    mockPrisma.notification.count.mockResolvedValue(3);

    await expect(countUnreadNotifications(ALI)).resolves.toBe(3);
    expect(mockPrisma.notification.count.mock.calls[0][0].where).toEqual({
      userId: ALI,
      readAt: null,
    });
  });

  // Kritik: id'yi bilen birinin BASKASININ bildirimini okundu isaretlemesini
  // engelleyen tek sey where kosulundaki userId.
  it("tek bildirimi isaretlerken sorguyu kullaniciya kilitler", async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await markNotificationRead(ALI, "notif-1");

    expect(mockPrisma.notification.updateMany.mock.calls[0][0].where).toEqual({
      id: "notif-1",
      userId: ALI,
      readAt: null,
    });
  });

  it("baskasinin bildirimi guncellenmezse 0 doner", async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await expect(markNotificationRead(ALI, "notif-1")).resolves.toBe(0);
  });

  it("tumunu okundu isaretler", async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

    await expect(markAllNotificationsRead(ALI)).resolves.toBe(5);
    expect(mockPrisma.notification.updateMany.mock.calls[0][0].where).toEqual({
      userId: ALI,
      readAt: null,
    });
  });
});
