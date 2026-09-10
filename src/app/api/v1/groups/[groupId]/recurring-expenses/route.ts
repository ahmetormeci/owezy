import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { createRecurringSchema } from "@/lib/recurring-schemas";
import { createRecurringExpense, listRecurringExpenses } from "@/lib/recurring";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const recurring = await listRecurringExpenses(user.id, groupId);
    return NextResponse.json({ ok: true, recurring });
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

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { groupId } = await params;
    const body = createRecurringSchema.parse(await request.json());

    const recurring = await createRecurringExpense(user.id, groupId, body);
    return NextResponse.json({ ok: true, recurring }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
