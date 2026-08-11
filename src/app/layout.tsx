import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitApp",
  description: "Grup harcamalarını paylaş, kimin kime ne kadar borçlu olduğunu gör.",
};

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
