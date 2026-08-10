import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { updateGroup } from "@/lib/groups";
import { updateGroupSchema } from "@/lib/group-schemas";
import { handleApiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = updateGroupSchema.parse(await request.json());

    const group = await updateGroup(user.id, groupId, body);
    return NextResponse.json({ ok: true, group });
  } catch (error) {
    return handleApiError(error);
  }
}
