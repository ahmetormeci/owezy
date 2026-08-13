import type { GroupSummary as GroupSummaryData } from "@/lib/summary";
import { formatBasisPoints, formatMoney, formatSignedMoney } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { getLocale, getTranslate } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locale";

// Cevirici tipini elle yazmak yerine kaynaktan turetiyoruz: getTranslate'in
// imzasi degisirse burasi da onunla degisir.
type Translate = Awaited<ReturnType<typeof getTranslate>>;

/**
 * "Para nereye gitti" ve "bakiyem neden bu".
 *
 * ADR-021 geriliminin cozuldugu yer burasi: kategori kirilimi cok renkli bir
 * palet ISTEMIYOR. Renk bu uygulamada yalnizca alacak/borc tasiyor; yedi
 * kategoriye yedi renk vermek o kurali cignerdi ve kullanici turuncu bir
 * dilimi "bir sey mi oldu?" diye okurdu. Karsilastirmayi UZUNLUK yapiyor,
 * cubuklar tek renk (kobalt) ve buyukten kucuge sirali. Ayrica dar ekranda
 * pasta okunmaz, cubuk listesi okunur.
 */
export async function GroupSummary({
  summary,
  currency,
}: {
  summary: GroupSummaryData;
  currency: string;
}) {
  const t = await getTranslate();
  const locale = await getLocale();

  // Hic harcama yoksa blok hic gorunmuyor. Sifirlarla dolu bir ozet, olmayan
  // bir gecmisi varmis gibi gosterir.
  if (summary.expenseCount === 0) {
    return null;
  }

  const largestCategory = summary.byCategory[0]?.amount ?? 0;

  // En yeni ay sagda dursun: zaman soldan saga akiyor.
  const months = [...summary.byMonth].reverse();
  const largestMonth = Math.max(...months.map((slice) => slice.amount), 1);

  // Tek aylik bir grafik hicbir sey anlatmiyor - karsilastiracak ikinci bir
  // sutun yok, tek cubuk her zaman tam boy. O ay zaten listenin basliginda
  // yaziyor. Iki ay olunca grafik anlam kazaniyor.
  const showMonths = months.length > 1;

  return (
    <section className="mt-8 rounded-lg border border-border bg-card">
      <div className="grid grid-cols-3">
        <Figure label={t("ui.summary_total")} value={formatMoney(summary.totalAmount, currency, locale)} />
        <Figure
          label={t("ui.summary_your_share")}
          value={formatMoney(summary.myShare, currency, locale)}
          bordered
        />
        <Figure
          label={t("ui.summary_expense_count")}
          value={String(summary.expenseCount)}
          bordered
        />
      </div>

      <div className={`grid gap-7 p-5 md:gap-9 ${showMonths ? "md:grid-cols-2" : ""}`}>
        {showMonths ? (
          <div className="min-w-0">
            <p className="label mb-3">{t("ui.summary_by_month")}</p>
            <div className="flex items-end gap-3">
              {months.map((slice) => (
                <div key={slice.month} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="money truncate text-center text-[0.6875rem] text-muted-foreground">
                    {formatMoney(slice.amount, currency, locale)}
                  </span>
                  {/* Cubuk kendi SABIT yuksekligindeki kutunun icinde duruyor.
                      Etiketlerle ayni esnek kutuda olsaydi yuzde yukseklik
                      etiketleri disari tasirir ve tutar kirpilirdi. */}
                  <div className="flex h-20 items-end">
                    <span
                      className="mx-auto w-full max-w-14 rounded-[3px] bg-brand"
                      // En az %4: sifira yakin bir ay tamamen kaybolup "veri
                      // yok" gibi durmasin.
                      style={{
                        height: `${Math.max(4, (slice.amount / largestMonth) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="truncate text-center text-[0.6875rem] text-muted-foreground">
                    {formatMonth(slice.month, locale)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="label mb-3">{t("ui.summary_by_category")}</p>
          <ul className="flex flex-col gap-2.5">
            {summary.byCategory.map((slice) => (
              <li key={slice.category} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
                <span className="min-w-0 truncate">{t(EXPENSE_CATEGORY_CODES[slice.category])}</span>
                <span className="money text-xs text-muted-foreground">
                  {formatMoney(slice.amount, currency, locale)} ·{" "}
                  {formatBasisPoints(slice.basisPoints, locale)}
                </span>
                <span className="col-span-2 h-[5px] rounded-full bg-panel-strong">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${(slice.amount / largestCategory) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BalanceBreakdown summary={summary} currency={currency} locale={locale} t={t} />
    </section>
  );
}

function Figure({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={`border-b border-line-soft p-4 ${bordered ? "border-l" : ""}`}>
      <p className="label">{label}</p>
      <p className="money mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

/**
 * Sayfadaki en buyuk rakamin ACIKLAMASI.
 *
 * Bakiye bugune kadar gerekcesiz duruyordu. Buradaki sayilar tam olarak
 * bakiyeyi veriyor: odedigin - payin + yaptigin odemeler - aldigin odemeler.
 * Toplamin tuttugunu bir birim testi koruyor (summary.test.ts) - iki ayri kod
 * yolu sessizce ayrilirsa kullaniciya birbirini tutmayan iki rakam gosterirdik.
 *
 * Odeme satiri yalnizca gercekten odeme varsa yaziliyor: "0,00 ₺" yazan bir
 * satir, olmayan bir hareketi varmis gibi gosterir.
 */
function BalanceBreakdown({
  summary,
  currency,
  locale,
  t,
}: {
  summary: GroupSummaryData;
  currency: string;
  locale: Locale;
  t: Translate;
}) {
  const hasSettlements = summary.mySettlementsOut > 0 || summary.mySettlementsIn > 0;

  return (
    <div className="border-t border-line-soft px-5 py-4">
      <p className="label mb-2">{t("ui.summary_how_balance")}</p>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm">
        <Term label={t("ui.summary_you_paid")} value={formatMoney(summary.myPaid, currency, locale)} />
        <Term
          label={t("ui.summary_your_share")}
          value={`−${formatMoney(summary.myShare, currency, locale)}`}
        />
        {hasSettlements ? (
          <Term
            label={t("ui.summary_settlements")}
            value={formatSignedMoney(
              summary.mySettlementsOut - summary.mySettlementsIn,
              currency,
              locale,
            )}
          />
        ) : null}
        <span className="text-muted-foreground">=</span>
        <Term
          label={t("ui.summary_balance")}
          value={formatSignedMoney(summary.myBalance, currency, locale)}
          strong
        />
      </div>
    </div>
  );
}

function Term({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`money ${strong ? "font-medium" : ""}`}>{value}</span>
    </span>
  );
}
