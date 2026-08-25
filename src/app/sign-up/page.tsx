import { SignUpForm } from "@/components/sign-up-form";
import { PublicControls } from "@/components/public-controls";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslate } from "@/lib/i18n-server";

export default async function SignUpPage() {
  const t = await getTranslate();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <PublicControls />
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <h1 className="text-xl font-semibold">{t("ui.sign_up")}</h1>
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  );
}
