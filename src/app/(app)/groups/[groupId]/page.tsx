import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupBalances } from "@/lib/balances";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { listExpenses } from "@/lib/expenses";
import { listSettlements } from "@/lib/settlements";
import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { RecordSettlementDialog } from "@/components/record-settlement-dialog";

function balanceToneClass(amount: number) {
  if (amount > 0) return "text-emerald-600 dark:text-emerald-400";
  if (amount < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/groups" className="text-sm text-muted-foreground hover:underline">
          ← Gruplarim
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{group.name}</h1>
            {group.description ? (
              <p className="text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
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
            <Button render={<Link href={`/groups/${groupId}/expenses/new`} />}>
              Harcama ekle
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Senin durumun</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-semibold ${balanceToneClass(myAmount)}`}>
            {myAmount === 0 ? "Odestin" : formatMoney(Math.abs(myAmount), currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {myAmount > 0
              ? "Bu tutar sana borclu"
              : myAmount < 0
                ? "Bu tutari borclusun"
                : "Bu grupta acik hesabin yok"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onerilen odemeler</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestedTransfers.length === 0 ? (
            <p className="text-muted-foreground">
              Herkes odesmis durumda, yapilacak bir odeme yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {suggestedTransfers.map((transfer) => (
                <li
                  key={`${transfer.fromUserId}-${transfer.toUserId}`}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {nameByUserId.get(transfer.fromUserId) ?? "Bilinmeyen"}
                    </span>
                    {" → "}
                    <span className="font-medium">
                      {nameByUserId.get(transfer.toUserId) ?? "Bilinmeyen"}
                    </span>
                  </span>
                  <span className="font-medium">{formatMoney(transfer.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Uyeler ve bakiyeler</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/groups/${groupId}/members`}>Uyeleri yonet</Link>}
          />
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
                    <Badge variant="secondary">Sahip</Badge>
                  ) : null}
                  {balance.hasLeft ? <Badge variant="outline">Ayrildi</Badge> : null}
                </div>
                <span className={`shrink-0 font-medium ${balanceToneClass(balance.amount)}`}>
                  {balance.amount === 0 ? "—" : formatMoney(balance.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Harcamalar</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Kaydedilen odemeler</CardTitle>
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
  );
}
