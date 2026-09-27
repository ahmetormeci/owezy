import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { guestNameSchema } from "@/lib/guest-schemas";
import { renameGuest } from "@/lib/guests";

/**
 * Misafirin adini degistirir (ADR-057). Misafir giris yapamadigi icin
 * adini ancak grup duzeltebilir; her aktif uye degistirebilir.
 *
 * Misafiri CIKARMAK burada degil: bugunku uye cikarma ucu
 * (members/[userId], DELETE) ayni kuralla - yalnizca sahip, bakiye sifirsa -
 * misafir icin de calisiyor.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; guestId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { groupId, guestId } = await params;
    const input = guestNameSchema.parse(await request.json());

    const guest = await renameGuest(user.id, groupId, guestId, input);
    return NextResponse.json({ ok: true, guest });
  } catch (error) {
    return handleApiError(error);
  }
}
