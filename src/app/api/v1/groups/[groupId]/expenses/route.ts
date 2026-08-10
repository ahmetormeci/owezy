import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { createExpense } from "@/lib/expenses";
import { MAX_SPLIT_AMOUNT } from "@/lib/split";
import { handleApiError } from "@/lib/api";

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

// currency BILEREK bu semada yok - istemciden asla alinmiyor, createExpense() her
// zaman grubun currency'sini kullanir. Zod'un varsayilan "strip" davranisi geregi,
// body'de fazladan bir "currency" alani gonderilse bile parse sonrasi elenir.
const createExpenseSchema = z.discriminatedUnion("splitType", [
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = createExpenseSchema.parse(await request.json());

    const expense = await createExpense(user.id, groupId, body);
    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
