import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupBalances } from "@/lib/balances";
import { handleApiError } from "@/lib/api";

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
    const { currency, balances, suggestedTransfers } = await getGroupBalances(user.id, groupId);

    return NextResponse.json({ ok: true, currency, balances, suggestedTransfers });
  } catch (error) {
    return handleApiError(error);
  }
}
