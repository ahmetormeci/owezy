import { SignInForm } from "@/components/sign-in-form";
import { PublicControls } from "@/components/public-controls";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslate } from "@/lib/i18n-server";

/**
 * Giris sayfasi. Onceden Clerk'in <SignIn /> bileseni duruyordu ve klasor
 * adi [[...sign-in]] idi - o catch-all, Clerk'in kendi ic yonlendirmesi
 * icin gerekiyordu. Kendi formumuzda gerek yok, sade bir sayfa yetiyor.
 *
 * Kart, uygulamanin geri kalaniyla AYNI malzeme (davet sayfasindaki gibi):
 * golge ve ring degil, tek kenarlik. ADR-021.
 */
export default async function SignInPage() {
  const t = await getTranslate();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <PublicControls />
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <h1 className="text-xl font-semibold">{t("ui.sign_in")}</h1>
          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
