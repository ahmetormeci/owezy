import * as SecureStore from "expo-secure-store";
import { normalizeLocale, type Locale } from "@/lib/locale";

/**
 * Kullanicinin SECTIGI arayuz dilinin cihazda durdugu yer.
 *
 * NEDEN CIHAZDA DA SAKLANIYOR - sunucuda zaten var (User.locale, PATCH /me):
 * uygulama acilirken cevabi BEKLEYEMEZ. Sunucudan gelmesini bekleseydik her
 * aciliste ilk ekran ag turu kadar gecikirdi; beklemeseydik once cihaz
 * diliyle cizilip sonra secilen dile atlardi. Cihazdaki deger bir ONBELLEK:
 * dogrunun kaynagi sunucudaki kayit, ama acilista okunan bu.
 *
 * SecureStore, AsyncStorage DEGIL - ama gerekcesi session-store'unkiyle ayni
 * degil: dil bir sir degil. Sebep daha basit, AsyncStorage bu projede YOK ve
 * iki satirlik bir tercih icin yeni bir bagimlilik eklemek dogru olmazdi.
 * SecureStore zaten pakette.
 *
 * DEGER DOGRULANARAK OKUNUYOR: cihazda duran metin bozulmus ya da eski bir
 * surumden kalmis olabilir; normalizeLocale beyaz listede olmayani
 * varsayilana dusuruyor. "Bir sey yazili ama gecerli degil" durumunda dilin
 * cihaz dilinden gelmesi icin null donuyoruz.
 */
const KEY = "owezy.locale";

export async function readStoredLocale(): Promise<Locale | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    // normalizeLocale gecersizde varsayilani doner; o yuzden once RAW degerin
    // gercekten normalize edilmis haliyle ayni olup olmadigina bakiyoruz.
    const normalized = normalizeLocale(raw);
    return normalized === raw ? normalized : null;
  } catch (error) {
    // Okunamiyorsa tercih YOK sayiliyor: cihaz dili devreye giriyor.
    console.error("Dil tercihi okunamadı", error);
    return null;
  }
}

export async function writeStoredLocale(locale: Locale): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, locale);
  } catch (error) {
    // FIRLATMIYORUZ: sunucuya yazilan tercih ZATEN basarili oldu ve ekran o
    // dile gecti. Yalnizca bir sonraki aciliste cihaz diline donme ihtimali
    // var - kullaniciya hata gostermeye degmez.
    console.error("Dil tercihi saklanamadı", error);
  }
}
