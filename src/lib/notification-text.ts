import type { NotificationType } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { translate, type MessageCode, type MessageParams } from "@/lib/messages";

// Ceviriciyi ve dili disaridan alabiliyoruz ama ikisinin de varsayilani var.
// Boylece bu saf fonksiyonun testleri React kurmadan calismaya devam ediyor,
// zil bileseni ise kendi dilini gecirebiliyor.
type Translator = (code: string, params?: MessageParams) => string;
const defaultTranslator: Translator = (code, params) => translate(code, params);

/**
 * Bildirim kaydini ekranda gosterilecek metne cevirir.
 *
 * Saf fonksiyon: React'e, tarayiciya ve veritabanina bagimli degil. Boylece
 * "hangi olay nasil yaziliyor" kurallari, arayuz kurmadan test edilebiliyor.
 *
 * payload'i `unknown` olarak aliyoruz cunku veritabaninda Json kolonunda
 * duruyor: tip guvencesi yok. Eski surumde yazilmis, alani eksik bir kayit
 * gelebilir; bu durumda cokmek yerine elimizdekiyle anlamli bir cumle kuruyoruz.
 */
export type NotificationView = {
  title: string;
  detail: string | null;
  groupName: string | null;
  href: string | null;
};

type ParsedPayload = {
  groupId?: string;
  groupName?: string;
  actorName?: string;
  description?: string;
  amount?: number;
  currency?: string;
};

function parsePayload(payload: unknown): ParsedPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }

  const raw = payload as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const number = (value: unknown) => (typeof value === "number" ? value : undefined);

  return {
    groupId: text(raw.groupId),
    groupName: text(raw.groupName),
    actorName: text(raw.actorName),
    description: text(raw.description),
    amount: number(raw.amount),
    currency: text(raw.currency),
  };
}

const TITLE_CODES: Record<NotificationType, MessageCode> = {
  EXPENSE_ADDED: "ui.notif_expense_added",
  EXPENSE_UPDATED: "ui.notif_expense_updated",
  EXPENSE_DELETED: "ui.notif_expense_deleted",
  SETTLEMENT_RECORDED: "ui.notif_settlement_recorded",
  SETTLEMENT_CANCELLED: "ui.notif_settlement_cancelled",
  MEMBER_JOINED: "ui.notif_member_joined",
};

export function describeNotification(
  type: NotificationType,
  payload: unknown,
  t: Translator = defaultTranslator,
  locale: Locale = DEFAULT_LOCALE,
): NotificationView {
  const parsed = parsePayload(payload);
  const actor = parsed.actorName ?? t("ui.someone");

  // Tutar her zaman kurus cinsinden tam sayi olarak saklandi; ekrana cikarken
  // tek merkezden (formatMoney) bicimleniyor.
  const money =
    parsed.amount !== undefined && parsed.currency
      ? formatMoney(parsed.amount, parsed.currency, locale)
      : null;

  const detailParts = [parsed.description, money].filter(Boolean);

  return {
    title: t(TITLE_CODES[type], { actor }),
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    groupName: parsed.groupName ?? null,
    href: parsed.groupId ? `/groups/${parsed.groupId}` : null,
  };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "3 dakika once" / "3 minutes ago".
 *
 * ONCE Intl.RelativeTimeFormat KULLANIYORDU ve o secimin gerekcesi suydu:
 * tek bir sablon "1 minutes ago" derdi, cunku Turkcede cogul eki yok ama
 * Ingilizcede var. Gerekce dogruydu, COZUM YANLISTI.
 *
 * HERMES'TE Intl.RelativeTimeFormat YOK. Mobil bildirim ekrani yazilinca
 * uygulama "undefined cannot be used as a constructor" ile coktu ve kaynak
 * tam bu satirdi. Hermes'in Intl destegi 18.2'de olculmustu ama NumberFormat
 * ile DateTimeFormat icin; bu ucuncusu o olcumun disinda kalmis.
 *
 * COZUM: cogul biçimleri SOZLUKTE, tekil ve cogul AYRI anahtarlarda -
 * projenin baska yerlerde zaten kullandigi desen (ui.match_count_one/other).
 * Boylece tek bir kod yolu hem web'de hem Hermes'te calisiyor ve ADR-020
 * iki dilin de doldurulmasini derleme zamaninda garanti ediyor.
 *
 * CIKTI DEGISMEDI: eski Intl ciktisi iki dil icin de olculdu ve buradaki
 * metinler onunla birebir ayni ("1 minute ago" / "3 minutes ago" /
 * "3 dakika once"). Mevcut testler bu yuzden aynen geciyor.
 */
type RelativeUnit = "minute" | "hour" | "day";

// Kodlar SABIT ve MessageCode olarak yaziliyor: `ui.${unit}s_ago_...` gibi
// uretilen bir dize ADR-020'nin derleme zamani kontrolunu devre disi
// birakirdi - eksik bir ceviri ancak calisma aninda fark edilirdi.
const RELATIVE_CODES: Record<RelativeUnit, { one: MessageCode; other: MessageCode }> = {
  minute: { one: "ui.minutes_ago_one", other: "ui.minutes_ago_other" },
  hour: { one: "ui.hours_ago_one", other: "ui.hours_ago_other" },
  day: { one: "ui.days_ago_one", other: "ui.days_ago_other" },
};

function relative(t: Translator, count: number, unit: RelativeUnit): string {
  const codes = RELATIVE_CODES[unit];
  return t(count === 1 ? codes.one : codes.other, { count });
}

/**
 * "3 dakika once" gibi goreli zaman.
 *
 * `now` disaridan verilebiliyor: testin gercek saate bagli olmasi, gece yarisi
 * ya da yavas bir makinede kendiliginden kirilan test demektir.
 */
export function formatRelativeTime(
  date: Date,
  now: Date = new Date(),
  t: Translator = defaultTranslator,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const diff = now.getTime() - date.getTime();

  // Saat farki yuzunden gelecekte gorunen kayitlar olabilir; "eksi 2 dakika
  // once" yazmaktansa "az once" demek dogru.
  if (diff < MINUTE) {
    return t("ui.just_now");
  }
  if (diff < HOUR) {
    return relative(t, Math.floor(diff / MINUTE), "minute");
  }
  if (diff < DAY) {
    return relative(t, Math.floor(diff / HOUR), "hour");
  }
  if (diff < 7 * DAY) {
    return relative(t, Math.floor(diff / DAY), "day");
  }

  // Bir haftadan eskisi icin goreli zaman ("38 gun once") okunmuyor; tarihin
  // kendisi daha bilgilendirici. Bicim listelerdekiyle AYNI (dates.ts):
  // burada gun tek basamakliydi ("5 Agu"), listelerde iki ("05 Agu"). Ayni
  // tarihin uygulamanin iki yerinde farkli gorunmesi icin bir sebep yoktu.
  return formatDate(date, locale);
}
