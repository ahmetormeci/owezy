import * as SecureStore from "expo-secure-store";

/**
 * Clerk oturum belirtecinin saklandigi yer.
 *
 * NEDEN SecureStore, AsyncStorage DEGIL: AsyncStorage duz metin. Oturum
 * belirteci duz metinde durmaz - cihaza erisen biri onunla kullanicinin
 * hesabina girebilir. SecureStore iOS'ta Keychain'i kullaniyor.
 *
 * NEDEN HIC VERMEMEK SECENEK DEGIL: tokenCache verilmezse Clerk belirteci
 * yalnizca bellekte tutuyor ve uygulama kapaninca oturum kayboluyor.
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // Okuma basarisizsa "oturum yok" saymak GUVENLI tarafta kalmak demek:
      // kullanici yeniden giris yapar. Hatayi yutmuyoruz, loga birakiyoruz.
      console.error("Oturum belirteci okunamadi", error);
      return null;
    }
  },

  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      // Yazma basarisizsa firlatmiyoruz: Clerk'in giris akisini yarida
      // kesmek, kullaniciyi hicbir sey soylemeden disarida birakirdi.
      // Sonucu su olur: oturum bu acilista calisir, uygulama kapaninca gider.
      console.error("Oturum belirteci saklanamadi", error);
    }
  },
};
