"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { useTranslate } from "@/lib/i18n";

export type SettlementListItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note: string | null;
  settledAt: string;
  createdById: string;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function CancelSettlementButton({
  groupId,
  settlementId,
}: {
  groupId: string;
  settlementId: string;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/settlements/${settlementId}/cancel`, {
        method: "POST",
      });
      toast.success(t("ui.settlement_cancelled"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ui.settlement_cancel_failed"),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {t("ui.cancel_settlement")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("ui.cancel_settlement_question")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.cancel_settlement_hint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">{t("ui.cancel")}</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isCancelling} onClick={handleCancel}>
                {isCancelling ? t("ui.cancelling") : t("ui.cancel_settlement")}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SettlementList({
  groupId,
  currency,
  currentUserId,
  nameByUserId,
  settlements,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  nameByUserId: Record<string, string>;
  settlements: SettlementListItem[];
}) {
  const t = useTranslate();

  if (settlements.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("ui.no_settlements")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {settlements.map((settlement) => {
        // Iptal yetkisi kaydi olusturan kisidedir (harcamalardaki kuralla ayni).
        // Buton da buna gore gosteriliyor; asil kontrol her zaman sunucuda.
        const canCancel = settlement.createdById === currentUserId;

        return (
          <li key={settlement.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-medium">
                    {nameByUserId[settlement.fromUserId] ?? "Bilinmeyen"}
                  </span>
                  {" → "}
                  <span className="font-medium">
                    {nameByUserId[settlement.toUserId] ?? "Bilinmeyen"}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {dateFormatter.format(new Date(settlement.settledAt))}
                  {settlement.note ? ` · ${settlement.note}` : ""}
                </p>
                {canCancel ? (
                  <div className="mt-1">
                    <CancelSettlementButton groupId={groupId} settlementId={settlement.id} />
                  </div>
                ) : null}
              </div>
              <p className="money shrink-0 font-medium">
                {formatMoney(settlement.amount, currency)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
