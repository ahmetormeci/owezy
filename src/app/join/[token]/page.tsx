import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { findCurrentUser } from "@/lib/auth";
import { getInviteStatus } from "@/lib/groups";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInvite } from "@/components/accept-invite";
import { PublicControls } from "@/components/public-controls";
import { getTranslate } from "@/lib/i18n-server";
import type { MessageCode } from "@/lib/messages";

const INVALID_INVITE_CODES: Record<string, MessageCode> = {
  NOT_FOUND: "ui.invite_notice_invalid",
  REVOKED: "ui.invite_notice_revoked",
  EXPIRED: "ui.invite_notice_expired",
  EXHAUSTED: "ui.invite_notice_exhausted",
};

// Bu sayfa (app) route group'unun DISINDA: davet linkine tiklayan kisi henuz
// kayitli olmayabilir, o yuzden giris zorunlulugu yok. Giris yapilmamissa
// kullaniciyi kayit/giris akisina yonlendiriyor ve donusunde buraya
// geri geliyor (redirect_url).
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // IKI SISTEME DE BAKILIYOR (Faz 25.3). Clerk yarisi 25.7'de silinecek.
  // Burada da kayit OLUSTURULMUYOR: davet linki herkese acik.
  const currentUser = await findCurrentUser();
  const { userId: clerkId } = await auth();
  const userId = currentUser?.id ?? clerkId;
  const t = await getTranslate();

  // Davet gecerli mi diye ONCE bakiyoruz: kullanici gecersiz bir link icin
  // once kayit olup sonra hata almasin.
  const status = await getInviteStatus(token);
  const returnUrl = `/join/${token}`;

  if (!status.valid) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <PublicControls />
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <h1 className="text-xl font-semibold">{t("ui.invite_unusable")}</h1>
            <p className="text-muted-foreground">
              {t(INVALID_INVITE_CODES[status.reason])} {t("ui.invite_ask_new_link")}
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              {t("ui.back_home")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <PublicControls />
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">
            {t("ui.invited_to_group", { groupName: status.groupName })}
          </h1>

          {userId ? (
            <>
              <p className="text-muted-foreground">
                {t("ui.join_press_button")}
              </p>
              <AcceptInvite token={token} />
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                {t("ui.join_sign_in_first")}
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("ui.sign_in")}
                </Link>
                <Link
                  href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`}
                  className={buttonVariants()}
                >
                  {t("ui.sign_up")}
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
