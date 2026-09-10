import type { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertActiveMemberOfGroup } from "@/lib/group-access";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { MAX_COMMENTS_PER_EXPENSE } from "@/lib/comment-schemas";

/**
 * Harcamaya yazilan yorumlar (ADR-049).
 *
 * YORUM FINANSAL KAYIT DEGIL. Hicbir bakiyeye girmiyor, hicbir hesaplamayi
 * degistirmiyor - bu yuzden "finansal kayitlar fiziksel olarak silinmez"
 * kurali burayi baglamiyor ve silme kurallari ayri dusunuldu.
 */

export type CommentView = {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    hasImage: boolean;
  };
};

/**
 * Harcamayi bulur ve OKUMA yetkisini dogrular.
 *
 * SILINMIS HARCAMA DA OKUNABILIYOR - fis fotografiyla ayni gerekce
 * (receipts.ts): silme geri alinabilir ve "silinenleri goster" acikken satir
 * ekranda duruyor. Yorumlari gizlemek, geri almadan once neyin konusuldugunu
 * gormeyi engellerdi.
 */
async function expenseForRead(expenseId: string, userId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      groupId: true,
      deletedAt: true,
      description: true,
      group: { select: { name: true } },
    },
  });
  if (!expense) {
    throw new NotFoundError("expense.not_found");
  }
  await assertActiveMemberOfGroup(expense.groupId, userId);
  return expense;
}

export async function listComments(
  userId: string,
  expenseId: string,
): Promise<{ comments: CommentView[]; truncated: boolean }> {
  await expenseForRead(expenseId, userId);

  /**
   * SAYFALAMA YOK, sinir + "kirpildi" bayragi var (ADR-049). Bir harcamanin
   * yorumlari bir sohbet degil birkac not; sayfalama, olmayan bir sorunun
   * cozumu olurdu. Sinira dayanan olursa istemci bunu SOYLEYEBILIYOR -
   * sessizce kirpmak, eksik veriyi tam gibi gostermek olurdu.
   *
   * Bir fazla cekiliyor: sinira dayanildigini anlamanin tek yolu bu.
   */
  const rows = await prisma.expenseComment.findMany({
    where: { expenseId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: MAX_COMMENTS_PER_EXPENSE + 1,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: {
        select: { id: true, displayName: true, avatarUrl: true, hasImage: true },
      },
    },
  });

  const truncated = rows.length > MAX_COMMENTS_PER_EXPENSE;

  return {
    truncated,
    comments: rows.slice(0, MAX_COMMENTS_PER_EXPENSE).map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      author: {
        userId: row.user.id,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarUrl,
        hasImage: row.user.hasImage ?? false,
      },
    })),
  };
}

/**
 * Yorumu yazar.
 *
 * YETKI: grubun AKTIF UYESI olmak yeterli - harcamayi zaten herkes goruyor,
 * yorum da grubun ortak kaydinin parcasi. Harcamayi DEGISTIRME yetkisi
 * (yalnizca olusturan) burada aranmiyor; aransaydi yorum ozelligi tek kisilik
 * bir not defteri olurdu.
 *
 * SILINMIS HARCAMAYA YAZILAMAZ: okumak anlamli, yazmak degil.
 */
export async function createComment(
  userId: string,
  expenseId: string,
  body: string,
): Promise<CommentView> {
  const expense = await expenseForRead(expenseId, userId);
  if (expense.deletedAt) {
    throw new ValidationError("comment.expense_deleted");
  }

  const comment = await prisma.$transaction(async (tx) => {
    /**
     * ALICILAR YORUM YAZILMADAN ONCE HESAPLANIYOR ve bu onemli: sonra
     * hesaplansaydi "daha once yorum yapanlar" listesine YAZAN KISI de
     * girerdi. createNotifications islemi yapani zaten eliyor, yani sonuc
     * degismezdi - ama liste yanlis olurdu ve yarin baska bir kural
     * eklendiginde sessizce bozulurdu.
     */
    const recipientIds = await commentRecipients(tx, expenseId);

    const created = await tx.expenseComment.create({
      data: { expenseId, userId, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: {
          select: { id: true, displayName: true, avatarUrl: true, hasImage: true },
        },
      },
    });

    /**
     * Push'u createNotifications kendisi PLANLIYOR (schedulePush), gonderim
     * cevap gittikten sonra oluyor. Yorumun METNI o mesaja hic girmiyor:
     * push yalnizca grup adini ve olayin turunu tasiyor (ADR-047). Serbest
     * metnin kilit ekraninda ne yazacagini kimse onceden bilemez.
     */
    await createNotifications(tx, {
      type: "EXPENSE_COMMENTED",
      actorId: userId,
      recipientIds,
      payload: {
        groupId: expense.groupId,
        groupName: expense.group.name,
        expenseId,
        description: expense.description,
      },
    });

    return created;
  });

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: {
      userId: comment.user.id,
      displayName: comment.user.displayName,
      avatarUrl: comment.user.avatarUrl,
      hasImage: comment.user.hasImage ?? false,
    },
  };
}

/**
 * Kim haber alir?
 *
 * Harcama bildirimlerinde kural "yalnizca katilimcilar" ve gerekcesi
 * BAKIYESI DEGISENLER (expenses.ts). Yorumda kimsenin bakiyesi degismiyor,
 * yani o gerekce burada yok - yerine "bu harcamayla ilgisi olanlar" geciyor:
 *
 *   katilimcilar + odeyen + olusturan + DAHA ONCE YORUM YAPANLAR
 *
 * Son grup onemli: sohbete girmis birinin cevabi gormemesi, ozelligi
 * yarim birakirdi. Kendi islemi icin kimseye bildirim gitmiyor -
 * createNotifications actorId'yi zaten eliyor.
 */
async function commentRecipients(
  tx: Prisma.TransactionClient,
  expenseId: string,
): Promise<string[]> {
  const expense = await tx.expense.findUniqueOrThrow({
    where: { id: expenseId },
    select: {
      paidById: true,
      createdById: true,
      participants: { select: { userId: true } },
    },
  });

  const commenters = await tx.expenseComment.findMany({
    where: { expenseId, deletedAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });

  return [
    expense.paidById,
    expense.createdById,
    ...expense.participants.map((participant) => participant.userId),
    ...commenters.map((commenter) => commenter.userId),
  ];
}

/**
 * Yorumu siler.
 *
 * YETKI: YALNIZCA YAZAN. Grup sahibine moderasyon yetkisi VERILMEDI -
 * bugun boyle bir talep yok ve baskasinin sozunu silebilmek, ozelligin
 * sessizce baska bir seye donusmesi olurdu (ADR-049).
 *
 * DUZENLEME YOK: kisa bir yorumu duzeltmenin yolu silip yeniden yazmak.
 * Duzenleme, "ne zaman degisti" sorusunu ve bir gecmis kaydini beraberinde
 * getirirdi.
 */
export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const comment = await prisma.expenseComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      deletedAt: true,
      expense: { select: { groupId: true } },
    },
  });
  if (!comment || comment.deletedAt) {
    throw new NotFoundError("comment.not_found");
  }

  // Once uyelik: gruptan ayrilmis biri kendi yorumunu da silemesin.
  await assertActiveMemberOfGroup(comment.expense.groupId, userId);

  if (comment.userId !== userId) {
    throw new ForbiddenError("comment.author_only");
  }

  await prisma.expenseComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Hesap silmede cagriliyor (account.ts). Yorumlar FIZIKSEL olarak gidiyor -
 * fis fotograflariyla ayni gerekce (ADR-046): kullanicinin YAZDIGI serbest
 * metin kisisel veridir ve gizlilik hikayesi tek cumleyle anlatilabilmeli
 * ("hesabini silersen yukledigin her sey gider").
 *
 * Harcamanin kendisi duruyor, bakiyeler etkilenmiyor.
 */
export async function deleteCommentsWrittenBy(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const result = await tx.expenseComment.deleteMany({ where: { userId } });
  return result.count;
}
