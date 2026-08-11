"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function RemoveMemberButton({
  groupId,
  userId,
  displayName,
}: {
  groupId: string;
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/members/${userId}`, { method: "DELETE" });
      toast.success(`${displayName} gruptan çıkarıldı`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Üye çıkarılamadı");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Çıkar
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{displayName} gruptan cikarilsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Geçmiş harcamaları grupta kalır. Açık bir bakiyesi varsa önce
            ödeşilmesi gerekir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">Vazgeç</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isRemoving} onClick={handleRemove}>
                {isRemoving ? "Çıkarılıyor..." : "Çıkar"}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LeaveGroupButton({
  groupId,
  isOwner,
  otherMembers,
}: {
  groupId: string;
  isOwner: boolean;
  otherMembers: { userId: string; displayName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState(otherMembers[0]?.userId ?? "");

  // Grup sahibi, arkasinda uye birakiyorsa sahipligi devretmek zorunda:
  // her grupta her zaman bir sahip bulunmali.
  const mustTransferOwnership = isOwner && otherMembers.length > 0;

  async function handleLeave() {
    setIsLeaving(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/leave`, {
        method: "POST",
        body: JSON.stringify(mustTransferOwnership ? { newOwnerId } : {}),
      });
      toast.success("Gruptan ayrıldın");
      setOpen(false);
      router.push("/groups");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gruptan ayrılınamadı");
      setIsLeaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            Gruptan ayrıl
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gruptan ayrılmak istiyor musun?</AlertDialogTitle>
          <AlertDialogDescription>
            Geçmiş harcamaların grupta kalır. Açık bir bakiyen varsa önce
            ödeşmen gerekir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mustTransferOwnership ? (
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="newOwner">Sahipliği kime devrediyorsun?</Label>
            <select
              id="newOwner"
              className={selectClassName}
              value={newOwnerId}
              onChange={(event) => setNewOwnerId(event.target.value)}
            >
              {otherMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">Vazgeç</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isLeaving} onClick={handleLeave}>
                {isLeaving ? "Ayrılınıyor..." : "Ayrıl"}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
