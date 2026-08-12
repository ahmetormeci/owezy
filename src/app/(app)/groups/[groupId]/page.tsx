import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupBalances } from "@/lib/balances";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { listExpenses } from "@/lib/expenses";
import { listSettlements } from "@/lib/settlements";
import { AppError } from "@/lib/errors";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import type { Locale } from "@/lib/locale";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EditGroupDialog } from "@/components/edit-group-dialog";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { RecordSettlementDialog } from "@/components/record-settlement-dialog";
import { getLocale, getTranslate } from "@/lib/i18n-server";

// Renkler artik dogrudan yazilmiyor (eskiden "text-emerald-600
// dark:text-emerald-400" idi). Anlam tokenlari kullaniliyor: --credit
// "alacak", --debt "borc". Iki tema icin ayarlari globals.css'te; burasi
// yalnizca HANGI ANLAM oldugunu soyluyor, rengin ne oldugunu degil.
//
// ADR-021: odesmis durumda RENK YOK. Tutar notr griye duser - sayfadaki tek
// renk kaynagi bakiyenin isareti oldugu icin, isaret yoksa renk de yok.
function balanceToneClass(amount: number) {
  if (amount > 0) return "text-credit";
  if (amount < 0) return "text-debt";
  return "text-muted-foreground";
}

type SuggestedTransfer = { fromUserId: string; toUserId: string; amount: number };

/**
 * Durum panelindeki oneri listesi.
 *
 * Fiil BASLIKTA ("Odemen gerekenler"), satirda degil. Satiri
 * "{name} kisisine {amount} ode" diye kursaydik Turkce ek isterdi
 * ({name}'e / {name}'a / {name}'ye) ve ek ismin son harfine gore degisiyor -
 * yer tutucuyla dogru yazilamaz. Basliga tasiyinca satir yalnizca isim +
 * tutar oluyor ve iki dilde de dogru duruyor.
 *
 * Liste bossa hicbir sey render edilmiyor: bos bir baslik, olmayan bir borcu
 * varmis gibi gosterir.
 */
function SuggestionGroup({
  title,
  transfers,
  nameOf,
  currency,
  locale,
  fallbackName,
}: {
  title: string;
  transfers: SuggestedTransfer[];
  nameOf: (transfer: SuggestedTransfer) => string | undefined;
  currency: string;
  locale: Locale;
  fallbackName: string;
}) {
  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="label">{title}</p>
      <ul className="flex flex-col gap-1">
        {transfers.map((transfer) => (
          <li
            key={`${transfer.fromUserId}-${transfer.toUserId}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="truncate">{nameOf(transfer) ?? fallbackName}</span>
            <span className="money shrink-0 font-medium">
              {formatMoney(transfer.amount, currency, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bolum basligi: kucuk etiket + altinda cizgi + istege bagli bir baglanti.
 *
 * ADR-021: bolumleri buyuk baslikla degil, kucuk bir etiketle ayiriyoruz.
 * Kart basliklarinin yerini bu aldi - kutu kalkinca basligin da kutu
 * icinde durmasi gerekmiyor.
 */
function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-4 border-b border-border pb-2">
      <span className="label">{title}</span>
      {action ? (
        <Link
          href={action.href}
          className="text-xs text-muted-foreground transition-colors hover:text-brand"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const t = await getTranslate();
  const locale = await getLocale();

  const user = await getOrCreateCurrentUser();
  if (!user) {
    return null;
  }

  // Servis katmani yetkisiz/olmayan grup icin AppError firlatiyor. Sayfada bunu
  // 404'e ceviriyoruz: uye olmadigin bir grubun VAR OLDUGUNU bile sizdirmiyoruz.
  let group: Awaited<ReturnType<typeof getGroupForUser>>;
  let balanceData: Awaited<ReturnType<typeof getGroupBalances>>;
  let members: Awaited<ReturnType<typeof listGroupMembers>>;
  let expenseData: Awaited<ReturnType<typeof listExpenses>>;
  let settlementData: Awaited<ReturnType<typeof listSettlements>>;
  try {
    [group, balanceData, members, expenseData, settlementData] = await Promise.all([
      getGroupForUser(user.id, groupId),
      getGroupBalances(user.id, groupId),
      listGroupMembers(user.id, groupId),
      listExpenses(user.id, groupId, { limit: 20 }),
      listSettlements(user.id, groupId, { limit: 20 }),
    ]);
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }

  const { currency, balances, suggestedTransfers } = balanceData;
  const roleByUserId = new Map(members.map((member) => [member.userId, member.role]));
  const nameByUserId = new Map(balances.map((balance) => [balance.userId, balance.displayName]));

  const myBalance = balances.find((balance) => balance.userId === user.id);
  const myAmount = myBalance?.amount ?? 0;

  // Onerilen odemeler ikiye ayriliyor: BENI ilgilendirenler durum panelinde,
  // kalanlar ikincil kademede. Sayfa "senin durumun" sorusuna cevap veriyor;
  // grubun tam takas plani dogru ama ikincil bir bilgi ve bugun ikisi ayni
  // agirliktaydi.
  //
  // Sadelestirilmis planda net bakiyeler kullanildigi icin bir kisi ayni anda
  // hem odeyen hem alan olamaz - yani asagidaki iki listeden biri her zaman
  // bos. Yine de ikisi de yaziliyor: bu, simplifyDebts'in bir ozelligi, bu
  // sayfanin varsayabilecegi bir sey degil.
  const iPay = suggestedTransfers.filter((transfer) => transfer.fromUserId === user.id);
  const iReceive = suggestedTransfers.filter((transfer) => transfer.toUserId === user.id);
  const otherTransfers = suggestedTransfers.filter(
    (transfer) => transfer.fromUserId !== user.id && transfer.toUserId !== user.id,
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1">
        <Link
          href="/groups"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("ui.back_to_groups")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[1.0625rem] font-semibold">{group.name}</h1>
              {group.role === "OWNER" ? (
                <EditGroupDialog
                  groupId={groupId}
                  initialName={group.name}
                  initialDescription={group.description}
                />
              ) : null}
            </div>
            {group.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
          {/* Eylemler TEK YERDE toplandi. 11.5'te "Odeme kaydet" durum
              panelinin icindeydi; onaylanan tasarimda (ADR-021) panel
              yalnizca bilgi tasiyor, eylemler baslikta duruyor. Yogun bir
              duzende dagilmis butonlar araniyor. */}
          <div className="flex shrink-0 gap-2">
            <RecordSettlementDialog
              groupId={groupId}
              currency={currency}
              currentUserId={user.id}
              counterparties={balances
                .filter((balance) => balance.userId !== user.id)
                .map((balance) => ({
                  userId: balance.userId,
                  displayName: balance.displayName,
                }))}
              suggestedTransfers={suggestedTransfers}
            />
            <Link
              href={`/groups/${groupId}/expenses/new`}
              className={buttonVariants({ size: "sm" })}
            >
              {t("ui.add_expense")}
            </Link>
          </div>
        </div>
      </div>

      {/* Durum paneli.
          Kullanici bu sayfaya tek soruyla geliyor: alacakli miyim, borclu
          muyum, ne kadar? (ADR-016). Panel bunu cevapliyor ve yaninda
          "kime odeyecegim"i tasiyor - o, ayni sorunun ikinci yarisi.

          ADR-021: dolu renk alani DEGIL. Zemin bir tik kalkiyor, ayrimi
          1 px kenarlik yapiyor. Sayfadaki tek renk tutarin isaretinde ve
          odesmis durumda o da griye dusuyor. */}
      <section className="mt-4 grid gap-5 rounded-lg border border-border bg-card p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-9 sm:p-6">
        <div>
          <p className="label">{t("ui.your_status")}</p>
          <p
            className={`money text-figure mt-1.5 font-medium ${balanceToneClass(myAmount)}`}
          >
            {myAmount === 0
              ? formatMoney(0, currency, locale)
              : formatSignedMoney(myAmount, currency, locale)}
          </p>
          {/* Odesmis durumda rakam artik "0,00 ₺" yaziyor (once "Odestin"
              kelimesi yazardi) - sayi uc durumda da kahraman kaliyor.
              "Odestin" alt satira indi; hem daha dogru bir yer hem de o
              kelimeyi iki E2E testi ariyor. */}
          <p className="mt-1.5 text-muted-foreground">
            {myAmount > 0
              ? t("ui.owed_to_you")
              : myAmount < 0
                ? t("ui.you_owe")
                : t("ui.settled_up")}
          </p>
        </div>

        {/* Genis ekranda dikey cizgiyle ayriliyor, darda yataya doner.
            min-w-0 SART: grid cocuklari varsayilan olarak icerigin altina
            inmeyi reddediyor ve uzun bir isim sutunu tasirir (11.5'te bu
            hata yasandi). */}
        <div className="min-w-0 border-t border-line-soft pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-9">
          {iPay.length === 0 && iReceive.length === 0 ? (
            // Bu ayrim onemli: benim odemem kalmamis olabilir ama GRUPTA
            // baskalarinin borcu duruyor olabilir. O durumda "herkes
            // odesmis" demek duz yalan olur.
            suggestedTransfers.length === 0 ? (
              <p className="text-muted-foreground">{t("ui.everyone_settled")}</p>
            ) : (
              <p className="text-muted-foreground">{t("ui.no_open_balance")}</p>
            )
          ) : (
            <div className="flex flex-col gap-4">
              <SuggestionGroup
                title={t("ui.you_should_pay")}
                transfers={iPay}
                // Odeyen benim; satirda gorulmesi gereken KARSI TARAF.
                nameOf={(transfer) => nameByUserId.get(transfer.toUserId)}
                currency={currency}
                locale={locale}
                fallbackName={t("ui.unknown_user")}
              />
              <SuggestionGroup
                title={t("ui.will_be_paid_to_you")}
                transfers={iReceive}
                nameOf={(transfer) => nameByUserId.get(transfer.fromUserId)}
                currency={currency}
                locale={locale}
                fallbackName={t("ui.unknown_user")}
              />
            </div>
          )}
        </div>
      </section>

      {/* KADEME 2 - Sayfanin govdesi. Gruba gelmenin ikinci sebebi:
          "ne harcandi". */}
      {/* Sayfanin govdesi. Kart kalkti: bolumu artik kucuk bir etiket ve
          altindaki cizgi ayiriyor (ADR-021). */}
      <section className="mt-8">
        <SectionHead title={t("ui.expenses")} />
        <ExpenseList
            groupId={groupId}
            currency={currency}
            currentUserId={user.id}
            nameByUserId={Object.fromEntries(nameByUserId)}
            initialNextCursor={expenseData.nextCursor}
            initialExpenses={expenseData.expenses.map((expense) => ({
              id: expense.id,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              // Client bilesenine gecen veri serilestirilebilir olmali;
              // Date yerine ISO metin gonderiyoruz.
              expenseDate: expense.expenseDate.toISOString(),
              paidById: expense.paidById,
              createdById: expense.createdById,
              participants: expense.participants.map((participant) => ({
                userId: participant.userId,
                shareAmount: participant.shareAmount,
              })),
            }))}
        />
      </section>

      {/* Referans bilgisi, gunluk akisin parcasi degil.
          Genis ekranda yan yana: sayfa kisaliyor ve goz ikincil bolgeye
          gectigini anliyor. items-start olmasa iki sutun birbirinin boyuna
          uzardi.

          min-w-0 SART. Grid cocuklarinin varsayilan min-width degeri "auto",
          yani icerigin min-content genisliginin altina inmeyi reddediyorlar.
          Uzun bir isim (ornegin e-posta adresi) sutunu zorla genisletiyor ve
          icerideki truncate hic devreye giremiyor - sayfa yatay kayiyor.
          Mobil ekran goruntusunde yakalandi (11.5). */}
      <div className="mt-8 grid gap-8 md:grid-cols-2 md:items-start">
      <section className="min-w-0">
        <SectionHead
          title={t("ui.members_and_balances")}
          action={{ href: `/groups/${groupId}/members`, label: t("ui.manage_members") }}
        />
          <ul className="flex flex-col">
            {balances.map((balance) => (
              <li
                key={balance.userId}
                className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{balance.displayName}</span>
                  {roleByUserId.get(balance.userId) === "OWNER" ? (
                    <Badge variant="secondary">{t("ui.role_owner")}</Badge>
                  ) : null}
                  {balance.hasLeft ? <Badge variant="outline">{t("ui.member_left")}</Badge> : null}
                </div>
                <span
                  className={`money shrink-0 font-medium ${balanceToneClass(balance.amount)}`}
                >
                  {balance.amount === 0
                    ? "—"
                    : formatSignedMoney(balance.amount, currency, locale)}
                </span>
              </li>
            ))}
          </ul>
      </section>

        <div className="flex min-w-0 flex-col gap-8">
          {/* Beni ilgilendirmeyen transferler. Panelde degiller cunku sayfa
              "senin durumun" sorusuna cevap veriyor; ama grubun takas plani
              dogru bir bilgi ve bir yerde durmali. Bos oldugunda hic
              gorunmuyor - "Onerilen odemeler: yok" diyen bir bolum, olmayan
              bir isi varmis gibi gosterirdi. */}
          {otherTransfers.length > 0 ? (
            <section className="min-w-0">
              <SectionHead title={t("ui.other_suggested_payments")} />
              <ul className="flex flex-col">
                {otherTransfers.map((transfer) => (
                  <li
                    key={`${transfer.fromUserId}-${transfer.toUserId}`}
                    className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 truncate">
                      {nameByUserId.get(transfer.fromUserId) ?? t("ui.unknown_user")}
                      {" → "}
                      {nameByUserId.get(transfer.toUserId) ?? t("ui.unknown_user")}
                    </span>
                    <span className="money shrink-0 font-medium">
                      {formatMoney(transfer.amount, currency, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="min-w-0">
            <SectionHead title={t("ui.settlements")} />
            <SettlementList
              groupId={groupId}
              currency={currency}
              currentUserId={user.id}
              nameByUserId={Object.fromEntries(nameByUserId)}
              settlements={settlementData.settlements.map((settlement) => ({
                id: settlement.id,
                fromUserId: settlement.fromUserId,
                toUserId: settlement.toUserId,
                amount: settlement.amount,
                note: settlement.note,
                settledAt: settlement.settledAt.toISOString(),
                createdById: settlement.createdById,
              }))}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
