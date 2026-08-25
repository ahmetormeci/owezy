import { z } from "zod";

// Desteklenen diller TEK yerde: locale.ts. Buraya elle ["tr","en"] yazsaydik,
// ucuncu dil eklendiginde sema sessizce eski kalir ve yeni dil 400 alirdi.
import { SUPPORTED_LOCALES } from "@/lib/locale";

/**
 * PATCH /api/v1/me govdesi.
 *
 * displayName BURAYA 25.7'DE GELDI ve sebebi bir bosluktu, bir istek degil.
 * Onceden bu sema yalnizca "locale" kabul ediyordu ve dogru yapiyordu: ad ile
 * e-posta Clerk'ten geliyor, webhook ile senkronlaniyordu (ADR-011), yani bu
 * uctan degistirilebilir olmamalari gerekiyordu. Clerk gidince adi
 * degistirmenin HICBIR yolu kalmadi - e-posta koduyla giren birine Better Auth
 * bos ad yaziyor, biz de e-postayi yedek olarak koyuyoruz, ve o kisi uye
 * listesinde, bakiyelerde, fiste sonsuza kadar e-posta adresi olarak
 * gorunecekti.
 *
 * E-POSTA HALA DISARIDA ve kasten: adresi degistirmek yeni adresin
 * dogrulanmasini gerektirir (aksi halde baskasinin adresini yazip hesabi ona
 * baglayabilirsin). O kendi isi.
 *
 * IKISI DE OPSIYONEL ama en az biri ZORUNLU: bos bir govde sessizce "basarili"
 * donseydi, cagiran taraf bir seyin kaydedildigini sanirdi.
 */
export const updateMeSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES, { message: "validation.invalid" }).optional(),
    displayName: z
      .string()
      .trim()
      .min(1, "validation.display_name_required")
      // Grup adiyla ayni ust sinir: ikisi de ayni listelerde yan yana
      // goruntuleniyor ve birinin digerinden uzun olabilmesi icin sebep yok.
      .max(100, "validation.display_name_too_long")
      .optional(),
  })
  .refine((body) => body.locale !== undefined || body.displayName !== undefined, {
    message: "validation.invalid",
  });
