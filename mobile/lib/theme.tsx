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
 * RENK ANLAM TASIR: brand petroli hem kimlik hem ALACAK, debt kiremiti
 * "borclusun". Kagit & petrol yonunde anlam tasiyan renk sayisi ikiye indi;
 * gerekce globals.css'in basindaki blokta.
 */
export type Theme = {
  /** Ekran zemini - sicak kagit. Web'de --background. */
  background: string;
  /** Fis yapragi: zeminin UZERINDE duran daha beyaz yuzey. --paper. */
  paper: string;
  /** Girinti: ilerleme cubugu olugu, gorsel yer tutucu. --surface. */
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  lineSoft: string;
  /** Form alanlarinin ALT CIZGISI. Kutu yok; kenarliktan bir ton koyu. */
  inputLine: string;
  /** Kategori cipinin kenarligi. */
  chipBorder: string;
  brand: string;
  /**
   * BIRINCIL DUGMENIN UZERINDEKI METIN. Sabit beyaz DEGIL ve bu olculdu:
   * koyu temada petrol aciliyor (#3f8f76) ve beyaz metin orada 3.89:1
   * veriyor - AA'yi gecmiyor. Koyu metin 4.78:1. Acik temada iliski ters,
   * orada beyaz 7.82:1.
   */
  onBrand: string;
  /** Bakiye kartinin zemini - iki temada da KOYU petrol. */
  balanceCard: string;
  /** Bakir CIZGI. Metin icin kullanilmaz: kagit uzerinde 3.21:1. */
  copper: string;
  /** Bakir METIN (kucuk etiketler). Kagit uzerinde 5.29:1. */
  copperText: string;
  /** Cok soluk bakir zemin - bugun yalnizca KENDI satirini isaretlemek icin
   *  (uye listesindeki avatar). Bakir metin uzerinde 7.15:1. */
  copperSoft: string;
  /** Koyu petrol kart UZERINDEKI bakir - kart iki temada da koyu oldugu
   *  icin bu ikisi temaya gore DEGISMIYOR. */
  copperOnCard: string;
  copperFigure: string;
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
  background: "#faf8f4", //   --background
  paper: "#fffdf9", //        --paper / --card
  surface: "#ece8df", //      --surface
  foreground: "#1f2420", //   --foreground
  muted: "#6b6459", //        --muted-foreground
  border: "#ded9d0", //       --border
  lineSoft: "#eee9df", //     --line-soft
  inputLine: "#cfc7b8", //    --input-line
  chipBorder: "#e0d3bd", //   --chip-border
  brand: "#1c5c4c", //        --brand
  onBrand: "#ffffff", //      beyaz / petrol = 7.82:1
  balanceCard: "#123c32", //  --brand-strong
  copper: "#b5813a", //       --copper      (CIZGI)
  copperText: "#8a5f26", //   --copper-text (METIN)
  copperSoft: "#f7f0e2",
  copperOnCard: "#d9ac6c",
  copperFigure: "#e0b477",
  credit: "#1c5c4c", //       --credit (= brand)
  debt: "#a8503f", //         --debt
  destructive: "#e7000b", //  --destructive
};

/**
 * KOYU TEMA TASARIMDA CIZILMEDI - handoff yalnizca bir turetme kurali
 * veriyor. Buradaki degerler o kurala gore uretildi ve kontrastlari
 * OLCULDU; acik temadaki sira korunuyor (surface < background < paper).
 */
const DARK: Theme = {
  background: "#1a1916",
  paper: "#25231f",
  surface: "#141310",
  foreground: "#ecebe8",
  muted: "#a19e98",
  border: "#33302b",
  lineSoft: "#262420",
  inputLine: "#46423a",
  chipBorder: "#3f3a30",
  brand: "#3f8f76",
  onBrand: "#141310", //      koyu metin / acilmis petrol = 4.78:1
  balanceCard: "#16483c", //  koyu zeminden bir tik acik
  copper: "#d9ac6c",
  copperText: "#e0b477",
  copperSoft: "#322d22",
  copperOnCard: "#d9ac6c",
  copperFigure: "#e0b477",
  credit: "#6bbc9a",
  debt: "#cb7a68",
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
