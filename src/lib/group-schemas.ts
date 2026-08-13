import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

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
  // Uc harfli HER kodu degil, yalnizca destekledigimizi kabul ediyoruz.
  // Eskiden .length(3) idi ve API'den JPY ile grup acilabiliyordu; JPY sifir
  // ondalikli oldugu icin o gruptaki butun tutarlar 100 kat kucuk gorunurdu.
  // Liste ve gerekcesi money.ts'te - kisitin sebebi orada yasiyor.
  currency: z
    .enum(SUPPORTED_CURRENCIES, { error: "validation.currency_unsupported" })
    .optional(),
});

// currency guncellemede yok: mevcut kayitlar kendi currency'lerini saklamis
// durumda ve veritabani trigger'i bunlarin grubunkiyle ayni olmasini sart
// kosuyor (bkz. updateGroup).
export const updateGroupSchema = createGroupSchema.omit({ currency: true });
