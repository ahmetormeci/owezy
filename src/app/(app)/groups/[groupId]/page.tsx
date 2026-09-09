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
      <p className="cap">{title}</p>
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

      {/*
        BASLIK BLOGU FISIN DISINDA. Grup adi bir sure fisin icinde, mono ve
        harf araligi acik bir "magaza adi" olarak duruyordu; mobil yeni yonde
        onu disari cikardi (serif ad + bakir para birimi + uye bas harfleri)
        ve iki istemcinin ayni sayfayi iki turlu gostermesi icin sebep yok.

        Duzenle dugmesi hala basligin YANINDA DEGIL: eylemler kagidin disinda
        ve zaten ustteki eylem satirinda.
      */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="font-heading truncate text-2xl">{group.name}</h1>
          <span className="cap shrink-0">{currency}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center">
          {balances.slice(0, 4).map((balance, index) => (
            <div key={balance.userId} className={index === 0 ? undefined : "-ml-2"}>
              <PersonAvatar
                displayName={balance.displayName}
                avatarUrl={balance.avatarUrl}
                hasImage={balance.hasImage}
                size="lg"
                me={balance.userId === user.id}
                className="ring-2 ring-background"
              />
            </div>
          ))}
          {balances.length > 4 ? (
            <span className="-ml-2 grid size-8 place-items-center rounded-full border border-input-line bg-background text-[10px] text-muted-foreground">
              {`+${balances.length - 4}`}
            </span>
          ) : null}
        </div>
      </div>
      {group.description ? (
        <p className="mb-5 -mt-3 text-xs text-muted-foreground">{group.description}</p>
      ) : null}

      {/*
        BAKIYE KARTI FISIN DISINDA VE KOYU.

        Bakiye bir sure fisin ICINDE, kesikli bir cizginin altinda
        duruyordu. Yeni yonde ekranin tek koyu yuzeyi bu kart ve fisin
        disinda - mobil de oyle. Sira degismedi: bakiye hala fisin USTUNDE,
        cunku 40 harcamali bir grupta altta olsaydi ekranin disina duserdi
        (ADR-016).

        UC RENK DE TEMAYA GORE DEGISMIYOR: kart iki temada da koyu petrol.
      */}
      {!isEmpty ? (
        <div className="mb-5 overflow-hidden rounded-[4px] bg-balance-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="cap text-on-balance-card">
                {myAmount === 0
                  ? t("ui.settled_up")
                  : myAmount > 0
                    ? t("ui.owed_to_you")
                    : t("ui.you_owe")}
              </span>
              <p className="money mt-2 text-[2.875rem] leading-none tracking-[-0.04em] text-on-balance-card-figure">
                {myAmount === 0
                  ? formatMoney(0, currency, locale)
                  : formatSignedMoney(myAmount, currency, locale)}
              </p>
            </div>
            {/* Muhur: kac odemeyle kapandigini soyluyor. Odesmis halde metin
                "Odestin" - iki E2E testi tam o kelimeyi ariyor ve ekranda
                BIR KEZ gorunmeli. */}
            {hasSuggestions ? (
              <span className="cap shrink-0 rounded-[2px] border border-copper px-2 py-1 text-on-balance-card [transform:rotate(-4deg)]">
                {t(
                  suggestedTransfers.length === 1
                    ? "ui.settle_count_one"
                    : "ui.settle_count_other",
                  { count: suggestedTransfers.length },
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <Receipt>

        {/* Hesabin nasil kapanacagi. Fiil BASLIKTA, satirda degil - Turkce'de
            "{isim}'e ode" yer tutucuyla dogru yazilamiyor (ek son harfe gore
            degisiyor). Bu kural SuggestionGroup'tan beri gecerli. */}
        {!isEmpty && hasSuggestions ? (
          /* KUTU KALKTI: bolum artik bakir bir cizgiyle basliyor, sayfanin
             geri kalanindaki her bolum gibi (ADR-021 "kutu yerine cizgi").
             Panel zemini, kagidin uzerinde ikinci bir yuzey demekti. */
          <div className="flex flex-col gap-4">
            <SectionHead title={t("ui.settle_plan")} />
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
                <p className="cap">{t("ui.other_suggested_payments")}</p>
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
                    me={balance.userId === user.id}
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
