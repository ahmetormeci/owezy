"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  /**
   * Menu acildiginda liste cekiliyor ve bildirimler OKUNDU sayiliyor.
   *
   * Once elle basilan bir "tumunu okundu isaretle" dugmesi vardi; zile bakip
   * kapatan kullanicinin rakami oldugu gibi kaliyordu. Zile bakmak zaten
   * "gordum" demek.
   *
   * INCELIK: rozet hemen sifirlaniyor ama listedeki readAt'e DOKUNULMUYOR.
   * Boylece mavi noktalar menu acik kaldigi surece duruyor ve kullanici
   * hangilerinin yeni oldugunu okurken gorebiliyor. Bir dahaki acilista
   * sunucudan okunmus olarak geliyorlar ve noktalar kendiliginden kalkiyor.
   */
  async function loadNotifications() {
    setIsLoading(true);
    try {
      const data = await apiRequest<ListResponse>("/api/v1/notifications?limit=10");
      setItems(data.notifications);

      if (data.unreadCount > 0) {
        // Okundu isaretleme listeden SONRA: istek basarisiz olursa bildirimler
        // okunmamis kaliyor ve bir sonraki acilista yine gorunuyorlar.
        await apiRequest("/api/v1/notifications/read-all", { method: "POST" });
      }
      setUnreadCount(0);
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
      return;
    }

    // Tazeleme KAPANISTA: menu acikken yapilsaydi sunucu agaci yeniden gelir
    // ve okurken listenin altindan cekilirdi.
    router.refresh();
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
        {/* "Tumunu okundu isaretle" dugmesi kalkti: menuyu acmak zaten
            okundu sayiyor, dolayisiyla dugme hicbir zaman gorunmezdi. */}
        <div className="border-b border-border px-3 py-2">
          <span className="font-medium">{t("ui.notifications")}</span>
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
