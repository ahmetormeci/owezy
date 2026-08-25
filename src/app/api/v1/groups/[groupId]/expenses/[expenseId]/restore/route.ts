import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { restoreExpense } from "@/lib/expenses";
import { handleApiError } from "@/lib/api";

// RESTORE standart bir HTTP fiili olmadigi icin, kaynak altinda bir eylem
// endpoint'i olarak modelleniyor: POST .../expenses/[expenseId]/restore
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId, expenseId } = await params;

    const expense = await restoreExpense(user.id, groupId, expenseId);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    return handleApiError(error);
  }
}
