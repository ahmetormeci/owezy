import type { ExpenseCategory } from "@prisma/client";
import type { MessageCode } from "@/lib/messages";

// Enum degerlerinin arayuzde gosterilecek karsiliklari - artik METIN degil KOD.
// Metni gosteren taraf uretiyor (bkz. expense-list.tsx, expense-form.tsx).
//
// Record<ExpenseCategory, MessageCode> tipi iki seyi birden garanti ediyor:
//   - semaya yeni bir kategori eklenirse burasi guncellenmezse derleme hatasi
//   - yazilan kodun sozlukte karsiligi yoksa yine derleme hatasi
export const EXPENSE_CATEGORY_CODES: Record<ExpenseCategory, MessageCode> = {
  FOOD: "ui.category_food",
  TRANSPORT: "ui.category_transport",
  ACCOMMODATION: "ui.category_accommodation",
  SHOPPING: "ui.category_shopping",
  BILLS: "ui.category_bills",
  ENTERTAINMENT: "ui.category_entertainment",
  OTHER: "ui.category_other",
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_CODES) as [
  ExpenseCategory,
  MessageCode,
][];
