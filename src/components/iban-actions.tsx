"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IbanDialog } from "@/components/iban-dialog";
import { formatIban } from "@/lib/iban";
import { useTranslate } from "@/lib/i18n";

/**
 * ALACAKLININ IBAN'INI KOPYALA (ADR-059). "Odemen gerekenler" satirinda ve
 * odeme kaydetme diyaloğunda.
 *
 * "YAKINDA DEGISTI" UYARISI KOPYALAMA ANINDA: satirda kalici bir rozet
 * her bakista goze batardi; uyarinin ise tam para gondermeden once, yani
 * IBAN kopyalanirken gorulmesi gerekiyor.
 *
 * PANO YAZILAMAZSA IBAN MESAJDA: tarayici izin vermeyebilir (guvensiz
 * baglam, izin reddi). O durumda kullanici elle secip kopyalayabilmeli -
 * sessizce basarisiz olmak "bastim ama bir sey olmadi" demek olurdu.
 */
export function CopyIbanButton({
  iban,
  recentlyChanged,
  appearance = "link",
}: {
  iban: string;
  recentlyChanged: boolean;
  /**
   * "link": satir icinde, "Hatirlat" ile ayni gorunum - ayni listede iki
   * farkli dugme dili olmasin. "button": odeme diyalogunda, alanlarin
   * arasinda duz bir dugme.
   */
  appearance?: "link" | "button";
}) {
  const t = useTranslate();

  async function copy() {
    try {
      await navigator.clipboard.writeText(iban);
      toast.success(t("ui.iban_copied"), {
        description: recentlyChanged ? t("ui.iban_recently_changed") : undefined,
      });
    } catch {
      toast.error(t("ui.iban_copy_failed", { iban: formatIban(iban) }), {
        description: recentlyChanged ? t("ui.iban_recently_changed") : undefined,
      });
    }
  }

  if (appearance === "button") {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {t("ui.copy_iban")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="shrink-0 rounded-[3px] text-xs text-brand underline underline-offset-3 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {t("ui.copy_iban")}
    </button>
  );
}

/**
 * "IBAN'ini eklersen..." ipucu. Grup sayfasinda, sana odenecekler varken
 * ve senin IBAN'in yokken. Bu olmadan ozelligi kimse bulmazdi: ayar
 * kullanici menusunde duruyor ve oraya kimse IBAN aramaya gitmez.
 */
export function AddIbanHint() {
  const t = useTranslate();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <p className="min-w-0 flex-1">{t("ui.add_iban_hint")}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("ui.add_iban")}
      </Button>
      {open ? <IbanDialog open onOpenChange={setOpen} currentIban={null} /> : null}
    </div>
  );
}
