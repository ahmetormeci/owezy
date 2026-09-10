import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { getGroupBalances } from "@/lib/balances";
import { listRecentReminders } from "@/lib/reminders";
import { handleApiError } from "@/lib/api";

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

    /**
     * HATIRLATMALAR BURADAN GELIYOR, AYRI BIR UCTAN DEGIL (ADR-050).
     *
     * Odesme plani ile "kime hatirlattim" ayni ekranin ayni satirinda
     * bulusuyor; ikinci bir istek, telefonun her grup acilisinda bir
     * gidis-donus daha yapmasi demekti. Sirali degil PARALEL: ikisi
     * birbirini beklemiyor.
     *
     * BALANCES.TS'E KOYULMADI: orasi para hesabinin yeri ve saf kalmali.
     * Iki servis burada, rota katmaninda birlestiriliyor.
     */
    const [{ currency, balances, suggestedTransfers }, reminders] = await Promise.all([
      getGroupBalances(user.id, groupId),
      listRecentReminders(user.id, groupId),
    ]);

    return NextResponse.json({
      ok: true,
      currency,
      balances,
      suggestedTransfers,
      reminders,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
