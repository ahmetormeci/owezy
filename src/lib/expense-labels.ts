import type { ExpenseCategory } from "@prisma/client";

// Enum degerlerinin arayuzde gosterilecek Turkce karsiliklari.
// Record<ExpenseCategory, string> tipi sayesinde semaya yeni bir kategori
// eklenirse TypeScript burayi guncellemedigimizi derleme aninda yakalar.
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: "Yemek",
  TRANSPORT: "Ulasim",
  ACCOMMODATION: "Konaklama",
  SHOPPING: "Alisveris",
  BILLS: "Faturalar",
  ENTERTAINMENT: "Eglence",
  OTHER: "Diger",
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS) as [
  ExpenseCategory,
  string,
][];
