"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/messages";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
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
        throw new Error(data.code ? translate(data.code, data.params) : "Gruba katılınamadı");
      }

      toast.success("Gruba katıldın");
      router.push(`/groups/${data.membership.groupId}`);
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Gruba katılınamadı");
      setIsJoining(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={handleJoin} disabled={isJoining}>
        {isJoining ? "Katılınıyor..." : "Gruba katıl"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
