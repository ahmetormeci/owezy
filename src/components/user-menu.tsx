"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersonAvatar } from "@/components/person-avatar";
import { useTranslate } from "@/lib/i18n";

/**
 * Basliktaki kullanici menusu. Clerk'in <UserButton /> bileseninin yerini
 * aldi (Faz 25.4) ve bu kozmetik bir degisiklik degildi: <UserButton />
 * yalnizca CLERK'IN oturumunu biliyordu, Better Auth ile giren kullaniciyi
 * tanimiyordu.
 *
 * SIMDILIK YALNIZCA CIKIS. Profil duzenleme, parola degistirme ve hesap
 * silme bilerek disarida: hesap silme zaten ADR-031'in kendi isi
 * (DELETE /api/v1/me henuz yazilmadi), parola degistirme de kullanici
 * e-posta koduyla girebildigi surece acil degil. Kucuk ve test edilebilir
 * kalmasi tercih edildi.
 */
export function UserMenu({
  displayName,
  email,
  avatarUrl,
  hasImage,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  hasImage?: boolean | null;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);

    /**
     * NEDEN DUZ fetch, authClient.signOut() DEGIL:
     * authClient'i buraya import etmek, better-auth/react + better-fetch'i
     * (app) altindaki HER SAYFANIN istemci paketine sokardi. Cikis ise TEK
     * bir POST - bir kutuphaneyi uygulama kabugunun tamamina tasimak icin
     * fazla kucuk bir is.
     *
     * Giris ve kayit formlari authClient'i kullanmaya devam ediyor: onlar
     * yalnizca kendi sayfalarinda yukleniyor, bedeli orada kaliyor.
     *
     * Ayni kokene giden fetch Origin basligini kendisi ekliyor, yani
     * Better Auth'un CSRF kontrolu memnun.
     *
     * BURADA BIR ZAMANLAR IKI CIKIS VARDI (Promise.allSettled): biri Better
     * Auth'a, biri Clerk'e. Goc suresince zorunluydu - tarayici hangi
     * sistemde oturum oldugunu bilemiyor ve yalnizca birinden cikmak,
     * digerinin cerezini birakirdi; auth.ts bir sonraki istekte onu bulup
     * kullaniciyi ICERIDE tutardi. Sistem tek kalinca ikinci cagriya da
     * gerek kalmadi.
     */
    await fetch("/api/auth/sign-out", { method: "POST" });

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <Popover>
      {/* asChild YOK: buradaki Popover Base UI uzerine kurulu, Radix degil -
          tetikleyici kendi <button>'ini render ediyor. notification-bell.tsx
          de ayni sekilde kullaniyor. */}
      <PopoverTrigger
        aria-label={displayName}
        className="flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PersonAvatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          hasImage={hasImage}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {/* Ad e-postayla ayni olabilir (kod akisindaki yedek). Oyleyse
              ayni satiri iki kez gostermenin anlami yok. */}
          {email !== displayName ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => void signOut()}
          disabled={busy}
        >
          {t("ui.sign_out")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
