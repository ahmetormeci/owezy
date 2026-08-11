"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Koyu/acik tema saglayicisi.
 *
 * globals.css koyu paleti ".dark" sinifi altinda tanimliyor
 * (`@custom-variant dark (&:is(.dark *))`), bu yuzden attribute="class".
 * Palet bastan beri yaziliydi ama bu saglayici olmadigi icin ".dark" sinifini
 * hicbir sey uygulamiyordu - yani olu koddu.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Tema degisiminde gecis animasyonlarini kapatir: aksi halde renk
      // degistiren her ogenin animasyonu ayni anda tetiklenip ekran titrer.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
