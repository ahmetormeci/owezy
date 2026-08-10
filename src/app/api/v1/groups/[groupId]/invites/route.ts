import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { createGroupInvite } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(100).optional(),
  ttlDays: z.number().int().min(1).max(30).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId } = await params;
    const rawBody = await request.text();
    const body = createInviteSchema.parse(rawBody ? JSON.parse(rawBody) : {});

    const invite = await createGroupInvite(user.id, groupId, body);
    return NextResponse.json({ ok: true, invite }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
