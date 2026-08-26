import Link from "next/link";
import { redirect } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { listGroupsForUser } from "@/lib/groups";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { BrandMark } from "@/components/brand-mark";
import { GroupSwitcher } from "@/components/group-switcher";
import { UserMenu } from "@/components/user-menu";
import { getTranslate } from "@/lib/i18n-server";

// (app) bir "route group": parantezli klasor adi URL'e yansimaz, yalnizca
// altindaki sayfalari ortak bir layout altinda toplar.
//
// Giris kontrolu burada, sayfanin kendisinde yapiliyor - proxy'de degil.
// Proxy yol eslestirmesine dayanir ve Next.js'in gercek yonlendirmesinden
// sapabilir; bu da korunmasi gereken bir sayfanin acikta kalmasina yol acar.
// src/proxy.ts 25.7'de tamamen silindi: tek isi Clerk'in oturum baglamini
// her istekte kullanilabilir kilmakti ve hicbir route'u korumuyordu.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslate();

  // BU LAYOUT ALTINDAKI HER SAYFANIN KORUMASI BU IKI SATIR.
  //
  // Bir sure burada findCurrentUser degil getOrCreateCurrentUser cagriliyordu:
  // Clerk yolunda kullanici kaydini ilk goruste olusturan yer burasiydi
  // ("lazy sync", ADR-011). Better Auth satiri kendisi yazdigi icin
  // olusturacak bir sey kalmadi.
  //
  // Zil rakamini sunucuda hesapliyoruz: sayfa acilir acilmaz dogru sayiyla
  // geliyor, istemcinin ayrica bir istek atmasi gerekmiyor. Bildirimlerin
  // KENDISI ise yalnizca menu acildiginda cekiliyor.
  const user = await findCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  // Bildirim sayisi ve grup listesi PARALEL: ikisi de baslikta gorunuyor ve
  // birbirini beklemeleri icin sebep yok. Grup listesi kucuk bir sorgu
  // (kullanici basina birkac satir) ve baslik zaten her sayfada.
  const [unreadCount, groups] = await Promise.all([
    countUnreadNotifications(user.id),
    listGroupsForUser(user.id),
  ]);

  // Marka baglantisi "ev"e gider. Tek grubu olan icin ev, o grubun kendisi -
  // arada duran tek satirlik bir dizin sayfasi degil (Faz 16.4).
  const homeHref = groups.length === 1 ? `/groups/${groups[0].id}` : "/groups";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Baslik yapiskan: harcama listesi uzadikca kullanici zile ve gruplara
          donmek icin basa kadar kaydirmak zorunda kalmasin.
          Yari saydam zemin + backdrop-blur, altindan gecen icerigin
          okunmasini engelliyor ama sayfanin devam ettigini de belli ediyor. */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between px-4">
          {/* Marka isareti + grup degistirici. Uygulama adi baslikta artik
              YAZILMIYOR: sekme basliginda zaten var ve o yerin asil isi
              "hangi gruptayim" sorusunu cevaplamak. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={homeHref}
              aria-label={t("ui.app_name")}
              className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BrandMark className="size-4 text-brand" />
            </Link>
            {groups.length > 0 ? (
              <>
                <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
                <GroupSwitcher groups={groups.map(({ id, name }) => ({ id, name }))} />
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <NotificationBell initialUnreadCount={unreadCount} />
            <UserMenu
              displayName={user.displayName}
              email={user.email}
              avatarUrl={user.avatarUrl}
              hasImage={user.hasImage}
              // Sutun zaten okunan satirda: menudeki "Acik / Kapali" bilgisi
              // BEDAVA geliyor, ek bir sorgu yok.
              twoFactorEnabled={user.twoFactorEnabled}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
