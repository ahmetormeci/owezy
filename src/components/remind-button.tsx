"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";

/**
 * "Hatirlat" (ADR-050).
 *
 * SATIRIN ICINDE, ayri bir bolum degil: hatirlatma bir kisiye ve bir tutara
 * bagli, ve o ikisi zaten odesme planinin satirinda yan yana duruyor. Ayri
 * bir yere koysaydik kullanici kimi hatirlattigini ikinci kez secmek
 * zorunda kalirdi.
 *
 * DUGME DEGIL, METIN BAGLANTISI. ADR-021'e gore satirlar cizgiyle ayriliyor
 * ve renk yalnizca DURUM tasiyor; odesme planindaki her satira dolu bir
 * dugme koymak, fisin uzerine tiklanabilir kutular dizmek olurdu. Bakir
 * renk burada bir DURUM degil, sayfanin vurgu rengi - ayni kullanim fis
 * satirlarindaki yorum sayacinda da var.
 */
export function RemindButton({
  groupId,
  toUserId,
  /** Sunucudan gelen son hatirlatma. Varsa dugme kapali gelir. */
  alreadySentAt,
}: {
  groupId: string;
  toUserId: string;
  alreadySentAt: string | null;
}) {
  const t = useTranslate();
  const [isSending, setIsSending] = useState(false);
  /**
   * SUNUCUNUN CEVABI BASLANGIC DEGERI, tek kaynak degil: gonderdikten sonra
   * sayfa yeniden cizilmeden de dugme kapanmali. router.refresh() cagirmak
   * butun fisi yeniden getirirdi - tek bir dugmenin durumu icin fazla.
   */
  const [sent, setSent] = useState(alreadySentAt !== null);

  async function send() {
    setIsSending(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/reminders`, {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      });
      setSent(true);
      toast.success(t("ui.reminder_sent"));
    } catch (error) {
      /**
       * SOGUMA HATASI DA DUGMEYI KAPATIYOR (409). Sunucu "cok erken"
       * diyorsa gonderilmis bir hatirlatma VAR demektir - baska bir
       * sekmeden ya da telefondan. Dugmeyi acik birakmak, kullaniciyi ayni
       * duvara tekrar tekrar surmek olurdu.
       */
      if (error instanceof ApiClientError && error.status === 409) {
        setSent(true);
      }
      toast.error(error instanceof Error ? error.message : t("ui.reminder_failed"));
    } finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">{t("ui.reminded")}</span>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={isSending}
      className="shrink-0 rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {isSending ? t("ui.reminding") : t("ui.remind")}
    </button>
  );
}
