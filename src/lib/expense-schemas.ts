import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { MAX_SPLIT_AMOUNT } from "@/lib/split";

// Sayfalama sinirlari API sozlesmesinin parcasi oldugu icin sema dosyasinda
// tanimli; servis katmani (expenses.ts) bunlari buradan okur. Ters yonde
// (servisten semaya) import etmek, servisi mock'layan route testlerinde
// semayi de bozardi.
export const DEFAULT_EXPENSE_PAGE_SIZE = 50;
export const MAX_EXPENSE_PAGE_SIZE = 100;

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
// Query string'ten gelen her deger string oldugu icin sayisal alanlarda coerce
// kullaniyoruz. includeDeleted'i z.coerce.boolean() ile parse ETMIYORUZ: bos
// olmayan her string true'ya donusurdu, yani "?includeDeleted=false" bile true
// olurdu. Bu yuzden kabul edilen degerleri acikca listeliyoruz.
export const listExpensesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_EXPENSE_PAGE_SIZE).optional(),
  cursor: z.uuid().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Arama metni. Bos string'i ELEMEK sart: "?q=" gonderildiginde filtre
  // uygulanmis sayilirsa liste hicbir seyle eslesmez gibi davranir.
  q: z.string().trim().min(1).max(100).optional(),
  category: categorySchema.optional(),
  // includeDeleted ile ayni sebep: z.coerce.boolean() bos olmayan her string'i
  // true yapardi, yani "?mine=false" bile true olurdu.
  mine: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Ay penceresi: "YYYY-MM". Sema burada da dogruluyor ki gecersiz bir deger
  // servise hic ulasmasin - servisteki kontrol son savunma hatti, ilki degil.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

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
