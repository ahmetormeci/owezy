import { z } from "zod";

// Bu semalar hem sunucuda (route handler) hem istemcide (form) kullanilir.
// Ayni kurali iki yerde ayri ayri yazmiyoruz: form ne kabul ediyorsa API de
// onu kabul eder, mesajlar da tek yerden gelir.
export const createGroupSchema = z.object({
  name: z.string().min(1, "Grup adı boş olamaz").max(100, "Grup adı en fazla 100 karakter olabilir"),
  description: z.string().max(500, "Açıklama en fazla 500 karakter olabilir").optional(),
  currency: z.string().length(3, "Para birimi 3 harfli olmalıdır").optional(),
});

// currency guncellemede yok: mevcut kayitlar kendi currency'lerini saklamis
// durumda ve veritabani trigger'i bunlarin grubunkiyle ayni olmasini sart
// kosuyor (bkz. updateGroup).
export const updateGroupSchema = createGroupSchema.omit({ currency: true });
