import { z } from "zod";

// Desteklenen diller TEK yerde: locale.ts. Buraya elle ["tr","en"] yazsaydik,
// ucuncu dil eklendiginde sema sessizce eski kalir ve yeni dil 400 alirdi.
import { SUPPORTED_LOCALES } from "@/lib/locale";

/**
 * PATCH /api/v1/me govdesi.
 *
 * Yalnizca "locale" var; e-posta ve isim Clerk'ten geliyor (webhook ile
 * senkronlaniyor, ADR-011), yani bu uctan degistirilebilir olmamalari
 * gerekiyor. Sema onlari kabul etmedigi icin ileride yanlislikla
 * eklenmeleri de zorlasiyor.
 */
export const updateMeSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES, { message: "validation.invalid" }),
});
