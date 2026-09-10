import { z } from "zod";
import { nonItemizedExpenseBodySchema } from "@/lib/expense-schemas";

/**
 * Bir cagrida en fazla kac donem yakalanir (ADR-051).
 *
 * Gunluk bir cron'da normalde donem basina bir uretim olur; bu sinir yalnizca
 * cron BIR SURE CALISMADIYSA devreye giriyor. Kalan donemler ertesi gun
 * uretiliyor - yani kendini onaran, ama tek seferde patlamayan bir yakalama.
 */
export const MAX_CATCHUP_PER_RUN = 12;

/** Bir cagrida en fazla kac sablon islenir. */
export const MAX_TEMPLATES_PER_RUN = 200;

const intervalSchema = z.enum(["WEEKLY", "MONTHLY"]);

/**
 * Sablon govdesi = harcama govdesi + donem bilgisi.
 *
 * HARCAMA SEMASINI YENIDEN KULLANIYOR ve bu bilincli: sablon, uretilecek
 * harcamanin ta kendisini tarif ediyor. Ayri bir sema yazsaydik ikisi
 * zamanla ayrisirdi - orn. harcamaya yeni bir bolusum turu eklendiginde
 * sablon onu kabul etmezdi ve sebebi hicbir yerde yazili olmazdi.
 *
 * expenseDate YOK: sablonun tarihi startsOn. version de YOK - sablon
 * duzenlenmiyor (kapsam karari, ADR-051).
 */
export const createRecurringSchema = z.intersection(
  /**
   * KALEM KALEM BIR SABLON YOK (ADR-052). "Her ay ayni restoran hesabi,
   * ayni kalemlerle" diye bir ihtiyac yok; kira ve abonelik duz bir toplam.
   * Ayrim TIPTE: ITEMIZED bir govde buraya ULASAMIYOR, bir kontrol satiri
   * unutulsa bile.
   */
  nonItemizedExpenseBodySchema,
  z.object({
    interval: intervalSchema,
    startsOn: z.coerce.date(),
  }),
);

/**
 * Yalnizca duraklat/devam. PUT DEGIL PATCH cunku sablon DUZENLENMIYOR;
 * "tam degistirme" anlamina gelen bir fiil, olmayan bir yetenegi vaat
 * ederdi.
 */
export const updateRecurringSchema = z.object({
  paused: z.boolean(),
});
