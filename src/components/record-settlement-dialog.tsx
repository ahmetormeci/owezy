"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";
import { formatMoney, parseMoney } from "@/lib/money";

type Counterparty = {
  userId: string;
  displayName: string;
};

type SuggestedTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function RecordSettlementDialog({
  groupId,
  currency,
  currentUserId,
  counterparties,
  suggestedTransfers,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  counterparties: Counterparty[];
  suggestedTransfers: SuggestedTransfer[];
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);

  // Yon secimi, "yalnizca odemenin taraflarindan biri kaydedebilir" kuralini
  // arayuze tasiyor: karsi taraf kim olursa olsun, taraflardan biri her zaman
  // sen oluyorsun. Boylece gecersiz bir istek olusturmak mumkun degil.
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [counterpartyId, setCounterpartyId] = useState(
    counterparties[0]?.userId ?? "",
  );
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [settledAt, setSettledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = parseMoney(amountText);

  const fromUserId = direction === "outgoing" ? currentUserId : counterpartyId;
  const toUserId = direction === "outgoing" ? counterpartyId : currentUserId;

  // Netlestirme onerileri arasinda bu yon ve kisi icin bir tutar varsa
  // kullaniciya tek tikla doldurma imkani sunuyoruz.
  const matchingSuggestion = suggestedTransfers.find(
    (transfer) => transfer.fromUserId === fromUserId && transfer.toUserId === toUserId,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!counterpartyId) {
      setError(t("ui.settlement_counterparty_required"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t("ui.amount_required"));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount,
          note: note.trim() || undefined,
          settledAt,
        }),
      });

      toast.success(t("ui.settlement_saved"));
      setAmountText("");
      setNote("");
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("server.unexpected"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (counterparties.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">{t("ui.record_settlement")}</Button>} />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("ui.record_settlement")}</DialogTitle>
            <DialogDescription>
              {t("ui.settlement_hint")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="direction">{t("ui.settlement_direction")}</Label>
              <select
                id="direction"
                className={selectClassName}
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as "outgoing" | "incoming")
                }
              >
                <option value="outgoing">{t("ui.i_paid")}</option>
                <option value="incoming">{t("ui.paid_to_me")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="counterparty">
                {direction === "outgoing"
                  ? t("ui.settlement_counterparty")
                  : t("ui.who_paid")}
              </Label>
              <select
                id="counterparty"
                className={selectClassName}
                value={counterpartyId}
                onChange={(event) => setCounterpartyId(event.target.value)}
              >
                {counterparties.map((counterparty) => (
                  <option key={counterparty.userId} value={counterparty.userId}>
                    {counterparty.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settlement-amount">{t("ui.amount")}</Label>
              <Input
                id="settlement-amount"
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
                    : `= ${formatMoney(amount, currency)}`}
              </p>
              {matchingSuggestion ? (
                <button
                  type="button"
                  className="self-start text-sm text-primary underline-offset-4 hover:underline"
                  onClick={() =>
                    setAmountText(
                      String(matchingSuggestion.amount / 100).replace(".", ","),
                    )
                  }
                >
                  {t("ui.use_suggested_amount", {
                    amount: formatMoney(matchingSuggestion.amount, currency),
                  })}
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settledAt">{t("ui.date")}</Label>
              <Input
                id="settledAt"
                type="date"
                value={settledAt}
                onChange={(event) => setSettledAt(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settlement-note">{t("ui.settlement_note")}</Label>
              <Input
                id="settlement-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("ui.settlement_note_placeholder")}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("ui.saving") : t("ui.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
