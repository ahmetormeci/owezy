import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { readStoredTheme, writeStoredTheme, type ThemeChoice } from "./theme-store";

/**
 * Web'in tasarim tokenlarinin (src/app/globals.css) React Native karsiliklari.
 *
 * NEDEN AYRI BIR DOSYA: web tokenlari oklch, React Native oklch anlamiyor.
 * Buradaki hex degerleri oklch'den HESAPLANARAK uretildi, goz karariyla
 * secilmedi; her satirda kaynak token yaziyor.
 *
 * IKI GERCEK KAYNAK OLDUGUNUN FARKINDAYIZ: globals.css'te bir token
 * degisirse burasi ELLE guncellenmeli. Alternatifi derleme sirasinda
 * cevirmekti - bu boyuttaki bir uygulama icin fazla makine.
 *
 * RENK ANLAM TASIR (ADR-021): credit yesili "sana borclu", debt kiremiti
 * "borclusun", brand kobalti kimlik. Baska hicbir yerde kullanilmazlar.
 */
export type Theme = {
  paper: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  lineSoft: string;
  brand: string;
  credit: string;
  debt: string;
  /**
   * YIKICI EYLEM rengi - "borc" renginden AYRI ve bu ayrim ADR-015'in
   * geregi. Kirmizi bu uygulamada BILGI TASIYOR: debt kiremiti "sen
   * borclusun" demek. Hesap silme dugmesini o renkle boyamak, kullaniciya
   * borcunu anlatan renkle bir eylemi anlatmak olurdu.
   *
   * globals.css'te ikisi zaten ayri (--debt ve --destructive) ve aradaki
   * farki DOYGUNLUK tasiyor. Mobil temada bugune kadar yoktu cunku mobilde
   * hic yikici eylem yoktu; hesap silme ilk oldu.
   */
  destructive: string;
};

const LIGHT: Theme = {
  paper: "#fdfefe", //      --paper
  surface: "#e9eaed", //    --surface
  foreground: "#212327", // --foreground
  muted: "#6e7075", //      --muted-foreground
  border: "#e2e4e7", //     --border
  lineSoft: "#edeef0", //   --line-soft
  brand: "#065ac0", //      --brand
  credit: "#388064", //     --credit
  debt: "#a5564e", //       --debt
  destructive: "#e7000b", // --destructive
};

const DARK: Theme = {
  paper: "#141518",
  surface: "#07080a",
  foreground: "#ecedef",
  muted: "#9a9da2",
  border: "#212428",
  lineSoft: "#17191d",
  brand: "#5b9af6",
  credit: "#6bbc9a",
  debt: "#cb6d64",
  destructive: "#ff6467",
};

/**
 * TEMA TERCIHI. Uc durum var ve ucu de gerekli:
 *   "system" - cihazin ayarini izler (varsayilan, web'de de oyle)
 *   "light" / "dark" - kullanici acikca sectiyse SISTEMI EZER
 *
 * NEDEN "system" AYRI BIR SECENEK, sadece acik/koyu degil: telefonunu
 * gun batiminda koyuya geciren biri uygulamanin da gecmesini bekler.
 * Yalnizca iki secenek sunmak o kisiyi elle secim yapmaya mahkum ederdi.
 *
 * BUGUNE KADAR SECIM HIC YOKTU ve bu bir karar degildi - DECISIONS.md'de
 * karsiligi yok, yani hic ele alinmamisti. Web'de secim bastan beri var
 * (components/theme-toggle.tsx).
 */
type ThemeState = {
  theme: Theme;
  choice: ThemeChoice;
  setChoice: (next: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  /**
   * Cihazdaki tercih ASENKRON okunuyor, yani ilk cizim "system" ile
   * yapiliyor. Koyu tema secmis bir kullanici acilista bir an acik tema
   * gorebilir - kabul edilebilir, cunku alternatifi tercih okunana kadar
   * EKRANI HIC CIZMEMEK olurdu ve bu, her acilisi bir bekleme haline
   * getirirdi. Dil tercihi de ayni sekilde calisiyor.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readStoredTheme();
      if (!cancelled && stored) setChoiceState(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    void writeStoredTheme(next);
  }, []);

  const value = useMemo<ThemeState>(() => {
    const dark = choice === "system" ? system === "dark" : choice === "dark";
    return { theme: dark ? DARK : LIGHT, choice, setChoice };
  }, [choice, system, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  /**
   * SAGLAYICI YOKSA SISTEM AYARINA DUSUYOR, firlatmiyor. Bilesen testleri
   * ekranlari saglayicisiz cizmek istiyor (components/*.test.tsx) ve orada
   * tema bir renkten ibaret - testin konusu degil. Firlatsaydi her test
   * dosyasina bir sarmalayici eklemek gerekirdi.
   */
  const context = useContext(ThemeContext);
  const system = useColorScheme();
  if (context) return context.theme;
  return system === "dark" ? DARK : LIGHT;
}

/** Tercihi okumak ve degistirmek icin - yalnizca hesap ekrani kullaniyor. */
export function useThemeChoice(): Pick<ThemeState, "choice" | "setChoice"> {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeChoice ThemeProvider olmadan cagrilamaz");
  }
  return { choice: context.choice, setChoice: context.setChoice };
}
