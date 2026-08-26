import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { getGroupForUser, updateGroup } from "@/lib/groups";
import { updateGroupSchema } from "@/lib/group-schemas";
import { handleApiError } from "@/lib/api";

// Tek grup. Web tarafi ayni veriyi sayfa icinden getGroupForUser ile okuyor;
// burada yapilan sey o okumayi HTTP'ye acmak, yeni bir mantik eklemek degil
// (ADR-002: is mantigi /api/v1 altinda, mobil istemci de ayni uclari cagirir).
//
// Liste ucu (GET /groups) mobilde grup ekranini acmaya yetmiyor: kullanici
// dogrudan bir gruba derin baglantiyla girebilir ve o an elde liste yoktur.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;

    const group = await getGroupForUser(user.id, groupId);
    return NextResponse.json({ ok: true, group });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
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
    const body = updateGroupSchema.parse(await request.json());

    const group = await updateGroup(user.id, groupId, body);
    return NextResponse.json({ ok: true, group });
  } catch (error) {
    return handleApiError(error);
  }
}
