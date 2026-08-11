import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { getExpenseForUser } from "@/lib/expenses";
import { AppError } from "@/lib/errors";
import { ExpenseForm } from "@/components/expense-form";
import { getTranslate } from "@/lib/i18n-server";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ groupId: string; expenseId: string }>;
}) {
  const { groupId, expenseId } = await params;
  const t = await getTranslate();

  const user = await getOrCreateCurrentUser();
  if (!user) {
    return null;
  }

  let group: Awaited<ReturnType<typeof getGroupForUser>>;
  let members: Awaited<ReturnType<typeof listGroupMembers>>;
  let expense: Awaited<ReturnType<typeof getExpenseForUser>>;
  try {
    [group, members, expense] = await Promise.all([
      getGroupForUser(user.id, groupId),
      listGroupMembers(user.id, groupId),
      getExpenseForUser(user.id, groupId, expenseId),
    ]);
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">{t("ui.edit_expense")}</h1>
      </div>

      <ExpenseForm
        groupId={groupId}
        currency={group.currency}
        currentUserId={user.id}
        members={members.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
        }))}
        initialValues={{
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          paidById: expense.paidById,
          category: expense.category,
          splitType: expense.splitType,
          expenseDate: expense.expenseDate.toISOString().slice(0, 10),
          participants: expense.participants.map((participant) => ({
            userId: participant.userId,
            shareAmount: participant.shareAmount,
          })),
        }}
      />
    </div>
  );
}
