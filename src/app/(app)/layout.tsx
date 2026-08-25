import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
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
// Giris kontrolu burada, sayfanin kendisinde yapiliyor - middleware'de degil.
// Clerk'in kendi dokumantasyonu da bunu oneriyor: middleware yol eslestirmesine
// dayanir ve Next.js'in gercek yonlendirmesinden sapabilir, bu da korunmasi
// gereken bir sayfanin acikta kalmasina yol acabilir.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslate();

  // KORUMA ARTIK BIZIM KAPIMIZDAN (Faz 25.3). Onceden dogrudan Clerk'in
  // auth()'u soruluyordu; oyle kalsaydi Better Auth ile giren biri
  // uygulamanin tamamindan disari atilirdi - bu layout altindaki HER sayfa
  // buradan geciyor.
  //
  // getOrCreateCurrentUser, findCurrentUser DEGIL: Clerk yolunda kaydi
  // olusturan yer burasi ("lazy sync", ADR-011). findCurrentUser'a
  // gecseydik, ilk kez giren bir Clerk kullanicisi kaydi olmadigi icin
  // giris ekranina geri atilirdi - yani hic iceri giremezdi.
  //
  // Zil rakamini sunucuda hesapliyoruz: sayfa acilir acilmaz dogru sayiyla
  // geliyor, istemcinin ayrica bir istek atmasi gerekmiyor. Bildirimlerin
  // KENDISI ise yalnizca menu acildiginda cekiliyor.
  const user = await getOrCreateCurrentUser();
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
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
