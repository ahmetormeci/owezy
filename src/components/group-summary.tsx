import type { GroupSummary as GroupSummaryData } from "@/lib/summary";
import { formatBasisPoints, formatMoney } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { getLocale, getTranslate } from "@/lib/i18n-server";

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

  // Tek kategorili bir kirilim da hicbir sey anlatmiyor: tek cubuk her zaman
  // tam boy ve yaninda "%100" yaziyor. Aylik grafikte ayni kural zaten vardi
  // (Faz 13); kategori tarafinda yoktu ve varsayilanin "Diger" olmasi
  // yuzunden en sik gorulen hal buydu - ekran goruntusunde de oyle cikti.
  // Kategori tahmini (Faz 17) bu durumu seyrekletiyor ama ortadan
  // kaldirmiyor: iki harcamasi da markete gitmis bir grup hala tek cubuk.
  const showCategories = summary.byCategory.length > 1;

  // Ikisi de yoksa blogun kendisi cizilmiyor: bos bir kart, olmayan bir
  // ozetin yerini tutar.
  if (!showMonths && !showCategories) {
    return null;
  }

  return (
    // Faz 16: uc rakam kutusu (TOPLAM / PAYIN / HARCAMA) ve "bakiyen nasil
    // olustu" denklemi BURADAN KALKTI. Ikisi de fisin kendisinde var artik -
    // toplamlar cift cizginin altinda, bakiye ustte. Ayni sayiyi bir sayfada
    // iki kez gostermek, ekran goruntusunde bakinca hemen goze carpiyordu.
    // Bu blok yalnizca fiste OLMAYANI tasiyor: paranin nereye gittigi.
    <section className="rounded-lg border border-border bg-card">
      <div className={`grid gap-7 p-5 md:gap-9 ${showMonths && showCategories ? "md:grid-cols-2" : ""}`}>
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

        {showCategories ? (
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
        ) : null}
      </div>

    </section>
  );
}
