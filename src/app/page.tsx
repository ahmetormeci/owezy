import Link from "next/link";
import { redirect } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { BrandMark } from "@/components/brand-mark";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
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
  // TEK SORU KALDI: oturum var mi.
  //
  // Burada bir sure IKI sistem birden soruluyordu (findCurrentUser VE
  // Clerk'in auth()'u). Sebebi Clerk'e ozguydu: o yolda kullanici kaydi bu
  // sayfada degil (app) duzeninde olusuyordu, yani "oturumu var ama satiri
  // yok" diye bir ara durum vardi ve yalnizca kayda bakmak girisli birini
  // karsilama sayfasinda birakirdi. Better Auth satiri kendisi yazdigi icin
  // o ara durum yok.
  const user = await findCurrentUser();
  const t = await getTranslate();
  const locale = await getLocale();
  if (user) {
    // Tek grubu olan kullaniciyi dogrudan grubunun icine birakiyoruz
    // (Faz 16.4). Kullanicilarin cogu bir ya da iki grupla calisiyor ve
    // tek satirlik bir dizin sayfasi, arada duran bos bir duraktir.
    const groups = await listGroupsForUser(user.id);
    redirect(groups.length === 1 ? `/groups/${groups[0].id}` : "/groups");
  }

  return (
    /* Kagit dokusu: bilgi tasimiyor, yuzeyi duz bir dikdortgen olmaktan
       cikariyor. %4 bilerek - goruldugu anda kitsch olur. */
    <div className="paper relative flex flex-1 flex-col">
      <div className="paper-grain" aria-hidden />

      {/* BASLIK CUBUGU. Dil ve tema dugmeleri BURADA, PublicControls'un
          sabit kosesinde degil: o bilesenin kendi yorumu "11.6 bu sayfalari
          elden gecirdiginde burasi yeniden degerlendirilmeli, dar ekranda
          ustteki bir kartla cakisabilir" diyordu. Giris ve kayit sayfalari
          PublicControls'u kullanmaya devam ediyor. */}
      <header className="flex items-center gap-3.5 border-b border-border px-6 py-5 sm:px-[30px]">
        <BrandMark className="size-6 text-brand" />
        <span className="font-heading text-2xl">{t("ui.app_name")}</span>
        <span className="hidden h-px w-[22px] bg-copper sm:block" aria-hidden />
        <span className="cap hidden sm:block">{t("ui.landing_platforms")}</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="rounded-[3px] px-1 text-sm whitespace-nowrap transition-colors outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("ui.sign_in")}
          </Link>
          <Link
            href="/sign-up"
            className="rounded-[3px] bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors outline-none hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("ui.sign_up")}
          </Link>
        </div>
      </header>

      {/* HERO. Iki kolon 900px ustunde; altinda tek kolona duser ve ornek
          defterin egimi sifirlanir - dar ekranda egik bir kart tasiyor. */}
      <div className="grid items-center gap-12 px-6 pt-16 pb-12 sm:px-[30px] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <span className="cap">{t("ui.landing_eyebrow")}</span>
          {/* Ikinci satir italik ve petrol: cumlenin agirligi orada.
              clamp() ile 40px-74px - 74px dar ekranda bir afis olurdu. */}
          <h1 className="font-heading max-w-[20ch] text-balance text-[clamp(2.5rem,7vw,4.625rem)] leading-[0.98] tracking-[-0.02em]">
            {t("ui.landing_title_lead")}
            <br />
            <em className="text-brand italic">{t("ui.landing_title_rest")}</em>
          </h1>
          <p className="max-w-[48ch] text-pretty text-[17px] leading-relaxed text-muted-foreground">
            {t("ui.landing_lede")}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/sign-up"
              className="flex h-[50px] items-center rounded-[3px] bg-brand px-[22px] text-[15.5px] font-semibold text-primary-foreground transition-colors outline-none hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("ui.landing_cta")}
            </Link>
            {/* Magaza adresi PROJECT.md'de yaziyor; uygulama 1.0'dan beri
                canli, yani bu baglanti bir vaat degil. */}
            <a
              href="https://apps.apple.com/tr/app/owezy/id6805650395"
              className="flex h-[50px] items-center rounded-[3px] border border-foreground px-[22px] text-[15.5px] font-semibold transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("ui.landing_app_store")}
            </a>
          </div>

          {/* UC RAKAM, UCU DE DOGRULANABILIR - gerekcesi sozlukte yazili. */}
          <dl className="flex flex-wrap gap-x-9 gap-y-4 border-t border-border pt-4">
            {[
              ["3", t("ui.landing_stat_splits")],
              ["2", t("ui.landing_stat_locales")],
              [formatMoney(0, "TRY", locale), t("ui.landing_stat_rounding")],
            ].map(([figure, label]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="font-heading text-[26px] leading-none">{figure}</dt>
                <dd className="text-xs text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ORNEK DEFTER. Gercek veri DEGIL - uygulamanin ne yaptigini bir
            paragraf yazmak yerine gostermek icin duruyor. Ayni
            formatSignedMoney'den geciyor, yani hizalama ve isaretler
            uygulamanin gercek davranisiyla birebir ayni. */}
        <div className="relative px-2.5 pb-6">
          <div className="rounded-[3px] border border-border bg-paper p-[22px] shadow-[0_26px_44px_-30px_rgba(31,36,32,0.5)] lg:rotate-[0.8deg]">
            <div className="flex items-baseline justify-between gap-4 border-b border-copper pb-3">
              <span className="font-heading text-xl">{t("ui.sample_title")}</span>
              <span className="money text-xs text-muted-foreground">
                {formatMoney(SAMPLE_TOTAL, "TRY", locale)}
              </span>
            </div>
            <ul className="flex flex-col pt-1">
              {SAMPLE_ROWS.map((row) => (
                <li
                  key={row.name}
                  className="flex items-baseline border-b border-line-soft py-[11px] last:border-b-0"
                >
                  <span className="text-[15px]">{row.name}</span>
                  <span className="leader" aria-hidden />
                  <span
                    className={`money text-[15px] ${
                      row.amount > 0 ? "text-credit" : "text-debt"
                    }`}
                  >
                    {formatSignedMoney(row.amount, "TRY", locale)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="cap pt-3">{t("ui.sample_note")}</p>
          </div>
          {/* Kase: borc sadelestirmesinin sonucu. Kartin disina tasiyor,
              o yuzden kapsayici relative ve alt bosluk birakiliyor. */}
          <div className="absolute bottom-0 -left-1.5 -rotate-3 border border-copper bg-background px-3 py-1.5">
            <span className="cap">{t("ui.landing_sample_stamp")}</span>
          </div>
        </div>
      </div>

      {/* UC ADIM. Her biri bakir bir cizgiyle basliyor - bolum basliyor
          demenin isareti, uygulamanin icindeki bolum cizgileriyle ayni dil. */}
      <div className="grid gap-[30px] px-6 pb-14 sm:px-[30px] md:grid-cols-3">
        {/*
          ANAHTARLAR TEK TEK YAZILI, dongude uretilmiyor - ve bu bir
          tekrar degil, bir GARANTI.

          messages.test.ts kaynak kodu tarayip gecen her "ui.*" kodunun
          sozlukte oldugunu dogruluyor (ADR-020'nin isleyen hali; Translator
          duz string aldigi icin tip sistemi bunu yakalamiyor). Sablon
          dizgiyle yazilan bir anahtar kaynakta HIC GECMIYOR, yani o kontrol
          onu goremiyor - dokuz anahtar sessizce korumasiz kaliyordu.
        */}
        {[
          {
            label: t("ui.landing_step_1_label"),
            title: t("ui.landing_step_1_title"),
            body: t("ui.landing_step_1_body"),
          },
          {
            label: t("ui.landing_step_2_label"),
            title: t("ui.landing_step_2_title"),
            body: t("ui.landing_step_2_body"),
          },
          {
            label: t("ui.landing_step_3_label"),
            title: t("ui.landing_step_3_title"),
            body: t("ui.landing_step_3_body"),
          },
        ].map((step) => (
          <div key={step.label} className="flex flex-col gap-2.5 border-t border-copper pt-3.5">
            <span className="cap">{step.label}</span>
            <h2 className="font-heading text-[26px] leading-tight">{step.title}</h2>
            <p className="text-[14.5px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>

      {/* Gizlilik ve destek sayfalarina TEK giris noktasi burasi. Uygulamanin
          ICINE footer koymadik: fis ekraninin sonu tasarlanmis bir sey (yirtik
          kenar) ve altina global bir cizgi eklemek onunla kavga ederdi.
          Magazalar zaten adresleri dogrudan kullaniyor. */}
      <footer className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-6 py-4.5 text-[13px] text-muted-foreground sm:px-[30px]">
        <span>{t("ui.landing_footer")}</span>
        <nav className="flex gap-5 sm:ml-auto">
          <Link
            href="/privacy"
            className="rounded-[3px] transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("ui.privacy")}
          </Link>
          <Link
            href="/support"
            className="rounded-[3px] transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("ui.support")}
          </Link>
          <a
            href="https://apps.apple.com/tr/app/owezy/id6805650395"
            className="rounded-[3px] transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("ui.landing_app_store")}
          </a>
        </nav>
      </footer>
    </div>
  );
}
