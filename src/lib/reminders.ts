import type { Prisma } from "@prisma/client";
import { getGroupBalances } from "@/lib/balances";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { REMINDER_COOLDOWN_HOURS } from "@/lib/reminder-schemas";

/**
 * ODEME HATIRLATMASI (ADR-050).
 *
 * NEDEN OTOMATIK DEGIL: bir hatirlatma SOSYAL bir eylemdir, teknik bir olay
 * degil. "Uc gun gecti, borclusun" diyen bir zamanlanmis is, grubun kendi
 * anlasmasini bilmeden kullanici adina karar verirdi - ailesiyle tatile
 * cikan biriyle yol arkadasi olan yabancilar ayni gruba benzemiyor. Ustelik
 * "sistem hatirlatti" cumlesinin muhatabi yok; "Ali hatirlatti" cevap
 * verilebilir bir cumle.
 *
 * HATIRLATMA FINANSAL KAYIT DEGIL: hicbir bakiyeye girmiyor. Yorum
 * (ADR-049) ve fis (ADR-046) ile ayni aile.
 */

export type ReminderView = {
  toUserId: string;
  amount: number;
  sentAt: Date;
};

function cooldownStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
}

/**
 * Cagiranin BU GRUPTA, soguma penceresi icinde gonderdigi hatirlatmalar.
 *
 * NEDEN SUNUCUDAN GELIYOR: istemci dugmeyi kapatacaksa "ne zamana kadar"
 * sorusunu cevaplamasi gerekiyor ve cevabi yalnizca sunucu biliyor. Istemci
 * kendi gonderdigini hatirlamaya calissaydi sayfa yenilendiginde ya da
 * ikinci bir cihazda dugme yeniden acilirdi - kullanici basar, sunucu
 * reddeder. Kapali bir dugme, dolduktan sonra reddedilen bir formdan iyidir.
 *
 * YALNIZCA CAGIRANIN GONDERDIKLERI. Baskasinin kime hatirlattigi bu ekranin
 * sorusu degil; donseydi grubun sosyal trafigi herkese acilirdi.
 */
export async function listRecentReminders(
  userId: string,
  groupId: string,
): Promise<ReminderView[]> {
  const rows = await prisma.paymentReminder.findMany({
    where: { groupId, fromUserId: userId, createdAt: { gte: cooldownStart() } },
    orderBy: { createdAt: "desc" },
    select: { toUserId: true, amount: true, createdAt: true },
  });

  /**
   * KISI BASINA EN YENISI. Pencere icinde ayni kisiye birden fazla satir
   * dusebilir (soguma suresi bir gun once kisaltilmis olabilir, ya da iki
   * istek yarismis olabilir); istemcinin sordugu sey "en son ne zaman".
   */
  const latest = new Map<string, ReminderView>();
  for (const row of rows) {
    if (!latest.has(row.toUserId)) {
      latest.set(row.toUserId, {
        toUserId: row.toUserId,
        amount: row.amount,
        sentAt: row.createdAt,
      });
    }
  }
  return [...latest.values()];
}

/**
 * Hatirlatmayi gonderir.
 *
 * KIME GONDERILEBILECEGINI SUNUCU BELIRLIYOR ve olcut ODESME PLANI: yalnizca
 * uygulamanin "bu kisi sana X odemeli" dedigi kisiye hatirlatilabiliyor.
 * "Negatif bakiyesi olan herkes" demek yetmezdi - sadelestirilmis planda
 * borclu paranin tamamini tek bir alacakliya odemiyor olabilir, ve olmayan
 * bir borc icin hatirlatma gondermek yanlis bilgi tasirdi.
 *
 * ALICININ AKTIF UYE OLMASI ARANMIYOR: gruptan ayrilmak borcu kapatmiyor ve
 * balances.ts bu kisileri bilerek listede tutuyor (yoksa para "kaybolmus"
 * gorunurdu). Ayrilmis birine borcunu hatirlatmak, ozelligin en cok ise
 * yaradigi durum.
 */
export async function sendPaymentReminder(
  userId: string,
  groupId: string,
  toUserId: string,
): Promise<ReminderView> {
  if (toUserId === userId) {
    throw new ValidationError("reminder.self");
  }

  /**
   * getGroupBalances GRUBU DA UYELIGI DE KENDISI KONTROL EDIYOR (bulunamayan
   * grup icin NotFoundError, uye olmayan icin ForbiddenError). Kontrolleri
   * burada TEKRARLAMIYORUZ: ikinci bir kopya, ilki degistiginde sessizce
   * ayrisir. Ayrica dondurdugu odesme plani zaten sayfada gorunenin aynisi -
   * yani hatirlatma, kullanicinin GORDUGU satirdan uretiliyor.
   */
  const { currency, suggestedTransfers } = await getGroupBalances(userId, groupId);

  const transfer = suggestedTransfers.find(
    (candidate) => candidate.fromUserId === toUserId && candidate.toUserId === userId,
  );
  if (!transfer) {
    throw new ValidationError("reminder.no_debt");
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });
  if (!group) {
    // getGroupBalances az once buldu; buraya ancak arada silinirse dusulur.
    throw new NotFoundError("group.not_found");
  }

  const reminder = await prisma.$transaction(async (tx) => {
    /**
     * SOGUMA KONTROLU TRANSACTION ICINDE. Disarida da yapilabilirdi ama o
     * zaman kontrol ile yazma arasindaki her sey yarisa acik olurdu. Icinde
     * de mutlak bir garanti degil - Postgres'in varsayilan yalitiminda
     * (read committed) es zamanli iki istek ayni bosluktan gecebilir; o
     * durumda kaybedilen sey BIR FAZLA BILDIRIM, para degil. Gercek koruma
     * katmani ustte: enforceWriteLimit her kullaniciyi zaten sinirliyor.
     */
    const recent = await tx.paymentReminder.findFirst({
      where: {
        groupId,
        fromUserId: userId,
        toUserId,
        createdAt: { gte: cooldownStart() },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent) {
      throw new ConflictError("reminder.too_soon", { hours: REMINDER_COOLDOWN_HOURS });
    }

    const created = await tx.paymentReminder.create({
      data: {
        groupId,
        fromUserId: userId,
        toUserId,
        amount: transfer.amount,
        currency,
      },
      select: { toUserId: true, amount: true, createdAt: true },
    });

    /**
     * TEK ALICI: hatirlatilan kisi. Gruptaki digerleri haber almiyor -
     * "Ali, Veli'ye borcunu hatirlatti" herkese giden bir bildirim olsaydi
     * ozellik bir dürtmeden bir TESHIRE donerdi.
     *
     * TUTAR PAYLOAD'A GIRIYOR (uygulama ici bildirim onu gosterebilsin diye),
     * ama PUSH'A GIRMIYOR - o ayrim push.ts'te ve butun turler icin gecerli
     * (ADR-047).
     */
    await createNotifications(tx, {
      type: "PAYMENT_REMINDED",
      actorId: userId,
      recipientIds: [toUserId],
      payload: {
        groupId,
        groupName: group.name,
        amount: transfer.amount,
        currency,
      },
    });

    return created;
  });

  return {
    toUserId: reminder.toUserId,
    amount: reminder.amount,
    sentAt: reminder.createdAt,
  };
}

/**
 * Hesap silmede cagriliyor (account.ts). Hatirlatmalar FIZIKSEL olarak
 * gidiyor - yorum (ADR-049) ve fis (ADR-046) ile ayni gerekce: bunlar
 * finansal kayit degil, kisiler arasindaki bir temas kaydi.
 *
 * IKI YON DE SILINIYOR: gonderdikleri ve kendisine gonderilenler. Yalnizca
 * biri silinseydi, silinmis bir hesabin adi hala bir hatirlatma satirinin
 * ucunda dururdu - ve "hesabini silersen yukledigin her sey gider" cumlesi
 * yarim kalirdi.
 *
 * SILINEN SEYIN BEDELI VAR ve acikca yaziliyor: karsi taraf icin soguma
 * penceresi sifirlanir, yani silinmis bir hesaba (ya da onun hatirlattigi
 * kisiye) 24 saat dolmadan yeniden hatirlatilabilir. Bu, kisisel verinin
 * kalmasindan iyi bir takas.
 */
export async function deleteRemindersInvolving(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const result = await tx.paymentReminder.deleteMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
  });
  return result.count;
}
