import * as SecureStore from "expo-secure-store";

/**
 * Better Auth oturum belirtecinin cihazda durdugu yer.
 *
 * NEDEN SecureStore, AsyncStorage DEGIL: AsyncStorage duz metin. Bu belirtec
 * dogrudan oturumun KENDISI - cihaza erisen biri onunla kullanicinin hesabina
 * girer. SecureStore iOS'ta Keychain'i kullaniyor.
 *
 * BU DOSYA ONCEDEN token-cache.ts IDI ve Clerk'in TokenCache arayuzunu
 * (getToken/saveToken/clearToken, anahtar parametreli) uyguluyordu. O arayuz
 * Clerk'e aitti; artik belirteci yazan da okuyan da biziz, o yuzden hem ad
 * hem sekil bize dondu: TEK anahtar, uc acik fonksiyon.
 *
 * CLERK'INKINDEN BIR FARK DAHA VAR ve onemli: Clerk'in verdigi sey kisa
 * omurlu bir JWT'ydi ve SDK onu arka planda yeniliyordu. Better Auth'un
 * Bearer belirteci oturum belirtecinin kendisi - yenileme makinesi yok,
 * sunucu omrunu kendisi uzatiyor. Yani "girisli miyim" sorusunun cevabi
 * burada duran degerden ibaret.
 */
const KEY = "owezy.session-token";

export async function readSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch (error) {
    // Okuma basarisizsa "oturum yok" saymak GUVENLI tarafta kalmak demek:
    // kullanici yeniden giris yapar. Hatayi yutmuyoruz, loga birakiyoruz.
    console.error("Oturum belirteci okunamadı", error);
    return null;
  }
}

export async function writeSessionToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch (error) {
    // Yazma basarisizsa FIRLATMIYORUZ: girisi yarida kesmek, kullaniciyi
    // hicbir sey soylemeden disarida birakirdi. Sonucu su olur: oturum bu
    // acilista calisir, uygulama kapaninca gider.
    console.error("Oturum belirteci saklanamadı", error);
  }
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch (error) {
    // Burada da firlatmiyoruz - firlatmak cikisi yarida keserdi ve kullanici
    // hicbir sey soylenmeden girisli kalirdi. Yutmuyoruz ama: silinemeyen bir
    // belirtec loga dusmeli.
    console.error("Oturum belirteci silinemedi", error);
  }
}
