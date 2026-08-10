import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { acceptGroupInvite } from "@/lib/groups";
import { handleApiError } from "@/lib/api";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { token } = acceptInviteSchema.parse(await request.json());
    const membership = await acceptGroupInvite(user.id, token);

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return handleApiError(error);
  }
}
