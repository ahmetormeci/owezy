import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { createGroup, listGroupsForUser } from "@/lib/groups";
import { createGroupSchema } from "@/lib/group-schemas";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const groups = await listGroupsForUser(user.id);
    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const body = createGroupSchema.parse(await request.json());
    const group = await createGroup(user.id, body);

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
