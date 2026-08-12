"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { describeNotification, formatRelativeTime } from "@/lib/notification-text";
import { useLocale, useTranslate } from "@/lib/i18n";

type NotificationItem = {
  id: string;
  type: NotificationType;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

type ListResponse = {
  notifications: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  // Sunucudan yeni bir sayi geldiginde (router.refresh sonrasi) state'i onunla
  // esitliyoruz. useState'e verilen deger YALNIZCA ilk render'da kullanilir;
  // bunu yapmasaydik zil rakami ilk yuklendigi degerde donup kalirdi - harcama
  // listesinde yasadigimiz hatanin aynisi.
  const [serverUnreadCount, setServerUnreadCount] = useState(initialUnreadCount);
  if (serverUnreadCount !== initialUnreadCount) {
    setServerUnreadCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  async function loadNotifications() {
    setIsLoading(true);
    try {
      const data = await apiRequest<ListResponse>("/api/v1/notifications?limit=10");
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ui.notifications_load_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Liste yalnizca menu acildiginda cekiliyor: sayfa her acildiginda bildirimleri
  // indirmek, kullanicilarin cogunun hic bakmadigi bir istek olurdu. Rakam zaten
  // sunucudan geliyor.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadNotifications();
    }
  }

  async function handleItemClick(item: NotificationItem, href: string | null) {
    setOpen(false);

    if (!item.readAt) {
      // Ekrani hemen guncelliyoruz; istek arka planda gidiyor. Basarisiz olursa
      // sunucu hala okunmamis sayar ve bir sonraki acilista tekrar gorunur -
      // bildirim icin kabul edilebilir bir takas.
      setItems((current) =>
        current?.map((row) =>
          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
        ) ?? null,
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await apiRequest(`/api/v1/notifications/${item.id}/read`, { method: "POST" });
      } catch {
        // Sessizce gecoyoruz: kullanici zaten gitmek istedigi yere gidiyor.
      }
    }

    if (href) {
      router.push(href);
    }
    router.refresh();
  }

  async function handleMarkAllRead() {
    try {
      await apiRequest("/api/v1/notifications/read-all", { method: "POST" });
      const readAt = new Date().toISOString();
      setItems((current) => current?.map((row) => ({ ...row, readAt })) ?? null);
      setUnreadCount(0);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ui.notifications_mark_failed"),
      );
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={
          unreadCount > 0
            ? t("ui.notifications_with_unread", { count: unreadCount })
            : t("ui.notifications")
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="font-medium">{t("ui.notifications")}</span>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              {t("ui.mark_all_read")}
            </Button>
          ) : null}
        </div>

        {isLoading && items === null ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("ui.loading")}
          </p>
        ) : items && items.length > 0 ? (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((item) => {
              const view = describeNotification(item.type, item.payload, t, locale);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item, view.href)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="flex w-full items-start gap-2">
                      {!item.readAt ? (
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          aria-label={t("ui.unread")}
                        />
                      ) : (
                        <span className="mt-1.5 size-2 shrink-0" />
                      )}
                      <span className="font-medium">{view.title}</span>
                    </span>
                    {view.detail ? (
                      <span className="pl-4 text-sm text-muted-foreground">
                        {view.detail}
                      </span>
                    ) : null}
                    <span className="pl-4 text-xs text-muted-foreground">
                      {[
                        view.groupName,
                        formatRelativeTime(new Date(item.createdAt), undefined, t, locale),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("ui.no_notifications")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
