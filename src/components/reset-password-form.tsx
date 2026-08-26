"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorCode } from "@/lib/auth-errors";
import { useTranslate } from "@/lib/i18n";

/**
 * Parola belirleme / yenileme. Faz 27.3.
 *
 * NEDEN BU EKRAN IKI ADIMLI DOGRULAMAYLA BIRLIKTE GELDI:
 * bugune kadar "parolami unuttum" diye bir ekrana ihtiyac yoktu, cunku
 * herkesin bir kacis kapisi vardi - e-posta koduyla girmek. 2FA o kapiyi
 * KAPATIYOR (better-auth.ts'teki kanca: 2FA acik hesap e-posta koduyla
 * giremez). Yani bu ekran olmadan 2FA acan bir kullanici, parolasini
 * unuttugu anda hesabina BIR DAHA giremezdi. Yedek kodlar da kurtarmazdi:
 * onlar IKINCI faktor, birincisi yine parola.
 *
 * AYNI EKRAN "HIC PAROLAM YOK" DURUMUNU DA COZUYOR - ve bu sansa degil,
 * olculdu: /email-otp/reset-password, kullanicinin credential hesabi yoksa
 * ONU YARATIYOR (email-otp/routes.mjs). Yani e-posta koduyla girmis,
 * parolasi hic olmamis biri de buradan bir parola kurabiliyor - ve ancak
 * ondan sonra 2FA acabiliyor.
 *
 * SUNUCUYA TEK BIR SATIR KOD EKLENMEDI: iki uc da (request-password-reset,
 * reset-password) emailOTP eklentisiyle birlikte zaten geliyordu ve
 * gonderdikleri posta bizim kendi sendOtpEmail'imizden gecip
 * "email.otp_subject_forget_password" konusuyla cikiyor - o metin de
 * sozlukte ZATEN vardi.
 *
 * OTURUM ACMIYOR: reset-password bir oturum kurmuyor. Yani bu yol 2FA'yi
 * ATLATMIYOR - kullanici yeni parolasiyla giris yapiyor ve ikinci faktor
 * yine soruluyor.
 */
type Step = "email" | "reset" | "done";

export function ResetPasswordForm() {
  const t = useTranslate();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Giris formundakinin aynisi; gerekcesi orada yaziyor (try/catch/finally). */
  async function run(
    call: () => Promise<{ error?: { code?: string } | null }>,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const { error: apiError } = await call();
      if (apiError) {
        setError(t(authErrorCode(apiError) ?? "ui.sign_in_failed"));
        return false;
      }
      return true;
    } catch (caught) {
      console.error("[auth] istek gönderilemedi:", caught);
      setError(t("server.offline"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    /**
     * KAYITLI OLMAYAN ADRES DE BASARILI DONUYOR - ve bu eklentinin bilincli
     * davranisi (routes.mjs: kullanici yoksa da ctx.json({success:true})).
     * Ayirt etseydi, bir adresin sistemde olup olmadigi buradan tek tek
     * sinanabilirdi. Biz de ayni sekilde davraniyoruz: her durumda kod
     * adimina geciyoruz.
     */
    if (await run(() => authClient.emailOtp.requestPasswordReset({ email }))) {
      setStep("reset");
    }
  }

  async function submitNewPassword(event: React.FormEvent) {
    event.preventDefault();
    const ok = await run(() =>
      authClient.emailOtp.resetPassword({ email, otp: code, password }),
    );
    if (!ok) return;
    setCode("");
    setPassword("");
    setStep("done");
  }

  const redirectUrl = searchParams.get("redirect_url");
  const signInHref = `/sign-in${
    redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""
  }`;

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t("ui.password_updated")}</p>
        <Link href={signInHref} className="text-sm underline underline-offset-4">
          {t("ui.sign_in")}
        </Link>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={submitNewPassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-code">{t("ui.verification_code")}</Label>
          <p className="text-sm text-muted-foreground">{t("ui.code_sent_to", { email })}</p>
          <Input
            id="reset-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t("ui.code_placeholder")}
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-password">{t("ui.new_password")}</Label>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            // Kayit formundakiyle AYNI kural (Better Auth varsayilani 8).
            // Asil kontrol yine sunucuda.
            minLength={8}
            required
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={busy}>
          {t("ui.save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          disabled={busy}
        >
          {t("ui.change_email")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("ui.reset_password_hint")}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-email">{t("ui.email")}</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t("ui.email_placeholder")}
          autoFocus
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {t("ui.send_code")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={signInHref} className="underline underline-offset-4">
          {t("ui.sign_in")}
        </Link>
      </p>
    </form>
  );
}
