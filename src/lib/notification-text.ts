import type { NotificationType } from "@prisma/client";
import { formatMoney } from "@/lib/money";

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

const TITLES: Record<NotificationType, (actor: string) => string> = {
  EXPENSE_ADDED: (actor) => `${actor} yeni bir harcama ekledi`,
  EXPENSE_UPDATED: (actor) => `${actor} bir harcamayı güncelledi`,
  EXPENSE_DELETED: (actor) => `${actor} bir harcamayı sildi`,
  SETTLEMENT_RECORDED: (actor) => `${actor} bir ödeme kaydetti`,
  SETTLEMENT_CANCELLED: (actor) => `${actor} bir ödeme kaydını iptal etti`,
  MEMBER_JOINED: (actor) => `${actor} gruba katıldı`,
};

export function describeNotification(
  type: NotificationType,
  payload: unknown,
): NotificationView {
  const parsed = parsePayload(payload);
  const actor = parsed.actorName ?? "Birisi";

  // Tutar her zaman kurus cinsinden tam sayi olarak saklandi; ekrana cikarken
  // tek merkezden (formatMoney) bicimleniyor.
  const money =
    parsed.amount !== undefined && parsed.currency
      ? formatMoney(parsed.amount, parsed.currency)
      : null;

  const detailParts = [parsed.description, money].filter(Boolean);

  return {
    title: TITLES[type](actor),
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    groupName: parsed.groupName ?? null,
    href: parsed.groupId ? `/groups/${parsed.groupId}` : null,
  };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "3 dakika once" gibi goreli zaman.
 *
 * `now` disaridan verilebiliyor: testin gercek saate bagli olmasi, gece yarisi
 * ya da yavas bir makinede kendiliginden kirilan test demektir.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();

  // Saat farki yuzunden gelecekte gorunen kayitlar olabilir; "eksi 2 dakika
  // once" yazmaktansa "az once" demek dogru.
  if (diff < MINUTE) {
    return "az önce";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} dakika önce`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} saat önce`;
  }
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)} gün önce`;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
