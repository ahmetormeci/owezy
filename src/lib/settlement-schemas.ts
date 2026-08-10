import { z } from "zod";
import { MAX_SPLIT_AMOUNT } from "@/lib/split";

// Sayfalama sinirlari API sozlesmesinin parcasi oldugu icin burada tanimli;
// servis katmani bunlari buradan okur (expense-schemas.ts ile ayni gerekce).
export const DEFAULT_SETTLEMENT_PAGE_SIZE = 50;
export const MAX_SETTLEMENT_PAGE_SIZE = 100;

// currency BILEREK bu semada yok - istemciden asla alinmiyor, servis katmani
// her zaman grubun currency'sini kullanir.
export const createSettlementSchema = z.object({
  fromUserId: z.uuid(),
  toUserId: z.uuid(),
  amount: z.number().int().positive().max(MAX_SPLIT_AMOUNT),
  note: z.string().max(500).optional(),
  settledAt: z.coerce.date().optional(),
});

export const listSettlementsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_SETTLEMENT_PAGE_SIZE).optional(),
  cursor: z.uuid().optional(),
  // z.coerce.boolean() kullanilmiyor: bos olmayan her string true'ya donusurdu,
  // yani "?includeCancelled=false" bile true olurdu.
  includeCancelled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
