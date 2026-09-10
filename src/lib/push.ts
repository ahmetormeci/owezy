import type { NotificationType } from "@prisma/client";
import { after } from "next/server";
import { normalizeLocale, type Locale } from "@/lib/locale";
import { translate, type MessageCode } from "@/lib/messages";
import { prisma } from "@/lib/prisma";

/**
 * Telefona push bildirimi.
 *
 * NE GONDERILIYOR - VE NE GONDERILMIYOR: baslikta GRUP ADI, govdede OLAYIN
 * TURU. Kisi adi ve TUTAR YOK. Uygulama icindeki cumle ikisini de tasiyor
 * ("Ali 120,50 TL'lik Market harcamasi ekledi") ama o cumle push'a konsaydi
 * ayni bilgi hem Expo'nun sunucularindan gecer hem de telefon KILITLIYKEN
 * yanindaki herkese gorunurdu. Bu bir para uygulamasi.
 *
 * NEDEN EXPO'NUN SERVISI, DOGRUDAN APNs DEGIL: APNs HTTP/2 istiyor ve
 * Node'un fetch'i (undici) HTTP/2 konusmuyor; ayrica her istekte ES256 ile
 * JWT imzalamak ve baglantiyi havuzlamak gerekiyordu - Vercel'in istek basina
 * yasayan islevlerinde havuzlanacak bir sey yok. Expo'nun ucu duz bir HTTPS
 * POST ve Expo zaten bu uygulamayi paketleyen arac.
 */

/**
 * GONDERIM CEVABI BEKLENMEDEN once dikkat: bu modul ASLA transaction icinden
 * cagrilmamali. Bildirim satirlari harcamayla AYNI transaction'da yaziliyor
 * (notifications.ts) cunku ikisi ya birlikte olmali ya hic. Push ise geri
 * alinamaz: transaction sonradan geri alinirsa insanlara HIC OLMAMIS bir
 * harcamanin bildirimi gitmis olur. Ustelik ag istegi, veritabani
 * baglantisini bosuna acik tutar.
 */
const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Expo tek istekte en fazla 100 mesaj aliyor. */
const BATCH_SIZE = 100;

/**
 * Push govdeleri. "ui.notif_*" ile ayni olay, farkli cumle: bunlarda {actor}
 * YOK. Ayri anahtar olmasi bilincli - tek anahtari paylassalardi biri
 * digerini bozmadan degistirilemezdi.
 */
const BODY_CODES: Record<NotificationType, MessageCode> = {
  EXPENSE_ADDED: "push.expense_added",
  EXPENSE_UPDATED: "push.expense_updated",
  EXPENSE_DELETED: "push.expense_deleted",
  SETTLEMENT_RECORDED: "push.settlement_recorded",
  SETTLEMENT_CANCELLED: "push.settlement_cancelled",
  MEMBER_JOINED: "push.member_joined",
  /**
   * YORUMUN METNI YOK, olmasi da dusunulmedi: push'a giren her sey kilit
   * ekraninda duruyor ve serbest metnin ne yazacagini kimse onceden bilemez
   * (ADR-047 + ADR-049). Kisi adi da yok - o kural zaten butun turler icin
   * gecerli.
   */
  EXPENSE_COMMENTED: "push.expense_commented",
  /**
   * TUTAR YOK - ve burada kural en cok ise yariyor: hatirlatmanin TAMAMI bir
   * tutar hakkinda, yani metne konsaydi kilit ekraninda "sana 1.250 TL
   * borcun var" yazardi (ADR-047 + ADR-050). Kim hatirlatti sorusunun
   * cevabi da yok; o kural zaten butun turler icin gecerli.
   */
  PAYMENT_REMINDED: "push.payment_reminded",
  /**
   * TUTAR VE ACIKLAMA YOK - butun turlerde oldugu gibi (ADR-047). Uretilen
   * harcamanin aciklamasi kullanicinin yazdigi serbest metin; kilit
   * ekraninda ne yazacagini kimse onceden bilemez.
   */
  EXPENSE_RECURRED: "push.expense_recurred",
  RECURRING_PAUSED: "push.recurring_paused",
};

export type PendingPush = {
  /**
   * Az once YAZILAN bildirim satirlarinin kimlikleri.
   *
   * ALICI LISTESI DEGIL DE BUNLAR TASINIYOR, cunku gonderim aninda
   * cevaplanmasi gereken soru "kime?" degil, "gercekten oldu mu?". after()
   * cevap gonderildikten sonra calisiyor ve ROTA HATA ATSA DA calisiyor;
   * transaction geri alinmissa bu satirlar veritabaninda YOKTUR ve push
   * kendiliginden iptal olur. Aliciyi da hayatta kalan satirlardan okuyoruz -
   * yani gonderilen sey, gercekten yazilmis olanin aynisi.
   */
  notificationIds: string[];
  type: NotificationType;
  groupId: string;
  groupName: string;
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  /** Dokununca hangi ekranin acilacagi. Metin DEGIL, yalnizca kimlik. */
  data: { groupId: string };
};

/**
 * Gonderilecek mesajlari kurar. SAF: veritabanina da aga da dokunmuyor, o
 * yuzden dogrudan test edilebiliyor.
 *
 * DIL ALICININ, gonderenin degil. Ayni olay icin Turkce ve Ingilizce iki
 * kullaniciya iki farkli cumle gidiyor; gonderenin dilini kullanmak, herkesi
 * harcamayi ekleyen kisinin diline mahkum ederdi.
 */
export function buildPushMessages(
  devices: { token: string; locale: string | null }[],
  push: Pick<PendingPush, "type" | "groupId" | "groupName">,
): PushMessage[] {
  return devices.map((device) => ({
    to: device.token,
    // Grup adi CEVRILMIYOR: kullanicinin kendi yazdigi metin.
    title: push.groupName,
    body: translate(BODY_CODES[push.type], undefined, normalizeLocale(device.locale) as Locale),
    sound: "default",
    data: { groupId: push.groupId },
  }));
}

/**
 * Cihazi kullaniciya baglar.
 *
 * UPSERT VE SAHIP DEVRI: ayni cihaz baska bir hesaba giris yaparsa Expo AYNI
 * adresi veriyor. Yeni satir acsaydik tek cihaz iki kullanicinin altinda
 * durur ve ONCEKI kullanicinin bildirimleri yeni kullaniciya giderdi - yani
 * bir cihaz degistirme, bir veri sizintisina donerdi.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform, lastSeenAt: new Date() },
  });
}

/**
 * CIKISTA cagriliyor. Silinmezse telefon o hesabin bildirimlerini almaya
 * devam eder - baska biri giris yapmis olsa bile.
 */
export async function removePushToken(token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { token } });
}

/**
 * Gonderimi COMMIT SONRASINA planlar.
 *
 * after() cevap gonderildikten SONRA calisiyor, yani kullanici push'un
 * gitmesini beklemiyor. Iki tuzagi var ve ikisi de burada karsilaniyor:
 *
 * 1. after() ROTA HATA ATSA DA calisiyor. O yuzden bu fonksiyon yalnizca
 *    $transaction cozuldukten SONRA, basari dalinda cagriliyor.
 * 2. Istek baglami disinda cagrilirsa FIRLATIYOR - ornegin birim testlerinde,
 *    is mantigi dogrudan cagrildiginda. Push gonderilememesi o baglamda
 *    zaten anlamsiz, ve bunun yuzunden bir harcamanin kaydedilmemesi kabul
 *    edilemez. Bu yuzden yutuluyor; yutulan sey BILDIRIM, para degil.
 */
export function schedulePush(push: PendingPush): void {
  try {
    after(() => deliverPush(push));
  } catch {
    // Istek baglami yok. Bkz. yukaridaki (2).
  }
}

/**
 * Cihazlari bulur, mesajlari kurar, gonderir ve OLU ADRESLERI TEMIZLER.
 *
 * HICBIR HATA YUKARI CIKMIYOR: bu fonksiyon cevap gonderildikten sonra
 * calisiyor, yani firlatacagi hatanin gidecegi bir yer yok. Bildirimin
 * gitmemesi kotu ama kurtarilabilir - kullanici uygulamayi actiginda
 * bildirimi zaten listede goruyor.
 */
export async function deliverPush(push: PendingPush): Promise<void> {
  try {
    if (push.notificationIds.length === 0) return;

    /**
     * ONCE SATIRLAR GERCEKTEN VAR MI. Transaction geri alindiysa hicbiri
     * yoktur ve buradan sessizce donuyoruz - yoksa insanlara HIC OLMAMIS bir
     * harcamanin bildirimi giderdi. Bu, "commit oldu mu" sorusunu tahmin
     * etmek yerine VERITABANINA SORMAK.
     */
    const written = await prisma.notification.findMany({
      where: { id: { in: push.notificationIds } },
      select: { userId: true },
    });
    if (written.length === 0) return;

    const devices = await prisma.pushToken.findMany({
      where: { userId: { in: written.map((row) => row.userId) } },
      select: { token: true, user: { select: { locale: true } } },
    });
    if (devices.length === 0) return;

    const messages = buildPushMessages(
      devices.map((device) => ({ token: device.token, locale: device.user.locale })),
      push,
    );

    for (let at = 0; at < messages.length; at += BATCH_SIZE) {
      const batch = messages.slice(at, at + BATCH_SIZE);
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!response.ok) continue;

      const parsed: unknown = await response.json().catch(() => null);
      await pruneDeadTokens(batch, parsed);
    }
  } catch {
    // Yukaridaki gerekce.
  }
}

/**
 * Expo "DeviceNotRegistered" derse adres artik calismiyor: uygulama
 * kaldirilmis ya da bildirimler kapatilmis. Temizlenmezse tablo olu
 * adreslerle buyur ve her gonderimde bosuna denenirler.
 *
 * CEVAP SIRAYLA GELIYOR: data[i], gonderilen batch[i]'nin sonucu. Expo'nun
 * sozlesmesi bu; baska turlu hangi adresin oldugunu bilmenin yolu yok.
 */
async function pruneDeadTokens(batch: PushMessage[], parsed: unknown): Promise<void> {
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return;
  const tickets = (parsed as { data: unknown }).data;
  if (!Array.isArray(tickets)) return;

  const dead: string[] = [];
  tickets.forEach((ticket: unknown, index) => {
    if (!ticket || typeof ticket !== "object") return;
    const details = (ticket as { details?: { error?: string } }).details;
    if (details?.error === "DeviceNotRegistered" && batch[index]) {
      dead.push(batch[index].to);
    }
  });

  if (dead.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
