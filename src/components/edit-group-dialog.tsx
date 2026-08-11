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
import { updateGroupSchema } from "@/lib/group-schemas";
import { apiRequest } from "@/lib/api-client";

export function EditGroupDialog({
  groupId,
  initialName,
  initialDescription,
}: {
  groupId: string;
  initialName: string;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = updateGroupSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Geçersiz giriş");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/v1/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });

      toast.success("Grup güncellendi");
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Beklenmeyen bir hata oluştu",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Düzenle
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Grubu düzenle</DialogTitle>
            <DialogDescription>
              Grup adını ve açıklamasını değiştirebilirsin. Para birimi, mevcut
              kayıtlarla tutarlılık için değiştirilemez.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-group-name">Grup adı</Label>
              <Input
                id="edit-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-group-description">Açıklama (isteğe bağlı)</Label>
              <Input
                id="edit-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Kira, faturalar, market"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
