import Link from "next/link";
import { notFound } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
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

  const user = await findCurrentUser();
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
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {group.name}
        </Link>
        <h1 className="font-heading text-2xl">{t("ui.edit_expense")}</h1>
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
            basisPoints: participant.basisPoints,
          })),
          // Kalemler (ADR-052). Sira ve sekil SERVISTEN geliyor: uc zaten
          // "userIds" donduruyor ve sirayi position'a gore veriyor.
          // Buradaki duzlestirme kaldirildi - iki istemcinin ayni veriyi
          // ayri ayri duzlestirmesi, birinin unutulmasi demekti.
          items: expense.items,
          // Sayfa sunucuda render edildigi icin bu, formun acildigi ANDAKI
          // surum. Kaydederken geri gidiyor; arada baskasi yazdiysa 409
          // doner (ADR-032).
          version: expense.version,
        }}
      />

      {/* FIS FOTOGRAFI - YALNIZCA GORUNTULEME.
          Yukleme web'de YOK ve bu bilincli bir kapsam karari: fis, odeme
          aninda telefonla cekilen bir sey. Web'de eklemek ayrica tarayicida
          kucultme demekti (Vercel'in govde siniri 4.5MB, telefon fotografi
          3-8MB) ve bu surumu sisirirdi.

          GORSEL KENDI UCUMUZDAN: depoya herkese acik bir adres verilmedi -
          fiste isim, adres, kartin son hanesi olabilir ve o adresi eline
          gecirenin yetkisi bir daha kontrol edilmezdi. Buradaki istek
          cerezi tasiyor, uc de her seferinde grup uyeligini soruyor.
          Yan fayda: ayni kaynak oldugu icin CSP'deki "img-src 'self'"
          oldugu gibi kaliyor. */}
      {expense.receipt ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("ui.receipt")}
          </h2>
          {/* next/image DEGIL: o bileseni optimize edici, kaynagi kendi
              sunucusundan CEKIP yeniden boyutluyor ve bunun icin adresi
              yetkisiz istemesi gerekirdi. Fis yetkiye bagli. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/v1/groups/${groupId}/expenses/${expenseId}/receipt`}
            alt={t("ui.receipt")}
            className="max-h-[32rem] w-full rounded-xs border border-border bg-surface object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
