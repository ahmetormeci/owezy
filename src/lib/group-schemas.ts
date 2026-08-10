import { z } from "zod";

// Bu semalar hem sunucuda (route handler) hem istemcide (form) kullanilir.
// Ayni kurali iki yerde ayri ayri yazmiyoruz: form ne kabul ediyorsa API de
// onu kabul eder, mesajlar da tek yerden gelir.
export const createGroupSchema = z.object({
  name: z.string().min(1, "Grup adi bos olamaz").max(100, "Grup adi en fazla 100 karakter olabilir"),
  description: z.string().max(500, "Aciklama en fazla 500 karakter olabilir").optional(),
  currency: z.string().length(3, "Para birimi 3 harfli olmalidir").optional(),
});
