import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { MAX_SPLIT_AMOUNT } from "@/lib/split";

// Prisma'nin ExpenseCategory enum'unu tekrar yazmak yerine, uretilen degerlerden
// bir Zod semasi turetiyoruz - tek kaynak schema.prisma'da kalir.
const categorySchema = z.enum(
  Object.values(ExpenseCategory) as [ExpenseCategory, ...ExpenseCategory[]],
);

const baseExpenseSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().int().positive().max(MAX_SPLIT_AMOUNT),
  paidById: z.uuid(),
  category: categorySchema.optional(),
  expenseDate: z.coerce.date().optional(),
});

const exactShareSchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().nonnegative(),
});

const percentageShareSchema = z.object({
  userId: z.uuid(),
  basisPoints: z.number().int().min(0).max(10_000),
});

// Hem olusturma (POST) hem guncelleme (PUT) ayni govdeyi kullanir: guncelleme
// "tam degistirme" semantigi tasir, yani istemci harcamanin tam halini gonderir.
// Tek bir semayi paylasmak, iki endpoint'in zamanla sessizce birbirinden
// ayrilmasini (orn. biri yeni bir alan kabul ederken digeri etmemesi) onler.
//
// currency BILEREK bu semada yok - istemciden asla alinmiyor, servis katmani her
// zaman grubun currency'sini kullanir. Zod'un varsayilan "strip" davranisi geregi,
// body'de fazladan bir "currency" alani gonderilse bile parse sonrasi elenir.
export const expenseBodySchema = z.discriminatedUnion("splitType", [
  baseExpenseSchema.extend({
    splitType: z.literal("EQUAL"),
    participantUserIds: z.array(z.uuid()).min(1),
  }),
  baseExpenseSchema.extend({
    splitType: z.literal("EXACT"),
    shares: z.array(exactShareSchema).min(1),
  }),
  baseExpenseSchema.extend({
    splitType: z.literal("PERCENTAGE"),
    shares: z.array(percentageShareSchema).min(1),
  }),
]);
