import { ResetPasswordForm } from "@/components/reset-password-form";
import { PublicControls } from "@/components/public-controls";
import { Card, CardContent } from "@/components/ui/card";
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
 * gozunde tek bir is.
 */
export default async function ResetPasswordPage() {
  const t = await getTranslate();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <PublicControls />
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <h1 className="text-xl font-semibold">{t("ui.reset_password_title")}</h1>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
