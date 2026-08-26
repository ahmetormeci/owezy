"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersonAvatar } from "@/components/person-avatar";
import { apiRequest } from "@/lib/api-client";
import { updateMeSchema } from "@/lib/me-schemas";
import { useTranslate } from "@/lib/i18n";

/**
 * GUVENLIK EKRANI TEMBEL YUKLENIYOR.
 *
 * Bu bilesen (app)/layout.tsx'in icinde, yani uygulamanin HER sayfasinda.
 * Guvenlik ekrani ise QR ureticisini (uqr) ve Better Auth'un tarayici
 * istemcisini tasiyor. Dogrudan import edilseydi ikisi de her sayfanin
 * istemci paketine girerdi - oysa o ekran yilda birkac kez aciliyor.
 *
 * next/dynamic + kosullu render: modul, kullanici menuden guvenlik satirina
 * BASTIGINDA indiriliyor.
 */
const SecurityDialog = dynamic(() =>
  import("@/components/security-dialog").then((m) => m.SecurityDialog),
);

/**
 * Basliktaki kullanici menusu. Clerk'in <UserButton /> bileseninin yerini
 * aldi (Faz 25.4) ve bu kozmetik bir degisiklik degildi: <UserButton />
 * yalnizca CLERK'IN oturumunu biliyordu, Better Auth ile giren kullaniciyi
 * tanimiyordu.
 *
 * ADI DUZENLEME BURADA, AYRI BIR HESAP EKRANINDA DEGIL. 25.4'te "menude
 * yalnizca ad, e-posta ve cikis" diye karar verilmisti ve o karar duruyor;
 * ad duzenleme yeni bir ekran ACMIYOR, zaten adi gosteren yerin yanina
 * ekleniyor.
 *
 * NEDEN GEREKTI: adi degistirmenin tek yolu Clerk'in kendi profil arayuzuydu
 * ve degisiklik webhook ile bize geliyordu (ADR-011). Clerk gidince o yol da
 * gitti - e-posta koduyla giren birinin adi e-postasi olarak kaliyor ve uye
 * listesinde, bakiyelerde, fiste oyle gorunuyordu. Sokme isi bu boslugu
 * KENDISI acti, o yuzden kapatmasi da ayni fazin isi.
 *
 * HESAP SILME hala yok: o ADR-031'in kendi isi (DELETE /api/v1/me henuz
 * yazilmadi). Parola degistirme de yok - kullanici e-posta koduyla
 * girebildigi surece acil degil.
 */
export function UserMenu({
  displayName,
  email,
  avatarUrl,
  hasImage,
  twoFactorEnabled,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  hasImage?: boolean | null;
  twoFactorEnabled: boolean;
}) {
  const router = useRouter();
  const t = useTranslate();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | null>(null);

  function stopEditing() {
    setEditing(false);
    setError(null);
    // Yazilan ama kaydedilmeyen metin BIRAKILMIYOR: menu yeniden acildiginda
    // gercek adin durmasi lazim, yoksa kullanici degisikligin kaydedildigini
    // sanir.
    setName(displayName);
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    // Dogrulama SUNUCUYLA AYNI semadan geciyor (me-schemas.ts). Iki ayri kural
    // yazmak, formun kabul edip API'nin reddettigi bir deger demek olurdu.
    const parsed = updateMeSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "validation.invalid"));
      return;
    }

    // Degismediyse istek atmiyoruz; "kaydedildi" demek de yaniltici olurdu.
    if (parsed.data.displayName === displayName) {
      stopEditing();
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: parsed.data.displayName }),
      });
      setEditing(false);
      toast.success(t("ui.name_saved"));
      // TAM TAZELEME: ad yalnizca burada degil, uye listesinde, bakiyelerde ve
      // fiste de gorunuyor. Yalnizca bu bileseni guncellemek, sayfanin geri
      // kalanini eski adla birakirdi.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("server.unexpected"));
    } finally {
      setBusy(false);
    }
  }

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
    /**
     * try/catch: fetch AG HATASINDA FIRLATIYOR. Once sarilmamisti ve sonucu
     * giris formundakinin aynisiydi - istek gonderilemeyince setBusy(false)
     * hic calismiyor, dugme sonsuza kadar kapali kaliyordu.
     *
     * BASARISIZ CIKISTA YONLENDIRME YAPMIYORUZ ve bu bilincli: oturum cerezi
     * hala yerinde oldugu icin /sign-in bizi aninda geri atardi. Kullanici
     * cikamadigini BILMELI - sessizce ayni yerde kalmak, "bastim ama bir sey
     * olmadi" demek olurdu (Faz 24'te mobilde tam bu hata duzeltildi).
     */
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch (caught) {
      console.error("[auth] çıkış isteği gönderilemedi:", caught);
      toast.error(t("server.offline"));
      setBusy(false);
      return;
    }

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
    {/*
      MENU KONTROLLU (open + onOpenChange). Denetimsizken guvenlik ekrani
      acildiginda menu ARKADA ACIK kaliyordu; dialog kapaninca kullanici
      hic dokunmadigi bir menuyle karsi karsiya geliyordu.
    */}
    <Popover
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) stopEditing();
      }}
    >
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
      <PopoverContent align="end" className="w-64 p-2">
        {editing ? (
          <form onSubmit={saveName} className="flex flex-col gap-2 px-2 py-1.5">
            <Label htmlFor="display-name" className="text-xs text-muted-foreground">
              {t("ui.display_name")}
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
              maxLength={100}
              disabled={busy}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {t("ui.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={stopEditing}
                disabled={busy}
              >
                {t("ui.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <>
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
              onClick={() => setEditing(true)}
            >
              {t("ui.edit")}
            </Button>
            {/*
              DURUM SATIRIN UZERINDE YAZIYOR ("Kapali" / "Acik"). Yalnizca
              baslik olsaydi kullanici, iki adimli dogrulamanin acik olup
              olmadigini ogrenmek icin ekrani ACMAK zorunda kalirdi - oysa
              cevap zaten burada, bedava.

              Deger PROP'tan geliyor: layout kullanici satirini zaten
              okuyor, yani ek bir sorgu yok. Ekranin KENDISI durumu bir kez
              daha sunucudan cekiyor, cunku orada tazelik onemli.
            */}
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                setSecurityOpen(true);
              }}
            >
              <span className="truncate">{t("ui.two_factor_title")}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {t(twoFactorEnabled ? "ui.two_factor_is_on" : "ui.two_factor_is_off")}
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => void signOut()}
              disabled={busy}
            >
              {t("ui.sign_out")}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
    {/* Popover'in DISINDA: menu kapaninca dialog da kapanmamali. Popover
        kapandiginda icerigini agactan cikariyor. */}
    {securityOpen ? (
      <SecurityDialog open onOpenChange={setSecurityOpen} />
    ) : null}
    </>
  );
}
