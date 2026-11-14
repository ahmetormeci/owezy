import { formatMoneyForInput, parseMoney } from "@/lib/money";
import type { Locale } from "@/lib/locale";
import type { MessageCode } from "@/lib/messages";
import { orderPayers, payerRemainder, type PayerShare } from "@/lib/payers";

/**
 * Mobil formlarin ODEYEN SATIRLARI (ADR-067, yon C) - saf kurallar.
 *
 * Iki ekran kullaniyor: harcama ekleme ve harcama detayi. Kural web'deki
 * formla AYNI: ilk satir (ana odeyen) tutar YAZMIYOR, kalani aliyor;
 * digerleri kendi tutarini yaziyor. Kalanin hesabi sunucunun da kullandigi
 * payerRemainder'dan geciyor - ekranda gorunen "kalan" ile gonderilen tutar
 * ayrisamasin.
 *
 * REACT NATIVE'E DOKUNMUYOR, o yuzden vitest'le test ediliyor (lib/**).
 */

/** Ek bir odeyen satiri. Tutar METIN: kullanici yazarken ara hallerden gecer. */
export type PayerDraft = { userId: string; amountText: string };

/**
 * Kayitli harcamadan ek satirlar: ana odeyen DISINDAKILER, gosterim
 * sirasinda (tutar azalan). Ana odeyen ilk satirda zaten duruyor.
 *
 * `payers` gelmeyebilir (eski sunucu cevabi): o zaman tek odeyen, yani ek
 * satir yok.
 */
export function extraPayerDrafts(
  payers: PayerShare[] | undefined,
  paidById: string,
  locale: Locale,
): PayerDraft[] {
  return orderPayers(payers ?? [], paidById)
    .filter((payer) => payer.userId !== paidById)
    .map((payer) => ({
      userId: payer.userId,
      amountText: formatMoneyForInput(payer.amount, locale),
    }));
}

export type PayerFormState = {
  /** Ilk satirin kalani. Tutar okunamiyorsa null. */
  rest: number | null;
  /**
   * Kaydi engelleyen ilk sorun. Tek odeyende hic yok.
   *
   * IKI DURUM VE SIRASI ONEMLI: once "bir satirin tutari eksik" - o
   * durumda kalan da anlamsiz. Sonra "digerleri tutari dolduruyor": ilk
   * satir da bir odeyen, sifir ya da eksi odemis olamaz.
   */
  error: MessageCode | null;
  /**
   * Canli gosterilen tek hata (web'deki gibi). "Eksik tutar" yazarken gecici
   * bir durum - ancak kaydete basinca soyleniyor.
   */
  exceeds: boolean;
};

export function payerFormState(amount: number | null, extras: PayerDraft[]): PayerFormState {
  if (extras.length === 0) {
    return { rest: amount, error: null, exceeds: false };
  }
  const values = extras.map((payer) => parseMoney(payer.amountText));
  const rest = amount === null ? null : payerRemainder(amount, values);
  const missing = values.some((value) => value === null || value <= 0);
  const exceeds = !missing && rest !== null && rest <= 0;
  return {
    rest,
    error: missing ? "ui.each_payer_amount_required" : exceeds ? "ui.payers_exceed" : null,
    exceeds,
  };
}

/**
 * Sunucuya gidecek liste. Tek odeyende de LISTE gidiyor (web gibi):
 * `paidById` yalnizca eski istemcilerin ve sablonlarin bicimi.
 *
 * Cagiran once payerFormState'in hatasiz oldugunu dogrulamis olmali;
 * okunamayan bir satir burada sifir olur ve sunucu onu reddeder.
 */
export function payersBody(
  primaryId: string,
  amount: number,
  extras: PayerDraft[],
): PayerShare[] {
  const values = extras.map((payer) => parseMoney(payer.amountText));
  return [
    { userId: primaryId, amount: payerRemainder(amount, values) },
    ...extras.map((payer, index) => ({ userId: payer.userId, amount: values[index] ?? 0 })),
  ];
}

/**
 * BU HARCAMADA NET DURUMUM: odedigim - payim. Listede payin rengi buna
 * bakiyor (ADR-067).
 *
 * Eskiden renk "ben mi odedim"e bakiyordu. Iki kisi odediginde o soru
 * yetmiyor: 3.000 odeyip 2.250 pay alan biri alacakli, 1.000 odeyip 2.250
 * pay alan borclu - ikisi de "odeyenlerden biri". Tek odeyende sonuc
 * eskisiyle ayni: odediysem tutarin tamami eksi payim (> 0, cunku pay
 * tutarin tamami oldugunda satir payi zaten yazmiyor).
 *
 * `payers` gelmeyen eski bir cevapta tek odeyen sayiliyor.
 */
export function netOnExpense(
  expense: {
    amount: number;
    paidById: string;
    payers?: PayerShare[];
    participants: { userId: string; shareAmount: number }[];
  },
  userId: string,
): number {
  const payers = expense.payers ?? [{ userId: expense.paidById, amount: expense.amount }];
  const paid = payers
    .filter((payer) => payer.userId === userId)
    .reduce((sum, payer) => sum + payer.amount, 0);
  const share = expense.participants
    .filter((participant) => participant.userId === userId)
    .reduce((sum, participant) => sum + participant.shareAmount, 0);
  return paid - share;
}
