"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorCode } from "@/lib/auth-errors";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { useTranslate } from "@/lib/i18n";

/**
 * Giris formu. Clerk'in <SignIn /> bileseninin yerini aliyor.
 *
 * AKIS MOBILDEKININ AYNISI (mobile/app/sign-in.tsx): birincil yol e-posta
 * kodu, parola ikincil bir baglantinin arkasinda. Iki istemcinin ayni
 * akisi farkli sirayla sunmasi, ayni uygulamayi iki ayri urun gibi
 * gosterirdi - ve destek sorusu geldiginde hangisinden bahsedildigi
 * belirsiz olurdu.
 *
 * METINLER ZATEN SOZLUKTEYDI: hepsi mobil fazinda (23) messages.ts'e
 * tasinmisti. Bu form neredeyse hic yeni metin getirmedi.
 */
type Step = "email" | "code" | "password";

export function SignInForm() {
  const router = useRouter();
  const t = useTranslate();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Giris tamamlandi: sunucu tarafi yeniden calissin diye tam gecis. */
  function finish() {
    /**
     * NEREYE DONECEGIMIZ ADRESTE YAZILI OLABILIR ve bu bir sussuz ihtiyacti:
     * davet sayfasi girisi olmayan ziyaretciyi
     * /sign-in?redirect_url=/join/<token> adresine gonderiyor. Bu satir
     * eksikken giris calisiyor ama kullanici davet sayfasina DONMUYORDU -
     * uygulamanin ana ekranina dusuyor ve "Gruba katil" dugmesini hic
     * gormuyordu. Yani davet linki, girisi olmayan biri icin ise yaramiyordu.
     *
     * Clerk'in <SignIn /> bileseni bunu kendisi yapiyordu; 25.4'te yerine
     * kendi formumuzu koyduk ve davranis taşınmadı.
     *
     * DEGER DOGRULANIYOR: adres cubugundan geliyor, yani saldirgan yazabilir
     * (bkz. lib/safe-redirect.ts).
     */
    const target = safeRedirectPath(searchParams.get("redirect_url"));

    // router.push DEGIL, replace + refresh: giris ekrani gecmise
    // yazilmamali (geri tusu kullaniciyi oturum acmis haldeyken giris
    // formuna dondururdu), ve sunucu bileseni yeni oturumu gormek icin
    // yeniden calismali.
    router.replace(target);
    router.refresh();
  }

  /**
   * Butun cagrilarin ORTAK kuyrugu.
   *
   * try/catch/finally UCU DE ZORUNLU ve bu OLCULEREK ogrenildi. Once boyle
   * degildi: cagri await ediliyor, hemen ardindan setBusy(false) yaziliyordu.
   * better-fetch ag hatasinda { error } DONDURMUYOR, FIRLATIYOR - yani o satira
   * hic gelinmiyordu. Sonucu su oluyordu: dugme sonsuza kadar kapali kaliyor ve
   * ekranda HICBIR SEY yazmiyor. Kullanicinin gordugu sey "uygulama dondu".
   *
   * Tarayicida yeniden uretildi: sunucu kapatilip dugmeye basildi, konsolda
   * "Uncaught (in promise) TypeError: Failed to fetch" cikti, dugme soluk kaldi.
   *
   * finally SART: catch icinde setBusy(false) yazmak yetmez - ileride buraya
   * erken bir return eklenirse dugme yine kilitlenirdi.
   */
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
      // Buraya yalnizca istek HIC GONDERILEMEDIGINDE geliniyor: sunucu kapali,
      // cihaz cevrimdisi, DNS yok. Sozlukteki cumle mobilde de ayni durumda
      // gosteriliyor (mobile/lib/api.ts).
      console.error("[auth] istek gönderilemedi:", caught);
      setError(t("server.offline"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const ok = await run(() =>
      authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }),
    );
    if (ok) setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (await run(() => authClient.signIn.emailOtp({ email, otp: code }))) finish();
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (await run(() => authClient.signIn.email({ email, password }))) finish();
  }

  /** Basa donus: adimi VE girilen kodu birlikte temizliyor. */
  function startOver() {
    setStep("email");
    setCode("");
    setError(null);
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">{t("ui.verification_code")}</Label>
          <p className="text-sm text-muted-foreground">{t("ui.code_sent_to", { email })}</p>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // inputMode: mobil tarayicida sayi tusunu aciyor. autoComplete
            // ise iOS/Android'in gelen SMS ya da e-postadaki kodu teklif
            // etmesini sagliyor.
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t("ui.code_placeholder")}
            autoFocus
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {t("ui.sign_in")}
        </Button>
        <Button type="button" variant="ghost" onClick={startOver} disabled={busy}>
          {t("ui.change_email")}
        </Button>
      </form>
    );
  }

  const passwordStep = step === "password";

  return (
    <form
      onSubmit={passwordStep ? signInWithPassword : sendCode}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("ui.email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t("ui.email_placeholder")}
          autoFocus
          required
        />
      </div>

      {passwordStep ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("ui.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={busy}>
        {passwordStep ? t("ui.sign_in") : t("ui.send_code")}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setError(null);
          setStep(passwordStep ? "email" : "password");
        }}
        disabled={busy}
      >
        {passwordStep ? t("ui.sign_in_with_code") : t("ui.sign_in_with_password")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("ui.no_account_yet")}{" "}
        {/* redirect_url TASINIYOR: kullanici buradan kayda gecerse davet
            adresi kaybolmamali - zincir orada kopardi. */}
        <Link
          href={`/sign-up${
            searchParams.get("redirect_url")
              ? `?redirect_url=${encodeURIComponent(searchParams.get("redirect_url")!)}`
              : ""
          }`}
          className="underline underline-offset-4"
        >
          {t("ui.sign_up")}
        </Link>
      </p>
    </form>
  );
}
