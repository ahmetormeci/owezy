import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateMeSchema } from "@/lib/me-schemas";
import { handleApiError } from "@/lib/api";

export async function GET() {
  const user = await findCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
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
