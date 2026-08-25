"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory, SplitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  formatBasisPoints,
  formatBasisPointsForInput,
  formatMoney,
  formatMoneyForInput,
  parseMoney,
  parsePercentageToBasisPoints,
  type Locale,
} from "@/lib/money";
import { guessCategory } from "@/lib/expense-category-guess";
import {
  inferBasisPoints,
  splitByPercentage,
  splitEqually,
  splitExactly,
  type SplitShare,
} from "@/lib/split";
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SPLIT_TYPE_CODES,
} from "@/lib/expense-labels";
import { diffExpenses, type ExpenseChange } from "@/lib/expense-diff";
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
  paidById: string;
  category: ExpenseCategory;
  splitType: SplitType;
  expenseDate: string;
  participants: { userId: string; shareAmount: number; basisPoints: number | null }[];
  /** Optimistic locking sayaci (ADR-032). Kaydederken geri gonderiliyor. */
  version: number;
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

// Native <select>, shadcn'in Select bilesenine gore daha az kod ve mobilde
// isletim sisteminin kendi seciciyi acmasi sayesinde daha iyi bir deneyim
// veriyor; gorunum Input ile ayni siniflarla eslestirildi.
const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

  // Onizleme, sunucunun kullanacagi AYNI saf fonksiyonlarla hesaplaniyor.
  // Boylece kullanici kaydetmeden once kalan kurusun kime gittigini de,
  // toplamin tutup tutmadigini da gercek sonucla birebir goruyor.
  const preview = useMemo<{ shares: SplitShare[] } | { error: string } | null>(() => {
    if (amount === null || amount <= 0 || selected.length === 0) {
      return null;
    }

    try {
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
  }, [amount, selected, splitType, t]);

  function updateParticipant(userId: string, changes: Partial<ParticipantDraft>) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.userId === userId ? { ...participant, ...changes } : participant,
      ),
    );
  }

  function buildRequestBody() {
    const base = {
      description: description.trim(),
      amount,
      paidById,
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
    if (selected.length === 0) {
      setError(t("ui.participant_required"));
      return;
    }
    if (preview && "error" in preview) {
      setError(preview.error);
      return;
    }

    setIsSubmitting(true);
    setConflict(null);
    try {
      const url = isEditing
        ? `/api/v1/groups/${groupId}/expenses/${initialValues!.id}`
        : `/api/v1/groups/${groupId}/expenses`;

      await apiRequest(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(buildRequestBody()),
      });

      toast.success(isEditing ? t("ui.expense_updated") : t("ui.expense_added"));
      // Harcamanin AYINA donuyoruz, grubun varsayilan ayina degil (Faz 16.2).
      // Fiste yalnizca acik ay tam gorunuyor; gecmis bir aya harcama ekleyip
      // varsayilan aya donseydik kullanici kaydettigi satiri goremezdi ve
      // kaydin gitmedigini sanirdi. expenseDate zaten "YYYY-MM-DD".
      router.push(`/groups/${groupId}?month=${expenseDate.slice(0, 7)}`);
      router.refresh();
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
      case "paidById":
        return t("ui.conflict_change", {
          field: t("ui.payer"),
          before: nameByUserId.get(change.before) ?? t("ui.unknown_user"),
          after: nameByUserId.get(change.after) ?? t("ui.unknown_user"),
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
          onChange={(event) => setAmountText(event.target.value)}
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
        </div>

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
            onChange={(event) => setSplitType(event.target.value as SplitType)}
          >
            {(Object.keys(EXPENSE_SPLIT_TYPE_CODES) as SplitType[]).map((value) => (
              <option key={value} value={value}>
                {t(EXPENSE_SPLIT_TYPE_CODES[value])}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>{t("ui.participants")}</Label>
        <div className="flex flex-col gap-2">
          {participants.map((participant) => (
            <div key={participant.userId} className="flex items-center gap-3">
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
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

      {preview ? (
        // Onizleme bir kart degil, formun icinde sessiz bir panel: girdiye
        // gore degisen bir ARA sonuc, ayri bir nesne degil.
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3.5">
          <p className="label">{t("ui.split_preview")}</p>
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
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-3.5">
          <p className="label">{t("ui.conflict_heading")}</p>
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
