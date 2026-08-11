"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/i18n";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslate();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        // Bu bilesen apiRequest'i kullanmiyor (kendi fetch'i var), o yuzden
        // kod -> metin cevirisini burada kendisi yapiyor.
        throw new Error(data.code ? t(data.code, data.params) : t("ui.join_failed"));
      }

      toast.success(t("ui.joined_group"));
      router.push(`/groups/${data.membership.groupId}`);
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : t("ui.join_failed"));
      setIsJoining(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={handleJoin} disabled={isJoining}>
        {isJoining ? t("ui.joining") : t("ui.join_group")}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
