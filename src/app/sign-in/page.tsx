import { SignInForm } from "@/components/sign-in-form";
import { AuthShell } from "@/components/auth-shell";
import { getTranslate } from "@/lib/i18n-server";

/**
 * Giris sayfasi. Onceden Clerk'in <SignIn /> bileseni duruyordu ve klasor
 * adi [[...sign-in]] idi - o catch-all, Clerk'in kendi ic yonlendirmesi
 * icin gerekiyordu. Kendi formumuzda gerek yok, sade bir sayfa yetiyor.
 *
 * Iskelet AuthShell'de; kart kaldirildi, gerekcesi orada.
 */
export default async function SignInPage() {
  const t = await getTranslate();

  return (
    <AuthShell label={t("ui.sign_in")}>
      <SignInForm />
    </AuthShell>
  );
}
