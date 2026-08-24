import { useColorScheme } from "react-native";

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
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}
