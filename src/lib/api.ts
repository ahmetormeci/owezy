import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

// Butun Route Handler'larin try/catch bloklarinda tek tip hata cevabi
// uretmesi icin ortak fonksiyon.
//
// Cevap sekli: { ok: false, code, params? }
// Metin YOK - okuyan taraf kodu kendi diline cevirir (ADR-017). Sunucuda
// Turkce metin birakmamak bilincli bir tercih: "sonra silinecek" diye
// birakilan alanlar silinmiyor ve zamanla iki ayri sozluk olusuyor.
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, code: error.code, params: error.params },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    // issues icindeki "message" alanlari da KOD tasiyor: semalardaki
    // dogrulama mesajlari kod olarak yazildi (bkz. group-schemas.ts).
    // Alan bazli hata gostermek isteyen istemci bunlari da cevirebilir.
    return NextResponse.json(
      { ok: false, code: "validation.invalid", issues: error.issues },
      { status: 400 },
    );
  }

  // Beklenmeyen hatanin KENDISI loga gidiyor; kullaniciya yalnizca genel bir
  // kod donuyor. Ic detay (stack, sorgu, id) disari sizmamali.
  console.error(error);
  return NextResponse.json({ ok: false, code: "server.unexpected" }, { status: 500 });
}
