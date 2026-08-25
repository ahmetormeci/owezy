/**
 * Clerk hatasini okunur bir cumleye cevirir. Ham nesneyi ekrana basmak
 * kullaniciya hicbir sey anlatmaz.
 *
 * NEDEN BURADA: eskiden app/sign-in.tsx'in icindeydi. Ikinci faktor adimi
 * ayri bir bilesene cikinca iki yerden birden gerekti. Bir rota dosyasindan
 * import etmek yon olarak yanlis olurdu (bilesenler rotalara bagimli olmaz),
 * ve bu zaten saf bir yardimci - lib/ tam yeri.
 *
 * IKI SEKIL BIRDEN ele aliniyor cunku @clerk/expo v4'te ikisi de gelebiliyor:
 *   - DONEN hata: ClerkError - duz nesne, { message, longMessage, code }.
 *     emailCode.sendCode/verifyCode, password, mfa.*, finalize bunu doniyor.
 *   - FIRLATILAN hata: {errors:[{message}]} - eski Clerk sekli, ag katmaninda
 *     hala cikabiliyor.
 *
 * longMessage ONCE deneniyor: Clerk'in kendi tarifine gore kullaniciya
 * gosterilmek uzere yazilan alan o; message gelistiriciye bakan metin.
 */
export function describeClerkError(caught: unknown): string | null {
  if (caught && typeof caught === "object") {
    if ("longMessage" in caught && typeof caught.longMessage === "string" && caught.longMessage) {
      return caught.longMessage;
    }
    if ("errors" in caught && Array.isArray(caught.errors) && caught.errors.length > 0) {
      const first: unknown = caught.errors[0];
      if (
        first &&
        typeof first === "object" &&
        "message" in first &&
        typeof first.message === "string"
      ) {
        return first.message;
      }
    }
    if ("message" in caught && typeof caught.message === "string" && caught.message) {
      return caught.message;
    }
  }
  // null = "tanidik bir sekil bulamadim". Cumleyi CAGIRAN taraf sozlukten
  // koyuyor; bu fonksiyon bilesenlerin disinda ve ceviriciye erisemiyor.
  return null;
}
