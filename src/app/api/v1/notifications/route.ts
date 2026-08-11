import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications";
import { listNotificationsQuerySchema } from "@/lib/notification-schemas";
import { handleApiError } from "@/lib/api";

// Bildirimler her zaman ISTEGI YAPAN kisiye aittir: adreste kullanici kimligi
// yok, listeyi oturumdan belirliyoruz. Baskasinin bildirimlerini istemenin
// bir yolu bulunmuyor.
export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = listNotificationsQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      unreadOnly: searchParams.get("unreadOnly") ?? undefined,
    });

    // Okunmamis sayisini ayni cevapta donuyoruz: mobil istemcinin zil rakami
    // icin ikinci bir istek atmasi gereksiz olurdu.
    const [{ notifications, nextCursor }, unreadCount] = await Promise.all([
      listNotifications(user.id, query),
      countUnreadNotifications(user.id),
    ]);

    return NextResponse.json({ ok: true, notifications, nextCursor, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}
