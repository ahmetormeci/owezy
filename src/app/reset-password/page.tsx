import { ResetPasswordForm } from "@/components/reset-password-form";
import { AuthShell } from "@/components/auth-shell";
import { getTranslate } from "@/lib/i18n-server";

/**
 * Parola belirleme / yenileme sayfasi (Faz 27.3).
 *
 * (app) GRUBUNUN DISINDA, yani giris kontrolu YOK - ve bu zorunlu: buraya
 * gelen kisilerin cogu zaten giremiyor olacak. Ama giris YAPMIS biri de
 * kullaniyor: hesabinda hic parola olmayan, e-posta koduyla giren kullanici
 * iki adimli dogrulamayi ancak buradan bir parola kurduktan sonra acabiliyor
 * (bkz. security-dialog.tsx).
 *
 * Sayfa iskeleti /sign-in ve /sign-up ile AYNI - bu uc ekran kullanicinin
 * gozunde tek bir is. Ayniligi artik kopya degil AuthShell tasiyor.
 */
export default async function ResetPasswordPage() {
  const t = await getTranslate();

  return (
    <AuthShell label={t("ui.reset_password_title")}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
