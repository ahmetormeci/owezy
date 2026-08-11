import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getTranslate } from "@/lib/i18n-server";
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
// dile bagli, ve dil calisma zamaninda okunuyor (11.4c'de cerezden gelecek).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslate();
  return {
    title: t("ui.app_name"),
    description: t("ui.meta_description"),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="tr"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        // next-themes ".dark" sinifini tarayicida ekliyor; sunucudan gelen
        // HTML'de o sinif yok. suppressHydrationWarning olmadan React bunu
        // uyumsuzluk sayip konsola uyari basar.
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
