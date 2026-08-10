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
      toast.success("Davet linki olusturuldu");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet linki olusturulamadi");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      await apiRequest(`/api/v1/groups/${groupId}/invites/${inviteId}/revoke`, {
        method: "POST",
      });
      toast.success("Davet iptal edildi");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet iptal edilemedi");
    }
  }

  async function handleCopy() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      toast.success("Link kopyalandi");
    } catch {
      toast.error("Link kopyalanamadi, elle secip kopyalayabilirsin");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxUses">Kac kisi kullanabilsin?</Label>
          <select
            id="maxUses"
            className={selectClassName}
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
          >
            <option value="1">1 kisi</option>
            <option value="5">5 kisi</option>
            <option value="25">25 kisi</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ttlDays">Ne kadar gecerli olsun?</Label>
          <select
            id="ttlDays"
            className={selectClassName}
            value={ttlDays}
            onChange={(event) => setTtlDays(event.target.value)}
          >
            <option value="1">1 gun</option>
            <option value="7">7 gun</option>
            <option value="30">30 gun</option>
          </select>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={isCreating} className="self-start">
        {isCreating ? "Olusturuluyor..." : "Davet linki olustur"}
      </Button>

      {createdLink ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-medium">Davet linkin hazir</p>
            <p className="text-sm text-muted-foreground">
              Bu link yalnizca simdi gosteriliyor. Sayfayi yenilersen bir daha
              goremezsin, cunku sunucuda linkin kendisi degil yalnizca sifrelenmis
              bir ozeti saklaniyor.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={createdLink} onFocus={(event) => event.target.select()} />
              <Button type="button" variant="outline" onClick={handleCopy}>
                Kopyala
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Aktif davetler</p>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aktif bir davet linki yok.</p>
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
                      {invite.useCount}/{invite.maxUses} kullanildi
                    </p>
                    <p className="text-muted-foreground">
                      {dateFormatter.format(new Date(invite.expiresAt))} tarihine kadar ·{" "}
                      {nameByUserId[invite.invitedById] ?? "Bilinmeyen"} olusturdu
                    </p>
                  </div>

                  {isExhausted ? (
                    <Badge variant="outline">Tukendi</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      Iptal et
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
