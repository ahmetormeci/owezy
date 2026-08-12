"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatDate } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { useLocale, useTranslate } from "@/lib/i18n";

export type ExpenseListItem = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  paidById: string;
  createdById: string;
  participants: { userId: string; shareAmount: number }[];
};

function DeleteExpenseButton({
  groupId,
  expenseId,
  description,
}: {
  groupId: string;
  expenseId: string;
  description: string;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
      });
      toast.success(t("ui.expense_deleted"));
      // Pencereyi acikca kapatiyoruz: acik kalirsa kullanici islemin
      // basarisiz oldugunu saniyor ve tekrar deneyince "bulunamadi" aliyor.
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.expense_delete_failed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {t("ui.delete")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("ui.delete_expense_question")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.delete_expense_hint", { description })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">{t("ui.cancel")}</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? t("ui.deleting") : t("ui.delete")}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ExpenseList({
  groupId,
  currency,
  currentUserId,
  nameByUserId,
  initialExpenses,
  initialNextCursor,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  nameByUserId: Record<string, string>;
  initialExpenses: ExpenseListItem[];
  initialNextCursor: string | null;
}) {
  const t = useTranslate();
  const locale = useLocale();

  // Ilk sayfa sunucudan hazir geliyor; "daha fazla" tiklandiginda ek sayfalar
  // /api/v1 uzerinden cekilip listenin sonuna ekleniyor.
  const [expenses, setExpenses] = useState(initialExpenses);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // useState'e verilen deger YALNIZCA ilk render'da kullanilir. Bir harcama
  // silindiginde router.refresh() sunucudan guncel listeyi getiriyor, ama biz
  // listeyi yerel state'te tuttugumuz icin ekran eski halde kaliyordu: silinen
  // kayit listede duruyor, kullanici tekrar silmeye calisip hata aliyordu.
  // Bu yuzden sunucudan yeni bir liste geldiginde state'i onunla esitliyoruz.
  // ("Daha fazla" ile yuklenmis ek sayfalar bu sirada sifirlanir; dogru olan da
  // budur, cunku sunucunun gonderdigi liste artik tek gecerli kaynak.)
  const [serverExpenses, setServerExpenses] = useState(initialExpenses);
  if (serverExpenses !== initialExpenses) {
    setServerExpenses(initialExpenses);
    setExpenses(initialExpenses);
    setNextCursor(initialNextCursor);
  }

  async function loadMore() {
    if (!nextCursor) return;

    setIsLoadingMore(true);
    try {
      const data = await apiRequest<{
        expenses: ExpenseListItem[];
        nextCursor: string | null;
      }>(`/api/v1/groups/${groupId}/expenses?limit=20&cursor=${nextCursor}`);

      setExpenses((current) => [...current, ...data.expenses]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.expenses_load_failed"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (expenses.length === 0) {
    return (
      <p className="text-muted-foreground">
        {t("ui.no_expenses")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {expenses.map((expense) => {
          const myShare = expense.participants.find(
            (participant) => participant.userId === currentUserId,
          );
          // Yalnizca kaydi olusturan kisi duzenleyip silebilir; buton da bu
          // kurala gore gosteriliyor. (Asil kontrol her zaman sunucuda.)
          const canModify = expense.createdById === currentUserId;

          return (
            <li
              key={expense.id}
              className="border-b border-line-soft py-2.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{expense.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(new Date(expense.expenseDate), locale)} ·{" "}
                    {t(EXPENSE_CATEGORY_CODES[expense.category])} ·{" "}
                    {t("ui.paid_by", {
                      name: nameByUserId[expense.paidById] ?? t("ui.unknown_user"),
                    })}
                  </p>
                  {canModify ? (
                    <div className="-ml-2 mt-0.5 flex gap-0.5">
                      <Link
                        href={`/groups/${groupId}/expenses/${expense.id}/edit`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        {t("ui.edit")}
                      </Link>
                      <DeleteExpenseButton
                        groupId={groupId}
                        expenseId={expense.id}
                        description={expense.description}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="money font-medium">
                    {formatMoney(expense.amount, currency, locale)}
                  </p>
                  {myShare ? (
                    <p className="money mt-0.5 text-xs text-muted-foreground">
                      {t("ui.your_share_amount", {
                        amount: formatMoney(myShare.shareAmount, currency, locale),
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {nextCursor ? (
        <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? t("ui.loading") : t("ui.load_more")}
        </Button>
      ) : null}
    </div>
  );
}
