import { z } from "zod";

/**
 * Misafir adi (ADR-057). Sunucu ve istemci ayni semayi kullaniyor.
 *
 * KURAL KULLANICININ KENDI ADIYLA AYNI (me-schemas.ts): misafir, uye
 * listelerinde, bakiyelerde ve fiste gercek uyelerle YAN YANA duruyor.
 * Birinin digerinden uzun olabilmesi icin bir sebep yok.
 *
 * BOS AD MESAJI AYRI: ortak kod "Adin bos olamaz" diyordu - yani misafirin
 * adini yazmayan kullaniciya KENDI adindan bahsediyordu. Mobil ekran testi
 * yakaladi. Uzunluk mesaji ("Ad en fazla 100 karakter") iki durumda da dogru.
 */
export const guestNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "validation.guest_name_required")
    .max(100, "validation.display_name_too_long"),
});

export type GuestNameInput = z.infer<typeof guestNameSchema>;
