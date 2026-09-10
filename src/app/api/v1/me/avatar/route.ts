import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { removeAvatar, setAvatar } from "@/lib/avatars";

/**
 * Kendi profil fotografin (ADR-054).
 *
 * NEDEN /me ALTINDA: baskasinin fotografini degistirmek diye bir yetki yok
 * ve olmamali. Ucu /users/<id>/avatar altina koysaydik, "hangi kimlik
 * yazabilir" sorusunu her istekte yeniden cevaplamak gerekirdi; /me'de o
 * soru hic sorulmuyor cunku cevabi adreste yaziyor.
 *
 * OKUMA BASKA BIR YERDE (/users/<id>/avatar): yazma kisinin kendisine,
 * okuma ortak grubu olanlara ait - iki ayri yetki, iki ayri uc.
 */

/**
 * Fotografi koyar ya da degistirir.
 *
 * GOVDE HAM BAYTLAR, multipart DEGIL - fisle ayni gerekce: gonderilen tek
 * sey bir fotograf. multipart bir ayristirici ve bir dizi sinir durumu
 * getirirdi, karsiliginda hicbir sey kazandirmazdi.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const body = await request.arrayBuffer();
    const saved = await setAvatar(user.id, body);

    return NextResponse.json({ ok: true, avatar: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Fotografi kaldirir. Bas harfe geri donuluyor. */
export async function DELETE() {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    await removeAvatar(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
