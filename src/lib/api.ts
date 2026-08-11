import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

// Butun Route Handler'larin try/catch bloklarinda tek tip hata cevabi
// uretmesi icin ortak fonksiyon: { ok: false, error } + dogru HTTP status.
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Geçersiz istek", issues: error.issues },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json({ ok: false, error: "Beklenmeyen bir hata oluştu" }, { status: 500 });
}
