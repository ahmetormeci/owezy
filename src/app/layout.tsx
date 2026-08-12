import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/lib/i18n";
import { getLocale, getTranslate } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locale";
import "./globals.css";

// Clerk'in giris/kayit formu KENDI metinlerini tasiyor; bizim sozlugumuz
// (messages.ts) oraya ulasmiyor. localization verilmedigi surece form
// Clerk'in varsayilan diliyle, yani Ingilizce render ediliyordu: uygulamanin
// metni Turkce, formun ici Ingilizce - ve bu kullanicinin gordugu ILK ekran.
//
// Burada Partial DOGRU olan (ADR-020'de DICTIONARIES'ten kaldirmistik, cunku
// orada eksik bir dil sessiz bir bosluk demekti). Buradaysa eksiklik bir
// bosluk degil, gecerli bir cevap: "Clerk'in varsayilani zaten dogru."
// Ingilizce icin bilerek hicbir sey gondermiyoruz - enUS gondermek 1444
// metni bosuna RSC yukune eklerdi.
// Tip prop'un KENDISINDEN turetiliyor. "@clerk/types" dogrudan bagimlilik
// degil (Clerk onu kendi icinde tasiyor); oradan import etmek, bizim
// beyan etmedigimiz bir pakete bel baglamak olurdu. Boyle yazinca Clerk
// tarafi tipi degistirirse burasi da onunla degisiyor.
type ClerkLocalization = React.ComponentProps<typeof ClerkProvider>["localization"];

const CLERK_LOCALIZATIONS: Partial<Record<Locale, ClerkLocalization>> = {
  tr: trTR,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sabit bir "metadata" nesnesi yerine generateMetadata: baslik ve aciklama da
// dile bagli, ve dil calisma zamaninda cerezden okunuyor.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslate();
  return {
    title: t("ui.app_name"),
    description: t("ui.meta_description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dil TEK yerde okunuyor ve buradan iki yone dagiliyor: <html lang> ile
  // tarayiciya/ekran okuyucuya, LocaleProvider ile istemci bilesenlerine.
  const locale = await getLocale();

  return (
    // DIKKAT: Clerk bu ayari yalnizca BASLARKEN okuyor. Prop degistiginde
    // zaten mount olmus form eski dilde kaliyor - olculdu. Bu yuzden herkese
    // acik sayfalardaki dil dugmesi sayfayi bastan yukluyor
    // (PublicControls -> LanguageToggle fullReload).
    <ClerkProvider localization={CLERK_LOCALIZATIONS[locale]}>
      <html
        // Sabit "tr" degildi bu: ekran okuyucu sayfanin tamamini Turkce
        // telaffuz ederdi, Ingilizce metni de. lang yalnizca bir etiket degil,
        // sesletim ve tireleme kurallarini secen sey.
        lang={locale}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        // next-themes ".dark" sinifini tarayicida ekliyor; sunucudan gelen
        // HTML'de o sinif yok. suppressHydrationWarning olmadan React bunu
        // uyumsuzluk sayip konsola uyari basar.
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          {/* Sunucuda okunan dil, istemci bilesenlerine buradan geciyor.
              useTranslate() ve useLocale() bu saglayicidan okuyor - yani
              ~190 cagri yerinin hicbiri dil parametresi tasimiyor. */}
          <LocaleProvider locale={locale}>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
