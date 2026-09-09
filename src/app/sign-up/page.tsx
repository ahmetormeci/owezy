import { SignUpForm } from "@/components/sign-up-form";
import { AuthShell } from "@/components/auth-shell";
import { getTranslate } from "@/lib/i18n-server";

export default async function SignUpPage() {
  const t = await getTranslate();

  return (
    <AuthShell label={t("ui.sign_up")}>
      <SignUpForm />
    </AuthShell>
  );
}
