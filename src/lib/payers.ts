import { ValidationError } from "@/lib/errors";
import type { MessageCode, MessageParams } from "@/lib/messages";

/**
 * Birden fazla odeyen (ADR-067) - saf kurallar.
 *
 * NEDEN AYRI BIR MODUL: split.ts "kim ne kadar BORCLANDI" sorusunu
 * cevapliyor, bu dosya "kim ne kadar ODEDI". Ikisi ayni harcamanin iki
 * yuzu ama birbirinden bagimsiz: dort bolusum turunun hepsi her odeyen
 * listesiyle calisiyor.
 *
 * SAF: Prisma'ya da React'e de dokunmuyor, o yuzden mobil agac da import
 * ediyor (ADR-042). Formun "kalan" satiri ile sunucunun dogrulamasi ayni
 * kurali buradan okuyor - ekranda gorunen ile kaydedilen ayrisamasin.
 *
 * Tutarlar kurus cinsinden TAM SAYI. Hicbir adimda kesirli deger yok.
 */

export type PayerShare = {
  userId: string;
  amount: number;
};

/**
 * Bir istekte en fazla kac odeyen. Pratikte grubun uye sayisi; sinir
 * sunucuyu korumak icin (kalemlerdeki MAX_EXPENSE_ITEMS ile ayni gerekce).
 */
export const MAX_EXPENSE_PAYERS = 50;

/**
 * Istek govdesinden harcamanin odeyenlerini cikarir ve dogrular.
 *
 * IKI GOVDE BICIMI VAR ve ikisi de gecerli:
 *   payers    - yeni istemciler. Her satir bir kisi ve odedigi kisim.
 *   paidById  - ESKI istemciler (magazadaki 1.0.7) ve hizli giris satiri.
 *               Tek odeyen, tutarin tamami.
 * Ikisinden TAM OLARAK BIRI gelmeli; bunu sema (expense-schemas.ts)
 * denetliyor. Burada ikisi birden gelirse payers kazanir - yalnizca
 * savunma, sema o istegi buraya ulastirmiyor.
 *
 * TOPLAM TUTARA ESIT OLMALI. Veritabani da ayni kurali commit aninda
 * denetliyor (ertelenmis tetikleyici); buradaki kontrol kullaniciya
 * anlamli bir hata kodu vermek icin, son savunma hatti degil.
 */
export function resolvePayers(input: {
  amount: number;
  paidById?: string;
  payers?: PayerShare[];
}): PayerShare[] {
  if (!input.payers) {
    if (!input.paidById) {
      throw new ValidationError("payer.none");
    }
    return [{ userId: input.paidById, amount: input.amount }];
  }

  if (input.payers.length === 0) {
    throw new ValidationError("payer.none");
  }

  const seen = new Set<string>();
  let total = 0;
  for (const payer of input.payers) {
    if (seen.has(payer.userId)) {
      throw new ValidationError("payer.duplicate", { userId: payer.userId });
    }
    seen.add(payer.userId);

    // SIFIR DA GECERSIZ: hicbir sey odememis biri odeyen degil. Formda bos
    // kalan satir zaten gonderilmiyor.
    if (!Number.isInteger(payer.amount) || payer.amount <= 0) {
      throw new ValidationError("payer.amount_invalid", { userId: payer.userId });
    }
    total += payer.amount;
  }

  if (total !== input.amount) {
    throw new ValidationError("payer.sum_mismatch", { total, amount: input.amount });
  }

  return input.payers.map((payer) => ({ userId: payer.userId, amount: payer.amount }));
}

/**
 * ANA ODEYEN: en cok odeyen; esitlikte listede ILK siradaki.
 *
 * Expense.paidById'ye bu yaziliyor. Eski istemciler "X odedi"yi oradan
 * okuyor; en cok odeyeni gostermek, tek bir ad sigiyorsa en az yaniltan ad.
 *
 * ESITLIKTE LISTE SIRASI cunku formda ilk satir harcamayi giren kisi
 * (genelde "Sen") ve yari yariya odenmis bir hesapta onun adinin
 * gorunmesi en dogal sonuc. Liste bossa tanimsiz - cagiran zaten
 * resolvePayers'tan gecmis bir liste veriyor.
 */
export function primaryPayerId(payers: PayerShare[]): string {
  let primary = payers[0];
  for (const payer of payers) {
    if (payer.amount > primary.amount) {
      primary = payer;
    }
  }
  return primary.userId;
}

/**
 * GOSTERIM SIRASI: ana odeyen basta, kalanlar tutara gore azalan; esitlikte
 * kimlige gore - yalnizca sira her cizimde ayni olsun diye.
 *
 * Ana odeyeni paidById'den okuyor, yeniden hesaplamiyor: veritabanindaki
 * satirlarin sirasi istek sirasini tasimiyor, yani "esitlikte ilki"
 * kurali burada yeniden uygulanamaz. paidById o karari zaten sakliyor.
 */
export function orderPayers<T extends PayerShare>(payers: T[], paidById: string): T[] {
  return [...payers].sort((a, b) => {
    if (a.userId === paidById) return -1;
    if (b.userId === paidById) return 1;
    if (a.amount !== b.amount) return b.amount - a.amount;
    return a.userId.localeCompare(b.userId);
  });
}

/**
 * Formun ILK SATIRI: tutardan digerlerinin girdiklerini cikarir (yon C).
 *
 * Kalan HESAPLANIYOR, girilmiyor - toplam tutmazligini neredeyse imkansiz
 * kilan bu. Okunamayan (null) satirlar sifir sayiliyor: o satiri kaydetme
 * adimi zaten ayrica reddediyor, kalanin da o arada bir sayi gostermesi
 * yaziyi bozmaktan iyi.
 *
 * Sonuc SIFIR ya da NEGATIF olabilir: digerleri tutari doldurmus ya da
 * asmis demek. Gecerli olup olmadigina cagiran karar veriyor (ilk satir
 * da bir odeyen, yani > 0 olmali).
 */
export function payerRemainder(amount: number, others: (number | null)[]): number {
  return others.reduce<number>((rest, value) => rest - (value ?? 0), amount);
}

/**
 * Cevirmen: web'in useTranslate'i ve mobilin t'si ayni sekilde. Burada
 * bir tip olarak duruyor ki bu modul i18n saglayicisina baglanmasin.
 */
type Translate = (code: MessageCode, params?: MessageParams) => string;

/**
 * Liste satirindaki odeyen parcasi: "Ayse odedi", "Ayse ve Can odedi",
 * "Ayse ve 2 kisi odedi".
 *
 * WEB VE MOBIL AYNI CUMLEYI BURADAN KURUYOR. Uc kalip butun cumle olarak
 * sozlukte duruyor (ui.paid_by*): Ingilizcede kelime sirasi ters ("paid by
 * X and Y"), parca birlestirmek ceviriyi bozardi.
 *
 * UCUNCU KISIDEN SONRASI SAYI: ad listesi uzadikca satir kategoriyi ve payi
 * ekranin disina itiyor - ayni sebeple uzun e-posta adlari da kisaltiliyor
 * (expense-list-view.ts). Tum adlar harcamanin icinde.
 *
 * `nameOf` cagiranin ad cozumu (displayNameForLine dahil) - bu modul uye
 * listesini bilmiyor.
 */
export function payerLine(
  payers: PayerShare[],
  paidById: string,
  nameOf: (userId: string) => string,
  t: Translate,
): string {
  // Alan gelmediyse (eski bir cevap) tek odeyen: ana odeyen.
  const ordered = payers.length > 0 ? orderPayers(payers, paidById) : [{ userId: paidById, amount: 0 }];
  const first = nameOf(ordered[0].userId);
  if (ordered.length === 1) {
    return t("ui.paid_by", { name: first });
  }
  if (ordered.length === 2) {
    return t("ui.paid_by_two", { first, second: nameOf(ordered[1].userId) });
  }
  return t("ui.paid_by_many", { first, count: ordered.length - 1 });
}

/**
 * Odeyenlerin tam dokumu: tek odeyende yalnizca ad, birden fazlasinda
 * "Ayse 800,00 · Can 400,00". Cakisma uyarisi ve CSV kullaniyor.
 *
 * TEK ODEYENDE TUTAR YOK: tutarin tamamini odemis, o sayi zaten yaninda
 * yaziyor. Yazmak ayni sayiyi iki kez soylemek olurdu.
 */
export function describePayers(
  payers: PayerShare[],
  paidById: string,
  nameOf: (userId: string) => string,
  formatAmount: (amount: number) => string,
  separator = " · ",
): string {
  const ordered = orderPayers(payers, paidById);
  if (ordered.length === 1) {
    return nameOf(ordered[0].userId);
  }
  return ordered
    .map((payer) => `${nameOf(payer.userId)} ${formatAmount(payer.amount)}`)
    .join(separator);
}
