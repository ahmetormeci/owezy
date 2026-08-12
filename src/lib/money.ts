// Para gosterimi ve girisi - sistemin geri kalaniyla arayuz arasindaki SINIR.
//
// Sistemin her yerinde para "en kucuk birim cinsinden tam sayi" (TRY icin kurus).
// Bu dosya iki yonlu donusumden sorumlu:
//   formatMoney(12050) -> "120,50 ₺"   (yalnizca GOSTERIM)
//   parseMoney("120,50") -> 12050      (form girisi -> kurus)
//
// Degismez kural: hesap yapan hicbir kod ondalikli sayi gormez. Donusum burada,
// tam sayi aritmetigi ve metin islemleriyle yapilir; arada float aritmetigi yok.

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

// Dil tipi artik locale.ts'te: cerez adi ve dogrulamasiyla ayni yerde durmasi
// gerekiyordu (bkz. o dosyanin bas yorumu). Buradan yeniden disa aktariliyor,
// boylece "@/lib/money"den Locale alan mevcut importlar oldugu gibi calisiyor.
export type { Locale } from "@/lib/locale";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

const LOCALE_RULES: Record<
  Locale,
  {
    // Binlik gruplamasini Intl'e yaptiriyoruz; ayrac dilden dile degisiyor
    // ("1.234" / "1,234") ve bu listeyi elle tutmak hataya acik.
    intlLocale: string;
    decimal: string;
    // Turkce: "120,50 ₺" (sembol sonda). Ingilizce: "$120.50" (sembol basta).
    symbolFirst: boolean;
    // Turkce: "%33,33". Ingilizce: "33.33%".
    percentFirst: boolean;
  }
> = {
  tr: { intlLocale: "tr-TR", decimal: ",", symbolFirst: false, percentFirst: true },
  en: { intlLocale: "en-US", decimal: ".", symbolFirst: true, percentFirst: false },
};

// Intl.NumberFormat kurulumu pahalidir ve formatMoney bakiye listelerinde
// satir basina cagriliyor. Dil basina bir kez kurup saklıyoruz.
const groupingFormatters: Partial<Record<Locale, Intl.NumberFormat>> = {};

function groupingFormatter(locale: Locale): Intl.NumberFormat {
  return (groupingFormatters[locale] ??= new Intl.NumberFormat(
    LOCALE_RULES[locale].intlLocale,
  ));
}

export function formatMoney(
  minorUnits: number,
  currency = "TRY",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const rules = LOCALE_RULES[locale];
  const isNegative = minorUnits < 0;
  const absolute = Math.abs(minorUnits);

  // Tam sayi bolme + kalan: ondalikli ara deger uretilmiyor.
  // Intl'e yalnizca TAM SAYI olan lira kismi gidiyor; kurus kismi metin
  // olarak ekleniyor. Yani para hicbir asamada float'a donusmuyor.
  const major = Math.trunc(absolute / 100);
  const minor = absolute % 100;

  const majorText = groupingFormatter(locale).format(major);
  const minorText = String(minor).padStart(2, "0");
  const body = `${majorText}${rules.decimal}${minorText}`;

  // Bilinmeyen bir para biriminde sembol yerine kodun kendisini gosteriyoruz
  // ("JPY"). Kod bir sembol degil, o yuzden basa yapistirilmiyor: "JPY120.50"
  // okunmaz, "120.50 JPY" okunur.
  const symbol = CURRENCY_SYMBOLS[currency];
  const display = symbol ?? currency;
  const sign = isNegative ? "-" : "";

  return rules.symbolFirst && symbol !== undefined
    ? `${sign}${display}${body}`
    : `${sign}${body} ${display}`;
}

/**
 * Bakiye gosterimi icin isaretli bicim: "+120,50 ₺" / "−120,50 ₺" / "0,00 ₺".
 *
 * formatMoney TUTARI bicimler; bu fonksiyon YONU bicimler. Ayri durmalarinin
 * sebebi: bir harcamanin tutarinda isaret anlamsizdir ("+120,50 ₺ market
 * alisverisi" sacma), bir bakiyede ise asil bilgi isarettir.
 *
 * Neden renk yetmiyor: bakiye ekraninda yesil "alacak", kiremit "borc" demek.
 * Ama renk tek basina bilgi tasirsa, renk korlugu olan bir kullanici (erkeklerin
 * ~%8'i) veya siyah-beyaz ciktisi alan biri borcunu alacagindan ayirt edemez.
 * Isaret ayni bilgiyi metne yaziyor; renk yalnizca okumayi hizlandiriyor.
 *
 * Eksi icin U+2212 "minus sign" kullaniliyor, klavyedeki kisa tire (U+002D)
 * degil. Kisa tire cogu yazi tipinde rakamlardan dar; sut sut alta gelen
 * tutarlarda virgullerin hizasini kaydiriyor. U+2212 rakam genisligindedir.
 */
export function formatSignedMoney(
  minorUnits: number,
  currency = "TRY",
  locale: Locale = DEFAULT_LOCALE,
): string {
  const formatted = formatMoney(Math.abs(minorUnits), currency, locale);
  if (minorUnits > 0) {
    return `+${formatted}`;
  }
  if (minorUnits < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

/**
 * Kullanicinin yazdigi metni kurus cinsinden tam sayiya cevirir.
 * Cozulemeyen girdilerde null doner (cagiran taraf dogrulama hatasi gosterir).
 *
 * Turkce yazimda "." binlik, "," ondalik ayracidir; ama kullanici ikisini de
 * ters kullanabilir. Bu yuzden SON ayrac belirleyici kabul edilir ve ondan
 * sonraki basamak sayisina bakilir:
 *   - 1 veya 2 basamak -> ondalik   ("120,5" -> 12050 / "120.50" -> 12050)
 *   - tam 3 basamak    -> binlik    ("1.234" -> 123400)
 *   - diger            -> gecersiz
 * Para hicbir zaman 3 ondalik basamakla yazilmadigi icin bu ayrim guvenli.
 *
 * NEDEN BU FONKSIYON DILE DUYARLI DEGIL (Faz 11.3'te olculdu):
 * Kural ayracin KIMLIGINE degil, ondan sonraki BASAMAK SAYISINA baktigi icin
 * iki yazim da ayni sonuca cikiyor - olculdu, tahmin edilmedi:
 *
 *   "2.500"        -> 250000      "2,500"        -> 250000
 *   "2,50"         -> 250         "2.50"         -> 250
 *   "1.234,56"     -> 123456      "1,234.56"     -> 123456
 *   "12.345.678,90"-> 1234567890  "12,345,678.90"-> 1234567890
 *
 * Buraya bir "locale" parametresi eklemek davranisi degistirmez, yalnizca
 * yanlis bir izlenim verir. Katilastirmak ise bugun calisan girdileri
 * reddederdi: numpad aliskanligiyla "120.50" yazan Turk kullanici su an
 * dogru sonucu aliyor, katı kuralda hata gorurdu.
 *
 * Dile bagimli olan taraf GOSTERIM (formatMoney), giris degil.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/[₺$€£\s ]/g, "");
  if (cleaned === "") {
    return null;
  }

  const isNegative = cleaned.startsWith("-");
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;

  if (!/^[0-9.,]+$/.test(unsigned)) {
    return null;
  }

  const lastSeparatorIndex = Math.max(unsigned.lastIndexOf(","), unsigned.lastIndexOf("."));

  let majorText: string;
  let minorText: string;

  if (lastSeparatorIndex === -1) {
    majorText = unsigned;
    minorText = "00";
  } else {
    const head = unsigned.slice(0, lastSeparatorIndex);
    const tail = unsigned.slice(lastSeparatorIndex + 1);

    if (tail.length === 3) {
      // Son ayrac da binlik ayraciymis: ondalik kismi yok.
      majorText = `${head}${tail}`.replace(/[.,]/g, "");
      minorText = "00";
    } else if (tail.length === 1 || tail.length === 2) {
      majorText = head.replace(/[.,]/g, "");
      minorText = tail.padEnd(2, "0");
    } else {
      return null;
    }
  }

  if (majorText === "") {
    majorText = "0";
  }
  if (!/^\d+$/.test(majorText) || !/^\d{2}$/.test(minorText)) {
    return null;
  }

  const result = Number(majorText) * 100 + Number(minorText);
  if (!Number.isSafeInteger(result)) {
    return null;
  }

  return isNegative ? -result : result;
}

/**
 * Yuzde girisini "basis point"e (yuzde binde biri) cevirir: "33,33" -> 3333.
 *
 * Ayristirma kurali parayla birebir ayni problem: iki ondalik basamakli bir
 * sayiyi tam sayiya cevirmek. Bu yuzden parseMoney'i yeniden kullaniyoruz -
 * "33,33 lira -> 3333 kurus" ile "%33,33 -> 3333 basis point" ayni islem.
 */
export function parsePercentageToBasisPoints(input: string): number | null {
  const parsed = parseMoney(input);
  if (parsed === null || parsed < 0) {
    return null;
  }
  return parsed;
}

/**
 * Yuzde gosterimi de dile bagimli, hem de iki yerden: ondalik ayraci
 * ("33,33" / "33.33") ve isaretin yeri. Turkce yuzde isaretini ONE yazar
 * ("%33"), Ingilizce ARKAYA ("33%"). Ikisi de dogru; birbirinin yerine
 * kullanilinca yanlis.
 */
export function formatBasisPoints(
  basisPoints: number,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const rules = LOCALE_RULES[locale];
  const whole = Math.trunc(basisPoints / 100);
  const fraction = basisPoints % 100;

  const body =
    fraction === 0
      ? String(whole)
      : `${whole}${rules.decimal}${String(fraction).padStart(2, "0")}`;

  return rules.percentFirst ? `%${body}` : `${body}%`;
}
