import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";
import { MAX_SPLIT_AMOUNT } from "@/lib/split";
import { MAX_EXPENSE_PAYERS } from "@/lib/payers";

// Sayfalama sinirlari API sozlesmesinin parcasi oldugu icin sema dosyasinda
// tanimli; servis katmani (expenses.ts) bunlari buradan okur. Ters yonde
// (servisten semaya) import etmek, servisi mock'layan route testlerinde
// semayi de bozardi.
export const DEFAULT_EXPENSE_PAGE_SIZE = 50;
export const MAX_EXPENSE_PAGE_SIZE = 100;

// Prisma'nin ExpenseCategory enum'unu tekrar yazmak yerine, uretilen degerlerden
// bir Zod semasi turetiyoruz - tek kaynak schema.prisma'da kalir.
const categorySchema = z.enum(
  Object.values(ExpenseCategory) as [ExpenseCategory, ...ExpenseCategory[]],
);

const commonExpenseFields = {
  description: z.string().min(1).max(500),
  amount: z.number().int().positive().max(MAX_SPLIT_AMOUNT),
  category: categorySchema.optional(),
  expenseDate: z.coerce.date().optional(),
};

/**
 * TEK ODEYENLI govde: tekrarlayan harcama sablonlari (ADR-067, S3).
 * Sablon cok odeyenli olamiyor ve bu ayrim TIPTE - kalemlerde oldugu gibi.
 */
const singlePayerExpenseSchema = z.object({
  ...commonExpenseFields,
  paidById: z.uuid(),
});

const payerSchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().positive().max(MAX_SPLIT_AMOUNT),
});

/**
 * Harcama govdesi: odeyenler IKI BICIMDEN BIRIYLE geliyor (ADR-067).
 *
 *   payers    - yeni istemciler. Tek odeyenli harcamada da tek satirlik
 *               bir liste.
 *   paidById  - ESKI bicim. Magazadaki 1.0.7 yalnizca bunu biliyor ve
 *               gondermeye devam edecek; hizli giris satiri da bunu
 *               kullaniyor (orada odeyen her zaman "sen").
 *
 * IKISI BIRDEN ya da HICBIRI gecersiz - asagidaki exactlyOnePayerForm.
 * Ikisi birden gelseydi hangisinin kazandigi sozlesmede yazili olmayan
 * bir kural olurdu.
 *
 * Toplamin tutara esitligi ve tekrar eden kisi burada DEGIL, servis
 * katmaninda (payers.ts) denetleniyor: o hatalarin kendi kodlari var ve
 * mobil form da ayni kurali oradan okuyor.
 */
const multiPayerExpenseSchema = z.object({
  ...commonExpenseFields,
  paidById: z.uuid().optional(),
  payers: z.array(payerSchema).min(1).max(MAX_EXPENSE_PAYERS).optional(),
});

function exactlyOnePayerForm(
  body: { paidById?: string; payers?: unknown[] },
  ctx: z.RefinementCtx,
) {
  if ((body.paidById === undefined) === (body.payers === undefined)) {
    ctx.addIssue({ code: "custom", message: "validation.invalid", path: ["payers"] });
  }
}

const exactShareSchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().nonnegative(),
});

const percentageShareSchema = z.object({
  userId: z.uuid(),
  basisPoints: z.number().int().min(0).max(10_000),
});

/**
 * Kalem kalem bolusumun sinirlari (ADR-052).
 *
 * ELLI KALEM: bir restoran hesabi icin fazlasiyla yeterli ve ustu bir liste
 * degil bir defter olurdu. Sinir olmasaydi tek bir istek binlerce satir
 * yazdirabilirdi - kullanicinin degil, sunucunun korunma sebebi.
 */
export const MAX_EXPENSE_ITEMS = 50;
export const MAX_ITEM_DESCRIPTION_LENGTH = 200;

const itemSchema = z.object({
  description: z.string().trim().min(1).max(MAX_ITEM_DESCRIPTION_LENGTH),
  amount: z.number().int().positive().max(MAX_SPLIT_AMOUNT),
  /**
   * Kalemi PAYLASANLAR. Bos olamaz - "kimsenin yemedigi kalem" diye bir sey
   * yok ve olsaydi tutari kimseye dagitilamazdi.
   */
  userIds: z.array(z.uuid()).min(1),
});

// Hem olusturma (POST) hem guncelleme (PUT) ayni govdeyi kullanir: guncelleme
// "tam degistirme" semantigi tasir, yani istemci harcamanin tam halini gonderir.
// Tek bir semayi paylasmak, iki endpoint'in zamanla sessizce birbirinden
// ayrilmasini (orn. biri yeni bir alan kabul ederken digeri etmemesi) onler.
//
// currency BILEREK bu semada yok - istemciden asla alinmiyor, servis katmani her
// zaman grubun currency'sini kullanir. Zod'un varsayilan "strip" davranisi geregi,
// body'de fazladan bir "currency" alani gonderilse bile parse sonrasi elenir.
// Query string'ten gelen her deger string oldugu icin sayisal alanlarda coerce
// kullaniyoruz. includeDeleted'i z.coerce.boolean() ile parse ETMIYORUZ: bos
// olmayan her string true'ya donusurdu, yani "?includeDeleted=false" bile true
// olurdu. Bu yuzden kabul edilen degerleri acikca listeliyoruz.
export const listExpensesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_EXPENSE_PAGE_SIZE).optional(),
  cursor: z.uuid().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Arama metni. Bos string'i ELEMEK sart: "?q=" gonderildiginde filtre
  // uygulanmis sayilirsa liste hicbir seyle eslesmez gibi davranir.
  q: z.string().trim().min(1).max(100).optional(),
  category: categorySchema.optional(),
  // includeDeleted ile ayni sebep: z.coerce.boolean() bos olmayan her string'i
  // true yapardi, yani "?mine=false" bile true olurdu.
  mine: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Ay penceresi: "YYYY-MM". Sema burada da dogruluyor ki gecersiz bir deger
  // servise hic ulasmasin - servisteki kontrol son savunma hatti, ilki degil.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

// Optimistic locking surumu (ADR-032). expenseBodySchema'nin ICINE
// konulmuyor cunku o sema POST ile PAYLASILIYOR ve olusturmada surum diye bir
// sey yok. Ayri bir sema olarak ayni ham govdeden ikinci kez okunuyor; Zod'un
// varsayilan "strip" davranisi geregi expenseBodySchema "version"i zaten eliyor.
//
// ZORUNLU, opsiyonel degil: gonderilmedigi zaman kontrolun atlandigi bir
// yazma yolu birakmak, kontrolu hic koymamakla ayni kapiya cikar.
export const expenseVersionSchema = z.object({
  version: z.number().int().positive(),
});

// DELETE'in govdesi yok (bazi ara sunucular kirpiyor), o yuzden surum query
// string'ten geliyor. Orada her deger string oldugu icin coerce sart.
export const deleteExpenseQuerySchema = z.object({
  version: z.coerce.number().int().positive(),
});

const equalFields = {
  splitType: z.literal("EQUAL"),
  participantUserIds: z.array(z.uuid()).min(1),
};
const exactFields = {
  splitType: z.literal("EXACT"),
  shares: z.array(exactShareSchema).min(1),
};
const percentageFields = {
  splitType: z.literal("PERCENTAGE"),
  shares: z.array(percentageShareSchema).min(1),
};

/**
 * SABLONUN TARIF ETTIGI HARCAMA: kalemsiz UC tur, TEK odeyen.
 *
 * Bir sablon kalem kalem OLAMIYOR (ADR-052): "her ay ayni restoran hesabi,
 * ayni kalemlerle" diye bir ihtiyac yok; kira ve abonelik duz bir toplam.
 * Desteklemek, kalemler icin ikinci bir tablo cifti ve her uretimde onlarin
 * kopyalanmasi demekti - karsiliginda kimsenin kullanmayacagi bir yetenek.
 *
 * Cok odeyenli de OLAMIYOR (ADR-067, kullanicinin karari): ilk surumun
 * disinda. Ihtiyac cikarsa sablona da bir odeyen tablosu gerekecek.
 *
 * Ayrimi TIPTE tutuyoruz, bir kontrol satirinda degil: recurring-schemas.ts
 * bu birlesimi kullaniyor ve ITEMIZED ya da "payers" tasiyan bir govde
 * oraya ULASAMIYOR (Zod'un "strip" davranisi fazladan alani eliyor,
 * paidById ise zorunlu).
 */
export const templateExpenseBodySchema = z.discriminatedUnion("splitType", [
  singlePayerExpenseSchema.extend(equalFields),
  singlePayerExpenseSchema.extend(exactFields),
  singlePayerExpenseSchema.extend(percentageFields),
]);

export const expenseBodySchema = z
  .discriminatedUnion("splitType", [
    multiPayerExpenseSchema.extend(equalFields),
    multiPayerExpenseSchema.extend(exactFields),
    multiPayerExpenseSchema.extend(percentageFields),
    /**
     * KATILIMCI LISTESI YOK ve olmamali: katilimcilar kalem atamalarinin
     * BIRLESIMI. Iki yerden girilebilseydi ikisi celisebilirdi - hicbir
     * kaleme atanmamis bir "katilimci" ne demek olurdu?
     */
    multiPayerExpenseSchema.extend({
      splitType: z.literal("ITEMIZED"),
      items: z.array(itemSchema).min(1).max(MAX_EXPENSE_ITEMS),
    }),
  ])
  .superRefine(exactlyOnePayerForm);
