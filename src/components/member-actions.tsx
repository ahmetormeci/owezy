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
import { useTranslate } from "@/lib/i18n";

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
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}/members/${userId}`, { method: "DELETE" });
      toast.success(t("ui.member_removed_named", { name: displayName }));
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.member_remove_failed"));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            {t("ui.remove_member")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("ui.remove_member_question", { name: displayName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.remove_member_hint")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">{t("ui.cancel")}</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isRemoving} onClick={handleRemove}>
                {isRemoving ? t("ui.removing") : t("ui.remove_member")}
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
  const t = useTranslate();
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
      toast.success(t("ui.left_group"));
      setOpen(false);
      router.push("/groups");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.leave_failed"));
      setIsLeaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            {t("ui.leave_group")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("ui.leave_group_question")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.leave_group_hint")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {mustTransferOwnership ? (
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="newOwner">{t("ui.transfer_to_whom")}</Label>
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
          <AlertDialogCancel render={<Button variant="outline">{t("ui.cancel")}</Button>} />
          <AlertDialogAction
            render={
              <Button variant="destructive" disabled={isLeaving} onClick={handleLeave}>
                {isLeaving ? t("ui.leaving") : t("ui.leave")}
              </Button>
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
