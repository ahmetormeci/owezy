import { z } from "zod";

// Bu semalar hem sunucuda (route handler) hem istemcide (form) kullanilir.
// Ayni kurali iki yerde ayri ayri yazmiyoruz: form ne kabul ediyorsa API de
// onu kabul eder, mesajlar da tek yerden gelir.
//
// Mesaj alanlarinda METIN degil KOD duruyor. Sema paylasildigi icin bu sart:
// sunucu bir dil bilmiyor, istemci ise kodu kendi diline ceviriyor. Gosteren
// taraf translate() cagiriyor (bkz. create-group-dialog.tsx).
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "validation.group_name_required")
    .max(100, "validation.group_name_too_long"),
  description: z.string().max(500, "validation.description_too_long").optional(),
  currency: z.string().length(3, "validation.currency_length").optional(),
});

// currency guncellemede yok: mevcut kayitlar kendi currency'lerini saklamis
// durumda ve veritabani trigger'i bunlarin grubunkiyle ayni olmasini sart
// kosuyor (bkz. updateGroup).
export const updateGroupSchema = createGroupSchema.omit({ currency: true });
