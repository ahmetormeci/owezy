import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { createExpense, listExpenses } from "@/lib/expenses";
import { expenseBodySchema, listExpensesQuerySchema } from "@/lib/expense-schemas";
import { handleApiError } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const query = listExpensesQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      includeDeleted: searchParams.get("includeDeleted") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      mine: searchParams.get("mine") ?? undefined,
      month: searchParams.get("month") ?? undefined,
    });

    const { expenses, nextCursor, matches } = await listExpenses(user.id, groupId, query);
    return NextResponse.json({ ok: true, expenses, nextCursor, matches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = expenseBodySchema.parse(await request.json());

    const expense = await createExpense(user.id, groupId, body);
    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
