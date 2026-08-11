import { z } from "zod";

// Sayfalama sinirlari API sozlesmesinin parcasi oldugu icin burada tanimli;
// servis katmani (notifications.ts) bunlari buradan okur.
export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE_SIZE = 50;

// unreadOnly'yi z.coerce.boolean() ile parse ETMIYORUZ: bos olmayan her string
// true'ya donusurdu, yani "?unreadOnly=false" bile true olurdu. Kabul edilen
// degerleri acikca listeliyoruz. (Ayni tuzagi listExpensesQuerySchema'da da
// bilerek atlamistik - iki endpoint ayni sekilde davranmali.)
export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_NOTIFICATION_PAGE_SIZE).optional(),
  cursor: z.uuid().optional(),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
