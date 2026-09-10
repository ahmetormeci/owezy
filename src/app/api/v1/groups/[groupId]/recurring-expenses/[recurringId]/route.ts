import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { updateRecurringSchema } from "@/lib/recurring-schemas";
import { deleteRecurringExpense, setRecurringPaused } from "@/lib/recurring";

/**
 * PATCH, PUT DEGIL: sablon DUZENLENMIYOR (ADR-051, kapsam karari) ve tek
 * degistirilebilir alan "duraklatildi mi". PUT "tam degistirme" anlamina
 * gelirdi, yani olmayan bir yetenegi vaat ederdi.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; recurringId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { groupId, recurringId } = await params;
    const { paused } = updateRecurringSchema.parse(await request.json());

    const recurring = await setRecurringPaused(user.id, groupId, recurringId, paused);
    return NextResponse.json({ ok: true, recurring });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; recurringId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { groupId, recurringId } = await params;
    await deleteRecurringExpense(user.id, groupId, recurringId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
