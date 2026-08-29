"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { apiRequest } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";

/**
 * Hesap silme onayi.
 *
 * NEDEN VAR: App Store Guideline 5.1.1(v) hesap acilabilen uygulamalarda
 * uygulama ici silmeyi zorunlu kiliyor. Karar ADR-031'de alinmis ama
 * uygulanmamisti; eksiklik 28 Agustos'ta Apple'in 2.1 reddiyle ortaya cikti.
 * Zorunluluk MOBILDEN geliyor ama web'de olmamasi tutarsizlik olurdu -
 * ayni hesap, ayni haklar.
 *
 * NEDEN AYRI BIR DIALOG, menude tek dokunus degil: silme geri alinamaz ve
 * menu ogeleri yanlislikla basilan yerlerdir. Onay ayri bir yuzeyde
 * aliniyor ve orada NE KAYBEDILECEGI yaziyor.
 *
 * NEDEN TEMBEL YUKLENIYOR: user-menu.tsx her sayfada; bu ekran yilda bir
 * kez bile acilmayabilir. Bagi orada next/dynamic ile kuruluyor.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/v1/me", { method: "DELETE" });
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : t("server.unexpected"));
      return;
    }

    /**
     * SUNUCU OTURUM SATIRLARINI ZATEN SILDI (deleteAccount). Yine de
     * signOut() cagriliyor: tarayicidaki cerezi temizlemek ve istemci
     * durumunu cikisli yapmak gerekiyor, yoksa kullanici silinmis bir
     * hesapla girisli gorunur ve her istek 401 alirdi.
     *
     * Hatasi YUTULUYOR: sunucudaki oturum zaten yok, cagri basarisiz olabilir
     * ve bu beklenen bir sey. Onemli olan yerel durumun temizlenmesi.
     */
    await authClient.signOut().catch(() => undefined);
    toast.success(t("ui.delete_account_done"));
    router.replace("/");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ui.delete_account_title")}</DialogTitle>
          {/* Kaybedilecek sey SOMUT yaziliyor. "Bu islem geri alinamaz" tek
              basina hicbir sey anlatmiyor - kullanici neyin gidip neyin
              kaldigini bilmeli. */}
          <DialogDescription>{t("ui.delete_account_warning")}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("ui.delete_account_balance_warning")}
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("ui.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {t("ui.delete_account_confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
