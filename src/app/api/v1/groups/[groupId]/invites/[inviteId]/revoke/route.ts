import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { revokeGroupInvite } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; inviteId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId, inviteId } = await params;
    const invite = await revokeGroupInvite(user.id, groupId, inviteId);

    // tokenHash disari sizmasin diye yalnizca gerekli alanlar donuyor.
    return NextResponse.json({
      ok: true,
      invite: { id: invite.id, revokedAt: invite.revokedAt },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
