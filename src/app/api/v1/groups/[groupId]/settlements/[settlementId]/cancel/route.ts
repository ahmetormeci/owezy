import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
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
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { groupId, settlementId } = await params;

    const settlement = await cancelSettlement(user.id, groupId, settlementId);
    return NextResponse.json({ ok: true, settlement });
  } catch (error) {
    return handleApiError(error);
  }
}
