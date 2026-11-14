"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory, SplitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, selectClassName } from "@/components/ui/input";
import { SectionHead } from "@/components/section-head";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  formatBasisPoints,
  formatBasisPointsForInput,
  formatMoney,
  formatMoneyForInput,
  parseMoney,
  parsePercentageToBasisPoints,
  sumWrittenAmounts,
  type Locale,
} from "@/lib/money";
import { guessCategory } from "@/lib/expense-category-guess";
import {
  inferBasisPoints,
  MAX_SPLIT_AMOUNT,
  splitByItems,
  splitByPercentage,
  splitEqually,
  splitExactly,
  type SplitShare,
} from "@/lib/split";
import { MAX_EXPENSE_ITEMS } from "@/lib/expense-schemas";
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SPLIT_TYPE_CODES,
} from "@/lib/expense-labels";
import { diffExpenses, type ExpenseChange } from "@/lib/expense-diff";
import { describePayers, orderPayers, payerRemainder, primaryPayerId } from "@/lib/payers";
import { formatDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { useLocale, useTranslate } from "@/lib/i18n";

type Member = {
  userId: string;
  displayName: string;
};

export type ExpenseFormInitialValues = {
  id: string;
  description: string;
  amount: number;
  /** Ana odeyen (ADR-067): en cok odeyen. Formun ilk odeyen satiri. */
  paidById: string;
  /** Kim ne kadar odedi. Tek odeyenli harcamada tek satir. */
  payers: { userId: string; amount: number }[];
  category: ExpenseCategory;
  splitType: SplitType;
  expenseDate: string;
  participants: { userId: string; shareAmount: number; basisPoints: number | null }[];
  /**
   * Kalemler (ADR-052). Yalnizca ITEMIZED harcamalarda dolu. Duzenleme
   * formu masayi yeniden kurabilsin diye geliyor - gelmeseydi kullanici
   * kalemleri bastan girmek zorunda kalirdi.
   */
  items?: { description: string; amount: number; userIds: string[] }[];
  /** Optimistic locking sayaci (ADR-032). Kaydederken geri gonderiliyor. */
  version: number;
};

/** Formdaki bir kalem satiri. Tutar METIN: kullanici yazarken ara hallerden gecer. */
type ItemDraft = {
  description: string;
  amountText: string;
  userIds: string[];
};

/**
 * ILK SATIRIN DISINDAKI bir odeyen (ADR-067, yon C). Ilk odeyen `paidById`
 * durumunda ve tutari GIRILMIYOR: tutardan bunlarin toplami cikariliyor.
 */
type PayerDraft = {
  userId: string;
  amountText: string;
};

type ParticipantDraft = {
  userId: string;
  selected: boolean;
  amountText: string;
  percentageText: string;
};

/**
 * Cakisma (ADR-032) durumu.
 *
 * "deleted": harcama arada silinmis, kaydetmenin bir anlami kalmadi.
 * "changed": baskasi degistirmis; `changes` neyin degistigini soyluyor.
 *   Bos dizi olabilir - o zaman degisikligi tarif edemiyoruz, ama SAKLAMIYORUZ:
 *   uyari yine cikiyor, yalnizca icerigi "gosteremiyoruz" oluyor.
 */
type ConflictState =
  | { kind: "deleted" }
  | { kind: "changed"; changes: ExpenseChange[] };


// Duzenleme formunun yuzde alanlarini neyle dolduracagini belirler.
//
// Iki kaynak var ve sirasi onemli:
//   1. Kayitli yuzde (basisPoints kolonu) - kullanicinin GERCEKTEN yazdigi sey.
//   2. Paylardan geri hesaplama - yalnizca kolon eklenmeden onceki kayitlar icin,
//      ve yalnizca inferBasisPoints ispati gecirirse.
//
// PERCENTAGE olmayan harcamalarda bos donuyor: EQUAL bir harcamayi acip
// PERCENTAGE'a gecen kullaniciya "%50 / %50" gostermek, hic girilmemis bir
// yuzdeyi girilmis gibi sunmak olurdu.
function resolveBasisPoints(
  initial: ExpenseFormInitialValues | undefined,
): Map<string, number> {
  const result = new Map<string, number>();

  if (!initial || initial.splitType !== "PERCENTAGE") {
    return result;
  }

  if (initial.participants.every((participant) => participant.basisPoints !== null)) {
    for (const participant of initial.participants) {
      if (participant.basisPoints !== null) {
        result.set(participant.userId, participant.basisPoints);
      }
    }
    return result;
  }

  const inferred = inferBasisPoints({
    amount: initial.amount,
    shares: initial.participants.map((participant) => ({
      userId: participant.userId,
      amount: participant.shareAmount,
    })),
  });

  for (const share of inferred ?? []) {
    result.set(share.userId, share.basisPoints);
  }

  return result;
}

function buildInitialParticipants(
  members: Member[],
  initial: ExpenseFormInitialValues | undefined,
  locale: Locale,
): ParticipantDraft[] {
  const basisPointsByUser = resolveBasisPoints(initial);

  return members.map((member) => {
    const existing = initial?.participants.find(
      (participant) => participant.userId === member.userId,
    );
    const basisPoints = basisPointsByUser.get(member.userId);

    return {
      userId: member.userId,
      selected: initial ? Boolean(existing) : true,
      amountText: existing ? formatMoneyForInput(existing.shareAmount, locale) : "",
      percentageText:
        basisPoints === undefined ? "" : formatBasisPointsForInput(basisPoints, locale),
    };
  });
}

export function ExpenseForm({
  groupId,
  currency,
  members,
  currentUserId,
  initialValues,
}: {
  groupId: string;
  currency: string;
  members: Member[];
  currentUserId: string;
  initialValues?: ExpenseFormInitialValues;
}) {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const isEditing = Boolean(initialValues);

  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [amountText, setAmountText] = useState(
    initialValues ? formatMoneyForInput(initialValues.amount, locale) : "",
  );
  const [paidById, setPaidById] = useState(initialValues?.paidById ?? currentUserId);
  /**
   * DIGER ODEYENLER (ADR-067, yon C). Bos liste = tek odeyen; formun
   * bugunku hali. Duzenlemede ana odeyen ilk satira, digerleri buraya
   * diziliyor - ana odeyen en cok odeyen oldugu icin "kalan" onun kayitli
   * tutarini birebir veriyor.
   */
  const [extraPayers, setExtraPayers] = useState<PayerDraft[]>(() =>
    initialValues
      ? orderPayers(initialValues.payers, initialValues.paidById)
          .filter((payer) => payer.userId !== initialValues.paidById)
          .map((payer) => ({
            userId: payer.userId,
            amountText: formatMoneyForInput(payer.amount, locale),
          }))
      : [],
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initialValues?.category ?? "OTHER",
  );
  /**
   * Kategoriye ELLE dokunuldu mu?
   *
   * Dokunulmadigi surece aciklamadan tahmin ediliyor; bir kez secim
   * yapildiginda tahmin susuyor. DUZENLEMEDE bastan "dokunulmus" sayiliyor:
   * kayitli bir kategoriyi, kullanici aciklamayi degistirdi diye ezmek
   * onun kararini geri almak olurdu.
   */
  const [categoryTouched, setCategoryTouched] = useState(isEditing);
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType ?? "EQUAL");
  const [expenseDate, setExpenseDate] = useState(
    initialValues?.expenseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() =>
    buildInitialParticipants(members, initialValues, locale),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * TEKRARLAMA (ADR-051).
   *
   * AYRI BIR FORM ACILMADI ve bu bilincli: tekrarlayan bir harcama, bir
   * harcamanin TA KENDISI artı bir donem. Ayri bir form, ayni yedi alani
   * ikinci kez yazmak ve ikisinin zamanla ayrismasi demekti - biri yeni bir
   * bolusum turunu tanirken digerinin tanimamasi gibi.
   *
   * DUZENLEMEDE HIC GORUNMUYOR: sablon duzenlenmiyor (kapsam karari) ve
   * var olan bir harcamayi "artik tekrarlansin" yapmak, o harcamayi baska
   * bir seye donusturmek olurdu.
   */
  const [repeats, setRepeats] = useState(false);
  const [interval, setInterval] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");

  /**
   * KALEMLER (ADR-052). Kayitli bir ITEMIZED harcama aciliyorsa oradan,
   * yoksa BIR BOS satirla basliyor: sifir satirli bir liste, kullaniciya
   * once "ekle"ye basmayi ogretmek olurdu.
   */
  const [items, setItems] = useState<ItemDraft[]>(() =>
    initialValues?.items && initialValues.items.length > 0
      ? initialValues.items.map((item) => ({
          description: item.description,
          amountText: formatMoneyForInput(item.amount, locale),
          userIds: item.userIds,
        }))
      : [{ description: "", amountText: "", userIds: [] }],
  );
  /**
   * TUTAR, ELLE YAZILANA KADAR KALEMLERI TAKIP EDIYOR (21 Ekim). Gerekcesi
   * mobildeki ayni durumun yaninda (expenses/new.tsx): kalem toplami altta
   * gorunuyor ama yukari yazilmiyordu. Elle yazilinca duruyor (bahsis ve
   * indirim, ADR-052), bos birakip cikinca yeniden basliyor.
   *
   * DUZENLEMEDE BASTAN KAPALI: kayitli tutar kullanicinin onceki karari;
   * bir kalemi duzeltti diye onu ezmek o karari geri almak olurdu.
   */
  const [amountFollowsItems, setAmountFollowsItems] = useState(!isEditing);

  /**
   * Optimistic locking (ADR-032) icin iki parca durum.
   *
   * `baseline`: ekrana YUKLENEN harcamanin sunucudaki hali. Cakisma sonrasi
   * yenisiyle degistiriliyor ki ikinci bir cakismada fark, ilk yuklemeye gore
   * degil "en son gordugun hale" gore hesaplansin.
   * `version`: o halin surumu; her kaydetmede govdeyle birlikte gidiyor.
   */
  const [baseline, setBaseline] = useState(initialValues);
  const [version, setVersion] = useState(initialValues?.version ?? 0);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  const amount = parseMoney(amountText);
  const selected = participants.filter((participant) => participant.selected);

  /**
   * TEKRARLAMA NE ZAMAN SUNULUYOR. Kalem kalem (ADR-052) ve cok odeyenli
   * (ADR-067) bir sablon yok. Kosul TEK YERDE: hem kutunun gorunmesi hem
   * de kaydetmenin hangi uca gidecegi buna bakiyor - kutu isaretliyken
   * kalemlere ya da ikinci odeyene gecen birinin kaydi sablon ucuna gidip
   * reddedilmesin.
   */
  const canRepeat = !isEditing && splitType !== "ITEMIZED" && extraPayers.length === 0;

  // Onizleme, sunucunun kullanacagi AYNI saf fonksiyonlarla hesaplaniyor.
  // Boylece kullanici kaydetmeden once kalan kurusun kime gittigini de,
  // toplamin tutup tutmadigini da gercek sonucla birebir goruyor.
  const preview = useMemo<{ shares: SplitShare[] } | { error: string } | null>(() => {
    if (amount === null || amount <= 0 || selected.length === 0) {
      return null;
    }
    // split.ts'in kendi mesaji ham sayiyi yaziyor ("2147483647"); kullanici
    // sinirini kendi para biriminde gormeli.
    if (amount > MAX_SPLIT_AMOUNT) {
      return { error: t("ui.amount_too_large", { max: formatMoney(MAX_SPLIT_AMOUNT, currency, locale) }) };
    }

    try {
      if (splitType === "ITEMIZED") {
        const parsed = items.map((item) => ({
          amount: parseMoney(item.amountText),
          userIds: item.userIds,
        }));
        if (parsed.some((item) => item.amount === null || item.amount <= 0)) {
          return { error: t("ui.each_item_amount_required") };
        }
        if (parsed.some((item) => item.userIds.length === 0)) {
          return { error: t("split.item_no_participants") };
        }
        return {
          shares: splitByItems({
            amount,
            items: parsed as { amount: number; userIds: string[] }[],
          }),
        };
      }

      if (splitType === "EQUAL") {
        return {
          shares: splitEqually({
            amount,
            participantUserIds: selected.map((participant) => participant.userId),
          }),
        };
      }

      if (splitType === "EXACT") {
        const shares = selected.map((participant) => ({
          userId: participant.userId,
          amount: parseMoney(participant.amountText),
        }));
        if (shares.some((share) => share.amount === null)) {
          return { error: t("ui.each_amount_required") };
        }
        return {
          shares: splitExactly({
            amount,
            shares: shares as { userId: string; amount: number }[],
          }),
        };
      }

      const shares = selected.map((participant) => ({
        userId: participant.userId,
        basisPoints: parsePercentageToBasisPoints(participant.percentageText),
      }));
      if (shares.some((share) => share.basisPoints === null)) {
        return { error: t("ui.each_percentage_required") };
      }
      return {
        shares: splitByPercentage({
          amount,
          shares: shares as { userId: string; basisPoints: number }[],
        }),
      };
    } catch (previewError) {
      // split.ts artik kod firlatiyor; onizlemede gosterilecek metni burada
      // uretiyoruz. Parametreleri de geciriyoruz, yoksa "paylarin toplami
      // (...) esit degil" mesajindaki sayilar kaybolurdu.
      if (previewError instanceof AppError) {
        return { error: t(previewError.code, previewError.params) };
      }
      return { error: t("split.failed") };
    }
  }, [amount, selected, splitType, items, t, currency, locale]);

  // ODEYEN HESAPLARI ONIZLEMEDEN SONRA - bilerek. React Compiler parseMoney'nin
  // dondurdugu `amount`un duz bir sayi oldugunu bilmiyor; memo'dan ONCE bir
  // fonksiyona verildigini gorunce "degismis olabilir" sayip onizlemenin
  // memo'sunu koruyamiyor (react-hooks/preserve-manual-memoization). Memo'dan
  // sonra deger donmus sayiliyor. Onizleme bu degerlerin hicbirini kullanmiyor.
  /**
   * ODEYENLERIN DURUMU (ADR-067). Ilk satirin tutari HESAPLANIYOR; kalan
   * ile "kaydedilebilir mi" ayni yerden cikiyor ki ekrandaki sayi ile
   * gonderilen ayrisamasin.
   */
  const extraAmounts = extraPayers.map((payer) => parseMoney(payer.amountText));
  const payerRest = amount === null ? null : payerRemainder(amount, extraAmounts);
  const payerAmountMissing = extraAmounts.some((value) => value === null || value <= 0);
  /**
   * CANLI GOSTERILEN TEK HATA bu: digerleri tutari doldurdu. Eksik tutar
   * yazarken gecici bir durum - ancak kaydetmeye basinca soyleniyor.
   */
  const payersExceed = !payerAmountMissing && payerRest !== null && payerRest <= 0;
  const payerError =
    extraPayers.length === 0
      ? null
      : payerAmountMissing
        ? t("ui.each_payer_amount_required")
        : payersExceed
          ? t("ui.payers_exceed")
          : null;
  /** Bir odeyen satirinda secilebilecek kisiler: baska satirda olmayanlar. */
  const takenPayerIds = new Set([paidById, ...extraPayers.map((payer) => payer.userId)]);
  const canAddPayer = members.some((member) => !takenPayerIds.has(member.userId));

  function addPayer() {
    const next = members.find((member) => !takenPayerIds.has(member.userId));
    if (!next) return;
    setExtraPayers((current) => [...current, { userId: next.userId, amountText: "" }]);
  }

  function updatePayer(index: number, changes: Partial<PayerDraft>) {
    setExtraPayers((current) =>
      current.map((payer, at) => (at === index ? { ...payer, ...changes } : payer)),
    );
  }

  function removePayer(index: number) {
    setExtraPayers((current) => current.filter((_, at) => at !== index));
  }

  /** Kalem toplami - hepsi gecerliyse. Bir tanesi bile bos ise null. */
  const itemsTotal =
    splitType === "ITEMIZED"
      ? items.reduce<number | null>((total, item) => {
          if (total === null) return null;
          const value = parseMoney(item.amountText);
          return value === null ? null : total + value;
        }, 0)
      : null;

  /**
   * KALEMLER HEP BURADAN DEGISIYOR ki tutar takibi hicbir yolu kacirmasin.
   * Takip edilmiyorsa tutara dokunulmuyor - kullanicinin yazdigi kalir.
   */
  function changeItems(next: ItemDraft[]) {
    setItems(next);
    if (amountFollowsItems) writeItemsTotal(next);
  }

  /** Tutar alanina kalemlerin toplamini yazar; okunabilen kalem yoksa bosaltir. */
  function writeItemsTotal(list: ItemDraft[]) {
    const total = sumWrittenAmounts(list.map((item) => item.amountText));
    setAmountText(total === null ? "" : formatMoneyForInput(total, locale));
  }

  function updateItem(index: number, changes: Partial<ItemDraft>) {
    changeItems(items.map((item, at) => (at === index ? { ...item, ...changes } : item)));
  }

  function removeItem(index: number) {
    changeItems(items.filter((_, at) => at !== index));
  }

  function toggleItemMember(index: number, userId: string) {
    setItems((current) =>
      current.map((item, at) =>
        at === index
          ? {
              ...item,
              userIds: item.userIds.includes(userId)
                ? item.userIds.filter((candidate) => candidate !== userId)
                : [...item.userIds, userId],
            }
          : item,
      ),
    );
  }

  function updateParticipant(userId: string, changes: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.userId === userId ? { ...participant, ...changes } : participant,
      ),
    );
  }

  /**
   * `forTemplate`: tekrarlayan sablon ucu yalnizca paidById biliyor (sablon
   * tek odeyenli, ADR-067). Harcama ucuna HER ZAMAN `payers` gidiyor - tek
   * odeyenli olsa bile. Eski bicim (paidById) yalnizca eski istemciler
   * icin; yeni istemcinin onu kullanmasi, cok odeyenli bir harcamayi
   * guncellerken sunucunun "uygulamayi guncelle" demesine yol acardi.
   */
  function buildRequestBody(forTemplate = false) {
    const payerFields = forTemplate
      ? { paidById }
      : {
          payers: [
            // ILK SATIR KALANI ALIYOR. Esitlikte sunucu ilk satiri ana
            // odeyen yapiyor (payers.ts, primaryPayerId).
            { userId: paidById, amount: payerRest ?? 0 },
            ...extraPayers.map((payer) => ({
              userId: payer.userId,
              amount: parseMoney(payer.amountText) ?? 0,
            })),
          ],
        };
    const base = {
      description: description.trim(),
      amount,
      ...payerFields,
      category,
      expenseDate,
      // Yalnizca duzenlemede: olusturmada ortada bir surum yok ve sunucunun
      // POST semasi bu alani zaten kabul etmiyor.
      ...(isEditing ? { version } : {}),
    };

    if (splitType === "EQUAL") {
      return {
        ...base,
        splitType: "EQUAL" as const,
        participantUserIds: selected.map((participant) => participant.userId),
      };
    }

    if (splitType === "EXACT") {
      return {
        ...base,
        splitType: "EXACT" as const,
        shares: selected.map((participant) => ({
          userId: participant.userId,
          amount: parseMoney(participant.amountText) ?? 0,
        })),
      };
    }

    if (splitType === "ITEMIZED") {
      return {
        ...base,
        splitType: "ITEMIZED" as const,
        // KATILIMCI LISTESI GONDERILMIYOR: sunucu onu kalem atamalarindan
        // turetiyor (ADR-052). Iki yerden gitseydi celisebilirlerdi.
        items: items.map((item) => ({
          description: item.description.trim(),
          amount: parseMoney(item.amountText) ?? 0,
          userIds: item.userIds,
        })),
      };
    }

    return {
      ...base,
      splitType: "PERCENTAGE" as const,
      shares: selected.map((participant) => ({
        userId: participant.userId,
        basisPoints: parsePercentageToBasisPoints(participant.percentageText) ?? 0,
      })),
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError(t("ui.description_required"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t("ui.amount_required"));
      return;
    }
    if (amount > MAX_SPLIT_AMOUNT) {
      setError(t("ui.amount_too_large", { max: formatMoney(MAX_SPLIT_AMOUNT, currency, locale) }));
      return;
    }
    if (splitType === "ITEMIZED") {
      if (items.some((item) => item.description.trim() === "")) {
        setError(t("ui.each_item_description_required"));
        return;
      }
    } else if (selected.length === 0) {
      setError(t("ui.participant_required"));
      return;
    }
    if (payerError) {
      setError(payerError);
      return;
    }
    if (preview && "error" in preview) {
      setError(preview.error);
      return;
    }

    setIsSubmitting(true);
    setConflict(null);
    try {
      const isRecurring = repeats && canRepeat;
      /**
       * TEKRARLAYAN OLARAK KAYDEDILIYORSA BASKA BIR UCA GIDIYOR.
       *
       * Ayni uca "tekrarla" bayragiyla gitmek de mumkundu ama harcama ucunun
       * anlamini bulandirirdi: o uc BIR harcama yaziyor, burasi bir TAKVIM
       * kuruyor. Ilk donem de o takvimden cikiyor - yani "kaydet"e basinca
       * bugunun harcamasi calistiricinin ilk kosusunda beliriyor.
       */
      const url = isRecurring
        ? `/api/v1/groups/${groupId}/recurring-expenses`
        : isEditing
          ? `/api/v1/groups/${groupId}/expenses/${initialValues!.id}`
          : `/api/v1/groups/${groupId}/expenses`;

      await apiRequest(url, {
        method: isEditing && !isRecurring ? "PUT" : "POST",
        body: JSON.stringify(
          isRecurring
            ? { ...buildRequestBody(true), interval, startsOn: expenseDate }
            : buildRequestBody(),
        ),
      });

      toast.success(
        isRecurring
          ? t("ui.recurring_saved")
          : isEditing
            ? t("ui.expense_updated")
            : t("ui.expense_added"),
      );
      // Harcamanin AYINA donuyoruz, grubun varsayilan ayina degil (Faz 16.2).
      // Fiste yalnizca acik ay tam gorunuyor; gecmis bir aya harcama ekleyip
      // varsayilan aya donseydik kullanici kaydettigi satiri goremezdi ve
      // kaydin gitmedigini sanirdi. expenseDate zaten "YYYY-MM-DD".
      //
      // ARDINDAN router.refresh() YOK ve bu bilerek (7 Kasim). Eskiden vardi;
      // OLCULDU: refresh, gezinmeyle AYNI ANDA butun sayfayi (basligi da)
      // yeniden istiyordu ve Next sayfayi ancak IKISI de bitince
      // degistiriyordu - sunucu her kayitta sayfayi iki kez uretiyordu,
      // form "Kaydediliyor..."da onu bekliyordu.
      // Gereksizdi: grup sayfasi dinamik ve Next 16 dinamik sayfayi her
      // gezinmede sunucudan taze cekiyor (staleTimes.dynamic = 0). Refresh'in
      // ek getirdigi tek sey ortak baslik (okunmamis bildirim sayisi, grup
      // listesi) ve harcama kaydetmek ikisini de degistirmiyor: bildirim
      // ekleyene gitmiyor, gruplar katilma tarihine gore sirali.
      // Basliga dokunan bir sey kaydedilmeye baslarsa refresh geri gelmeli.
      router.push(`/groups/${groupId}?month=${expenseDate.slice(0, 7)}`);
    } catch (submitError) {
      // Cakisma (ADR-032) diger hatalardan ayri ele aliniyor: kullanicinin
      // formda yazdiklari OLDUGU GIBI duruyor, biz yalnizca arada ne olmus
      // onu gosteriyoruz. Yeniden kaydetmek artik guncel surumle gidiyor.
      if (
        submitError instanceof ApiClientError &&
        submitError.code === "expense.version_conflict"
      ) {
        await loadConflict();
        setIsSubmitting(false);
        return;
      }

      setError(
        submitError instanceof Error ? submitError.message : t("server.unexpected"),
      );
      setIsSubmitting(false);
    }
  }

  /**
   * Cakismadan sonra sunucudaki hali cekip farki hesaplar.
   *
   * Basarisiz olursa (ag koptu, harcama silindi) SESSIZ KALMIYORUZ: cakismanin
   * kendisi zaten gerceklesti, kullanici bunu bilmeli. Yalnizca "ne degisti"
   * kismini gosteremiyoruz.
   */
  async function loadConflict() {
    if (!initialValues) {
      return;
    }

    try {
      const fresh = await apiRequest<{ expense: ExpenseFormInitialValues }>(
        `/api/v1/groups/${groupId}/expenses/${initialValues.id}`,
      );

      const source = baseline ?? initialValues;
      setConflict({ kind: "changed", changes: diffExpenses(source, fresh.expense) });
      setBaseline(fresh.expense);
      setVersion(fresh.expense.version);
    } catch (fetchError) {
      // 404 = harcama arada silindi. Kaydetmenin bir anlami kalmadi.
      if (fetchError instanceof ApiClientError && fetchError.status === 404) {
        setConflict({ kind: "deleted" });
        return;
      }
      setConflict({ kind: "changed", changes: [] });
    }
  }

  /** Bir degisikligi okunur tek satira cevirir. Bicimleme burada, farkta degil. */
  function describeChange(change: ExpenseChange): string {
    switch (change.field) {
      case "description":
        return t("ui.conflict_change", {
          field: t("ui.description"),
          before: change.before,
          after: change.after,
        });
      case "amount":
        return t("ui.conflict_change", {
          field: t("ui.amount"),
          before: formatMoney(change.before, currency, locale),
          after: formatMoney(change.after, currency, locale),
        });
      case "payers":
        return t("ui.conflict_change", {
          field: t("ui.payers"),
          before: describeChangedPayers(change.before),
          after: describeChangedPayers(change.after),
        });
      case "category":
        return t("ui.conflict_change", {
          field: t("ui.category"),
          before: t(EXPENSE_CATEGORY_CODES[change.before as ExpenseCategory]),
          after: t(EXPENSE_CATEGORY_CODES[change.after as ExpenseCategory]),
        });
      case "splitType":
        return t("ui.conflict_change", {
          field: t("ui.split_type"),
          before: t(EXPENSE_SPLIT_TYPE_CODES[change.before]),
          after: t(EXPENSE_SPLIT_TYPE_CODES[change.after]),
        });
      case "expenseDate":
        return t("ui.conflict_change", {
          field: t("ui.date"),
          before: formatDate(new Date(change.before), locale),
          after: formatDate(new Date(change.after), locale),
        });
      case "participants": {
        const lines: string[] = [];
        if (change.addedUserIds.length > 0) {
          lines.push(
            t("ui.conflict_participants_added", { names: joinNames(change.addedUserIds) }),
          );
        }
        if (change.removedUserIds.length > 0) {
          lines.push(
            t("ui.conflict_participants_removed", { names: joinNames(change.removedUserIds) }),
          );
        }
        if (change.sharesChanged) {
          lines.push(t("ui.conflict_shares_changed"));
        }
        return lines.join(" · ");
      }
    }
  }

  /** "Ayse" ya da "Ayse 800,00 · Can 400,00". Ana odeyen once. */
  function describeChangedPayers(list: { userId: string; amount: number }[]): string {
    return describePayers(
      list,
      primaryPayerId(list),
      (userId) => nameByUserId.get(userId) ?? t("ui.unknown_user"),
      (value) => formatMoney(value, currency, locale),
    );
  }

  function joinNames(userIds: string[]): string {
    return userIds.map((id) => nameByUserId.get(id) ?? t("ui.unknown_user")).join(", ");
  }

  const nameByUserId = new Map(members.map((member) => [member.userId, member.displayName]));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("ui.description")}</Label>
        <Input
          id="description"
          value={description}
          onChange={(event) => {
            const next = event.target.value;
            setDescription(next);
            // Tahmin GORUNUR: secim kutusu yazarken degisiyor, gizli bir
            // varsayim degil. Ipucu bulunamazsa "Diger"e donuyor - eski bir
            // tahminin yazi silinince ekranda kalmasi yaniltirdi.
            if (!categoryTouched) {
              setCategory(guessCategory(next) ?? "OTHER");
            }
          }}
          placeholder={t("ui.description_placeholder")}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">{t("ui.amount")}</Label>
        <Input
          id="amount"
          value={amountText}
          onChange={(event) => {
            setAmountText(event.target.value);
            setAmountFollowsItems(false);
          }}
          onBlur={(event) => {
            // Bos birakilip cikildiysa takip yeniden basliyor.
            if (event.target.value.trim() !== "") return;
            setAmountFollowsItems(true);
            if (splitType === "ITEMIZED") writeItemsTotal(items);
          }}
          placeholder={t("ui.amount_placeholder")}
          inputMode="decimal"
        />
        <p className="text-sm text-muted-foreground">
          {amountText.trim() === ""
            ? t("ui.amount_example")
            : amount === null
              ? t("ui.amount_unreadable")
              : `= ${formatMoney(amount, currency, locale)}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/*
          ODEYEN (ADR-067, yon C). Tek odeyenken bugunku secici ve altinda
          kucuk bir "Baska odeyen ekle". Ikinci odeyen eklenince secici
          asagidaki tam genislikteki ODEYENLER blogunun ilk satirina
          tasiniyor - tutarlar yan yana ancak orada sigiyor.
        */}
        {extraPayers.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="paidBy">{t("ui.who_paid")}</Label>
            <select
              id="paidBy"
              className={selectClassName}
              value={paidById}
              onChange={(event) => setPaidById(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
            {canAddPayer ? (
              <button
                type="button"
                onClick={addPayer}
                className="self-start rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("ui.add_payer")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">{t("ui.category")}</Label>
          <select
            id="category"
            className={selectClassName}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ExpenseCategory);
              setCategoryTouched(true);
            }}
          >
            {EXPENSE_CATEGORY_OPTIONS.map(([value, code]) => (
              <option key={value} value={value}>
                {t(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {extraPayers.length > 0 ? (
        /*
          ODEYENLER BLOGU (ADR-067). ILK SATIRIN TUTARI GIRILMIYOR, kalan
          olarak hesaplaniyor: toplam tutmazligi boylece neredeyse imkansiz.
          Tek hata durumu "digerleri tutari dolduruyor" ve asagida yaziyor.
          Kalem editoruyle ayni dil: satirlar, ince ayrac, "ekle" baglantisi.
        */
        <div className="flex flex-col gap-3" data-slot="payers">
          <Label htmlFor="paidBy">{t("ui.payers")}</Label>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <select
                id="paidBy"
                className={`${selectClassName} flex-1`}
                value={paidById}
                onChange={(event) => setPaidById(event.target.value)}
                aria-label={t("ui.payer_person_label", { index: 1 })}
              >
                {members
                  .filter(
                    (member) =>
                      member.userId === paidById || !takenPayerIds.has(member.userId),
                  )
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName}
                    </option>
                  ))}
              </select>
              <span className="money w-40 shrink-0 text-right text-sm text-muted-foreground">
                {t("ui.payer_remainder")}{" "}
                <span className="text-foreground" data-slot="payer-rest">
                  {payerRest === null ? "—" : formatMoney(payerRest, currency, locale)}
                </span>
              </span>
            </li>
            {extraPayers.map((payer, index) => (
              <li key={index} className="flex items-center gap-2">
                <select
                  className={`${selectClassName} flex-1`}
                  value={payer.userId}
                  onChange={(event) => updatePayer(index, { userId: event.target.value })}
                  aria-label={t("ui.payer_person_label", { index: index + 2 })}
                >
                  {members
                    .filter(
                      (member) =>
                        member.userId === payer.userId || !takenPayerIds.has(member.userId),
                    )
                    .map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.displayName}
                      </option>
                    ))}
                </select>
                <Input
                  className="w-32"
                  value={payer.amountText}
                  onChange={(event) => updatePayer(index, { amountText: event.target.value })}
                  placeholder="0,00"
                  inputMode="decimal"
                  aria-label={t("ui.payer_amount_label", {
                    name: nameByUserId.get(payer.userId) ?? "",
                  })}
                />
                <button
                  type="button"
                  onClick={() => removePayer(index)}
                  className="w-6 shrink-0 rounded-[3px] py-2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={t("ui.remove_payer")}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {payersExceed ? (
            <p className="text-sm text-destructive">{t("ui.payers_exceed")}</p>
          ) : null}
          {canAddPayer ? (
            <button
              type="button"
              onClick={addPayer}
              className="self-start rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("ui.add_payer")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="expenseDate">{t("ui.date")}</Label>
          <Input
            id="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="splitType">{t("ui.how_to_split")}</Label>
          <select
            id="splitType"
            className={selectClassName}
            value={splitType}
            onChange={(event) => {
              const next = event.target.value as SplitType;
              setSplitType(next);
              // Kalemlere donulduyse ve tutar takip ediliyorsa, once
              // girilmis kalemler tutara hemen yansisin.
              if (next === "ITEMIZED" && amountFollowsItems) writeItemsTotal(items);
            }}
          >
            {(Object.keys(EXPENSE_SPLIT_TYPE_CODES) as SplitType[]).map((value) => (
              <option key={value} value={value}>
                {t(EXPENSE_SPLIT_TYPE_CODES[value])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*
        TEKRARLAMA (ADR-051). Bolusumun USTUNDE, tarihin hemen ALTINDA:
        "ne zaman" sorusunun devami. Bolusumun altina koysaydik, formun en
        uzun bolumunun ardinda kalir ve kimse gormezdi.

        DUZENLEMEDE HIC CIZILMIYOR: var olan bir harcamayi tekrarlayana
        cevirmek, onu baska bir seye donusturmek olurdu.
      */}
      {/* ITEMIZED'DA VE IKINCI ODEYEN EKLENINCE HIC CIZILMIYOR: kalem kalem
          (ADR-052) ve cok odeyenli (ADR-067) bir SABLON yok. Cizilseydi
          kullanici isaretler, kaydeder ve sunucudan bir dogrulama hatasi
          alirdi - olmayan bir yetenegi vaat etmis olurduk. */}
      {canRepeat ? (
        <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={repeats}
              onChange={() => setRepeats((current) => !current)}
            />
            {t("ui.repeat_this")}
          </label>

          {repeats ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("ui.repeat_hint")}</p>
              <div className="flex flex-col gap-2 sm:max-w-xs">
                <Label htmlFor="interval">{t("ui.how_often")}</Label>
                <select
                  id="interval"
                  className={selectClassName}
                  value={interval}
                  onChange={(event) =>
                    setInterval(event.target.value as "WEEKLY" | "MONTHLY")
                  }
                >
                  <option value="WEEKLY">{t("ui.repeat_weekly")}</option>
                  <option value="MONTHLY">{t("ui.repeat_monthly")}</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {splitType === "ITEMIZED" ? (
        /*
          KALEM EDITORU (ADR-052).
          KATILIMCI ONAY KUTULARI BURADA HIC YOK: katilimcilar kalem
          atamalarinin BIRLESIMI. Ikisi birden dursaydi celisebilirlerdi -
          hicbir kaleme atanmamis bir "katilimci" ne demek olurdu?
        */
        <div className="flex flex-col gap-3">
          <Label>{t("ui.items")}</Label>
          <p className="text-xs text-muted-foreground">{t("ui.items_hint")}</p>

          <ul className="flex flex-col gap-4">
            {items.map((item, index) => (
              <li key={index} className="flex flex-col gap-2 border-t border-line-soft pt-3">
                <div className="flex items-start gap-2">
                  <Input
                    className="flex-1"
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, { description: event.target.value })
                    }
                    placeholder={t("ui.item_description")}
                    aria-label={`${t("ui.item_description")} ${index + 1}`}
                  />
                  <Input
                    className="w-32"
                    value={item.amountText}
                    onChange={(event) => updateItem(index, { amountText: event.target.value })}
                    placeholder="0,00"
                    inputMode="decimal"
                    aria-label={`${t("ui.item_amount")} ${index + 1}`}
                  />
                  {/* TEK KALEM KALDIYSA CIKARMA YOK: bos bir liste, kaydi
                      imkansiz bir forma birakirdi. */}
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="shrink-0 rounded-[3px] px-1 py-2 text-xs text-muted-foreground underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label={`${t("ui.remove_item")} ${index + 1}`}
                    >
                      {t("ui.remove_item")}
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {members.map((member) => (
                    <label
                      key={member.userId}
                      className="flex cursor-pointer items-center gap-1.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={item.userIds.includes(member.userId)}
                        onChange={() => toggleItemMember(index, member.userId)}
                      />
                      {member.displayName}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {items.length < MAX_EXPENSE_ITEMS ? (
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { description: "", amountText: "", userIds: [] },
                ])
              }
              className="self-start rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("ui.add_item")}
            </button>
          ) : null}

          {/* KALEM TOPLAMI VE FARK. Kullanici bahsisi/indirimi kaydetmeden
              once GORMELI - bakiyeye bakip cikarmasi gereken bir sey
              olmamali. */}
          {itemsTotal !== null ? (
            <div className="flex flex-col gap-1 border-t border-line-soft pt-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-4">
                <span>{t("ui.items_total")}</span>
                <span className="money">{formatMoney(itemsTotal, currency, locale)}</span>
              </div>
              {amount !== null && amount !== itemsTotal ? (
                <div className="flex justify-between gap-4">
                  <span>{amount > itemsTotal ? t("ui.items_tip") : t("ui.items_discount")}</span>
                  <span className="money">
                    {formatMoney(Math.abs(amount - itemsTotal), currency, locale)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        <Label>{t("ui.participants")}</Label>
        <div className="flex flex-col gap-2">
          {participants.map((participant) => (
            <div key={participant.userId} className="flex items-center gap-3">
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={participant.selected}
                  onChange={() =>
                    updateParticipant(participant.userId, {
                      selected: !participant.selected,
                    })
                  }
                />
                {nameByUserId.get(participant.userId)}
              </label>

              {splitType === "EXACT" && participant.selected ? (
                <Input
                  className="w-32"
                  value={participant.amountText}
                  onChange={(event) =>
                    updateParticipant(participant.userId, { amountText: event.target.value })
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  aria-label={t("ui.participant_amount_label", {
                    name: nameByUserId.get(participant.userId) ?? "",
                  })}
                />
              ) : null}

              {splitType === "PERCENTAGE" && participant.selected ? (
                <Input
                  className="w-32"
                  value={participant.percentageText}
                  onChange={(event) =>
                    updateParticipant(participant.userId, {
                      percentageText: event.target.value,
                    })
                  }
                  placeholder="%0"
                  inputMode="decimal"
                  aria-label={t("ui.participant_percentage_label", {
                    name: nameByUserId.get(participant.userId) ?? "",
                  })}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
      )}

      {preview ? (
        // Onizleme bir kart DEGIL: girdiye gore degisen bir ARA sonuc, ayri
        // bir nesne degil. Kutusu kalkti, bolum basligiyla ayriliyor -
        // sayfanin geri kalanindaki her bolum gibi.
        /* data-slot: onizlemeye DISARIDAN tutunmak icin. Sayfada baska
           listeler de var (kalemler) ve onlarin icinde de kisi adlari
           geciyor; testin hangi listeye baktigi belirsiz kalamaz. Kalip
           projedeki ui bilesenlerinin aynisi. */
        <div className="flex flex-col gap-2" data-slot="split-preview">
          <SectionHead title={t("ui.split_preview")} />
          {"error" in preview ? (
            <p className="text-destructive">{preview.error}</p>
          ) : (
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {preview.shares.map((share) => (
                  <li key={share.userId} className="flex justify-between gap-4">
                    <span className="min-w-0 truncate">
                      {nameByUserId.get(share.userId) ?? share.userId}
                    </span>
                    <span className="money shrink-0">
                      {formatMoney(share.amount, currency, locale)}
                      {splitType === "PERCENTAGE" && amount
                        ? ` (${formatBasisPoints(
                            parsePercentageToBasisPoints(
                              participants.find((p) => p.userId === share.userId)
                                ?.percentageText ?? "",
                            ) ?? 0,
                            locale,
                          )})`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
          )}
        </div>
      ) : null}

      {/*
        Cakisma uyarisi (ADR-032). Renk tek basina anlam tasimiyor (ADR-021):
        basligi kalin, degisiklikleri tireli cerceve icinde listeliyoruz -
        rengi goremeyen biri de neyin ne oldugunu okuyabiliyor.
      */}
      {conflict ? (
        <div className="flex flex-col gap-2">
          <SectionHead title={t("ui.conflict_heading")} />
          {conflict.kind === "deleted" ? (
            <p className="text-muted-foreground">{t("ui.conflict_deleted")}</p>
          ) : conflict.changes.length === 0 ? (
            <p className="text-muted-foreground">{t("ui.conflict_unknown")}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-muted-foreground">
                {conflict.changes.map((change) => (
                  <li key={change.field}>{describeChange(change)}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">{t("ui.conflict_overwrite_hint")}</p>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || conflict?.kind === "deleted"}>
          {isSubmitting
            ? t("ui.saving")
            : isEditing
              ? t("ui.save_changes")
              : repeats
                ? t("ui.save_recurring")
                : t("ui.save_expense")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/groups/${groupId}`)}
        >
          {t("ui.cancel")}
        </Button>
      </div>
    </form>
  );
}
