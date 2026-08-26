import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { leaveGroup } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

// newOwnerId yalnizca grup sahibi ayrilirken ve arkasinda aktif uye kalirken
// zorunludur; servis katmani bu kurali uyguluyor.
const leaveGroupSchema = z.object({
  newOwnerId: z.uuid().optional(),
});

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
    const rawBody = await request.text();
    const { newOwnerId } = leaveGroupSchema.parse(rawBody ? JSON.parse(rawBody) : {});

    const membership = await leaveGroup(user.id, groupId, newOwnerId);
    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return handleApiError(error);
  }
}
