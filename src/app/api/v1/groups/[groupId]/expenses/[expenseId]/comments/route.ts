import { NextRequest, NextResponse } from "next/server";
import { findCurrentUser } from "@/lib/auth";
import { enforceWriteLimit } from "@/lib/api-rate-limit";
import { handleApiError } from "@/lib/api";
import { createComment, listComments } from "@/lib/comments";
import { createCommentSchema } from "@/lib/comment-schemas";

/**
 * Bir harcamanin yorumlari (ADR-049).
 *
 * groupId ADRESTE VAR AMA KULLANILMIYOR ve bu bilincli: yetki harcamanin
 * KENDI grubundan cozuluyor (lib/comments.ts), adresteki gruptan degil.
 * Adresten okusaydik, uyesi oldugu bir grubun kimligini yazip baska bir
 * grubun harcamasini okumak mumkun olurdu. Adres yalnizca arayuzun
 * gezinme duzenini yansitiyor - fis ucunda da ayni sekilde.
 */

/** Yorumlari listeler. Grubun aktif uyesi olan herkes okuyabiliyor. */
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
    const result = await listComments(user.id, expenseId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Yorum yazar. Grubun aktif uyesi olan herkes yazabiliyor. */
export async function POST(
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
    const parsed = createCommentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: parsed.error.issues[0]?.message ?? "validation.invalid" },
        { status: 400 },
      );
    }

    const comment = await createComment(user.id, expenseId, parsed.data.body);

    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
