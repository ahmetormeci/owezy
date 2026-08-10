import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { deleteExpense, updateExpense } from "@/lib/expenses";
import { expenseBodySchema } from "@/lib/expense-schemas";
import { handleApiError } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId, expenseId } = await params;
    const body = expenseBodySchema.parse(await request.json());

    const expense = await updateExpense(user.id, groupId, expenseId, body);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await deleteExpense(user.id, groupId, expenseId);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}
