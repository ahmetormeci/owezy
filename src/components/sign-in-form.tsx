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
 *
 * IKINCI FAKTOR ADIMI 27.3'TE EKLENDI. Ayni bilesenin icinde, ayri bir
 * sayfa degil: kullanicinin gozunde tek bir giris isi bu, ve ortada bir
 * yonlendirme olsaydi tarayicinin geri tusu onu yarim kalmis bir meydan
 * okumaya geri dondururdu.
 */
type Step = "email" | "code" | "password" | "two-factor";

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
  /** Ikinci faktorde: uygulamadaki kod yerine yedek kod giriliyor. */
  const [usingBackupCode, setUsingBackupCode] = useState(false);
  /** "Bu cihazi 30 gun hatirla" - imzali bir cerez birakiyor. */
  const [trustDevice, setTrustDevice] = useState(false);

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
   *
   * SONUC "ok" ILE "data"YI AYRI TASIYOR, cunku basari her zaman "giris
   * bitti" demek degil: 2FA acikken signIn.email BASARIYLA donuyor ama
   * icinde { twoFactorRedirect: true } var. Sadece boolean donseydi bu
   * bilgiyi tasiyacak yer olmazdi (asagida).
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
      return { ok: true, data: data ?? null };
    } catch (caught) {
      // Buraya yalnizca istek HIC GONDERILEMEDIGINDE geliniyor: sunucu kapali,
      // cihaz cevrimdisi, DNS yok. Sozlukteki cumle mobilde de ayni durumda
      // gosteriliyor (mobile/lib/api.ts).
      console.error("[auth] istek gönderilemedi:", caught);
      setError(t("server.offline"));
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() =>
      authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }),
    );
    if (ok) setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() => authClient.signIn.emailOtp({ email, otp: code }));
    if (ok) finish();
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    const { ok, data } = await run(() => authClient.signIn.email({ email, password }));
    if (!ok) return;

    /**
     * 2FA ACIKKEN BU CAGRI HATA DONDURMUYOR - OLCULDU.
     *
     * Eklenti, parola dogruysa once bir oturum yaratiyor, sonra 2FA'nin
     * beklediginin farkina varip O OTURUMU SILIYOR ve yerine imzali bir
     * "meydan okuma" cerezi birakiyor (two-factor/index.mjs). Geriye donen
     * sey { twoFactorRedirect: true }; error hala null.
     *
     * Yalnizca error'a bakan bir kod burada finish() cagirirdi ve kullanici
     * OTURUMSUZ halde ana ekrana gonderilirdi; layout onu aninda /sign-in'e
     * geri atardi. Kullanicinin gordugu sey bir dongu olurdu - hicbir hata
     * mesaji olmadan.
     *
     * Kod da parola da TEMIZLENIYOR: bu noktadan sonra ikisi de gerekmiyor
     * ve parolayi bellekte tutmanin sebebi yok.
     */
    if (data && typeof data === "object" && "twoFactorRedirect" in data) {
      setPassword("");
      setCode("");
      setUsingBackupCode(false);
      setStep("two-factor");
      return;
    }

    finish();
  }

  async function verifySecondFactor(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() =>
      usingBackupCode
        ? authClient.twoFactor.verifyBackupCode({ code, trustDevice })
        : authClient.twoFactor.verifyTotp({ code, trustDevice }),
    );
    if (ok) finish();
  }

  /** Basa donus: adimi VE girilen kodu birlikte temizliyor. */
  function startOver() {
    setStep("email");
    setCode("");
    setError(null);
    setUsingBackupCode(false);
  }

  /** Adres cubugundan gelen davet adresi, gecilen her baglantida tasiniyor. */
  const redirectUrl = searchParams.get("redirect_url");
  const carryRedirect = redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : "";

  if (step === "two-factor") {
    return (
      <form onSubmit={verifySecondFactor} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="second-factor">
            {usingBackupCode ? t("ui.backup_code") : t("ui.verification_code")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {usingBackupCode ? t("ui.backup_code_hint") : t("ui.totp_hint")}
          </p>
          <Input
            id="second-factor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // Yedek kodlar rakam DEGIL; sayi klavyesi acmak orada isi
            // zorlastirirdi.
            inputMode={usingBackupCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            /**
             * autoCapitalize="none" ZORUNLU VE BU CIHAZDA OLCULDU.
             *
             * Yedek kodlar BUYUK/KUCUK HARFE DUYARLI ("pDHBX-yCqQf") ve iOS
             * Safari metin girdilerinde ilk harfi kendiliginden BUYUTUYOR.
             * Simulatorde gercekten yasandi: kod "PDHBX-yCqQf" olarak gitti
             * ve reddedildi. Kullanicinin gordugu sey "Kod dogrulanamadi" -
             * yani dogru kodu yazdigi halde giremeyen, sebebini de asla
             * anlayamayan biri. Ustelik tam olarak "telefonumu kaybettim"
             * yolunda, yani baska secenegi olmadigi anda.
             *
             * Sayi klavyesinde sorun cikmiyordu; bu yuzden ancak yedek kod
             * denenince gorunur oluyor.
             */
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={usingBackupCode ? undefined : t("ui.code_placeholder")}
            autoFocus
            required
          />
        </div>

        {/*
          "BU CIHAZI HATIRLA" YALNIZCA WEB'DE. Ozellik imzali bir cerezle
          yurutuyor (verify-two-factor.mjs) ve mobil istemci bilerek
          credentials:"omit" kullaniyor (ADR-038) - yani orada tasinamaz.

          Kendi <input>'u: projede bir onay kutusu bileseni yok ve tek bir
          kutu icin bir tane eklemek, bir bagimliligi tek kullanim ugruna
          getirmek olurdu. <label> sarmalayici sayesinde metne tiklamak da
          calisiyor.
        */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="size-4 accent-primary"
            disabled={busy}
          />
          {t("ui.remember_this_device")}
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" disabled={busy}>
          {t("ui.sign_in")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setUsingBackupCode(!usingBackupCode);
            setCode("");
            setError(null);
          }}
          disabled={busy}
        >
          {usingBackupCode ? t("ui.use_authenticator") : t("ui.use_backup_code")}
        </Button>

        {/* Cikis kapisi: telefonu da yedek kodlari da yaninda olmayan biri
            en azindan bu ekranda mahsur kalmamali. */}
        <Button type="button" variant="ghost" onClick={startOver} disabled={busy}>
          {t("ui.change_email")}
        </Button>
      </form>
    );
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

      {/*
        PAROLA YENILEME YALNIZCA PAROLA ADIMINDA GORUNUYOR - ve bu 2FA ile
        birlikte ZORUNLU hale geldi.

        2FA acilmadan once "parolami unuttum"un kacis kapisi e-posta koduyla
        girmekti. 2FA acikken o kapi KAPALI (better-auth.ts'teki kanca):
        kullanici parolayla girmek ZORUNDA. Bu ekran olmasaydi, parolasini
        unutan bir 2FA kullanicisinin hicbir yolu kalmazdi - yedek kodlar da
        kurtarmazdi, cunku onlar IKINCI faktor; birincisi yine parola.
      */}
      {passwordStep ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={`/reset-password${carryRedirect}`}
            className="underline underline-offset-4"
          >
            {t("ui.forgot_password")}
          </Link>
        </p>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        {t("ui.no_account_yet")}{" "}
        {/* redirect_url TASINIYOR: kullanici buradan kayda gecerse davet
            adresi kaybolmamali - zincir orada kopardi. */}
        <Link href={`/sign-up${carryRedirect}`} className="underline underline-offset-4">
          {t("ui.sign_up")}
        </Link>
      </p>
    </form>
  );
}
