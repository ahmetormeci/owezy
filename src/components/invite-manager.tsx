"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import { useTranslate } from "@/lib/i18n";

export type InviteListItem = {
  id: string;
  invitedById: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function InviteManager({
  groupId,
  invites,
  nameByUserId,
}: {
  groupId: string;
  invites: InviteListItem[];
  nameByUserId: Record<string, string>;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [maxUses, setMaxUses] = useState("1");
  const [ttlDays, setTtlDays] = useState("7");
  const [isCreating, setIsCreating] = useState(false);
  // Ham token sunucuda saklanmiyor (yalnizca hash'i saklaniyor), bu yuzden
  // olusturma cevabinda BIR KEZ donuyor. Sayfa yenilenirse geri getirilemez.
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const data = await apiRequest<{ invite: { token: string } }>(
        `/api/v1/groups/${groupId}/invites`,
        {
          method: "POST",
          body: JSON.stringify({
            maxUses: Number(maxUses),
            ttlDays: Number(ttlDays),
          }),
        },
      );

      setCreatedLink(`${window.location.origin}/join/${data.invite.token}`);
      toast.success(t("ui.invite_created"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.invite_create_failed"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await apiRequest(`/api/v1/groups/${groupId}/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      toast.success(t("ui.invite_revoked"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.invite_revoke_failed"));
    }
  }

  async function handleCopy() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      toast.success(t("ui.link_copied"));
    } catch {
      toast.error(t("ui.link_copy_failed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxUses">{t("ui.invite_uses")}</Label>
          <select
            id="maxUses"
            className={selectClassName}
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
          >
            <option value="1">{t("ui.uses_1")}</option>
            <option value="5">{t("ui.uses_5")}</option>
            <option value="25">{t("ui.uses_25")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ttlDays">{t("ui.invite_validity")}</Label>
          <select
            id="ttlDays"
            className={selectClassName}
            value={ttlDays}
            onChange={(event) => setTtlDays(event.target.value)}
          >
            <option value="1">{t("ui.days_1")}</option>
            <option value="7">{t("ui.days_7")}</option>
            <option value="30">{t("ui.days_30")}</option>
          </select>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={isCreating} className="self-start">
        {isCreating ? t("ui.creating") : t("ui.create_invite")}
      </Button>

      {createdLink ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-medium">{t("ui.invite_ready")}</p>
            <p className="text-sm text-muted-foreground">
              {t("ui.invite_once_warning")}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={createdLink} onFocus={(event) => event.target.select()} />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {t("ui.copy")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("ui.active_invites")}</p>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ui.no_active_invite")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {invites.map((invite) => {
              // Kullanim limiti dolmus bir davet zaten kullanilamaz; "iptal et"
              // sunmak yaniltici olur. Bunun yerine durumunu belirtiyoruz.
              const isExhausted = invite.useCount >= invite.maxUses;

              return (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 text-sm">
                    <p>
                      {t("ui.invite_uses_count", {
                        used: invite.useCount,
                        max: invite.maxUses,
                      })}
                    </p>
                    <p className="text-muted-foreground">
                      {t("ui.invite_valid_until", {
                        date: dateFormatter.format(new Date(invite.expiresAt)),
                      })}{" · "}
                      {t("ui.invite_created_by", {
                        name: nameByUserId[invite.invitedById] ?? t("ui.unknown_user"),
                      })}
                    </p>
                  </div>

                  {isExhausted ? (
                    <Badge variant="outline">{t("ui.invite_exhausted")}</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      {t("ui.invite_revoke")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
