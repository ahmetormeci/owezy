import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { listGroupMembers } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId } = await params;
    const members = await listGroupMembers(user.id, groupId);

    return NextResponse.json({ ok: true, members });
  } catch (error) {
    return handleApiError(error);
  }
}
