"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";
import { formatIban } from "@/lib/iban";
import { updateMeSchema } from "@/lib/me-schemas";
import { useTranslate } from "@/lib/i18n";

/**
 * KENDI IBAN'INI EKLEME / DEGISTIRME / KALDIRMA (ADR-059).
 *
 * Denetimli (open + onOpenChange): iki yerden aciliyor - kullanici
 * menusunden ve grup sayfasindaki "IBAN ekle" ipucundan. Tetikleyici
 * cagiranin isi.
 *
 * DOGRULAMA SUNUCUYLA AYNI SEMADAN (me-schemas.ts): formun kabul edip
 * API'nin reddettigi bir IBAN olmasin.
 */
export function IbanDialog({
  open,
  onOpenChange,
  currentIban,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIban: string | null;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [value, setValue] = useState(currentIban ? formatIban(currentIban) : "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function save(iban: string | null) {
    setError(null);
    const parsed = updateMeSchema.safeParse({ iban });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "validation.invalid"));
      return;
    }
    const next = parsed.data.iban ?? null;

    // Degismediyse istek yok: sunucu zaten yazmazdi, ama "kaydedildi"
    // demek de yaniltici olurdu.
    if (next === currentIban) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ iban: next }),
      });
      toast.success(t(next === null ? "ui.iban_removed" : "ui.iban_saved"));
      onOpenChange(false);
      // TAM TAZELEME: menudeki "Ekli / Yok" ve grup sayfasindaki ipucu
      // ayni bilgiye bakiyor.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("server.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        // Yeniden acildiginda yarim kalan yazim degil, kayittaki deger.
        if (next) {
          setValue(currentIban ? formatIban(currentIban) : "");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(value);
          }}
        >
          <DialogHeader>
            {/* Baslik alanin etiketiyle AYNI OLAMAZ (misafir diyalogunda E2E
                yakalamisti): ikisi de "IBAN" olsaydi ayirt edilemezdi. */}
            <DialogTitle>{t("ui.iban_title")}</DialogTitle>
            <DialogDescription>{t("ui.iban_hint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="iban">{t("ui.iban")}</Label>
            <Input
              id="iban"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              // Tarayicinin kayitli adres/kart onerileri buraya uymaz; yazim
              // denetimi de her rakam grubunun altini cizerdi.
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              maxLength={64}
              className="font-mono"
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            {currentIban ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isSubmitting}
                onClick={() => void save(null)}
              >
                {t("ui.remove_iban")}
              </Button>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("ui.saving") : t("ui.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
