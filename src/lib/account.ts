import { prisma } from "@/lib/prisma";
import { deleteReceiptsUploadedBy } from "@/lib/receipts";
import { deleteCommentsWrittenBy } from "@/lib/comments";
import { deleteRemindersInvolving } from "@/lib/reminders";
import { deactivateRecurringFor } from "@/lib/recurring";
import { deleteObject } from "@/lib/storage";
import { NotFoundError } from "@/lib/errors";

/**
 * HESAP SILME.
 *
 * NEDEN VAR: App Store Guideline 5.1.1(v), hesap acilabilen her uygulamada
 * UYGULAMA ICI hesap silmeyi zorunlu kiliyor. ADR-031 bunu 24 Agustos'ta
 * karara baglamisti ama uygulanmamisti; eksiklik 28 Agustos'ta, Apple'in
 * 2.1 reddinde "account deletion flows"u kayitta gormek istemesiyle ortaya
 * cikti.
 *
 * SOFT DELETE, fiziksel silme DEGIL. Degistirilemez kural: finansal kayitlar
 * fiziksel olarak silinmez. Kullanicinin harcamalari ve odemeleri YERINDE
 * KALIYOR, cunku onlar BASKALARININ da kaydi - silinseydi grupta kalanlarin
 * bakiyeleri bozulurdu. Silinen sey KISISEL VERI.
 *
 * BORC ENGEL DEGIL (ADR-031). leaveGroup() bakiye kapali degilse ayrilmayi
 * reddediyor ve bu gruptan cikma icin dogru; ama hesap silmeyi borca
 * baglamak, kullaniciyi kendi verisinin icinde REHIN tutmak olurdu. Arayuz
 * acik bakiyeyi uyari olarak gosteriyor, sonra da siliyor.
 *
 * SAHIPLIK OTOMATIK DEVREDILIYOR. leaveGroup() yeni sahibi kullaniciya
 * SECTIRIYOR; hesap silmede bu olmaz - kullanici on grubun her biri icin ayri
 * ayri sahip secmek zorunda kalirdi. Burada en ESKI aktif uyeye gecuyor:
 * keyfi degil, gruptaki en uzun sureli kisi.
 */

/** Silinen hesabin adresi. Gercek adres serbest kaliyor: kisi yeniden uye olabilir. */
function anonymousEmail(userId: string): string {
  // .invalid HICBIR ZAMAN cozulmeyen ayrilmis bir ust seviye alan adi
  // (RFC 2606). Yani bu adrese kazara posta gitmesi mumkun degil.
  return `deleted+${userId}@deleted.invalid`;
}

/**
 * GORUNEN AD SABIT BIR METIN ve bu bilincli bir EKSIK.
 *
 * Dogrusu, API'nin bir "deleted" bayragi dondurup etiketi istemcinin
 * cevirmesi olurdu (ADR-017: kod donulur, metni okuyan taraf uretir).
 * Ama displayName cok yerde dogrudan basiliyor ve tek bir dar bogaz yok;
 * o degisiklik IKI istemcide birden DTO ve arayuz dokunusu demekti.
 *
 * Sonucu acikca yaziyorum: Ingilizce arayuz kullanan biri, eski grup
 * arkadasi hesabini sildiginde Turkce bir etiket gorur. Uyumla ilgisi yok,
 * cilayla ilgili - PROGRESS.md'de aday olarak duruyor.
 */
const DELETED_DISPLAY_NAME = "Silinmiş kullanıcı";

/**
 * Hesabi siler ve neyin degistigini dondurur.
 *
 * TEK TRANSACTION: uyeliklerin kapanmasi, sahiplik devri ve kisisel verinin
 * anonimlesmesi ya HEP BIRLIKTE olur ya hic. Yarim kalmis bir silme,
 * sahipsiz bir grup ya da adi silinmis ama hala uye gorunun bir kullanici
 * birakirdi.
 */
export async function deleteAccount(userId: string) {
  // Transaction'in DISINDA duruyor: commit'ten sonra depoya gidecek.
  let receiptKeys: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundError("user.not_found");
    }

    const memberships = await tx.groupMember.findMany({
      where: { userId, leftAt: null, group: { deletedAt: null } },
      select: { id: true, groupId: true, role: true },
    });

    const now = new Date();
    let archivedGroups = 0;
    let transferredGroups = 0;

    for (const membership of memberships) {
      const others = await tx.groupMember.findMany({
        where: { groupId: membership.groupId, leftAt: null, userId: { not: userId } },
        // EN ESKI aktif uye: sahiplik ona gecuyor.
        orderBy: { joinedAt: "asc" },
        select: { id: true },
      });

      if (others.length === 0) {
        // Gruptaki son kisi gidiyor; gruba artik kimse erisemez. Ortada
        // birakmak yerine arsivliyoruz - kayitlar duruyor, yalnizca grup
        // deletedAt ile isaretleniyor (leaveGroup ile ayni davranis).
        await tx.group.update({
          where: { id: membership.groupId },
          data: { deletedAt: now },
        });
        archivedGroups += 1;
      } else if (membership.role === "OWNER") {
        // Her grupta HER ZAMAN bir OWNER bulunmali.
        await tx.groupMember.update({
          where: { id: others[0].id },
          data: { role: "OWNER" },
        });
        transferredGroups += 1;
      }

      await tx.groupMember.update({
        where: { id: membership.id },
        data: { leftAt: now },
      });
    }

    /**
     * OTURUM ARTIFAKTLARI FIZIKSEL OLARAK SILINIYOR ve bu tutarsizlik degil:
     * bunlar finansal kayit degil, kimlik bilgisi. Kalirlarsa silinmis bir
     * hesabin belirteci calismaya, parolasi gecerli olmaya devam ederdi.
     *
     * Account satiri parola hash'ini tasiyor - onu birakmak, "hesabimi
     * sildim" diyen birinin parolasini saklamak demek olurdu.
     */
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.twoFactor.deleteMany({ where: { userId } });

    // Bildirimler de kisisel: kime ne oldugunu anlatiyorlar.
    await tx.notification.deleteMany({ where: { userId } });
    // Cihaz adresleri. Semada Cascade var ama silme YUMUSAK (User.deletedAt),
    // yani cascade tetiklenmiyor - burada elle silinmezse silinmis bir hesabin
    // telefonuna bildirim gitmeye devam ederdi.
    await tx.pushToken.deleteMany({ where: { userId } });

    /**
     * FIS FOTOGRAFLARI - ADR-046. Burada iki kural carpisiyor: finansal
     * kayit silinmez (fis, harcamanin kanidi) ve kisisel veri silinir
     * (fiste yuz, adres, kartin son hanesi olabilir). Kisisel veri tarafi
     * secildi, cunku gizlilik hikayesi tek cumleyle anlatilabilmeli:
     * "hesabini silersen yukledigin her sey gider."
     *
     * HARCAMANIN KENDISI DURUYOR: tutar, kim odedi, kim ne kadar borclu -
     * hepsi yerinde, BAKIYELER ETKILENMIYOR. Giden sey kaydin kendisi degil,
     * destekleyici gorseli.
     *
     * ANAHTARLAR DISARI TASINIYOR: depodan silme bir AG ISTEGI ve bu
     * transaction'in icinde durmamali - islem geri alinirsa nesneler coktan
     * gitmis olurdu, ustelik baglanti bosuna acik kalirdi. Cagiran,
     * commit'ten SONRA siliyor.
     */
    receiptKeys = await deleteReceiptsUploadedBy(tx, userId);

    /**
     * YORUMLAR - ADR-049, fis fotografiyla AYNI gerekce (ADR-046). Yorum
     * kullanicinin YAZDIGI serbest metin, yani kisisel veri; gizlilik
     * hikayesi tek cumleyle anlatilabilmeli: "hesabini silersen yukledigin
     * her sey gider."
     *
     * FIZIKSEL SILME, deletedAt DEGIL: yumusak silme metni veritabaninda
     * BIRAKIRDI ve giden sey tam da metnin kendisi.
     *
     * Harcamanin kendisi duruyor, bakiyeler etkilenmiyor - yorumun hicbir
     * hesaba girmedigi zaten tablonun varlik sebebi.
     */
    await deleteCommentsWrittenBy(tx, userId);

    /**
     * ODEME HATIRLATMALARI - ADR-050. Ayni aile: hatirlatma finansal kayit
     * degil, iki kisi arasindaki bir TEMAS kaydi. Iki yon de gidiyor
     * (gonderdikleri ve kendisine gonderilenler), yoksa silinmis bir hesabin
     * adi hala bir satirin ucunda dururdu.
     */
    await deleteRemindersInvolving(tx, userId);

    /**
     * TEKRARLAYAN HARCAMA SABLONLARI - ADR-051. Burada silinen sey KISISEL
     * VERI DEGIL, calisan bir TAKVIM: kullanicinin kurdugu, odedigi ya da
     * icinde oldugu her sablon durduruluyor.
     *
     * NEDEN ZATEN GEREKLI: hesap silinince uyelikler kapaniyor, yani o
     * sablonlar uretemez hale geliyor. Burada durdurmasaydik calistirici
     * onlari tek tek "katilimci ayrildi" diye duraklatir ve grupta kalan
     * kisilere sirayla bildirim gonderirdi - silinen hesabin ardindan gelen
     * bir bildirim yagmuru.
     *
     * YUMUSAK SILME, cunku fiziksel silme ZATEN IMKANSIZ: uretilmis
     * harcamalar sablona isaret ediyor (onDelete: Restrict). Gecmis
     * harcamalar duruyor, bakiyeler etkilenmiyor.
     */
    await deactivateRecurringFor(tx, userId);

    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail(userId),
        displayName: DELETED_DISPLAY_NAME,
        avatarUrl: null,
        hasImage: false,
        // Adres artik bize ait degil; "dogrulanmis" iddiasi da dusmeli.
        emailVerified: false,
        twoFactorEnabled: false,
        locale: null,
        deletedAt: now,
      },
    });

    return { archivedGroups, transferredGroups, leftGroups: memberships.length };
  });

  /**
   * COMMIT OLDU: kayitlar kesin gitti, simdi nesneler. EN IYI GAYRET -
   * silinemeyen bir nesne OKSUZ kaliyor (kimse goremez, faturasi odenir)
   * ama hesap silme BUNUN YUZUNDEN BASARISIZ OLMAMALI. Apple uygulama ici
   * hesap silmeyi zorunlu tutuyor (5.1.1(v)) ve bir depo hatasinin o kapiyi
   * kapatmasi kabul edilemez.
   */
  await Promise.all(
    receiptKeys.map((key) =>
      /**
       * BURADA DA YAKALANIYOR - deleteObject zaten kendi icinde yakaliyor
       * olsa bile. Ona guvenmek GORUNMEZ bir bagimlilik olurdu: storage.ts'te
       * bir gun o try/catch kalkarsa hesap silme sessizce kirilgan hale
       * gelirdi ve bunu ancak silmeye calisan kullanici fark ederdi.
       * Bir test bu dali bilerek zorluyor.
       */
      deleteObject(key).catch(() => false),
    ),
  );

  return result;
}
