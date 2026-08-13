import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupSummary } from "@/lib/summary";
import { handleApiError } from "@/lib/api";

// Ozet sayfada degil burada: grup sayfasi servisi dogrudan cagiriyor (okuma
// yolu), mobil istemci ise bu ucu cagiracak. Ikisi ayni hesabi paylasiyor.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const summary = await getGroupSummary(user.id, groupId);

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return handleApiError(error);
  }
}
