import { NOT_TOTAL, TOTAL_LABELS, parseReceiptMoney } from "@/lib/receipt-amount";
import type { ReceiptLine, TextBlock } from "@/lib/receipt-blocks";

/**
 * FISTEKI KALEMLERI CIKARIR (ADR-055).
 *
 * BU MODULUN TEK BASINA CALISMASI MUMKUN DEGILDI. Fis satirinda ad solda,
 * fiyat sagda durur ve Apple Vision ikisini AYRI gozlem olarak dondurur;
 * dondurdugu sira da satira gore degil sutuna gore gruplanir. Yani "hangi
 * fiyat hangi ada ait" bilgisi metinde YOK. Once receipt-blocks.ts o
 * bilgiyi konumdan geri kuruyor; burasi kurulmus satirlari okuyor.
 *
 * SONUC MUKEMMEL OLMAYACAK VE OLMAK ZORUNDA DEGIL. Gercek bir fiste
 * kampanya satiri, vergi satiri, kur bilgisi - hepsi "metin + kuruslu
 * sayi" goruntusunde. Bunlarin bir kismi listeye SIZACAK. Tasarim bunu
 * kabul ediyor: liste kullaniciya gosteriliyor ve istemedigini cikariyor.
 * Amac hatasizlik degil, ELLE YAZMAKTAN IYI OLMAK.
 */

export type ReceiptItemGuess = {
  /** Kullaniciya gosterilecek ad. Adet varsa "2x Kola" bicimindedir. */
  description: string;
  /** Kurus cinsinden, SATIRIN TOPLAMI (adet x birim degil - o zaten satirda). */
  amount: number;
  /** Fiste yaziyorsa adet. Yoksa undefined - "1" yazmak uydurmak olurdu. */
  quantity?: number;
};

/**
 * "2x Kola", "2 X Kola", "2×Kola" -> adet 2, ad "Kola".
 *
 * Fisler adedi adin ONUNE yaziyor ve Vision bunu ada YAPISIK donduruyor
 * ("2xLatte Macchiato" - olculdu, fixtures/receipt-swiss.json). Yani ayirma
 * isi burada yapilmali; kullanici "2x Kola" gormek istiyor.
 */
const QUANTITY_PREFIX = /^(\d{1,3})\s*[x×]\s*(.+)$/i;

/**
 * Para birimi isaretleri ve kodlari. Tutarin YANINDA dururlar ve tutarin
 * parcasi degildirler: "5.00 CHF", "$27.96", "115,00 ₺".
 */
const CURRENCY_MARK = /(₺|\$|€|£|\bTL\b|\bTRY\b|\bCHF\b|\bEUR\b|\bUSD\b|\bAUD\b|\bGBP\b)/gi;

/**
 * BIR PARCA BASTAN SONA TUTAR MI?
 *
 * PARCANIN ICINDEKI RAKAMI ARAMIYORUZ ve bu fark her seyi degistiriyor.
 * Ilk yazim satirdaki her rakam dizisini tutar sayiyordu; olculdu ve
 * SIFIR kalem cikti: "2xLatte Macchiato" icindeki "2" ilk tutar sanildi,
 * ad da onun SOLUNDA hicbir sey kalmadigi icin bosaldi. Negatif kontrol
 * bunu dogruluyor: parcanin tamami yerine icindeki rakam aranirsa ALTI
 * test birden duser.
 *
 * Dogru soru "icinde sayi var mi" degil, "bu parca bir SAYIDAN ibaret mi".
 *
 * AYRICA BIR HARF KONTROLU YOK, cunku GEREKSIZ: parseReceiptMoney zaten
 * butun dizgenin ^\d[\d.,]*$ kalibina uymasini istiyor, yani geriye kalan
 * tek bir harf bile onu dusuruyor. Bir sure fazladan bir harf testi
 * duruyordu; negatif kontrol onu KALDIRINCA hicbir testin dusmedigini
 * gosterdi - yani hicbir is yapmiyordu ve silindi.
 */
function moneyInPart(text: string): { amount: number; hasFraction: boolean } | null {
  const stripped = text.replace(CURRENCY_MARK, "").trim();
  if (stripped.length === 0) return null;
  return parseReceiptMoney(stripped);
}

/** Satirdaki butun tutarlar, soldan saga. */
function moneyParts(line: ReceiptLine): { part: TextBlock; amount: number; hasFraction: boolean }[] {
  const found: { part: TextBlock; amount: number; hasFraction: boolean }[] = [];
  for (const part of line.parts) {
    const parsed = moneyInPart(part.text);
    if (parsed) found.push({ part, amount: parsed.amount, hasFraction: parsed.hasFraction });
  }
  return found;
}

/**
 * Kalemin adi: ILK para parcasinin SOLUNDA kalanlar.
 *
 * SONDAKI KISA PARCALAR ATILIYOR. Fisler birim fiyatin onune bir isaret
 * koyuyor - Isvicre fisinde "à", baska fislerde "@" ya da "x". Bunlar adin
 * parcasi degil, ve olculdu: "1xSchweinschnitzel à 22.00" satirinda ilk
 * paranin solunda ["1xSchweinschnitzel", "à"] kaliyor.
 */
function describe(line: ReceiptLine, firstMoneyPart: TextBlock | null): string {
  const before: TextBlock[] = [];
  for (const part of line.parts) {
    if (firstMoneyPart && part === firstMoneyPart) break;
    before.push(part);
  }
  while (before.length > 0 && before[before.length - 1].text.trim().length <= 2) {
    before.pop();
  }
  return before
    .map((part) => part.text.trim())
    .join(" ")
    .trim();
}

/** Icinde en az bir harf var mi? Yoksa bu bir ad degil (tarih, seri no, tutar). */
function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text);
}

/**
 * "AC90050" gibi bir URUN KODU mu?
 *
 * Kucuk harf YOK ve icinde rakam VAR. "Gloki" kucuk harf tasidigi icin
 * elenir, "PK50 RXL CONVNT" boslugu oldugu icin elenir - kod tek parcadir.
 */
const PRODUCT_CODE = /^[A-Z0-9][A-Z0-9\-/.]*$/;

function looksLikeCode(text: string): boolean {
  return PRODUCT_CODE.test(text) && /\d/.test(text) && /[A-Z]/.test(text);
}

/**
 * Satirlardan kalemleri cikarir.
 *
 * ELEME KURALLARI, her biri gercek fis verisiyle sinandi:
 *
 *   - TOPLAM / ARA TOPLAM / KDV / NAKIT / PARA USTU / INDIRIM satirlari:
 *     bunlar kalem degil, zaten var olan listelerle eleniyor.
 *   - KURUS SARTI: tutarin kurusu yazmali. Bu, fisin ustundeki sayilarin
 *     cogunu tek basina eliyor - fis numarasi, tarih, telefon, vergi no,
 *     posta kodu. Olculdu: "Rech. Nr. 4572" ve "Tel.: 033 853 67 16"
 *     bu sartla duser, sartsiz ikisi de kalem olurdu.
 *   - YUZDE ISARETI: "Incl. 7.6% MwSt" gibi vergi satirlari.
 *   - ADDA HARF SARTI: solunda harf olmayan bir sayi kalem degil.
 */
export function readReceiptItems(lines: ReceiptLine[]): ReceiptItemGuess[] {
  const items: ReceiptItemGuess[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const text = line.text;
    if (TOTAL_LABELS.some((label) => label.pattern.test(text))) continue;
    if (NOT_TOTAL.some((pattern) => pattern.test(text))) continue;
    if (text.includes("%")) continue;

    const money = moneyParts(line);
    if (money.length === 0) continue;

    /**
     * SATIRIN TOPLAMI EN SAGDAKI TUTAR. Fisler birim fiyati solda, satir
     * toplamini sagda basiyor; olculdu: "2xLatte Macchiato 4.50 CHF 9.00"
     * -> 4.50 birim, 9.00 satir toplami.
     */
    const last = money[money.length - 1];
    if (!last.hasFraction) continue;

    let description = describe(line, money[0].part);
    if (description.length === 0 || !hasLetters(description)) continue;

    /**
     * ADI BIR ALT SATIRDA OLAN FISLER - DAR BIR KURAL.
     *
     * OLCULDU (fixtures/receipt-officeworks.json): kod ve fiyat bir
     * satirda, urunun ADI bir altta:
     *     AC90050                        $27.96
     *     PK50 RXL CONVNT CRDHLDR PN/CLP
     *
     * Kural UC SARTI birden ariyor ve bu bilincli - genis bir kural
     * altindaki her satiri ada cevirirdi:
     *   1. bu satirin adi bir URUN KODU gibi duruyor (kucuk harf yok,
     *      rakam var, tek parca),
     *   2. alttaki satirda HIC TUTAR YOK - yani kendisi bir kalem degil,
     *   3. alttaki satirda harf var.
     *
     * Kod atilmiyor, ADIN ONUNE de konmuyor: kullanicinin gormek istedigi
     * sey ne aldigi, kodu degil.
     */
    const next = lines[index + 1];
    if (
      looksLikeCode(description) &&
      next &&
      moneyParts(next).length === 0 &&
      hasLetters(next.text)
    ) {
      description = next.text.trim();
    }

    const match = QUANTITY_PREFIX.exec(description);
    if (!match) {
      items.push({ description, amount: last.amount });
      continue;
    }

    const quantity = Number(match[1]);
    const name = match[2].trim();

    /**
     * TEK TUTAR VARSA CARPIYORUZ. "2 x 12,50" yazan ama satir toplamini
     * BASMAYAN fisler var; orada 12,50 birim fiyattir ve kalemin tutari
     * 25,00'dir. Iki ya da daha fazla tutar varsa carpmiyoruz - satir
     * toplami zaten basilmis demektir ve carpmak onu ikiye katlardi.
     */
    const amount = money.length === 1 ? last.amount * quantity : last.amount;
    items.push({ description: `${quantity}x ${name}`, amount, quantity });
  }

  return items;
}

/** Secilen kalemlerin toplami. Kurus cinsinden tam sayi - float yok. */
export function sumItems(items: { amount: number }[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}
