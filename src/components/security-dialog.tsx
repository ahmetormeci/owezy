"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode } from "@/components/qr-code";
import { authClient } from "@/lib/auth-client";
import { authErrorCode } from "@/lib/auth-errors";
import { useTranslate } from "@/lib/i18n";

/**
 * Hesap guvenligi ekrani: iki adimli dogrulamayi ac, dogrula, yedek kodlari
 * gor, kapat.
 *
 * NEDEN DIALOG, POPOVER ICINDE DEGIL: CURRENT_TASK'ta "ayri ekran ACMADAN"
 * yaziyor ve o kural burada da geciyor - yeni bir ROTA acmiyoruz, kullanici
 * bulundugu sayfada kaliyor. Ama kullanici menusunun popover'i 16rem genis;
 * bir QR kodu ile on yedek kod oraya sigmiyor. Dialog ikisini de sagliyor.
 *
 * NEDEN AYRI DOSYA VE TEMBEL YUKLENIYOR: user-menu.tsx (app)/layout.tsx'in
 * icinde, yani UYGULAMANIN HER SAYFASINDA. Bu bilesen QR ureticisini (uqr)
 * ve authClient'i tasiyor; dogrudan import edilseydi ikisi de her sayfanin
 * istemci paketine girerdi - oysa bu ekran yilda birkac kez aciliyor.
 * Bagi user-menu.tsx'te next/dynamic ile kuruluyor.
 *
 * AKIS UC PARCALI VE ORTASI ONEMLI:
 *   /two-factor/enable   -> gizli anahtar + yedek kodlar uretilir, 2FA HENUZ
 *                           ACILMAZ (twoFactor.verified = false)
 *   /two-factor/verify-totp -> 2FA BURADA acilir
 * Bu ayrimi biz kurmadik, eklentinin kendisi boyle (totp/index.mjs) - ve iyi
 * ki oyle: QR'i okutamayan kullanici yari yolda kilitlenmis olmuyor, cunku
 * dogrulayamadigi surece hesabi eskisi gibi calismaya devam ediyor.
 */

type Stage =
  | { name: "loading" }
  | { name: "unreadable" }
  | { name: "no-password" }
  | { name: "off" }
  | { name: "setup"; totpURI: string; backupCodes: string[] }
  | { name: "on"; backupCodes: string[] | null };

export function SecurityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const t = useTranslate();

  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ekran acilirken hesabin durumu bir kez okunuyor.
   *
   * OKUMANIN KENDISI BILESENIN DISINDA (readSecurityState, dosyanin sonunda)
   * ve icinde tek bir setState yok. Efekt yalnizca sonucu setState'e
   * BAGLIYOR. Bu bir bicim tercihi degil: efekt govdesinde setState cagirmak
   * zincirleme render uretiyor ve react-hooks/set-state-in-effect bunu
   * yakaliyor - kural, efektten ulasilabilen her setState'i sayiyor, await'in
   * arkasindakini bile. Isi saf bir fonksiyona tasiyinca hem kural memnun hem
   * de okuma mantigi React'siz kaliyor.
   *
   * cancelled: bilesen cevap donmeden kapatilirsa (kullanici ESC'e basar)
   * artik agacta olmayan bir bilesene setState cagrilmasin.
   *
   * DURUM PROP OLARAK GELMIYOR ve bunun iki sebebi var:
   *   1. Prop verilseydi kaynagi (app)/layout.tsx olurdu ve o layout HER
   *      sayfada calisiyor - parolanin varligini ogrenmek icin her sayfa
   *      yuklemesine bir sorgu daha eklenirdi.
   *   2. TAZELIK: 2FA'yi actiktan sonra prop, router.refresh() donene kadar
   *      eski degeri tasirdi.
   */
  useEffect(() => {
    let cancelled = false;
    void readSecurityState().then((next) => {
      if (!cancelled) setStage(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** "Tekrar dene" - bir olaydan tetiklendigi icin burada setState serbest. */
  function reload() {
    setStage({ name: "loading" });
    void readSecurityState().then(setStage);
  }

  /**
   * Butun cagrilarin ortak kuyrugu - giris formundakinin (sign-in-form.tsx)
   * ayni gerekcesi: better-fetch AG HATASINDA firlatiyor, { error }
   * dondurmuyor. finally olmasa dugme sonsuza kadar kapali kalirdi.
   */
  async function run<T>(
    call: () => Promise<{ data?: T | null; error?: { code?: string } | null }>,
  ): Promise<{ ok: boolean; data: T | null }> {
    if (busy) return { ok: false, data: null };
    setBusy(true);
    setError(null);
    try {
      const { data, error: apiError } = await call();
      if (apiError) {
        setError(t(authErrorCode(apiError) ?? "ui.sign_in_failed"));
        return { ok: false, data: null };
      }
      // "ok" ile "data" AYRI: basarili bir cevap veri tasimayabilir ve
      // yalnizca data'ya bakmak, o durumu sessizce basarisizlik sayardi.
      // Giris formundaki run() de ayni bicimi kullaniyor.
      return { ok: true, data: data ?? null };
    } catch (caught) {
      console.error("[security] istek gönderilemedi:", caught);
      setError(t("server.offline"));
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: React.FormEvent) {
    event.preventDefault();
    const { ok, data } = await run(() => authClient.twoFactor.enable({ password }));
    if (!ok) return;
    // totpURI yalnizca method === "totp" yanitinda var; bizde otpOptions
    // verilmedigi icin baska bir yol zaten uretilmiyor, ama tip birlesimi
    // her ikisini de tasiyor.
    if (data && "totpURI" in data && typeof data.totpURI === "string") {
      setPassword("");
      setStage({
        name: "setup",
        totpURI: data.totpURI,
        backupCodes: Array.isArray(data.backupCodes) ? data.backupCodes : [],
      });
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (stage.name !== "setup") return;
    const { ok } = await run(() => authClient.twoFactor.verifyTotp({ code }));
    if (!ok) return;
    setCode("");
    // Yedek kodlar EKRANDA KALIYOR: kullanici onlari kaydetmeden once
    // dogrulamis olabilir ve burada silmek, tek gosterim sansini elinden
    // almak olurdu.
    setStage({ name: "on", backupCodes: stage.backupCodes });
    toast.success(t("ui.two_factor_enabled"));
    // Sunucu bilesenleri kullanici satirini yeniden okusun.
    router.refresh();
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() => authClient.twoFactor.disable({ password }));
    if (!ok) return;
    setPassword("");
    setStage({ name: "off" });
    toast.success(t("ui.two_factor_disabled"));
    router.refresh();
  }

  async function regenerate(event: React.FormEvent) {
    event.preventDefault();
    const { ok, data } = await run(() =>
      authClient.twoFactor.generateBackupCodes({ password }),
    );
    if (!ok) return;
    setPassword("");
    setStage({
      name: "on",
      backupCodes: data && Array.isArray(data.backupCodes) ? data.backupCodes : [],
    });
    toast.success(t("ui.backup_codes_regenerated"));
  }

  async function copyBackupCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success(t("ui.backup_codes_copied"));
    } catch {
      toast.error(t("ui.backup_codes_copy_failed"));
    }
  }

  /** Parola alani: uc ayri islem de (ac / kapat / kod yenile) bunu istiyor. */
  function passwordField() {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="security-password">{t("ui.password")}</Label>
        <Input
          id="security-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={busy}
        />
      </div>
    );
  }

  function backupCodeList(codes: string[]) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("ui.backup_codes")}</p>
        <p className="text-xs text-muted-foreground">{t("ui.backup_codes_hint")}</p>
        {/* aria-label: ekran okuyucu listeyi baglamsiz gormesin - ve testin
            "yedek kodlar" listesini digerlerinden ayirmasini saglar. */}
        <ul
          aria-label={t("ui.backup_codes")}
          className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/60 p-3 font-mono text-xs"
        >
          {codes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copyBackupCodes(codes)}
        >
          {t("ui.copy")}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ui.two_factor_title")}</DialogTitle>
          <DialogDescription>
            {stage.name === "on" ? t("ui.two_factor_on_hint") : t("ui.two_factor_off_hint")}
          </DialogDescription>
        </DialogHeader>

        {stage.name === "loading" ? (
          <p className="text-sm text-muted-foreground">{t("ui.loading")}</p>
        ) : null}

        {stage.name === "unreadable" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-destructive">{t("server.unexpected")}</p>
            <Button type="button" variant="outline" onClick={reload}>
              {t("ui.try_again")}
            </Button>
          </div>
        ) : null}

        {/*
          PAROLASIZ KULLANICI. Burada bir dugme gosterip INVALID_PASSWORD
          almasini beklemek, CURRENT_TASK'ta "dugme calismiyor gibi
          gorunmemeli" diye yazan seyin ta kendisi olurdu. Sebep de cikis da
          soyleniyor.
        */}
        {stage.name === "no-password" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t("ui.two_factor_needs_password")}
            </p>
            {/* Link, <Button> icine SARILMIYOR: bu bir gezinme, bir eylem
                degil. Kodun geri kalaninda da ayni bicim kullaniliyor
                (join/[token]/page.tsx). */}
            <Link
              href="/reset-password"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => onOpenChange(false)}
            >
              {t("ui.set_password")}
            </Link>
          </div>
        ) : null}

        {stage.name === "off" ? (
          <form onSubmit={enable} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("ui.two_factor_password_hint")}
            </p>
            {passwordField()}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {t("ui.two_factor_enable")}
            </Button>
          </form>
        ) : null}

        {stage.name === "setup" ? (
          <form onSubmit={confirm} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">{t("ui.two_factor_scan")}</p>
              {/* Beyaz kutu: QR temaya uymuyor (bkz. qr-code.tsx) ve karanlik
                  temada aksi halde ekrana yapistirilmis gibi durur. */}
              <div className="rounded-lg bg-white p-2">
                <QrCode text={stage.totpURI} label={t("ui.two_factor_qr_label")} />
              </div>
              <div className="w-full">
                <p className="text-xs text-muted-foreground">
                  {t("ui.two_factor_secret")}
                </p>
                {/* <code>: bu bir ANAHTAR, duz metin degil - kullanici onu
                    secip kopyaliyor. Semantik etiket ayni zamanda testin
                    tutunacagi saglam bir yer (projede data-testid kullanilmiyor). */}
                <code className="block break-all font-mono text-xs">
                  {readSecret(stage.totpURI)}
                </code>
              </div>
            </div>

            {backupCodeList(stage.backupCodes)}

            <div className="flex flex-col gap-2">
              <Label htmlFor="security-code">{t("ui.verification_code")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("ui.two_factor_confirm_hint")}
              </p>
              <Input
                id="security-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("ui.code_placeholder")}
                required
                disabled={busy}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {t("ui.two_factor_verify")}
            </Button>
          </form>
        ) : null}

        {stage.name === "on" ? (
          <div className="flex flex-col gap-4">
            {stage.backupCodes ? backupCodeList(stage.backupCodes) : null}
            <form onSubmit={disable} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t("ui.two_factor_password_hint")}
              </p>
              {passwordField()}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-2">
                <Button type="submit" variant="outline" disabled={busy}>
                  {t("ui.two_factor_disable")}
                </Button>
                {/*
                  Yedek kodlar TEK KULLANIMLIK ve on tane. Yenileme olmasaydi,
                  kodlarini harcayan kullanicinin telefonu bozuldugunda geriye
                  hicbir yol kalmazdi.

                  type="button" + onClick: ayni <form> icinde ikinci bir
                  gonderim dugmesi olsaydi Enter tusu hangisini calistiracagi
                  belirsiz olurdu.
                */}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={(event) => void regenerate(event)}
                >
                  {t("ui.backup_codes_regenerate")}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * otpauth://totp/Owezy:ali@example.com?secret=... adresinden gizli anahtari
 * cikarir.
 *
 * NEDEN GOSTERIYORUZ: QR okutmak her zaman mumkun degil - masaustunde
 * authenticator kullanan, kamerasi calismayan ya da ekrani buyutemeyen biri
 * anahtari elle giriyor. Butun authenticator uygulamalari bu yolu destekliyor.
 *
 * new URL() otpauth semasini ayristiriyor (olculdu); "ozel" olmayan semalarda
 * da searchParams calisiyor. Yine de ayristirma basarisiz olursa URI'nin
 * kendisi donuyor: yanlis bir sey gostermektense ham degeri gostermek daha
 * dogru, cunku kullanici onu da uygulamaya yapistirabilir.
 */
function readSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? totpURI;
  } catch {
    return totpURI;
  }
}

/**
 * Hesabin guvenlik durumunu okur. React BILMIYOR: ne state'e dokunuyor ne de
 * bir kancaya bagli - yalnizca "sunucu ne diyor" sorusunu cevapliyor.
 *
 * HATA DA BIR DURUM: aga ulasilamadiginda ya da yanit beklenen bicimde
 * degilse "unreadable" donuyor. Sessizce "kapali" demek, kullaniciya iki
 * adimli dogrulamasinin kapali oldugunu SOYLEMEK olurdu - oysa bilmiyoruz.
 */
async function readSecurityState(): Promise<Stage> {
  try {
    const response = await fetch("/api/v1/me");
    const body: unknown = await response.json();
    if (!response.ok || typeof body !== "object" || body === null) {
      return { name: "unreadable" };
    }
    const { user, hasPassword } = body as {
      user?: { twoFactorEnabled?: boolean };
      hasPassword?: boolean;
    };
    if (!hasPassword) {
      return { name: "no-password" };
    }
    return user?.twoFactorEnabled ? { name: "on", backupCodes: null } : { name: "off" };
  } catch (caught) {
    console.error("[security] hesap durumu okunamadı:", caught);
    return { name: "unreadable" };
  }
}
