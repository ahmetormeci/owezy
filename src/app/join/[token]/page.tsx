import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getInviteStatus } from "@/lib/groups";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInvite } from "@/components/accept-invite";

const INVALID_INVITE_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Bu davet linki gecerli degil.",
  REVOKED: "Bu davet iptal edilmis.",
  EXPIRED: "Bu davetin suresi dolmus.",
  EXHAUSTED: "Bu davet linki kullanim limitine ulasmis.",
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
  const { userId } = await auth();

  // Davet gecerli mi diye ONCE bakiyoruz: kullanici gecersiz bir link icin
  // once kayit olup sonra hata almasin.
  const status = await getInviteStatus(token);
  const returnUrl = `/join/${token}`;

  if (!status.valid) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <h1 className="text-xl font-semibold">Davet kullanilamiyor</h1>
            <p className="text-muted-foreground">
              {INVALID_INVITE_MESSAGES[status.reason]} Seni davet eden kisiden yeni
              bir link isteyebilirsin.
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Ana sayfaya don
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">
            “{status.groupName}” grubuna davet edildin
          </h1>

          {userId ? (
            <>
              <p className="text-muted-foreground">
                Katilmak icin asagidaki butona bas.
              </p>
              <AcceptInvite token={token} />
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Davete katilmak icin once giris yapmalisin.
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Giris yap
                </Link>
                <Link
                  href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`}
                  className={buttonVariants()}
                >
                  Kayit ol
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
