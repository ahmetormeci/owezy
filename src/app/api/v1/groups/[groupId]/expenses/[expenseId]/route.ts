import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { deleteExpense, getExpenseForUser, updateExpense } from "@/lib/expenses";
import { expenseBodySchema } from "@/lib/expense-schemas";
import { handleApiError } from "@/lib/api";

// Tek harcama. Govde BILEREK liste ucundeki expenses[] elemaniyla ayni
// sekilde donuyor: farkli bir sekil tasarlasaydik mobil tarafta ayni veri icin
// iki ayri cozumleyici yazmak gerekirdi. Ic alanlari (descriptionFold gibi)
// ayiklamak istersek iki ucu birden degistirmeli.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await getExpenseForUser(user.id, groupId, expenseId);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
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
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await deleteExpense(user.id, groupId, expenseId);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}
