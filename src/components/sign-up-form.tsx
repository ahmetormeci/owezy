"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorCode } from "@/lib/auth-errors";
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
 */
export function SignUpForm() {
  const router = useRouter();
  const t = useTranslate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Giris formuyla ayni gerekce: giris/kayit ekrani gecmise yazilmamali,
      // ve sunucu bilesenleri yeni oturumu gormek icin yeniden calismali.
      router.replace("/");
      router.refresh();
    } catch (caught) {
      console.error("[auth] kayıt isteği gönderilemedi:", caught);
      setError(t("server.offline"));
    } finally {
      setBusy(false);
    }
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
        <Link href="/sign-in" className="underline underline-offset-4">
          {t("ui.sign_in")}
        </Link>
      </p>
    </form>
  );
}
