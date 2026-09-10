import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { deleteComment } from "@/lib/comments";

/**
 * Yorumu siler. YALNIZCA YAZAN silebiliyor (ADR-049) - grup sahibine
 * moderasyon yetkisi verilmedi.
 *
 * Silme YUMUSAK; yorum arayuzde hic gorunmuyor, mezar tasi birakmiyor.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const user = await findCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const limited = await enforceWriteLimit(user.id);
    if (limited) return limited;

    const { commentId } = await params;
    await deleteComment(user.id, commentId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
