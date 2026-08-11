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
import { createGroupSchema } from "@/lib/group-schemas";
import { apiRequest } from "@/lib/api-client";

export function CreateGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Sunucudakiyle AYNI Zod semasi. Buradaki dogrulama yalnizca hizli geri
    // bildirim icin; asil kontrol her zaman sunucuda tekrar yapiliyor
    // (istemci dogrulamasi atlanabilir, guvenilir kabul edilemez).
    const parsed = createGroupSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Geçersiz giriş");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });

      toast.success("Grup oluşturuldu");
      setName("");
      setDescription("");
      setOpen(false);
      // Sunucu bileseni yeniden calissin diye sayfayi tazeliyoruz; boylece
      // istemcide ayri bir onbellek tutmaya gerek kalmiyor.
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Beklenmeyen bir hata oluştu",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Yeni grup</Button>} />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yeni grup oluştur</DialogTitle>
            <DialogDescription>
              Ortak harcamaları takip edeceğin bir grup oluştur.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="group-name">Grup adı</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ev Arkadaşları"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="group-description">Açıklama (isteğe bağlı)</Label>
              <Input
                id="group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Kira, faturalar, market"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
