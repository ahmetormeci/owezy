// Tarih gosterimi. Paranin money.ts'te olmasi gibi, tarihin de tek bir yeri var.
//
// NEDEN VAR: bu bicimlendirme dort ayri yerde kopyalanmisti (harcama listesi,
// odeme listesi, davet yonetimi, bildirim metinleri) ve dordunde de dil
// "tr-TR" olarak SABITTI. Ingilizce arayuzde tutarlar dogru bicimlenirken
// tarihler Turkce kalirdi - paranin 11.3'te duzeltilen hatasinin aynisi.

import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

const INTL_LOCALES: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
};

// Intl.DateTimeFormat kurulumu pahalidir ve bu fonksiyon liste satiri basina
// cagriliyor. Dil basina bir kez kurup sakliyoruz (money.ts ile ayni kalip).
const formatters: Partial<Record<Locale, Intl.DateTimeFormat>> = {};

function formatter(locale: Locale): Intl.DateTimeFormat {
  return (formatters[locale] ??= new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    // Gun iki basamak: listelerde tarihler alt alta diziliyor ve "05 Agu" ile
    // "12 Agu" ayni genislikte duruyor. Hizalama bu uygulamanin karakteri
    // (ADR-016); tutarlarda tabular-nums ile yapilan sey burada da gecerli.
    day: "2-digit",
    month: "short",
    year: "numeric",
  }));
}

/**
 * Tarihi okunur bicime cevirir: "12 Agu 2026" / "Aug 12, 2026".
 *
 * Yalnizca GOSTERIM. Sistemin geri kalaninda tarihler Date ya da ISO metni
 * olarak dolasiyor; bicimlenmis metin hicbir yere geri beslenmiyor.
 */
export function formatDate(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  return formatter(locale).format(date);
}

const monthFormatters: Partial<Record<Locale, Intl.DateTimeFormat>> = {};

function monthFormatter(locale: Locale): Intl.DateTimeFormat {
  return (monthFormatters[locale] ??= new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    month: "long",
    year: "numeric",
    // UTC SART: asagida ayin ilk gunu UTC olarak kuruluyor. Bicimlendirici
    // yerel saat dilimini kullansaydi, UTC'nin gerisindeki bir dilimde
    // "2026-08" bir onceki ayin son gunune kayar ve "Temmuz 2026" yazardi.
    timeZone: "UTC",
  }));
}

/**
 * Ay anahtarini baslik metnine cevirir: "2026-08" -> "Agustos 2026" /
 * "August 2026".
 *
 * Girdi summary.ts'in urettigi anahtar; Date degil, cunku ay bir AN degil bir
 * aralik ve araya saat dilimi sokmanin anlami yok.
 */
export function formatMonth(month: string, locale: Locale = DEFAULT_LOCALE): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthFormatter(locale).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}
