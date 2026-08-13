"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExpenseCategory } from "@prisma/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDate, formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-labels";
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

/** Ozetten gelen ay toplamlari. Grubun TAMAMINI kapsar, ekrandakini degil. */
export type MonthTotal = { month: string; amount: number; count: number };

/**
 * Listenin tek state'i. matches YALNIZCA filtre acikken dolu - filtre yokken
 * "kac sonuc" diye bir soru yok, butun grup zaten listeleniyor.
 */
type ListState = {
  expenses: ExpenseListItem[];
  nextCursor: string | null;
  matches: { count: number; total: number } | null;
};

/**
 * Yuklenmis harcamalari aya boler.
 *
 * expenseDate ISO metni ve sunucudaki monthKey ile AYNI dilim aliniyor
 * (ilk 7 karakter, UTC). Date'e cevirip getMonth() kullansaydik, UTC'nin
 * gerisindeki bir saat diliminde ayin ilk gunu bir onceki basligin altina
 * duserdi ve o ayin toplami satirlariyla celisirdi.
 *
 * Liste zaten tarihe gore azalan sirali geldigi icin tek gecis yetiyor.
 */
function groupByMonth(expenses: ExpenseListItem[]) {
  const groups: { month: string; expenses: ExpenseListItem[] }[] = [];

  for (const expense of expenses) {
    const month = expense.expenseDate.slice(0, 7);
    const current = groups[groups.length - 1];

    if (current?.month === month) {
      current.expenses.push(expense);
    } else {
      groups.push({ month, expenses: [expense] });
    }
  }

  return groups;
}

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
  monthTotals,
  initialExpenses,
  initialNextCursor,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  nameByUserId: Record<string, string>;
  monthTotals: MonthTotal[];
  initialExpenses: ExpenseListItem[];
  initialNextCursor: string | null;
}) {
  const t = useTranslate();
  const locale = useLocale();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [mine, setMine] = useState(false);
  const isFiltered = query.trim() !== "" || category !== "" || mine;

  // Iki liste AYRI tutuluyor: filtresiz olan sunucudan geliyor, filtreli olan
  // /api/v1'den. Tek state'te birlestirip filtre kalkinca sunucununkine geri
  // donmek, effect icinde senkron setState demek olurdu (fazladan render).
  // Ayri tutunca hangisinin gosterilecegi sadece TURETILIYOR.
  const [unfiltered, setUnfiltered] = useState<ListState>({
    expenses: initialExpenses,
    nextCursor: initialNextCursor,
    matches: null,
  });
  const [filtered, setFiltered] = useState<ListState | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Bir harcama silindiginde router.refresh() sunucudan guncel listeyi
  // getiriyor, ama liste yerel state'te oldugu icin ekran eski halde kalirdi:
  // silinen kayit listede durur, kullanici tekrar silmeye calisip hata alirdi.
  // Sunucudan yeni bir liste geldiginde state onunla esitleniyor. ("Daha
  // fazla" ile yuklenmis sayfalar sifirlanir; dogru olan da bu, cunku
  // sunucunun gonderdigi liste artik tek gecerli kaynak.)
  const [serverExpenses, setServerExpenses] = useState(initialExpenses);
  if (serverExpenses !== initialExpenses) {
    setServerExpenses(initialExpenses);
    setUnfiltered({
      expenses: initialExpenses,
      nextCursor: initialNextCursor,
      matches: null,
    });
  }

  const list = isFiltered ? filtered : unfiltered;

  // Filtreler tek yerde URL'e cevriliyor: liste de disa aktarma da bunu
  // kullaniyor, yani indirilen dosya ekranda gorulen kumeyle ayni.
  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (mine) params.set("mine", "true");
    return params;
  }, [query, category, mine]);

  const buildUrl = useCallback(
    (cursor: string | null) => {
      const params = filterParams();
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);
      return `/api/v1/groups/${groupId}/expenses?${params.toString()}`;
    },
    [groupId, filterParams],
  );

  const exportParams = filterParams().toString();
  const exportUrl = `/api/v1/groups/${groupId}/expenses/export${
    exportParams ? `?${exportParams}` : ""
  }`;

  // Filtre degisince ilk sayfa yeniden cekiliyor. initialExpenses de bagimli:
  // bir harcama silindiginde router.refresh() sunucudan yeni liste getiriyor
  // ve filtre aciksa o listenin filtresiz hali ekrana basilmamali - yeniden
  // sorulmali. Filtre yokken sunucunun gonderdigi liste zaten tek gecerli
  // kaynak, ek istek atmiyoruz.
  useEffect(() => {
    // Filtre yokken hicbir sey yapmiyoruz: gosterilecek liste zaten sunucudan
    // gelen. Burada state sifirlamak effect icinde senkron setState olurdu.
    if (!isFiltered) {
      return;
    }

    let cancelled = false;

    // Yazarken her tusa istek atmamak icin bekleme. Temizleme fonksiyonu hem
    // zamanlayiciyi iptal ediyor hem de gec donen bir cevabin yeni sonucun
    // uzerine yazmasini engelliyor.
    //
    // isSearching zamanlayicinin ICINDE aciliyor, effect govdesinde degil:
    // govdede senkron setState fazladan render uretir. Yan faydasi da var -
    // solma yalnizca gercekten istek gidince basliyor, her tusta degil.
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await apiRequest<ListState>(buildUrl(null));
        if (!cancelled) {
          setFiltered(data);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("ui.expenses_load_failed"));
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFiltered, buildUrl, initialExpenses, initialNextCursor, t]);

  async function loadMore() {
    if (!list?.nextCursor) return;

    setIsLoadingMore(true);
    try {
      const data = await apiRequest<ListState>(buildUrl(list.nextCursor));
      const append = (current: ListState): ListState => ({
        expenses: [...current.expenses, ...data.expenses],
        nextCursor: data.nextCursor,
        matches: data.matches,
      });

      if (isFiltered) {
        setFiltered((current) => (current ? append(current) : data));
      } else {
        setUnfiltered(append);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.expenses_load_failed"));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const filters = (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("ui.search_expenses")}
        aria-label={t("ui.search_expenses")}
        className="h-9 w-full min-w-0 sm:w-56"
      />
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value as ExpenseCategory | "")}
        aria-label={t("ui.category")}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <option value="">{t("ui.all_categories")}</option>
        {EXPENSE_CATEGORY_OPTIONS.map(([value, code]) => (
          <option key={value} value={value}>
            {t(code)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mine}
          onChange={(event) => setMine(event.target.checked)}
          className="size-4"
        />
        {t("ui.only_mine")}
      </label>
      {/* Duz bir baglanti, fetch degil: tarayici indirmeyi kendisi yapiyor,
          cerezler gidiyor ve dosya adini Content-Disposition belirliyor.
          Blob'a cevirip indirmek ayni isi daha fazla kodla yapardi. */}
      <a
        href={exportUrl}
        download
        className="ml-auto text-xs text-muted-foreground transition-colors hover:text-brand"
      >
        {t("ui.export_csv")} ↓
      </a>
    </div>
  );

  // Filtre acikken AY TOPLAMLARI GIZLENIYOR. Baslikta ayin tamaminin toplami
  // yazarken altinda suzulmus bir liste durmasi, yan yana konularak soylenen
  // bir yalan olurdu. Yerine kac sonuc bulundugu yaziyor - o sayi listenin
  // where'iyle ayni kosuldan geliyor.
  const summaryLine = list?.matches ? (
    <p className="text-xs text-muted-foreground">
      {t(
        list.matches.count === 1 ? "ui.match_count_one" : "ui.match_count_other",
        { count: list.matches.count },
      )}
      {list.matches.count > 0
        ? ` · ${formatMoney(list.matches.total, currency, locale)}`
        : ""}
    </p>
  ) : null;

  // list yalnizca ilk aramanin cevabi beklenirken null olur.
  if (!list || list.expenses.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {filters}
        <p className="text-muted-foreground">
          {!list
            ? t("ui.loading")
            : isFiltered
              ? t("ui.no_matching_expenses")
              : t("ui.no_expenses")}
        </p>
      </div>
    );
  }

  const totalByMonth = new Map(monthTotals.map((slice) => [slice.month, slice]));

  return (
    <div className={`flex flex-col gap-4 ${isSearching ? "opacity-60" : ""}`}>
      {filters}
      {summaryLine}

      {groupByMonth(list.expenses).map((group) => {
        // Filtre acikken ay toplami YAZILMIYOR (bkz. summaryLine).
        const total = isFiltered ? undefined : totalByMonth.get(group.month);

        return (
          <section key={group.month}>
            {/* Baslik ayin TAMAMINI ozetliyor, ekrandaki satirlari degil.
                Ozette karsiligi bulunamazsa tutar hic yazilmiyor - yanlis bir
                toplam gostermektense hic gostermemek dogru. */}
            <div className="flex items-baseline justify-between gap-4 border-b border-line-soft pt-3 pb-1.5">
              <span className="label">{formatMonth(group.month, locale)}</span>
              {total ? (
                <span className="money text-xs text-muted-foreground">
                  {formatMoney(total.amount, currency, locale)} ·{" "}
                  {t(
                    total.count === 1
                      ? "ui.month_expense_count_one"
                      : "ui.month_expense_count_other",
                    { count: total.count },
                  )}
                </span>
              ) : null}
            </div>

            <ul className="flex flex-col">
              {group.expenses.map((expense) => {
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
          </section>
        );
      })}

      {list.nextCursor ? (
        <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? t("ui.loading") : t("ui.load_more")}
        </Button>
      ) : null}
    </div>
  );
}
