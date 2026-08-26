import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { cancelSettlement } from "@/lib/settlements";
import { handleApiError } from "@/lib/api";

// Iptal standart bir HTTP fiili olmadigi icin (ve kayit fiziksel olarak
// silinmedigi icin) kaynak altinda bir eylem endpoint'i olarak modelleniyor -
// harcamalardaki .../restore ile ayni desen.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; settlementId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { groupId, settlementId } = await params;

    const settlement = await cancelSettlement(user.id, groupId, settlementId);
    return NextResponse.json({ ok: true, settlement });
  } catch (error) {
    return handleApiError(error);
  }
}
