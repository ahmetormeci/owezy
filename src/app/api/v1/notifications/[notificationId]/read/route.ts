import { NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";
import { handleApiError } from "@/lib/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const { notificationId } = await params;
    const updated = await markNotificationRead(user.id, notificationId);

    // updated = 0 uc anlama gelebilir: kayit yok, baskasina ait, ya da zaten
    // okunmus. Ucunu de ayni sekilde cevapliyoruz - ayirt etmek, baskasinin
    // bildirim kimligini deneyen birine "bu id gercek" bilgisini verirdi.
    // Islemin sonucu her durumda ayni: artik okunmus sayiliyor.
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    return handleApiError(error);
  }
}
