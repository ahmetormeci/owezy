import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { readAvatar } from "@/lib/avatars";

/**
 * Baskasinin (ya da kendinin) profil fotografi (ADR-054).
 *
 * BAYTLAR BURADAN GECIYOR, depo adresi acilmiyor - fisteki gerekcenin
 * aynisi. Bir fotograf bir YUZ; imzali bir adres verseydik, adresi eline
 * gecirenin yetkisi bir daha kontrol edilmezdi. Burada HER ISTEKTE ortak
 * grup sorgulaniyor.
 *
 * YAN FAYDA: CSP'ye dokunmak gerekmiyor. Gorsel kendi alan adimizdan
 * geliyor, yani img-src 'self' oldugu gibi kaliyor.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { userId } = await params;
    const avatar = await readAvatar(user.id, userId);

    return new NextResponse(avatar.bytes, {
      headers: {
        "Content-Type": avatar.contentType,
        /**
         * PRIVATE ve BES DAKIKA. Fotograf yetkiye bagli: paylasilan bir
         * onbellege (CDN, vekil) dusmesi, ortak grubu olmayan birinin ayni
         * adresten okumasi demek olurdu.
         *
         * BES DAKIKA ESKI FOTOGRAF GOSTERMIYOR: her yukleme YENI bir depo
         * anahtari ve dolayisiyla YENI bir adres uretiyor (lib/avatars.ts),
         * yani degistirilen fotograf zaten baska bir adresten geliyor.
         */
        "Cache-Control": "private, max-age=300",
        /**
         * TARAYICI TURU KENDI TAHMIN ETMESIN. Tur baytlardan okunarak
         * secildi; bu baslik olmadan tarayici icerigi "koklayip" baska bir
         * sey sanabiliyor - kendi alan adimizda calistirilan bir belge riski.
         */
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
