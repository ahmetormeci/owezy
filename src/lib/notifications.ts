import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  MAX_NOTIFICATION_PAGE_SIZE,
} from "@/lib/notification-schemas";

/**
 * Bildirimin icinde saklanan anlik goruntu.
 *
 * Neden ID yerine isim/tutar da yaziyoruz: bildirim TARIHSEL bir ifadedir.
 * "Ali 120,50 TL'lik Market harcamasi ekledi" cumlesi, harcama sonradan
 * duzenlense veya silinse bile aynen dogru kalmali. Okuma aninda veritabanindan
 * cozseydik, gecmis bildirimler bugunun verisine gore degisirdi - ExpenseEdit'i
 * degistirilemez kayit olarak tasarlarken kullandigimiz mantigin aynisi.
 */
export type NotificationPayload = {
  groupId: string;
  groupName: string;
  actorName: string;
  expenseId?: string;
  settlementId?: string;
  description?: string;
  /** Kurus cinsinden tam sayi. Bildirimde de para asla float'a donmez. */
  amount?: number;
  currency?: string;
};

type CreateNotificationsInput = {
  type: NotificationType;
  /** Islemi yapan kisi. Kendi islemi icin kendisine bildirim gitmez. */
  actorId: string;
  recipientIds: string[];
  payload: Omit<NotificationPayload, "actorName">;
};

/**
 * Bildirimleri olusturur.
 *
 * Cagiran islemin transaction'ini (tx) ALIYOR, kendi transaction'ini acmiyor:
 * harcama kaydedildiyse bildirim de kaydedilmis olmali. Sonradan ayri yazsaydik
 * ve arada bir hata olsaydi, harcama olusur ama kimsenin haberi olmazdi -
 * sessiz kayip. Ikisi ya birlikte olur ya hic olmaz.
 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  input: CreateNotificationsInput,
): Promise<void> {
  // Kisi kendi yaptigi islem icin bildirim almaz. Ayrica ayni kisi listede
  // birden fazla gecebilir (orn. hem odeyen hem katilimci) - tek bildirim yeter.
  const recipients = [...new Set(input.recipientIds)].filter((id) => id !== input.actorId);
  if (recipients.length === 0) {
    return;
  }

  const actor = await tx.user.findUnique({
    where: { id: input.actorId },
    select: { displayName: true },
  });

  const payload: NotificationPayload = {
    ...input.payload,
    actorName: actor?.displayName ?? "Bilinmeyen kullanıcı",
  };

  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      payload: payload as unknown as Prisma.InputJsonObject,
    })),
  });
}

type ListNotificationsOptions = {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
};

/**
 * Bildirimlerin saklanma suresi.
 *
 * Bildirim FINANSAL KAYIT DEGIL: harcamanin, odemenin ve audit log'un
 * fiziksel olarak silinmemesi kurali (ADR'ler, PROJECT.md) buraya islemiyor.
 * Bildirim, o an olan bir seyi haber veren gecici bir isaret; payload'i da
 * zaten bir anlik goruntu. Iki ay onceki "harcama eklendi" bildirimi kimsenin
 * isine yaramiyor, ama sonsuza kadar birikiyordu.
 */
export const NOTIFICATION_RETENTION_DAYS = 60;

export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {},
) {
  const limit = Math.min(
    options.limit ?? DEFAULT_NOTIFICATION_PAGE_SIZE,
    MAX_NOTIFICATION_PAGE_SIZE,
  );

  const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [, rows] = await Promise.all([
    // Temizlik OKUMA sirasinda: cron yok, ve kullanici zaten burada.
    // where'de userId var - hem baskasinin kaydina dokunmuyor hem de
    // (userId, createdAt) index'i tam bu sorguyu karsiliyor, yani eski kayit
    // yoksa maliyeti bir index taramasi.
    prisma.notification.deleteMany({
      where: { userId, createdAt: { lt: cutoff } },
    }),
    prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      // Cursor sayfalamasi icin siralama BENZERSIZ olmali: ayni milisaniyede
      // birden fazla bildirim olusabilecegi icin id ile kesinlestiriyoruz.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rows.length > limit;
  const notifications = hasMore ? rows.slice(0, limit) : rows;

  return {
    notifications,
    nextCursor: hasMore ? notifications[notifications.length - 1].id : null,
  };
}

/** Zil ikonundaki rakam. (userId, readAt) index'i tam bu sorgu icin var. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Tek bildirimi okundu isaretler.
 *
 * where kosuluna userId de koyuyoruz: id'yi bilen birinin BASKASININ bildirimini
 * okundu isaretlemesini engelleyen tek sey bu. Kayit bulunamazsa updateMany
 * sessizce 0 satir gunceller - var olmayan ile baskasina ait olani ayirt
 * etmiyoruz, cunku bu ayrim saldirgana bilgi verirdi.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
