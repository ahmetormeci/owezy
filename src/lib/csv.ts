// CSV uretimi - saf. DB, HTTP veya Prisma bilmez.
//
// "Dogru CSV" ile "Excel'de duzgun acilan CSV" ayni sey DEGIL. Bu dosya
// ikincisini hedefliyor, cunku kullanicinin dosyayla yapacagi ilk sey onu
// Excel'de acmak.

import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

/**
 * Alan ayraci dile bagli.
 *
 * Excel ayraci yerel ayarindan okur: Turkce yerelde ";" bekler, virgulle
 * ayrilmis bir dosyayi tek sutuna sikistirir. Ingilizce yerelde tam tersi.
 *
 * Ayni sebeple ondalik ayraci da dile bagli olmak ZORUNDA
 * (formatMoneyForInput bunu zaten yapiyor): Turkce Excel'e "120.50" verirsen
 * sayi degil metin - hatta tarih - olarak okur. Ayrac ile ondalik birlikte
 * degismeli; virgullu ondalik virgullu ayracla yazilirsa "120,50" degeri iki
 * hucreye bolunur.
 */
const SEPARATORS: Record<Locale, string> = {
  tr: ";",
  en: ",",
};

export function csvSeparator(locale: Locale = DEFAULT_LOCALE): string {
  return SEPARATORS[locale];
}

/**
 * Byte order mark (U+FEFF). Excel'in dosyayi UTF-8 olarak tanimasi icin
 * basa konuyor.
 *
 * Onsuz Turkce Windows'ta Excel dosyayi yerel kod sayfasiyla okuyor ve
 * Turkce harfler bozuk cikiyor. Kati CSV ayristiricilari BOM'u gormezden
 * geldigi icin bedeli yok.
 *
 * Kacis dizisiyle yaziliyor, gorunmez karakter olarak DEGIL: gorunmez bir
 * karakter kopyala-yapistirda ya da editor ayarinda sessizce kaybolur.
 */
export const CSV_BOM = "\uFEFF";

/**
 * Tek bir hucreyi kacisla yazar.
 *
 * Tirnaklama sarti: deger ayraci, cift tirnak ya da satir sonu iceriyorsa.
 * Ic tirnaklar ikiye katlanir (RFC 4180). Aciklama alani kullanicidan geldigi
 * icin bu sart - "Yemek; icki" gibi bir aciklama tirnaklanmazsa satiri iki
 * hucreye boler ve o satirdan sonra butun tablo kayar.
 */
function escapeCell(value: string, separator: string): string {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");

  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Satirlari CSV metnine cevirir.
 *
 * Satir sonu \r\n: RFC 4180'in istedigi ve Excel'in bekledigi bicim.
 */
export function toCsv(rows: string[][], locale: Locale = DEFAULT_LOCALE): string {
  const separator = csvSeparator(locale);

  return rows
    .map((row) => row.map((cell) => escapeCell(cell, separator)).join(separator))
    .join("\r\n");
}
