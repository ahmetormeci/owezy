import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/lib/i18n";
import { getLocale, getTranslate } from "@/lib/i18n-server";
import "./globals.css";

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

  // BURADA BIR ZAMANLAR <ClerkProvider> VARDI ve ona bir "localization"
  // sozlugu geciriliyordu (trTR): Clerk'in giris/kayit formu kendi
  // metinlerini tasiyor, bizim sozlugumuz oraya ulasmiyordu. Formlar artik
  // BIZIM (Faz 25.4) ve metinleri messages.ts'ten geliyor - yani ADR-020'nin
  // "eksik ceviri = derleme hatasi" garantisi kullanicinin gordugu ILK
  // ekranda da gecerli. Once oyle degildi.
  //
  // BAGLI BIR SORU ACIK KALDI: dil dugmesi sayfayi bastan yukluyor
  // (ADR-023) ve gerekcesi "Clerk bu ayari yalnizca baslarken okuyor"du.
  // Clerk gitti, gerekce de gitti - ama tam yeniden yukleme kendi basina
  // dogru mu, olculmedi. Degistirmek bir sadelestirme isi, bir sokme isi
  // degil; oyle ele alinmali.
  return (
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
  );
}
