import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

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
  plugins: [emailOTPClient()],
});
