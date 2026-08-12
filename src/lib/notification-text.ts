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

const INTL_LOCALES: Record<Locale, string> = { tr: "tr-TR", en: "en-US" };
const relativeFormatters: Partial<Record<Locale, Intl.RelativeTimeFormat>> = {};

/**
 * "3 dakika once" / "3 minutes ago".
 *
 * NEDEN SOZLUKTE DEGIL: sablon olarak yazilsaydi Ingilizce "1 minutes ago"
 * derdi. Turkcede cogul eki olmadigi icin "{count} dakika once" her sayi
 * icin dogruydu; Ingilizcede sayiya gore degisiyor. Intl.RelativeTimeFormat
 * bu kurali her dil icin kendisi biliyor.
 *
 * numeric: "always" bilerek. "auto" olsaydi Turkcede "1 gun once" yerine
 * "dun", "2 gun once" yerine "evvelsi gun" yazardi - mevcut cikti degisirdi.
 */
function relative(locale: Locale, count: number, unit: Intl.RelativeTimeFormatUnit): string {
  const formatter = (relativeFormatters[locale] ??= new Intl.RelativeTimeFormat(
    INTL_LOCALES[locale],
    { numeric: "always" },
  ));
  return formatter.format(-count, unit);
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
    return relative(locale, Math.floor(diff / MINUTE), "minute");
  }
  if (diff < DAY) {
    return relative(locale, Math.floor(diff / HOUR), "hour");
  }
  if (diff < 7 * DAY) {
    return relative(locale, Math.floor(diff / DAY), "day");
  }

  // Bir haftadan eskisi icin goreli zaman ("38 gun once") okunmuyor; tarihin
  // kendisi daha bilgilendirici. Bicim listelerdekiyle AYNI (dates.ts):
  // burada gun tek basamakliydi ("5 Agu"), listelerde iki ("05 Agu"). Ayni
  // tarihin uygulamanin iki yerinde farkli gorunmesi icin bir sebep yoktu.
  return formatDate(date, locale);
}
