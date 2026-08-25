"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ExpenseCategory } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-labels";
import { useLocale, useTranslate } from "@/lib/i18n";
import { ReceiptLine, ReceiptPerforation } from "@/components/receipt";

export type ExpenseListItem = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: string;
  paidById: string;
  createdById: string;
  participants: { userId: string; shareAmount: number }[];
  /** Optimistic locking sayaci (ADR-032). Silme istegiyle birlikte gidiyor. */
  version: number;
};

/** Ozetten gelen ay toplamlari. Grubun TAMAMINI kapsar, ekrandakini degil. */
export type MonthTotal = { month: string; amount: number; count: number };

/** Katlanmis bir ay acildiginda tutulan durum. */
type MonthState = { expenses: ExpenseListItem[]; nextCursor: string | null };

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
  version,
}: {
  groupId: string;
  expenseId: string;
  description: string;
  version: number;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      // Surum query string'te: DELETE'in govdesi yok (ADR-032).
      await apiRequest(`/api/v1/groups/${groupId}/expenses/${expenseId}?version=${version}`, {
        method: "DELETE",
      });
      toast.success(t("ui.expense_deleted"));
      // Pencereyi acikca kapatiyoruz: acik kalirsa kullanici islemin
      // basarisiz oldugunu saniyor ve tekrar deneyince "bulunamadi" aliyor.
      setOpen(false);
      router.refresh();
    } catch (error) {
      // Cakismada pencere ACIK KALIYOR ve liste tazeleniyor: penceredeki
      // aciklama da, arkadaki satir da guncel hale donuyor. Yani "ne degisti"
      // sorusunu ayri bir metin yerine ekranin kendisi cevapliyor. Ikinci
      // onay artik yeni surumle gidiyor.
      if (error instanceof ApiClientError && error.code === "expense.version_conflict") {
        toast.error(error.message);
        router.refresh();
        setIsDeleting(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : t("ui.expense_delete_failed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          // Fis satirinin ikincil bilgisiyle ayni agirlikta: bu bir eylem
          // ama satirin konusu degil. Dolgu ve yukseklik sifirlaniyor ki
          // metin akisini bozmasin.
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-debt"
          >
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
  openMonth,
  initialExpenses,
  initialNextCursor,
}: {
  groupId: string;
  currency: string;
  currentUserId: string;
  nameByUserId: Record<string, string>;
  monthTotals: MonthTotal[];
  /**
   * Fiste ACIK duran ay ("YYYY-MM"). Sunucudan gelen initialExpenses YALNIZCA
   * bu ayi tasiyor; daha eski aylar katli ve acildiklarinda ayri ayri
   * cekiliyorlar. null ise grupta hic harcama yok.
   */
  openMonth: string | null;
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

  // Acilmis eski aylar. Anahtar ay ("2026-07"), deger o ayin cekilmis
  // satirlari. Acilmamis aylar burada HIC YOK - katli bir ayin tek bildigi
  // sey ozetten gelen toplami ve adedi, o kadar.
  const [expandedMonths, setExpandedMonths] = useState<Record<string, MonthState>>({});
  const [busyMonth, setBusyMonth] = useState<string | null>(null);

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
      // Filtre YOKKEN liste acik aya kapsaniyor: "daha fazla" o ayin icinde
      // ilerliyor, sessizce bir onceki aya tasmiyor. Filtre varken pencere
      // kalkiyor - arama butun gecmiste calismali, yoksa aranan kayit eski
      // bir ayda dururken "sonuc yok" denirdi.
      if (!isFiltered && openMonth) params.set("month", openMonth);
      return `/api/v1/groups/${groupId}/expenses?${params.toString()}`;
    },
    [groupId, filterParams, isFiltered, openMonth],
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

  /** Katli bir ayin URL'i. Filtre TASINMAZ: katlanan ay bir pencere, filtre degil. */
  function monthUrl(month: string, cursor: string | null) {
    const params = new URLSearchParams({ limit: "20", month });
    if (cursor) params.set("cursor", cursor);
    return `/api/v1/groups/${groupId}/expenses?${params.toString()}`;
  }

  /**
   * Katli bir ayi acar ya da kapatir.
   *
   * Kapatirken veriyi ATIYORUZ. Bellekte tutup tekrar gostermek daha hizli
   * olurdu ama bu arada baska biri o aya harcama eklemis olabilir; bayat bir
   * listeyi "acilmis" diye geri koymak, kullanicinin gordugu sayilarin
   * ozetteki toplamla celismesi demek.
   */
  async function toggleMonth(month: string) {
    if (expandedMonths[month]) {
      setExpandedMonths((current) => {
        const next = { ...current };
        delete next[month];
        return next;
      });
      return;
    }

    setBusyMonth(month);
    try {
      const data = await apiRequest<ListState>(monthUrl(month, null));
      setExpandedMonths((current) => ({
        ...current,
        [month]: { expenses: data.expenses, nextCursor: data.nextCursor },
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.expenses_load_failed"));
    } finally {
      setBusyMonth(null);
    }
  }

  /**
   * Acilmis bir ayin devami. Ay ici sayfalama SART: 20'den fazla harcamasi
   * olan bir ay sessizce kirpilsaydi, ekrandaki satirlarin toplami ayin
   * basliginda yazan toplamla tutmazdi ve bunu fark etmenin yolu olmazdi.
   */
  async function loadMoreInMonth(month: string) {
    const state = expandedMonths[month];
    if (!state?.nextCursor) return;

    setBusyMonth(month);
    try {
      const data = await apiRequest<ListState>(monthUrl(month, state.nextCursor));
      setExpandedMonths((current) => ({
        ...current,
        [month]: {
          expenses: [...(current[month]?.expenses ?? []), ...data.expenses],
          nextCursor: data.nextCursor,
        },
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.expenses_load_failed"));
    } finally {
      setBusyMonth(null);
    }
  }

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

  // FIS DILI (Faz 16): kutulu form denetimleri kagidin uzerinde yabanci
  // duruyordu (ekran goruntusunde goruldu). Kenarliklar kalkti, satir iki
  // kesikli cizgi arasina alindi: kagida yazilmis gibi duruyor.
  // Denetimler ERISILEBILIR kaliyor - label'lar, focus halkasi ve klavye
  // davranisi ayni; degisen yalnizca cerceve.
  const filters = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-dashed border-border py-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("ui.search_expenses")}
        aria-label={t("ui.search_expenses")}
        className="h-7 min-w-[10rem] flex-1 basis-40 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value as ExpenseCategory | "")}
        aria-label={t("ui.category")}
        className="cap h-7 border-0 bg-transparent text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{t("ui.all_categories")}</option>
        {EXPENSE_CATEGORY_OPTIONS.map(([value, code]) => (
          <option key={value} value={value}>
            {t(code)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={mine}
          onChange={(event) => setMine(event.target.checked)}
          className="size-3.5"
        />
        {t("ui.only_mine")}
      </label>
      {/* Duz bir baglanti, fetch degil: tarayici indirmeyi kendisi yapiyor,
          cerezler gidiyor ve dosya adini Content-Disposition belirliyor.
          Blob'a cevirip indirmek ayni isi daha fazla kodla yapardi. */}
      <a
        href={exportUrl}
        download
        className="cap ml-auto transition-colors hover:text-brand"
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
    // Grubun HIC harcamasi yok mu, yoksa yalnizca bu goruntu mu bos?
    // Ozet butun aylari tasiyor; bos olmasi grubun bos olmasi demek.
    const groupIsEmpty = monthTotals.length === 0 && !isFiltered;

    return (
      <div className="flex flex-col gap-4">
        {/* Bos bir fiste filtre cubugu YOK (Faz 16.5): suzulecek hicbir sey
            yokken arama kutusu gostermek, olmayan bir isi varmis gibi
            gosterir. Filtre acikken cubuk elbette duruyor - kullanici onu
            kapatabilmeli. */}
        {groupIsEmpty ? null : filters}

        {groupIsEmpty ? (
          // Yazilmayi bekleyen satirlar. Icleri BILEREK bos: mockup'ta ornek
          // aciklamalar vardi ("Kahvalti", "Benzin") ama uydurma icerik
          // ekranda gercek kayitla karisir. Bos noktali cizgiler ayni seyi
          // soyluyor - burasi yazilacak - hicbir sey uydurmadan.
          <div aria-hidden="true" className="flex flex-col gap-5 py-2">
            <span className="block border-b border-dotted border-border" />
            <span className="block border-b border-dotted border-border opacity-60" />
            <span className="block border-b border-dotted border-border opacity-30" />
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {!list
            ? t("ui.loading")
            : isFiltered
              ? t("ui.no_matching_expenses")
              : t("ui.no_expenses")}
        </p>
      </div>
    );
  }

  // Bir harcama satiri. Fonksiyon bilesenin ICINDE cunku t, locale,
  // nameByUserId ve currentUserId'yi kapaniyor; disari alsak alti prop'u tek
  // tek gecirmek gerekirdi. Iki yerde kullaniliyor: acik ayda ve acilmis eski
  // aylarda - kopyalanan bir satir, zamanla ayrisan bir satirdir.
  function renderRow(expense: ExpenseListItem) {
    const myShare = expense.participants.find(
      (participant) => participant.userId === currentUserId,
    );
    // Yalnizca kaydi olusturan kisi duzenleyip silebilir; buton da bu
    // kurala gore gosteriliyor. (Asil kontrol her zaman sunucuda.)
    const canModify = expense.createdById === currentUserId;

    return (
      <li key={expense.id} className="flex flex-col gap-1 py-2">
        {/* Fis satiri: aciklama - noktali ayrac - tutar.
            Ayrac bos bir eleman cunku genisligi degisken; goz
            satirdan kaymadan tutara ulassin diye var. */}
        <div className="flex items-baseline text-sm">
          <span className="min-w-0 truncate">{expense.description}</span>
          <span aria-hidden="true" className="leader" />
          <span className="money shrink-0">
            {formatMoney(expense.amount, currency, locale)}
          </span>
        </div>
        {/* Ikincil satir: kim odedi, hangi kategori, senin payin.
            Uc bilgi tek satirda cunku fiste her satir bir kayit -
            uc satira boluneni goz liste degil blok olarak okuyor. */}
        <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {formatDate(new Date(expense.expenseDate), locale)} ·{" "}
            {t(EXPENSE_CATEGORY_CODES[expense.category])} ·{" "}
            {t("ui.paid_by", {
              name: nameByUserId[expense.paidById] ?? t("ui.unknown_user"),
            })}
            {myShare ? (
              <>
                {" · "}
                <span className="money">
                  {t("ui.your_share_amount", {
                    amount: formatMoney(myShare.shareAmount, currency, locale),
                  })}
                </span>
              </>
            ) : null}
          </span>
          {canModify ? (
            <span className="ml-auto flex shrink-0 items-baseline gap-3">
              <Link
                href={`/groups/${groupId}/expenses/${expense.id}/edit`}
                className="transition-colors hover:text-brand"
              >
                {t("ui.edit")}
              </Link>
              <DeleteExpenseButton
                groupId={groupId}
                expenseId={expense.id}
                description={expense.description}
                version={expense.version}
              />
            </span>
          ) : null}
        </div>
      </li>
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
            {/* Ay siniri artik perfore cizgi (Faz 16). Toplam basliktan
                ayrilip ayin ALTINA indi: fiste ara toplam satirlarin
                arkasindan gelir, oncesinden degil.
                Ozette karsiligi bulunamazsa tutar hic yazilmiyor - yanlis bir
                toplam gostermektense hic gostermemek dogru. */}
            <ReceiptPerforation>{formatMonth(group.month, locale)}</ReceiptPerforation>

            <ul className="flex flex-col">
              {group.expenses.map(renderRow)}
            </ul>

            {/* Ay ara toplami. Fiste ara toplam satirlarin arkasindan gelir.
                Filtre acikken hic yazilmiyor (bkz. summaryLine): ayin tam
                toplami suzulmus bir listenin altinda yanlis bir sayi olurdu. */}
            {total ? (
              <div className="pt-1.5">
                <ReceiptLine muted amount={formatMoney(total.amount, currency, locale)}>
                  <span className="cap">
                    {t(
                      total.count === 1
                        ? "ui.month_expense_count_one"
                        : "ui.month_expense_count_other",
                      { count: total.count },
                    )}
                  </span>
                </ReceiptLine>
              </div>
            ) : null}
          </section>
        );
      })}

      {list.nextCursor ? (
        <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? t("ui.loading") : t("ui.load_more")}
        </Button>
      ) : null}

      {/* KATLANMIS AYLAR (Faz 16.2).
          Fis bir rulo gibi davraniyor: acik ay tam, gecmis aylar tek satir.
          Bu satirin tasidigi sayilar OZETTEN geliyor, yani katli bir ay icin
          hicbir sorgu atilmiyor - 100 harcamali bir grup 100 satir indirmeden
          aciliyor. Filtre acikken katlama YOK: arama butun gecmiste calisiyor
          ve sonuclar duz bir liste olarak geliyor. */}
      {!isFiltered
        ? monthTotals
            .filter((slice) => slice.month !== openMonth)
            .map((slice) => {
              const opened = expandedMonths[slice.month];
              const busy = busyMonth === slice.month;

              if (!opened) {
                return (
                  <button
                    key={slice.month}
                    type="button"
                    onClick={() => toggleMonth(slice.month)}
                    disabled={busy}
                    className="flex w-full items-baseline text-left text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="cap flex items-center gap-1.5">
                      <ChevronRight className="size-3" aria-hidden="true" />
                      {formatMonth(slice.month, locale)}
                    </span>
                    <span className="ml-2.5 text-xs">
                      {busy
                        ? t("ui.loading")
                        : t(
                            slice.count === 1
                              ? "ui.month_expense_count_one"
                              : "ui.month_expense_count_other",
                            { count: slice.count },
                          )}
                    </span>
                    <span aria-hidden="true" className="leader" />
                    <span className="money shrink-0 text-sm">
                      {formatMoney(slice.amount, currency, locale)}
                    </span>
                  </button>
                );
              }

              return (
                <section key={slice.month}>
                  <button
                    type="button"
                    onClick={() => toggleMonth(slice.month)}
                    className="flex w-full items-center gap-3 text-left before:h-px before:flex-1 before:border-t before:border-dashed before:border-border after:h-px after:flex-1 after:border-t after:border-dashed after:border-border"
                  >
                    <span className="cap flex items-center gap-1.5">
                      <ChevronDown className="size-3" aria-hidden="true" />
                      {formatMonth(slice.month, locale)}
                    </span>
                  </button>

                  <ul className="flex flex-col">{opened.expenses.map(renderRow)}</ul>

                  <div className="pt-1.5">
                    <ReceiptLine muted amount={formatMoney(slice.amount, currency, locale)}>
                      <span className="cap">
                        {t(
                          slice.count === 1
                            ? "ui.month_expense_count_one"
                            : "ui.month_expense_count_other",
                          { count: slice.count },
                        )}
                      </span>
                    </ReceiptLine>
                  </div>

                  {opened.nextCursor ? (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadMoreInMonth(slice.month)}
                        disabled={busy}
                      >
                        {busy ? t("ui.loading") : t("ui.load_more")}
                      </Button>
                    </div>
                  ) : null}
                </section>
              );
            })
        : null}
    </div>
  );
}
