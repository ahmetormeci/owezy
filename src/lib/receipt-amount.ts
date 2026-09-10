import { MAX_SPLIT_AMOUNT } from "@/lib/split";

/**
 * FIS FOTOGRAFINDAN OKUNAN METINDEN TUTARI CIKARIR (ADR-053).
 *
 * SAF MODUL - OCR'a, React'e, Prisma'ya dokunmuyor. Girdisi metin
 * satirlari, ciktisi kurus cinsinden bir tam sayi. Boyle olmasi bilincli:
 * asil risk metni ANLAMAKTA, tanimakta degil, ve bu haliyle gercek fis
 * metinleriyle native bir derleme olmadan sonuna kadar sinanabiliyor.
 * (ADR-042: saf moduller mobil sinirini geciyor.)
 *
 * NE ANLAMAYA CALISMIYOR: fisi. Kalemleri, satici adini, tarihi
 * cikarmiyor. Cevaplamaya calistigi tek soru "bu fisin toplami kac" -
 * cunku kullanicinin OCR'dan bekledigi tek sey tutari tekrar yazmamak.
 * Daha fazlasi, dogrulugu dusuk ve kullaniciya kontrol ettirilmesi
 * gereken daha cok alan demekti.
 */

/** Toplami isaretleyen etiketler, GUCLUDEN ZAYIFA. Sira onemli. */
const TOTAL_LABELS: { pattern: RegExp; rank: number }[] = [
  { pattern: /\bgenel\s*toplam\b/i, rank: 3 },
  { pattern: /\bgrand\s*total\b/i, rank: 3 },
  { pattern: /\btoplam\s*tutar\b/i, rank: 3 },
  { pattern: /\bamount\s*due\b/i, rank: 3 },
  { pattern: /\bbalance\s*due\b/i, rank: 3 },
  { pattern: /\bodenecek\b/i, rank: 3 },
  { pattern: /\bödenecek\b/i, rank: 3 },
  { pattern: /\btoplam\b/i, rank: 2 },
  { pattern: /\btotal\b/i, rank: 2 },
  { pattern: /\btutar\b/i, rank: 1 },
];

/**
 * Toplam SANILABILECEK ama toplam OLMAYAN satirlar.
 *
 * Her biri gercek bir fiste bulunuyor ve her biri yanlis cevap uretirdi:
 *   ARA TOPLAM / SUBTOTAL  - vergiden onceki tutar, toplamdan KUCUK
 *   KDV / VAT / TAX        - verginin kendisi
 *   NAKIT / CASH           - musterinin verdigi para, toplamdan BUYUK olabilir
 *   PARA USTU / CHANGE     - geri verilen para
 *   INDIRIM / DISCOUNT     - dusulen tutar
 *
 * "ARA TOPLAM" ozellikle onemli: icinde "TOPLAM" gectigi icin etiket
 * eslesmesini GECIYOR. Bu liste onu once eliyor.
 */
const NOT_TOTAL = [
  /\bara\s*toplam\b/i,
  /\bsub\s*-?\s*total\b/i,
  /\bkdv\b/i,
  /\bk\.d\.v\b/i,
  /\bvat\b/i,
  /\btax\b/i,
  /\bnakit\b/i,
  /\bcash\b/i,
  /\bpara\s*ustu\b/i,
  /\bpara\s*üstü\b/i,
  /\bchange\b/i,
  /\bindirim\b/i,
  /\bdiscount\b/i,
];

/** Metindeki sayi gorunumlu parcalar. */
const NUMBER_TOKEN = /\d[\d.,\s]*\d|\d/g;

export type ParsedMoney = {
  /** Kurus cinsinden tam sayi. */
  amount: number;
  /** Kurus basamagi YAZIYOR muydu ("342,50" evet, "342" hayir). */
  hasFraction: boolean;
};

/**
 * "1.234,56" / "1,234.56" / "342,50" / "342" -> kurus.
 *
 * FLOAT'A HIC DONMUYOR. Tam sayi ve kesir parcalari METIN olarak ayriliyor
 * ve kurus = tamsayi * 100 + kesir diye kuruluyor. Degistirilemez kural:
 * para kurus cinsinden tam sayidir; parseFloat kullansaydik 342,50 icin
 * 34249 uretebilecek bir yol acilirdi.
 *
 * AYIRICI BELIRSIZLIGI son ayiricidan SONRAKI BASAMAK SAYISIYLA cozuluyor:
 *   3 basamak -> binlik ayirici  ("1.234" = 1234)
 *   1-2       -> ondalik         ("342,5" = 342,50)
 *   digeri    -> sayi degil, reddediliyor
 * Iki farkli ayirici birlikte geciyorsa SONUNCUSU ondaliktir
 * ("1.234,56" ve "1,234.56" ikisi de dogru cozuluyor).
 */
export function parseReceiptMoney(raw: string): ParsedMoney | null {
  const text = raw.replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);

  let integerPart: string;
  let fractionPart = "";

  if (lastSep === -1) {
    integerPart = text;
  } else {
    const after = text.slice(lastSep + 1);
    if (!/^\d+$/.test(after)) return null;

    if (after.length === 3) {
      // Binlik ayirici: ayiricilarin tamami atiliyor.
      integerPart = text.replace(/[.,]/g, "");
    } else if (after.length === 1 || after.length === 2) {
      integerPart = text.slice(0, lastSep).replace(/[.,]/g, "");
      fractionPart = after;
    } else {
      // 0 ya da 4+ basamak: tarih, vergi numarasi, seri no - para degil.
      return null;
    }
  }

  if (!/^\d+$/.test(integerPart) || integerPart.length === 0) return null;
  // 12 basamaktan uzun bir "tutar" fis toplami degil (vergi no, barkod).
  if (integerPart.length > 12) return null;

  const kurus = fractionPart.padEnd(2, "0").slice(0, 2);
  const amount = Number(integerPart) * 100 + Number(kurus);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_SPLIT_AMOUNT) {
    return null;
  }

  return { amount, hasFraction: fractionPart.length > 0 };
}

export type ReceiptAmountGuess = {
  /** Kurus cinsinden. */
  amount: number;
  /**
   * "labelled": toplam etiketi tasiyan bir satirdan okundu - guvenilir.
   * "largest": etiket bulunamadi, kurusu olan en buyuk sayi secildi.
   * Arayuz ikisini AYIRABILIR; bu alan onun icin var.
   */
  source: "labelled" | "largest";
  /** Okunan satir. Kullaniciya "nereden aldik" diyebilmek icin. */
  line: string;
};

/**
 * Satirlardan fisin toplamini tahmin eder. Bulamazsa null.
 *
 * IKI YOL VE ARALARINDAKI FARK BILINCLI:
 *
 *   1. ETIKETLI. "TOPLAM 342,50" gibi bir satir. Kurus basamagi
 *      ZORUNLU DEGIL - "TOPLAM 350" gecerli bir fis satiri.
 *   2. YEDEK. Etiket yoksa, KURUSU YAZAN en buyuk sayi. Kurus sarti
 *      burada ZORUNLU ve eleyici gucu yuksek: yil (2026), vergi
 *      numarasi, adet, saat ve barkod boyle eleniyor. Fis toplami
 *      neredeyse her zaman kurusuyla basiliyor.
 *
 * ETIKET SATIRIN DEVAMINDA OLMAYABILIR: OCR sik sik etiketi ve tutari
 * AYRI SATIRLARA bolüyor. Bu yuzden etiketli satirda sayi yoksa BIR
 * SONRAKI satira bakiliyor.
 */
export function guessReceiptAmount(lines: string[]): ReceiptAmountGuess | null {
  const clean = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  let best: { rank: number; parsed: ParsedMoney; line: string } | null = null;

  for (let index = 0; index < clean.length; index += 1) {
    const line = clean[index];
    if (NOT_TOTAL.some((pattern) => pattern.test(line))) continue;

    const label = TOTAL_LABELS.find((candidate) => candidate.pattern.test(line));
    if (!label) continue;

    // Once satirin kendisi, sonra bir alttaki satir.
    const sources = [line, clean[index + 1] ?? ""];
    for (const source of sources) {
      const parsed = amountsIn(source).pop();
      if (!parsed) continue;
      if (!best || label.rank > best.rank) {
        best = { rank: label.rank, parsed, line };
      }
      break;
    }
  }

  if (best) {
    return { amount: best.parsed.amount, source: "labelled", line: best.line };
  }

  // --- YEDEK: kurusu yazan en buyuk sayi ---
  let fallback: { amount: number; line: string } | null = null;
  for (const line of clean) {
    if (NOT_TOTAL.some((pattern) => pattern.test(line))) continue;
    for (const parsed of amountsIn(line)) {
      if (!parsed.hasFraction) continue;
      if (!fallback || parsed.amount > fallback.amount) {
        fallback = { amount: parsed.amount, line };
      }
    }
  }

  return fallback
    ? { amount: fallback.amount, source: "largest", line: fallback.line }
    : null;
}

/** Bir satirdaki cozulebilen butun tutarlar, gecis sirasiyla. */
function amountsIn(line: string): ParsedMoney[] {
  const found: ParsedMoney[] = [];
  for (const token of line.match(NUMBER_TOKEN) ?? []) {
    const parsed = parseReceiptMoney(token);
    if (parsed) found.push(parsed);
  }
  return found;
}
