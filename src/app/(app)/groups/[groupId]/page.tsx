import Link from "next/link";
import { notFound } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
import { getGroupBalances } from "@/lib/balances";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { listExpenses } from "@/lib/expenses";
import { listSettlements } from "@/lib/settlements";
import { getGroupSummary } from "@/lib/summary";
import { AppError } from "@/lib/errors";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import type { Locale } from "@/lib/locale";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EditGroupDialog } from "@/components/edit-group-dialog";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { RecordSettlementDialog } from "@/components/record-settlement-dialog";
import { SectionHead } from "@/components/section-head";
import { PersonAvatar } from "@/components/person-avatar";
import { GroupSummary } from "@/components/group-summary";
import { Receipt, ReceiptLine } from "@/components/receipt";
import { ExpenseComposer } from "@/components/expense-composer";
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

/** Ekranda bir kisiyi gostermek icin gereken her sey. */
type Person = { displayName: string; avatarUrl: string | null; hasImage: boolean | null };

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
  personOf,
  currency,
  locale,
  fallbackName,
}: {
  title: string;
  transfers: SuggestedTransfer[];
  personOf: (transfer: SuggestedTransfer) => Person | undefined;
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
      <ul className="flex flex-col gap-1.5">
        {transfers.map((transfer) => {
          const person = personOf(transfer);
          const name = person?.displayName ?? fallbackName;
          return (
            <li
              key={`${transfer.fromUserId}-${transfer.toUserId}`}
              className="flex items-center gap-2"
            >
              <PersonAvatar
                displayName={name}
                avatarUrl={person?.avatarUrl}
                hasImage={person?.hasImage}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="money shrink-0 font-medium">
                {formatMoney(transfer.amount, currency, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { groupId } = await params;
  const { month: requestedMonth } = await searchParams;
  const t = await getTranslate();
  const locale = await getLocale();

  const user = await findCurrentUser();
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
  let summary: Awaited<ReturnType<typeof getGroupSummary>>;
  let openMonth: string | null;
  try {
    // getGroupSummary ve getGroupBalances ayni kisi-basi toplamlari istiyor;
    // ikisi de loadGroupTotals'i cagiriyor ve cache() sayesinde bu istekte
    // veritabanina TEK kez gidiliyor.
    [group, balanceData, members, settlementData, summary] = await Promise.all([
      getGroupForUser(user.id, groupId),
      getGroupBalances(user.id, groupId),
      listGroupMembers(user.id, groupId),
      listSettlements(user.id, groupId, { limit: 20 }),
      getGroupSummary(user.id, groupId),
    ]);

    // HARCAMALAR AYRI VE SONRA CEKILIYOR (Faz 16.2), cunku hangi ayin
    // cekilecegini ozet soyluyor: byMonth azalan sirali, ilki en yeni ay.
    //
    // Bedeli bir ek gidis-donus. Alternatifi, filtresiz ilk 20 kaydi cekip
    // istemcide aya bolmekti - ama o zaman "daha fazla yukle" acik ayin
    // sinirini asip bir onceki ayin satirlarini acik ayin altina eklerdi.
    // Sayfalamanin dogru calismasi icin pencerenin SORGUDA olmasi gerekiyor.
    // Istenen ay YALNIZCA gercekten harcamasi olan bir ayssa aciliyor.
    // Dogrudan dogrulamadan kullansaydik "?month=oyle-boyle" bos bir fis
    // uretirdi; ozette olmayan bir ay zaten gosterilecek hicbir sey tasimaz.
    const knownMonth = summary.byMonth.some((slice) => slice.month === requestedMonth);
    openMonth = (knownMonth ? requestedMonth : summary.byMonth[0]?.month) ?? null;
    expenseData = await listExpenses(user.id, groupId, {
      limit: 20,
      ...(openMonth ? { month: openMonth } : {}),
    });
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }

  const { currency, balances, suggestedTransfers } = balanceData;
  const roleByUserId = new Map(members.map((member) => [member.userId, member.role]));
  const nameByUserId = new Map(balances.map((balance) => [balance.userId, balance.displayName]));
  const personByUserId = new Map<string, Person>(
    balances.map((balance) => [
      balance.userId,
      {
        displayName: balance.displayName,
        avatarUrl: balance.avatarUrl,
        hasImage: balance.hasImage,
      },
    ]),
  );

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

  // Fisin ustundeki kisi satiri. Isimler bir cumle degil, basili bir liste -
  // o yuzden araya nokta konuyor, virgul degil.
  const memberNames = balances.map((balance) => balance.displayName).join(" · ");

  const hasSuggestions = suggestedTransfers.length > 0;

  // BOS GRUP (Faz 16.5): harcamasi olmayan bir grupta bakiye blogu, hesabin
  // nasil kapanacagi ve toplamlar HIC CIZILMIYOR. Ucu de sifir gosterirdi ve
  // sifirlarla dolu bir fis, olmayan bir gecmisi varmis gibi anlatir.
  // Ustelik "Odestin" damgasi orada yanlis: odesecek bir sey hic olmadi.
  const isEmpty = summary.expenseCount === 0;

  return (
    <>
      {/* Tezgah. Fisin bir NESNE gibi durabilmesi icin altinda ondan koyu bir
          yuzey gerekiyor; sayfanin zemini bunu tek basina veremiyordu.
          fixed + -z-10: yalnizca bu rotada, govdenin arkasinda ve yapiskan
          basligin (z-30) altinda. Baska sayfalarin zeminine dokunmuyor. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-surface" />

      <div className="mx-auto mb-3 flex w-full max-w-[36.25rem] items-center justify-between gap-3">
        <Link
          href="/groups"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("ui.back_to_groups")}
        </Link>
        {/* Eylemler fisin DISINDA. Kagidin uzerine buton koymak, basili bir
            belgeye tiklanabilir bir sey eklemek gibi durur; ustelik fis
            okunacak, butonlar kullanilacak - iki ayri is. */}
        <div className="flex shrink-0 items-center gap-2">
          {group.role === "OWNER" ? (
            <EditGroupDialog
              groupId={groupId}
              initialName={group.name}
              initialDescription={group.description}
            />
          ) : null}
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

      <Receipt>
        {/* Fis basligi: grup adi basili bir baslik gibi, harf araligi acik. */}
        <div className="flex flex-col items-center gap-2 text-center">
          {/* Duzenle dugmesi basligin YANINDA DEGIL. Harf araligi acik basili
              bir baslgin yanina buton koymak dengeyi bozuyordu (ekran
              goruntusunde goruldu); eylemler zaten kagidin disinda. */}
          <h1 className="pl-[0.34em] font-mono text-[1.0625rem] font-semibold tracking-[0.34em] uppercase">
            {group.name}
          </h1>
          <p className="cap">{memberNames}</p>
          {group.description ? (
            <p className="text-xs text-muted-foreground">{group.description}</p>
          ) : null}
        </div>

        {/* BAKIYE FISIN USTUNDE, ALTINDA DEGIL.
            Gercek bir fiste toplam en altta durur ve tasarim onerisi de
            oyleydi. Uygulamada boyle yapilmadi: 40 harcamali bir grupta
            bakiye ekranin cok altina duserdi ve ADR-016'nin "sayfa bakiyeye
            gore kurulur" kurali fiilen bozulurdu. Hesap ozetleri de ayni
            sebeple bakiyeyi basa koyar. Fis dili korunuyor (cift cizgi,
            mono etiket), sirasi degil. */}
        {!isEmpty ? (
        <div className="flex flex-col gap-2 border-t border-dashed border-border pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="cap text-foreground">{t("ui.your_status")}</span>
            <p className={`money text-figure font-medium ${balanceToneClass(myAmount)}`}>
              {myAmount === 0
                ? formatMoney(0, currency, locale)
                : formatSignedMoney(myAmount, currency, locale)}
            </p>
          </div>
          {/* Odesmis durumda cumle yerine DAMGA. Metin ayni ("Odestin"),
              yalnizca bir kez ekranda - iki E2E testi onu ariyor. */}
          <div className="flex justify-end">
            {myAmount === 0 && !hasSuggestions ? (
              <span className="rounded-[4px] border-2 border-credit px-4 py-1.5 pl-[calc(1rem+0.22em)] font-mono text-sm font-semibold tracking-[0.22em] text-credit uppercase opacity-90 [transform:rotate(-4deg)]">
                {t("ui.settled_up")}
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                {myAmount > 0
                  ? t("ui.owed_to_you")
                  : myAmount < 0
                    ? t("ui.you_owe")
                    : t("ui.settled_up")}
              </p>
            )}
          </div>
        </div>
        ) : null}

        {/* Hesabin nasil kapanacagi. Fiil BASLIKTA, satirda degil - Turkce'de
            "{isim}'e ode" yer tutucuyla dogru yazilamiyor (ek son harfe gore
            degisiyor). Bu kural SuggestionGroup'tan beri gecerli. */}
        {!isEmpty && hasSuggestions ? (
          <div className="flex flex-col gap-4 rounded-[3px] border border-border bg-panel px-4 py-3.5">
            <span className="cap text-foreground">{t("ui.settle_plan")}</span>
            <SuggestionGroup
              title={t("ui.you_should_pay")}
              transfers={iPay}
              personOf={(transfer) => personByUserId.get(transfer.toUserId)}
              currency={currency}
              locale={locale}
              fallbackName={t("ui.unknown_user")}
            />
            <SuggestionGroup
              title={t("ui.will_be_paid_to_you")}
              transfers={iReceive}
              personOf={(transfer) => personByUserId.get(transfer.fromUserId)}
              currency={currency}
              locale={locale}
              fallbackName={t("ui.unknown_user")}
            />
            {/* Beni ilgilendirmeyen transferler. Ayni blokta ama en altta ve
                soluk: grubun takas plani dogru bir bilgi, ama benim isim
                degil. */}
            {otherTransfers.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="label">{t("ui.other_suggested_payments")}</p>
                <ul className="flex flex-col gap-1.5">
                  {otherTransfers.map((transfer) => (
                    <li
                      key={`${transfer.fromUserId}-${transfer.toUserId}`}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {nameByUserId.get(transfer.fromUserId) ?? t("ui.unknown_user")}
                        {" → "}
                        {nameByUserId.get(transfer.toUserId) ?? t("ui.unknown_user")}
                      </span>
                      <span className="money shrink-0">
                        {formatMoney(transfer.amount, currency, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : !isEmpty ? (
          <p className="text-sm text-muted-foreground">{t("ui.everyone_settled")}</p>
        ) : null}

        {/* Harcamalar: fisin govdesi. Ay basliklari artik perfore cizgi. */}
        <ExpenseList
          groupId={groupId}
          currency={currency}
          currentUserId={user.id}
          nameByUserId={Object.fromEntries(nameByUserId)}
          monthTotals={summary.byMonth}
          openMonth={openMonth}
          initialNextCursor={expenseData.nextCursor}
          initialExpenses={expenseData.expenses.map((expense) => ({
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            expenseDate: expense.expenseDate.toISOString(),
            paidById: expense.paidById,
            createdById: expense.createdById,
            participants: expense.participants.map((participant) => ({
              userId: participant.userId,
              shareAmount: participant.shareAmount,
            })),
            version: expense.version,
          }))}
        />

        {/* Fisin kapanisi: cift cizgi ve toplamlar. Bu ucu zaten hesaplaniyor
            (summary), yeni bir sorgu yok. */}
        {!isEmpty ? (
        <div className="flex flex-col gap-2 border-t-[3px] border-double border-foreground pt-4">
          <ReceiptLine muted amount={formatMoney(summary.totalAmount, currency, locale)}>
            <span className="cap">{t("ui.summary_total")}</span>
          </ReceiptLine>
          <ReceiptLine muted amount={formatMoney(summary.myShare, currency, locale)}>
            <span className="cap">{t("ui.summary_your_share")}</span>
          </ReceiptLine>
          <ReceiptLine muted amount={formatMoney(summary.myPaid, currency, locale)}>
            <span className="cap">{t("ui.summary_you_paid")}</span>
          </ReceiptLine>
        </div>
        ) : null}

        {/* Fisin bir sonraki satiri. Toplamlardan SONRA duruyor: fis once
            kendini kapatiyor, sonra "bir satir daha?" diye soruyor. */}
        <ExpenseComposer
          groupId={groupId}
          memberIds={members.map((member) => member.userId)}
          currentUserId={user.id}
        />

        <div className="money flex justify-between text-[0.625rem] tracking-[0.08em] text-muted-foreground">
          <span>{group.currency}</span>
          <span>{t("ui.app_name")}</span>
        </div>
      </Receipt>

      {/* KAGIDIN ALTI - referans bolgesi.
          Uyeler, odemeler ve dagilim gunluk akisin parcasi degil; fisin
          disinda, tezgahin uzerinde duruyorlar. */}
      <div className="mx-auto mt-10 flex w-full max-w-[36.25rem] flex-col gap-8">
        <GroupSummary summary={summary} currency={currency} />

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
                  <PersonAvatar
                    displayName={balance.displayName}
                    avatarUrl={balance.avatarUrl}
                    hasImage={balance.hasImage}
                  />
                  <span className="truncate">{balance.displayName}</span>
                  {roleByUserId.get(balance.userId) === "OWNER" ? (
                    <Badge variant="secondary">{t("ui.role_owner")}</Badge>
                  ) : null}
                  {balance.hasLeft ? <Badge variant="outline">{t("ui.member_left")}</Badge> : null}
                </div>
                <span className={`money shrink-0 font-medium ${balanceToneClass(balance.amount)}`}>
                  {balance.amount === 0 ? "—" : formatSignedMoney(balance.amount, currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>

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
    </>
  );
}
