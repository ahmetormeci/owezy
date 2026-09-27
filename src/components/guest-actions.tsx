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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guestNameSchema } from "@/lib/guest-schemas";
import { apiRequest } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";

/**
 * Hesapsiz uye - misafir (ADR-057). Her aktif uye ekleyebilir ve adini
 * degistirebilir; cikarmak ise uye cikarma dugmesiyle, yalnizca sahipte.
 *
 * FORM SAYFADA ACIK DURUYOR, bir diyalogun arkasinda degil: misafir eklemek
 * tek alanlik bir is ve bu ozelligin butun amaci "tek basina baslayabilmek".
 * Bir tik daha, o kolayligin tam tersi olurdu.
 */
export function AddGuestForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const t = useTranslate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = guestNameSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "validation.invalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/guests`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success(t("ui.guest_added_named", { name: parsed.data.displayName }));
      setName("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("server.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor="add-guest-name">{t("ui.add_guest")}</Label>
      <div className="flex gap-2">
        <Input
          id="add-guest-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("ui.guest_name_placeholder")}
          maxLength={100}
        />
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? t("ui.saving") : t("ui.add_guest")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("ui.guest_hint")}</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

export function RenameGuestButton({
  groupId,
  guestId,
  displayName,
}: {
  groupId: string;
  guestId: string;
  displayName: string;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = guestNameSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "validation.invalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/guests/${guestId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      toast.success(t("ui.guest_renamed"));
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("server.unexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Vazgecilip yeniden acildiginda yarim kalan yazim degil, gecerli ad.
        if (next) {
          setName(displayName);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {t("ui.rename_guest")}
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            {/* Baslik ALANIN ETIKETIYLE AYNI OLAMAZ: diyalog basligini kendi
                adi olarak kullaniyor ve ayni adla iki oge, ekran okuyucuda da
                testte de ayirt edilemiyordu (E2E'de yakalandi). */}
            <DialogTitle>{t("ui.rename_guest")}</DialogTitle>
            <DialogDescription>{t("ui.guest_hint")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="rename-guest-name">{t("ui.guest_name")}</Label>
            <Input
              id="rename-guest-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoFocus
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("ui.saving") : t("ui.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Misafire OZEL davet linki (ADR-057, Faz 50b). Linki acan kisi misafir
 * OLARAK katilir ve misafirin kayitlari onun hesabina gecer.
 *
 * IKI ADIM: once ne olacagi anlatiliyor, link ancak "olustur"a basilinca
 * uretiliyor. Diyalogu acmak link uretseydi her acilis, kimsenin
 * gondermedigi gecerli bir davet birakirdi.
 *
 * Link BIR KEZ gosteriliyor - normal davetle ayni kural: veritabaninda
 * yalnizca ozeti duruyor, ham kod bir daha uretilemez.
 */
export function GuestInviteButton({
  groupId,
  guestId,
  displayName,
}: {
  groupId: string;
  guestId: string;
  displayName: string;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    setError(null);
    setIsCreating(true);
    try {
      const data = await apiRequest<{ invite: { token: string } }>(
        `/api/v1/groups/${groupId}/guests/${guestId}/invite`,
        { method: "POST" },
      );
      setLink(`${window.location.origin}/join/${data.invite.token}`);
      // Asagidaki davet listesi yeni linki gostersin (iptal edilebilsin).
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("server.unexpected"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("ui.link_copied"));
    } catch {
      toast.error(t("ui.link_copy_failed"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Kapatilinca link unutuluyor: bir kez gosterildi, o kadar.
        if (!next) {
          setLink(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {t("ui.invite_guest")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {link ? t("ui.guest_invite_ready", { name: displayName }) : t("ui.invite_guest")}
          </DialogTitle>
          <DialogDescription>{t("ui.guest_invite_hint", { name: displayName })}</DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-muted-foreground">{t("ui.invite_once_warning")}</p>
            <div className="flex gap-2">
              <Input
                readOnly
                aria-label={t("ui.guest_invite_ready", { name: displayName })}
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {t("ui.copy")}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? t("ui.saving") : t("ui.create_invite")}
            </Button>
          </DialogFooter>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
