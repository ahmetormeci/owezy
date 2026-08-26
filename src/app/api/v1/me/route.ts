import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { prisma } from "@/lib/prisma";
import { updateMeSchema } from "@/lib/me-schemas";
import { handleApiError } from "@/lib/api";

export async function GET() {
  const user = await findCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
  }

  /**
   * hasPassword: "bu hesabin parolasi var mi".
   *
   * NEDEN GEREKLI: /two-factor/enable PAROLA ISTIYOR ve bu pazarlik konusu
   * degil - eklentinin allowPasswordless secenegi KAPALI KALMALI. Acik
   * olsaydi parolasiz bir kullanici 2FA'yi acabilirdi; sonra e-posta koduyla
   * giris bizim kancamizla kapali (better-auth.ts), parola da yok. Yani
   * kendini TAMAMEN disarida birakirdi.
   *
   * Bu bilgi olmadan guvenlik ekrani "2FA'yi ac" dugmesini gosterir, kullanici
   * basar ve INVALID_PASSWORD alir - CURRENT_TASK'ta "dugme calismiyor gibi
   * gorunmemeli" diye yazan sey tam olarak bu.
   *
   * SUTUNUN KENDISI DONMUYOR, yalnizca "var mi" bilgisi. Parola hash'i
   * hicbir uctan disari cikmamali.
   *
   * AYRI SORGU, layout'a EKLENMEDI: (app)/layout.tsx her sayfada calisiyor
   * ve bu bilgi yalnizca guvenlik ekrani acildiginda gerekiyor. Oraya
   * koysaydik her sayfa yuklemesine bir sorgu daha eklenirdi.
   */
  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential", password: { not: null } },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, user, hasPassword: credential !== null });
}

/**
 * Kullanicinin kendi tercihlerini gunceller: dil ve gorunen ad.
 *
 * NEDEN CEREZ YETMIYOR: cerez tarayiciya ait. Kullanici baska bir cihazdan
 * girdiginde orada cerez yok ve dili yeniden secmesi gerekirdi. Kayit,
 * cerezi olmayan yeni cihaz icin yedek (ADR-019).
 *
 * CEREZI BURASI YAZMIYOR. Cerezi istemci yaziyor (language-toggle.tsx), bu
 * uc yalnizca kaydi guncelliyor. Iki yazar olsaydi hangisinin kazandigi
 * belirsizlesirdi.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const body = updateMeSchema.parse(await request.json());

    // YALNIZCA GONDERILEN ALAN yaziliyor. Ikisini birden yazsaydik, dil
    // dugmesine basmak adi undefined'a cevirirdi - iki ayri arayuz ayni uca
    // konusuyor ve birbirinin alanini silmemeli.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.locale === undefined ? {} : { locale: body.locale }),
        ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
