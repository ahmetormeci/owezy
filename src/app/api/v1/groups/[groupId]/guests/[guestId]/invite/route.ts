import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { createGuestInvite } from "@/lib/guests";

/**
 * Misafire OZEL, tek kullanimlik davet linki (ADR-057, Faz 50b). Linki
 * kabul eden kisi misafir OLARAK katilir ve misafirin kayitlari onun
 * hesabina gecer. Ham kod YALNIZCA bu cevapta doner.
 */
export async function POST(
  _request: NextRequest,
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
    const invite = await createGuestInvite(user.id, groupId, guestId);

    return NextResponse.json({ ok: true, invite }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
