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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditGroupDialog } from "@/components/edit-group-dialog";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { RecordSettlementDialog } from "@/components/record-settlement-dialog";
import { getLocale, getTranslate } from "@/lib/i18n-server";

// Renkler artik dogrudan yazilmiyor (eskiden "text-emerald-600
// dark:text-emerald-400" idi). Anlam tokenlari kullaniliyor: --credit
// "alacak", --debt "borc". Iki tema icin ayarlari globals.css'te; burasi
// yalnizca HANGI ANLAM oldugunu soyluyor, rengin ne oldugunu degil.
function balanceToneClass(amount: number) {
  if (amount > 0) return "text-credit";
  if (amount < 0) return "text-debt";
  return "text-muted-foreground";
}

// Bakiye kartinin zemini. Tutar yaziyi okumadan once "iyi mi kotu mu"
// bilgisini veriyor; rakam da ayrica isaretli yaziliyor, yani bilgi renge
// bagimli degil.
function balanceSurfaceClass(amount: number) {
  if (amount > 0) return "bg-credit-soft";
  if (amount < 0) return "bg-debt-soft";
  return "bg-muted";
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
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {transfers.map((transfer) => (
          <li
            key={`${transfer.fromUserId}-${transfer.toUserId}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="truncate font-medium">{nameOf(transfer) ?? fallbackName}</span>
            <span className="money shrink-0 font-medium">
              {formatMoney(transfer.amount, currency, locale)}
            </span>
          </li>
        ))}
      </ul>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-muted-foreground hover:underline">
          {t("ui.back_to_groups")}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{group.name}</h1>
              {group.role === "OWNER" ? (
                <EditGroupDialog
                  groupId={groupId}
                  initialName={group.name}
                  initialDescription={group.description}
                />
              ) : null}
            </div>
            {group.description ? (
              <p className="text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
          {/* Baslikta yalnizca "Harcama ekle" kaldi: gruba her gun yapilan
              sey bu. "Odeme kaydet" durum panelinin icine tasindi - odesmek
              bakiyeye bagli bir eylem ve yerinin borcun yani olmasi daha
              tutarli. */}
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/groups/${groupId}/expenses/new`}
              className={buttonVariants()}
            >
              {t("ui.add_expense")}
            </Link>
          </div>
        </div>
      </div>

      {/* KADEME 1 - Durum paneli.
          Kullanici bu sayfaya tek soruyla geliyor: alacakli miyim, borclu
          muyum, ne kadar? (ADR-016). Bu yuzden bir kart degil, sayfanin
          baskin blogu: tam genislik, text-display rakam, isarete gore zemin.
          "Kime odeyecegim" de icinde - o, ayni sorunun ikinci yarisi ve
          bugun ayri bir kartta esit agirliktaydi. */}
      <section
        className={`flex flex-col gap-5 rounded-xl p-6 ${balanceSurfaceClass(myAmount)}`}
      >
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("ui.your_status")}
          </p>
          <p
            className={`money text-display font-semibold ${balanceToneClass(myAmount)}`}
          >
            {myAmount === 0
              ? t("ui.settled_up")
              : formatSignedMoney(myAmount, currency, locale)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {myAmount > 0
              ? t("ui.owed_to_you")
              : myAmount < 0
                ? t("ui.you_owe")
                : t("ui.no_open_balance")}
          </p>
        </div>

        {iPay.length === 0 && iReceive.length === 0 ? (
          suggestedTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ui.everyone_settled")}</p>
          ) : null
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

        <div>
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
        </div>
      </section>

      {/* KADEME 2 - Sayfanin govdesi. Gruba gelmenin ikinci sebebi:
          "ne harcandi". */}
      <Card>
        <CardHeader>
          <CardTitle>{t("ui.expenses")}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* KADEME 3 - Referans bilgisi, gunluk akisin parcasi degil.
          Genis ekranda yan yana: sayfa kisaliyor ve goz ikincil bolgeye
          gectigini anliyor. items-start olmasa iki sutun birbirinin boyuna
          uzardi. */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
      {/* min-w-0 SART. Grid cocuklarinin varsayilan min-width degeri "auto",
          yani icerigin min-content genisliginin altina inmeyi reddediyorlar.
          Uzun bir isim (ornegin e-posta adresi) sutunu zorla genisletiyor ve
          icerideki truncate hic devreye giremiyor - sayfa yatay kayiyor.
          Onceki duzende bu kartlar flex-column cocuguydu, o yuzden sorun
          gorunmuyordu. Mobil ekran goruntusunde yakalandi. */}
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("ui.members_and_balances")}</CardTitle>
          <Link
            href={`/groups/${groupId}/members`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {t("ui.manage_members")}
          </Link>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {balances.map((balance) => (
              <li
                key={balance.userId}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{balance.displayName}</span>
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
        </CardContent>
      </Card>

        <div className="flex min-w-0 flex-col gap-6">
          {/* Beni ilgilendirmeyen transferler. Panelde degiller cunku sayfa
              "senin durumun" sorusuna cevap veriyor; ama grubun takas plani
              dogru bir bilgi ve bir yerde durmali. Bos oldugunda hic
              gorunmuyor - "Onerilen odemeler: yok" diyen bir kart, olmayan
              bir isi varmis gibi gosterirdi. */}
          {otherTransfers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("ui.other_suggested_payments")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {otherTransfers.map((transfer) => (
                    <li
                      key={`${transfer.fromUserId}-${transfer.toUserId}`}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">
                          {nameByUserId.get(transfer.fromUserId) ?? t("ui.unknown_user")}
                        </span>
                        {" → "}
                        <span className="font-medium">
                          {nameByUserId.get(transfer.toUserId) ?? t("ui.unknown_user")}
                        </span>
                      </span>
                      <span className="money shrink-0 font-medium">
                        {formatMoney(transfer.amount, currency, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("ui.settlements")}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
