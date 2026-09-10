import { z } from "zod";

/**
 * Yorum uzunlugu. 500 karakter, odesme notuyla ayni sinir
 * (settlement-schemas.ts) - ikisi de bir kayda ilistirilmis serbest metin,
 * farkli davranmalari icin bir sebep yok.
 *
 * SINIR VERITABANINDA DEGIL BURADA: kolon TEXT, cunku siniri degistirmek
 * migration gerektirmemeli.
 */
export const MAX_COMMENT_LENGTH = 500;

/**
 * Bir sayfada kac yorum. Sayfalama YOK ve bu bilincli bir kapsam karari
 * (ADR-049): bir harcamanin yorumlari bir sohbet degil, birkac notturur.
 * Sinira dayanan olursa liste kirpilir ve istemci "daha fazlasi var" diyebilir.
 */
export const MAX_COMMENTS_PER_EXPENSE = 100;

/**
 * userId BILEREK bu semada yok - yorumu kimin yazdigini her zaman sunucu
 * belirliyor (oturumdaki kullanici). Istemciden alinsaydi baskasi adina
 * yorum yazilabilirdi.
 *
 * trim + min(1): yalnizca bosluktan olusan bir yorum kabul edilmiyor.
 */
export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "validation.comment_required").max(MAX_COMMENT_LENGTH, "validation.comment_too_long"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
