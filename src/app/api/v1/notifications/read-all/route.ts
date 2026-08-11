import { NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications";
import { handleApiError } from "@/lib/api";

// Adres cakismasi yok: "read-all" sabit bir segment, [notificationId] ise
// degisken. Next.js sabit segmenti once eslestirir, yani /notifications/read-all
// hicbir zaman notificationId = "read-all" olarak yorumlanmaz.
export async function POST() {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const updated = await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    return handleApiError(error);
  }
}
