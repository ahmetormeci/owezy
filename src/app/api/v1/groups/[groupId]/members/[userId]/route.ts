import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { removeGroupMember } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId, userId: targetUserId } = await params;
    const membership = await removeGroupMember(user.id, groupId, targetUserId);

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return handleApiError(error);
  }
}
