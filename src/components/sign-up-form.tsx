"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorCode } from "@/lib/auth-errors";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { useTranslate } from "@/lib/i18n";

/**
 * Kayit formu. Clerk'in <SignUp /> bileseninin yerini aliyor.
 *
 * NEDEN AD SORULUYOR: e-posta koduyla giren birine Better Auth bos bir ad
 * yaziyor ve biz onu e-postayla dolduruyoruz (bkz. better-auth.ts'teki
 * databaseHooks). O bir YEDEK; gercek adi soracak tek yer burasi. Uye
 * listesinde, bakiyelerde ve odesme planinda gorunecek sey bu.
 *
 * NEDEN PAROLALI KAYIT, KODLA DEGIL: kod akisinda ad sorulacak bir adim
 * yok - Better Auth'un sign-in/email-otp ucu yalnizca e-posta ve kod
 * aliyor. Ad istiyorsak kayit parolayla kurulmali. Kod isteyenler zaten
 * giris ekranindan, kaydolmadan girebiliyor.
 *
 * KAYITTAN SONRA DOGRULAMA ADIMI VAR (Faz 28) ve bu bir veri kaybini
 * kapatiyor: dogrulanmamis bir hesapta e-posta koduyla giris yapmak
 * PAROLAYI SILIYOR. Sebep Better Auth'un revokeUnprovenAccountAccess'i ve
 * gerekcesi dogru - emailVerified=false bir satir, bagli erisimin posta
 * kutusu sahibine ait oldugunun kaniti degil. Biz e-postayi hic
 * dogrulamadigimiz icin parolayla kaydolan HERKES bu tuzaga acikti.
 *
 * ADIM ATLANABILIR ("Simdi degil"): girisi engellemek ADR-035'i geri
 * acardi. Atlayan kullanici korunmuyor ve bunu guvenlik ekraninda
 * gormeye devam ediyor.
 */
export function SignUpForm() {
  const router = useRouter();
  const t = useTranslate();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Kayit bitti, dogrulama kodu bekleniyor. */
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Kayit ya da dogrulama bitti: sunucu tarafi yeniden calissin diye tam gecis. */
  function finish() {
    router.replace(safeRedirectPath(searchParams.get("redirect_url")));
    router.refresh();
  }

  async function verifyEmail(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email,
        otp: code,
      });
      if (verifyError) {
        setError(t(authErrorCode(verifyError) ?? "ui.sign_in_failed"));
        return;
      }
      toast.success(t("ui.verify_email_done"));
      finish();
    } catch (caught) {
      console.error("[auth] doğrulama isteği gönderilemedi:", caught);
      setError(t("server.offline"));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    /**
     * try/catch/finally: better-fetch ag hatasinda FIRLATIYOR, { error }
     * dondurmuyor. Once yalnizca donen hataya bakiliyordu ve sunucuya
     * ulasilamadiginda setBusy(false) hic calismiyordu - dugme sonsuza kadar
     * kapali, ekranda hicbir mesaj yok. Giris formunda tarayicida yeniden
     * uretildi; ayni hata buradaydi.
     */
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });

      if (signUpError) {
        setError(t(authErrorCode(signUpError) ?? "ui.sign_in_failed"));
        return;
      }

      /**
       * KAYIT BITTI AMA HENUZ ICERI GONDERMIYORUZ. Sunucu kayitla birlikte
       * bir dogrulama kodu yolladi (better-auth.ts: sendVerificationOnSignUp)
       * ve bu adim, kullanicinin parolasini ilerideki bir veri kaybindan
       * koruyan tek sey. Oturum ZATEN acildi; atlayan da iceri giriyor.
       */
      setVerifying(true);
    } catch (caught) {
      console.error("[auth] kayıt isteği gönderilemedi:", caught);
      setError(t("server.offline"));
    } finally {
      setBusy(false);
    }
  }

  if (verifying) {
    return (
      <form onSubmit={verifyEmail} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="verify-code">{t("ui.verify_email_title")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("ui.verify_email_hint", { email })}
          </p>
          <Input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t("ui.code_placeholder")}
            autoFocus
            required
          />
        </div>

        {/* NE KAYBEDECEGI YAZILI, "guvenlik icin" denmiyor. Kullanicinin
            atlayip atlamayacagina karar verebilmesi icin somut olmali. */}
        <p className="text-sm text-muted-foreground">{t("ui.verify_email_why")}</p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={busy}>
          {t("ui.verify_email_action")}
        </Button>
        <Button type="button" variant="ghost" onClick={finish} disabled={busy}>
          {t("ui.verify_email_later")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("ui.display_name")}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder={t("ui.display_name_placeholder")}
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("ui.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t("ui.email_placeholder")}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("ui.password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          // Sunucudaki kuralin AYNISI (Better Auth varsayilani 8). Buradaki
          // kontrol yalnizca hizli geri bildirim icin; asil kontrol yine
          // sunucuda ve atlanabilecegi varsayiliyor.
          minLength={8}
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {t("ui.sign_up")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("ui.already_have_account")}{" "}
        <Link
          href={`/sign-in${
            searchParams.get("redirect_url")
              ? `?redirect_url=${encodeURIComponent(searchParams.get("redirect_url")!)}`
              : ""
          }`}
          className="underline underline-offset-4"
        >
          {t("ui.sign_in")}
        </Link>
      </p>
    </form>
  );
}
