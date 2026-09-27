import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { guestNameSchema } from "@/lib/guest-schemas";
import { addGuest } from "@/lib/guests";

/**
 * Gruba misafir ekler - hesabi olmayan, yalnizca ADI olan bir uye
 * (ADR-057). Her aktif uye ekleyebilir; kural ve tavan servis katmaninda.
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
    const input = guestNameSchema.parse(await request.json());

    const guest = await addGuest(user.id, groupId, input);
    return NextResponse.json({ ok: true, guest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
