import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { createReminderSchema } from "@/lib/reminder-schemas";
import { sendPaymentReminder } from "@/lib/reminders";

/**
 * Odeme hatirlatmasi gonderir (ADR-050).
 *
 * YALNIZCA POST. Hatirlatmalarin LISTESI balances ucundan geliyor: ekran
 * odesme planiyla birlikte cizildigi icin ikisi tek istekte gelmeli.
 * Buraya bir GET koymak, hicbir istemcinin cagirmayacagi bir yol acardi.
 *
 * enforceWriteLimit: soguma penceresinin (24 saat) UZERINDEKI ikinci koruma.
 * Soguma yalnizca AYNI kisiye tekrari engelliyor; yazma siniri, cok kisili
 * bir grupta arka arkaya herkesi durtmeyi de sinirliyor.
 */
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
    const { toUserId } = createReminderSchema.parse(await request.json());

    const reminder = await sendPaymentReminder(user.id, groupId, toUserId);
    return NextResponse.json({ ok: true, reminder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
