import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { findCurrentUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { BrandMark } from "@/components/brand-mark";
import { PublicControls } from "@/components/public-controls";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { getLocale, getTranslate } from "@/lib/i18n-server";

// Karsilama sayfasindaki ornek defter. Gercek veri DEGIL - uygulamanin ne
// yaptigini bir paragraf yazmak yerine gostermek icin duruyor. Ayni
// formatSignedMoney'den geciyor, yani ekranda gorunen hizalama ve isaretler
// uygulamanin gercek davranisiyla birebir ayni.
const SAMPLE_ROWS = [
  { name: "Ayşe", amount: 24000 },
  { name: "Mehmet", amount: -12000 },
  { name: "Zeynep", amount: -12000 },
];

// Ornek harcamanin toplami, kurus cinsinden. Ekranda "360,00 ₺" olarak
// SABIT yaziliydi: Ingilizce arayuzde satirlar "$240.00" olurken baslik
// "360,00 ₺" kalirdi. Yukaridaki yorum bu defterin gercek kod yolundan
// gectigini soyluyor; toplam da artik gercekten oradan geciyor.
const SAMPLE_TOTAL = 36000;

export default async function HomePage() {
  // IKI SISTEME DE BAKILIYOR (Faz 25.3). Clerk yarisi 25.7'de silinecek.
  //
  // Neden ikisi birden: Clerk yolunda kullanici kaydi bu sayfada DEGIL,
  // (app) duzeninde olusuyor. Yalnizca findCurrentUser'a baksaydik, ilk kez
  // giren bir Clerk kullanicisi "kaydi yok" diye giris yapmamis sayilir ve
  // karsilama sayfasinda birakilirdi - oysa girisli.
  const user = await findCurrentUser();
  const { userId: clerkId } = await auth();
  const t = await getTranslate();
  const locale = await getLocale();
  if (user || clerkId) {
    // Tek grubu olan kullaniciyi dogrudan grubunun icine birakiyoruz
    // (Faz 16.4). Kullanicilarin cogu bir ya da iki grupla calisiyor ve
    // tek satirlik bir dizin sayfasi, arada duran bos bir duraktir.
    //
    // getOrCreateCurrentUser BURADA CAGRILMAZ: burasi herkese acik
    // karsilama sayfasi ve bir SAYFA GORUNTULEMESI kullanici kaydi
    // yaratmamali (bkz. auth.ts). Kayit henuz yoksa liste sayfasina
    // gidiyoruz; onu (app) duzeni zaten olusturuyor.
    const groups = user ? await listGroupsForUser(user.id) : [];
    redirect(groups.length === 1 ? `/groups/${groups[0].id}` : "/groups");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <PublicControls />
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-7 text-brand" />
          <h1 className="text-display font-semibold">{t("ui.app_name")}</h1>
        </div>
        <p className="max-w-sm text-balance text-muted-foreground">
          {t("ui.tagline")}
        </p>
      </div>

      {/* Ornek defter: golge ve ring yerine tek bir kenarlik, kucultulmus
          kose. Uygulamanin icindeki panellerle AYNI malzeme olmali -
          karsilama sayfasi urunu gosteriyor, baska bir sey degil. */}
      <div className="w-full max-w-sm rounded-lg border border-border bg-card px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
          <span className="font-medium">{t("ui.sample_title")}</span>
          <span className="money text-muted-foreground">
            {formatMoney(SAMPLE_TOTAL, "TRY", locale)}
          </span>
        </div>
        <ul className="flex flex-col">
          {SAMPLE_ROWS.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-4 border-b border-line-soft py-2 last:border-b-0"
            >
              <span>{row.name}</span>
              <span
                className={`money font-medium ${
                  row.amount > 0 ? "text-credit" : "text-debt"
                }`}
              >
                {formatSignedMoney(row.amount, "TRY", locale)}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-2.5 text-xs text-muted-foreground">{t("ui.sample_note")}</p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/sign-up"
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors outline-none hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("ui.sign_up")}
        </Link>
        <Link
          href="/sign-in"
          className="rounded-md border border-border bg-background px-4 py-2 font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("ui.sign_in")}
        </Link>
      </div>

      {/* Gizlilik ve destek sayfalarina TEK giris noktasi burasi. Uygulamanin
          ICINE footer koymadik: fis ekraninin sonu tasarlanmis bir sey (yirtik
          kenar) ve altina global bir cizgi eklemek onunla kavga ederdi.
          Magazalar zaten adresleri dogrudan kullaniyor. */}
      <nav className="flex gap-5 text-sm text-muted-foreground">
        <Link
          href="/privacy"
          className="rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("ui.privacy")}
        </Link>
        <Link
          href="/support"
          className="rounded-md transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("ui.support")}
        </Link>
      </nav>
    </div>
  );
}
