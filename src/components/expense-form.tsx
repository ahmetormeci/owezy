"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory, SplitType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import {
  formatBasisPoints,
  formatMoney,
  parseMoney,
  parsePercentageToBasisPoints,
} from "@/lib/money";
import { splitByPercentage, splitEqually, splitExactly, type SplitShare } from "@/lib/split";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-labels";

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
  participants: { userId: string; shareAmount: number }[];
};

type ParticipantDraft = {
  userId: string;
  selected: boolean;
  amountText: string;
  percentageText: string;
};

const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  EQUAL: "Eşit böl",
  EXACT: "Tutar gir",
  PERCENTAGE: "Yüzde gir",
};

// Native <select>, shadcn'in Select bilesenine gore daha az kod ve mobilde
// isletim sisteminin kendi seciciyi acmasi sayesinde daha iyi bir deneyim
// veriyor; gorunum Input ile ayni siniflarla eslestirildi.
const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function buildInitialParticipants(
  members: Member[],
  initial: ExpenseFormInitialValues | undefined,
): ParticipantDraft[] {
  return members.map((member) => {
    const existing = initial?.participants.find(
      (participant) => participant.userId === member.userId,
    );

    // Duzenleme modunda yuzdeyi geri hesaplayamayiz (kayitta yalnizca sonuc
    // tutarlari var), bu yuzden yuzde alani bos baslar; kullanici PERCENTAGE'a
    // gecerse yeniden girer.
    return {
      userId: member.userId,
      selected: initial ? Boolean(existing) : true,
      amountText: existing ? String(existing.shareAmount / 100).replace(".", ",") : "",
      percentageText: "",
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
  const isEditing = Boolean(initialValues);

  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [amountText, setAmountText] = useState(
    initialValues ? String(initialValues.amount / 100).replace(".", ",") : "",
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
    buildInitialParticipants(members, initialValues),
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
          return { error: "Her katılımcı için geçerli bir tutar gir" };
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
        return { error: "Her katılımcı için geçerli bir yüzde gir" };
      }
      return {
        shares: splitByPercentage({
          amount,
          shares: shares as { userId: string; basisPoints: number }[],
        }),
      };
    } catch (previewError) {
      return {
        error: previewError instanceof Error ? previewError.message : "Bölüşüm hesaplanamadı",
      };
    }
  }, [amount, selected, splitType]);

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
      setError("Açıklama boş olamaz");
      return;
    }
    if (amount === null || amount <= 0) {
      setError("Geçerli ve sıfırdan büyük bir tutar gir. Örnek: 120,50");
      return;
    }
    if (selected.length === 0) {
      setError("En az bir katılımcı seçmelisin");
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

      toast.success(isEditing ? "Harcama güncellendi" : "Harcama eklendi");
      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Beklenmeyen bir hata oluştu",
      );
      setIsSubmitting(false);
    }
  }

  const nameByUserId = new Map(members.map((member) => [member.userId, member.displayName]));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Açıklama</Label>
        <Input
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Market alışverişi"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Tutar</Label>
        <Input
          id="amount"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="120,50"
          inputMode="decimal"
        />
        <p className="text-sm text-muted-foreground">
          {amountText.trim() === ""
            ? "Örnek: 120,50"
            : amount === null
              ? "Tutarı anlayamadım"
              : `= ${formatMoney(amount, currency)}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="paidBy">Kim ödedi?</Label>
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
          <Label htmlFor="category">Kategori</Label>
          <select
            id="category"
            className={selectClassName}
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
          >
            {EXPENSE_CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="expenseDate">Tarih</Label>
          <Input
            id="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="splitType">Nasıl bölünecek?</Label>
          <select
            id="splitType"
            className={selectClassName}
            value={splitType}
            onChange={(event) => setSplitType(event.target.value as SplitType)}
          >
            {(Object.keys(SPLIT_TYPE_LABELS) as SplitType[]).map((value) => (
              <option key={value} value={value}>
                {SPLIT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Katılımcılar</Label>
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
                  aria-label={`${nameByUserId.get(participant.userId)} tutarı`}
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
                  aria-label={`${nameByUserId.get(participant.userId)} yüzdesi`}
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {preview ? (
        <Card>
          <CardContent className="flex flex-col gap-2 py-4">
            <p className="text-sm font-medium">Bölüşüm önizlemesi</p>
            {"error" in preview ? (
              <p className="text-sm text-destructive">{preview.error}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {preview.shares.map((share) => (
                  <li key={share.userId} className="flex justify-between gap-4">
                    <span>{nameByUserId.get(share.userId) ?? share.userId}</span>
                    <span className="money">
                      {formatMoney(share.amount, currency)}
                      {splitType === "PERCENTAGE" && amount
                        ? ` (${formatBasisPoints(
                            parsePercentageToBasisPoints(
                              participants.find((p) => p.userId === share.userId)
                                ?.percentageText ?? "",
                            ) ?? 0,
                          )})`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Kaydediliyor..."
            : isEditing
              ? "Değişiklikleri kaydet"
              : "Harcamayı kaydet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/groups/${groupId}`)}
        >
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
