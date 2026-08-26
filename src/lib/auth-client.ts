import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";

/**
 * Better Auth'un TARAYICI istemcisi. Sunucu ornegi src/lib/better-auth.ts'te;
 * bu ikisi ayri paketlerden geliyor ve birbirini import etmiyor.
 *
 * baseURL VERILMIYOR: uygulama kendi kokunden servis ediliyor, yani
 * "/api/auth" zaten dogru adres. Elle yazmak, ortam basina bir degisken daha
 * demek olurdu ve yanlis yazildiginda giris sessizce baska bir sunucuya
 * giderdi.
 *
 * EKLENTI ESLESMESI ZORUNLU: sunucuda emailOTP varsa istemcide de
 * emailOTPClient olmali. Olmazsa authClient.emailOtp.* cagrilari TypeScript
 * seviyesinde bile yok - yani eksiklik derlemede yakalaniyor, calisma
 * zamaninda degil.
 *
 * bearer() eklentisinin istemci karsiligi YOK ve gerekmiyor: tarayici
 * cerezle calisiyor, Bearer yalnizca mobil icin (25.5).
 */
export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    /**
     * IKI ADIMLI DOGRULAMA (Faz 27.3).
     *
     * twoFactorPage ve onTwoFactorRedirect BILEREK VERILMIYOR, ve bu bir
     * eksiklik degil bir tercih. Ikisi de eklentinin fetch kancasinin icinde
     * calisiyor: biri window.location.href'i degistiriyor (tam sayfa
     * yenilemesi), digeri global bir geri cagirma. Ikisi de ayni seyi yapardi
     * - giris formunun DISINDA, formun haberi olmadan.
     *
     * Bunlar verilmeyince kanca hicbir sey yapmiyor ve sunucunun cevabi
     * cagirana OLDUGU GIBI donuyor: { twoFactorRedirect: true }. Karari
     * formun kendisi veriyor (sign-in-form.tsx), yani ikinci faktor adimi
     * ayni bilesenin icinde, gorunur bir durum degisikligi olarak duruyor.
     *
     * DIKKAT - OLCULDU: 2FA acikken signIn.email HATA DONDURMUYOR. error
     * null geliyor, bilgi yalnizca data.twoFactorRedirect'te. Yalnizca
     * error'a bakan bir cagiran, kullaniciyi OTURUMSUZ halde ana ekrana
     * gonderir ve /sign-in geri atar - kullanicinin gordugu sey bir dongu
     * olurdu.
     */
    twoFactorClient(),
  ],
});
