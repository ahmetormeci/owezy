import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { registerPushToken, removePushToken } from "@/lib/push";
import { handleApiError } from "@/lib/api";

/**
 * Telefonun push adresini kaydeder ve siler.
 *
 * ADRES ISTEMCIDEN GELIYOR ve gelmek zorunda: onu Expo, CIHAZDA uretiyor.
 * Sunucunun uretebilecegi bir sey degil.
 *
 * KOTUYE KULLANIM SINIRI: baskasinin adresini kaydettiren biri, o kisinin
 * telefonuna kendi grubunun bildirimlerini gonderemez - kayit her zaman
 * ISTEGI YAPAN kullaniciya baglaniyor, govdedeki bir kullanici kimligine
 * degil. En fazla kendi telefonuna baskasinin adresini yazabilir, ki o da
 * yalnizca kendi bildirimlerini kaybetmesine yarar.
 */
const registerSchema = z.object({
  /**
   * "ExponentPushToken[...]" bicimi DOGRULANMIYOR, uzunluk disinda. Bicimi
   * Expo belirliyor ve degistirebilir; burada bir desen tutturmaya calismak,
   * Expo'nun kabul edecegi bir adresi istemcide reddetme riski demekti -
   * ayni gerekce lib/invite-link.ts'te de yazili.
   */
  token: z.string().min(1).max(255),
  platform: z.enum(["ios", "android"]),
});

const removeSchema = z.object({ token: z.string().min(1).max(255) });

export async function POST(request: NextRequest) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const body = registerSchema.parse(await request.json());
    await registerPushToken(user.id, body.token, body.platform);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * CIKISTA cagriliyor. Adres silinmezse telefon o hesabin bildirimlerini
 * almaya devam eder - baska biri giris yapmis olsa bile.
 *
 * OTURUM ISTIYOR ama silme adrese gore yapiliyor, kullaniciya gore degil:
 * cikis sirasinda adres zaten o kullanicinin. Kullaniciya gore silseydik,
 * ayni hesabin BASKA cihazlarindaki adresler de silinirdi.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const body = removeSchema.parse(await request.json());
    await removePushToken(body.token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
