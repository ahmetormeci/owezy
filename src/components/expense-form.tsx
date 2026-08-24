"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory, SplitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";
import {
  formatBasisPoints,
  formatBasisPointsForInput,
  formatMoney,
  formatMoneyForInput,
  parseMoney,
  parsePercentageToBasisPoints,
  type Locale,
} from "@/lib/money";
import {
  inferBasisPoints,
  splitByPercentage,
  splitEqually,
  splitExactly,
  type SplitShare,
} from "@/lib/split";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-labels";
import { AppError } from "@/lib/errors";
import { useLocale, useTranslate } from "@/lib/i18n";
import type { MessageCode } from "@/lib/messages";

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
};

type ParticipantDraft = {
  userId: string;
  selected: boolean;
  amountText: string;
  percentageText: string;
};

const SPLIT_TYPE_CODES: Record<SplitType, MessageCode> = {
  EQUAL: "ui.split_equal",
  EXACT: "ui.split_exact",
  PERCENTAGE: "ui.split_percentage",
};

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
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType ?? "EQUAL");
  const [expenseDate, setExpenseDate] = useState(
    initialValues?.expenseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() =>
    buildInitialParticipants(members, initialValues, locale),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(
        submitError instanceof Error ? submitError.message : t("server.unexpected"),
      );
      setIsSubmitting(false);
    }
  }

  const nameByUserId = new Map(members.map((member) => [member.userId, member.displayName]));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("ui.description")}</Label>
        <Input
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
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
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
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
            {(Object.keys(SPLIT_TYPE_CODES) as SplitType[]).map((value) => (
              <option key={value} value={value}>
                {t(SPLIT_TYPE_CODES[value])}
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
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
