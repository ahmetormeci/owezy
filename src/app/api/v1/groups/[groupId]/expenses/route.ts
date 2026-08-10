import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { createExpense, listExpenses } from "@/lib/expenses";
import { expenseBodySchema, listExpensesQuerySchema } from "@/lib/expense-schemas";
import { handleApiError } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const query = listExpensesQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      includeDeleted: searchParams.get("includeDeleted") ?? undefined,
    });

    const { expenses, nextCursor } = await listExpenses(user.id, groupId, query);
    return NextResponse.json({ ok: true, expenses, nextCursor });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const body = expenseBodySchema.parse(await request.json());

    const expense = await createExpense(user.id, groupId, body);
    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
