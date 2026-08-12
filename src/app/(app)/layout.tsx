import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandMark } from "@/components/brand-mark";
import { getTranslate } from "@/lib/i18n-server";

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
  const t = await getTranslate();
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
      {/* Baslik yapiskan: harcama listesi uzadikca kullanici zile ve gruplara
          donmek icin basa kadar kaydirmak zorunda kalmasin.
          Yari saydam zemin + backdrop-blur, altindan gecen icerigin
          okunmasini engelliyor ama sayfanin devam ettigini de belli ediyor. */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between px-4">
          <Link
            href="/groups"
            className="flex items-center gap-2 rounded-md text-[0.8125rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandMark className="size-4 text-brand" />
            {t("ui.app_name")}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <NotificationBell initialUnreadCount={unreadCount} />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
