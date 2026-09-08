import * as SecureStore from "expo-secure-store";

/**
 * Kullanicinin SECTIGI tema tercihinin cihazda durdugu yer.
 *
 * DIL TERCIHINDEN BIR FARKI VAR: dil sunucuda da saklaniyor (User.locale)
 * cunku e-postalarin ve CSV basliklarinin dili sunucuda belirleniyor. Tema
 * SUNUCUYU HIC ILGILENDIRMIYOR - kagidin rengi yalnizca bu cihazda anlamli.
 * Ayni hesabin telefonu koyu, tarayicisi acik olabilir ve bu bir tutarsizlik
 * degil, dogru davranis.
 *
 * SecureStore, AsyncStorage DEGIL: gerekce locale-store.ts'teki ile ayni -
 * AsyncStorage bu projede yok ve iki satirlik bir tercih icin yeni bir
 * bagimlilik eklemek dogru olmazdi.
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "owezy.theme";

/** Beyaz liste: cihazda duran metin bozulmus ya da eski surumden kalmis olabilir. */
function isChoice(value: string): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export async function readStoredTheme(): Promise<ThemeChoice | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw || !isChoice(raw)) return null;
    return raw;
  } catch (error) {
    // Okunamiyorsa tercih YOK sayiliyor: sistem ayari devreye giriyor.
    console.error("Tema tercihi okunamadı", error);
    return null;
  }
}

export async function writeStoredTheme(choice: ThemeChoice): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, choice);
  } catch (error) {
    // Yazilamadi: tercih bu oturumda gecerli, bir sonraki aciliste degil.
    // Akis DURMUYOR - kullanici temayi yine de degistirmis oluyor.
    console.error("Tema tercihi kaydedilemedi", error);
  }
}
