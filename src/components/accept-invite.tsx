"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
        throw new Error(data.error ?? "Gruba katilinamadi");
      }

      toast.success("Gruba katildin");
      router.push(`/groups/${data.membership.groupId}`);
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Gruba katilinamadi");
      setIsJoining(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={handleJoin} disabled={isJoining}>
        {isJoining ? "Katiliniyor..." : "Gruba katil"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
