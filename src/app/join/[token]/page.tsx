import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInvite } from "@/components/accept-invite";

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

  const returnUrl = `/join/${token}`;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">Bir gruba davet edildin</h1>

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
                <Button
                  variant="outline"
                  render={
                    <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`}>
                      Giris yap
                    </Link>
                  }
                />
                <Button
                  render={
                    <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`}>
                      Kayit ol
                    </Link>
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
