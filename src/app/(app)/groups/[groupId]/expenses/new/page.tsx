import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { AppError } from "@/lib/errors";
import { ExpenseForm } from "@/components/expense-form";
import { getTranslate } from "@/lib/i18n-server";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const t = await getTranslate();

  const user = await getOrCreateCurrentUser();
  if (!user) {
    return null;
  }

  let group: Awaited<ReturnType<typeof getGroupForUser>>;
  let members: Awaited<ReturnType<typeof listGroupMembers>>;
  try {
    [group, members] = await Promise.all([
      getGroupForUser(user.id, groupId),
      listGroupMembers(user.id, groupId),
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
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {group.name}
        </Link>
        <h1 className="text-[1.0625rem] font-semibold">{t("ui.add_expense")}</h1>
      </div>

      <ExpenseForm
        groupId={groupId}
        currency={group.currency}
        currentUserId={user.id}
        members={members.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
        }))}
      />
    </div>
  );
}
