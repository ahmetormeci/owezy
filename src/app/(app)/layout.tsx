import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { NotificationBell } from "@/components/notification-bell";

// (app) bir "route group": parantezli klasor adi URL'e yansimaz, yalnizca
// altindaki sayfalari ortak bir layout altinda toplar.
//
// Giris kontrolu burada, sayfanin kendisinde yapiliyor - middleware'de degil.
// Clerk'in kendi dokumantasyonu da bunu oneriyor: middleware yol eslestirmesine
// dayanir ve Next.js'in gercek yonlendirmesinden sapabilir, bu da korunmasi
// gereken bir sayfanin acikta kalmasina yol acabilir.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // Zil rakamini sunucuda hesapliyoruz: sayfa acilir acilmaz dogru sayiyla
  // geliyor, istemcinin ayrica bir istek atmasi gerekmiyor. Bildirimlerin
  // KENDISI ise yalnizca menu acildiginda cekiliyor.
  const user = await getOrCreateCurrentUser();
  const unreadCount = user ? await countUnreadNotifications(user.id) : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/groups" className="font-semibold">
            SplitApp
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell initialUnreadCount={unreadCount} />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
