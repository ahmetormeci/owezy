import { z } from "zod";

// Desteklenen diller TEK yerde: locale.ts. Buraya elle ["tr","en"] yazsaydik,
// ucuncu dil eklendiginde sema sessizce eski kalir ve yeni dil 400 alirdi.
import { SUPPORTED_LOCALES } from "@/lib/locale";
import { isValidIban, normalizeIban } from "@/lib/iban";

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
 * HEPSI OPSIYONEL ama en az biri ZORUNLU: bos bir govde sessizce "basarili"
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
    /**
     * IBAN (ADR-059). null = kaldir. BOS METIN DE kaldir sayiliyor: alani
     * silip "Kaydet"e basan kullanicinin niyeti bu, "gecersiz IBAN" demek
     * onu cezalandirmak olurdu.
     *
     * Deger normalize edilip DOGRULANMIS olarak cikiyor - sunucu kayda
     * bunu yaziyor, ham girdiyi degil.
     */
    iban: z
      .preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? null : value),
        // union DEGIL, nullable: union iki kol da dusunce kendi genel
        // mesajini ("Invalid input") veriyor ve bizim kodumuz kayboluyordu.
        z
          .string({ message: "validation.iban_invalid" })
          .max(64, "validation.iban_invalid")
          .transform(normalizeIban)
          .refine(isValidIban, "validation.iban_invalid")
          .nullable(),
      )
      .optional(),
  })
  .refine(
    (body) =>
      body.locale !== undefined || body.displayName !== undefined || body.iban !== undefined,
    { message: "validation.invalid" },
  );
