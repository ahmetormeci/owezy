import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { attachReceipt, readReceipt, removeReceipt } from "@/lib/receipts";

/**
 * Harcamaya ekli fis fotografi.
 *
 * BAYTLAR BURADAN GECIYOR ve bu bilincli bir tercih. Depoya herkese acik ya
 * da imzali bir adres verseydik daha ucuz olurdu; ama fis kisisel veri
 * tasiyor (isim, adres, kartin son hanesi) ve o adresi eline gecirenin
 * yetkisi bir daha kontrol edilmezdi. Burada HER ISTEKTE grup uyeligi
 * sorgulaniyor.
 *
 * YAN FAYDA: CSP'ye dokunmak gerekmiyor. Gorsel kendi alan adimizdan
 * geliyor, yani "img-src 'self'" oldugu gibi kaliyor.
 */

/** Fisi indirir. Grubun aktif uyesi olan herkes gorebiliyor. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { expenseId } = await params;
    const receipt = await readReceipt(user.id, expenseId);

    return new NextResponse(receipt.bytes, {
      headers: {
        "Content-Type": receipt.contentType,
        /**
         * PRIVATE ve KISA. Fis yetkiye bagli: paylasilan bir onbellege
         * (CDN, vekil) dusmesi, yetkisi olmayan birinin ayni adresten
         * okumasi demek olurdu. "private" yalnizca tarayiciya izin veriyor.
         */
        "Cache-Control": "private, max-age=300",
        /**
         * TARAYICI TURU KENDI TAHMIN ETMESIN. Tur zaten baytlardan okundu
         * (lib/receipts.ts) ama bu baslik olmadan tarayici icerigi
         * "koklayip" baska bir sey sanabiliyor - kendi alan adimizda
         * calistirilan bir belge riski.
         */
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Fisi ekler ya da degistirir.
 *
 * GOVDE HAM BAYTLAR, multipart DEGIL: gonderilen tek sey bir fotograf.
 * multipart/form-data bir ayristirici ve bir dizi sinir durumu getirirdi
 * (bolum sayisi, alan adlari, kodlamalar) ve karsiliginda hicbir sey
 * kazandirmazdi.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { expenseId } = await params;
    const body = await request.arrayBuffer();
    const saved = await attachReceipt(user.id, expenseId, body);

    return NextResponse.json({ ok: true, receipt: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { expenseId } = await params;
    await removeReceipt(user.id, expenseId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
