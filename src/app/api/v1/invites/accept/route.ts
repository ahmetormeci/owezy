import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { acceptGroupInvite } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  // Misafire ozel davette ACIK ONAY (ADR-057): misafirin kimligi geri
  // gonderilmeden kabul edilmiyor. Normal davette hic gonderilmiyor.
  confirmGuestId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { token, confirmGuestId } = acceptInviteSchema.parse(await request.json());
    const membership = await acceptGroupInvite(user.id, token, confirmGuestId);

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return handleApiError(error);
  }
}
