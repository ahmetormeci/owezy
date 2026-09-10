"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionHead } from "@/components/section-head";
import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { useLocale, useTranslate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

/**
 * Grubun tekrarlayan harcamalari (ADR-051).
 *
 * KAGIDIN ALTINDA, fisin ICINDE DEGIL. Fis OLMUS islerin kaydi; tekrarlayan
 * harcama ise OLACAK bir sey - bir takvim. Fisin icine koysaydik henuz
 * gerceklesmemis bir satir gerceklesmisler arasinda dururdu ve bakiyeye
 * girdigi sanilirdi (girmiyor).
 *
 * DURAKLATILMISLAR DA LISTEDE: kullanicinin onlari geri acabilmesi icin
 * gorunmeleri sart. Gizlemek, sistemin durdurdugu bir kaydi kayip
 * gostermek olurdu.
 */

export type RecurringRow = {
  id: string;
  description: string;
  amount: number;
  interval: "WEEKLY" | "MONTHLY";
  startsOn: string;
  nextRunOn: string;
  pausedAt: string | null;
  createdById: string;
};

export function RecurringList({
  groupId,
  currency,
  currentUserId,
  initialRows,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  initialRows: RecurringRow[];
}) {
  const t = useTranslate();
  const locale = useLocale();

  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringRow | null>(null);

  async function togglePause(row: RecurringRow) {
    setBusyId(row.id);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/recurring-expenses/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paused: row.pausedAt === null }),
      });
      setRows((current) =>
        current.map((candidate) =>
          candidate.id === row.id
            ? {
                ...candidate,
                pausedAt: candidate.pausedAt === null ? new Date().toISOString() : null,
              }
            : candidate,
        ),
      );
      toast.success(t("ui.recurring_changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("server.unexpected"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: RecurringRow) {
    setBusyId(row.id);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/recurring-expenses/${row.id}`, {
        method: "DELETE",
      });
      setRows((current) => current.filter((candidate) => candidate.id !== row.id));
      toast.success(t("ui.recurring_deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("server.unexpected"));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    /**
     * data-slot: bu bolume DISARIDAN tutunmak icin. Sayfada baska "Sil"
     * dugmeleri de var (fis satirlari) ve testin hangisine bastigi
     * belirsiz kalamaz. Kalip yeni degil - projedeki her ui bileseni
     * data-slot tasiyor ve diyaloglar zaten boyle bulunuyor.
     */
    <section className="min-w-0" data-slot="recurring">
      <SectionHead title={t("ui.recurring")} />
      {rows.length === 0 ? (
        <p className="pt-2 text-sm text-muted-foreground">{t("ui.no_recurring")}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            // Sunucu yetkiyi ZATEN uyguluyor (assertCanModifyRecord); burasi
            // onu AYNALIYOR - reddedilecek bir dugmeyi hic cizmemek icin.
            const canManage = row.createdById === currentUserId;
            const paused = row.pausedAt !== null;
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.description}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[
                      t(row.interval === "WEEKLY" ? "ui.repeat_weekly" : "ui.repeat_monthly"),
                      paused
                        ? t("ui.repeat_paused")
                        : `${t("ui.repeat_next")}: ${formatDate(new Date(row.nextRunOn), locale)}`,
                    ].join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="money font-medium">
                    {formatMoney(row.amount, currency, locale)}
                  </span>
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void togglePause(row)}
                        disabled={busyId === row.id}
                        className="rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                      >
                        {paused ? t("ui.resume") : t("ui.pause")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        disabled={busyId === row.id}
                        className="rounded-[3px] text-xs text-muted-foreground underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                      >
                        {t("ui.delete")}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Silme YIKICI ve GERI ALINAMAZ (sablon icin geri alma yok), o yuzden
          onay penceresi - harcama silmede oldugu gibi. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.recurring_delete_question")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ui.recurring_delete_hint")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) void remove(pendingDelete);
              }}
            >
              {t("ui.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
