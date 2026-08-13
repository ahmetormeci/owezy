import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupMembers } from "@/lib/groups";
import { listExpensesForExport } from "@/lib/expenses";
import { listExpensesQuerySchema } from "@/lib/expense-schemas";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { formatMoneyForInput } from "@/lib/money";
import { CSV_BOM, toCsv } from "@/lib/csv";
import { getLocale, getTranslate } from "@/lib/i18n-server";
import { handleApiError } from "@/lib/api";

/**
 * Dosya adi. Turkce harfler ve bosluklar indirme adinda sorun cikardigi icin
 * iki bicim birden gonderiyoruz: ASCII yedek ve gercek ad (RFC 5987).
 * Eski tarayici yedegi alir, digerleri dogru adi.
 */
function contentDisposition(groupName: string, today: string): string {
  const full = `${groupName} - ${today}.csv`;
  const ascii = full.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(full)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Listeyle AYNI sema. Disa aktarma ekrandaki filtreyi izliyor: suzulmus
    // bir liste dururken butun grubu indirmek kullaniciyi sasirtirdi.
    // limit/cursor gonderilse bile listExpensesForExport onlari almiyor -
    // eslesen her kayit iniyor, ekrandaki 20 degil.
    const query = listExpensesQuerySchema.parse({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      mine: searchParams.get("mine") ?? undefined,
    });

    const t = await getTranslate();
    const locale = await getLocale();

    const [group, members, expenses] = await Promise.all([
      getGroupForUser(user.id, groupId),
      listGroupMembers(user.id, groupId),
      listExpensesForExport(user.id, groupId, query),
    ]);

    const nameByUserId = new Map(members.map((member) => [member.userId, member.displayName]));

    // Para birimi BASLIKTA, hucrede degil: "120,50 TL" yazan bir hucreyi Excel
    // sayi degil metin okur ve toplama alinamaz.
    const header = [
      t("ui.date"),
      t("ui.description"),
      t("ui.category"),
      t("ui.csv_paid_by"),
      t("ui.csv_amount", { currency: group.currency }),
      t("ui.csv_your_share", { currency: group.currency }),
    ];

    const rows = expenses.map((expense) => {
      const myShare = expense.participants.find(
        (participant) => participant.userId === user.id,
      );

      return [
        // ISO tarih: hem belirsizlik yok (13/08 mi 08/13 mi) hem de metin
        // olarak siralandiginda kronolojik kaliyor.
        expense.expenseDate.toISOString().slice(0, 10),
        expense.description,
        t(EXPENSE_CATEGORY_CODES[expense.category]),
        nameByUserId.get(expense.paidById) ?? t("ui.unknown_user"),
        formatMoneyForInput(expense.amount, locale),
        // Katilimci degilsem bos: "0,00" yazmak paya girdigimi ve sifir
        // odedigimi soylerdi.
        myShare ? formatMoneyForInput(myShare.shareAmount, locale) : "",
      ];
    });

    const body = CSV_BOM + toCsv([header, ...rows], locale);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDisposition(group.name, today),
        // Filtreye gore degisen bir dosya; ara katmanlar onbelleklemesin.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
