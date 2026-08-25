/**
 * Better Auth'un hata KODUNU bizim mesaj kodumuza cevirir.
 *
 * NEDEN CEVIRIYORUZ: Better Auth hatalarini Ingilizce METIN olarak da
 * veriyor ("Invalid OTP"). Onu dogrudan basmak iki sey birden bozardi -
 * Turkce arayuzde Ingilizce cumle, ve ADR-017'nin kurali ("kod donulur,
 * metni okuyan taraf uretir") tam da kullanicinin en kritik ekraninda
 * delinmis olurdu.
 *
 * KODLAR PAKETTEN OKUNDU, ezberden yazilmadi. Listede olmayan bir kod
 * gelirse null donuyor ve cagiran taraf genel mesaji koyuyor: yanlis bir
 * cumle gostermektense genel bir cumle gostermek dogru.
 */
const CODES: Record<string, string> = {
  INVALID_OTP: "auth.invalid_code",
  OTP_EXPIRED: "auth.invalid_code",
  // Cok deneme yapildi: kullanicinin yapmasi gereken sey yine "yeni kod
  // iste" oldugu icin ayni cumle. Ayri bir metin, ayni eylemi iki farkli
  // sekilde anlatmak olurdu.
  TOO_MANY_ATTEMPTS: "auth.invalid_code",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "auth.invalid_code",

  INVALID_EMAIL_OR_PASSWORD: "auth.invalid_credentials",
  // "Kullanici yok" da AYNI cumleye baglaniyor, bilerek: ayri bir mesaj
  // vermek, hangi e-postalarin kayitli oldugunu tek tek sinamaya izin
  // verirdi.
  USER_NOT_FOUND: "auth.invalid_credentials",

  PASSWORD_TOO_SHORT: "auth.password_too_short",
  USER_ALREADY_EXISTS: "auth.email_taken",
  // Calisma zamaninda donen GERCEK kod bu - kaynak dosyalarindaki kisa ad
  // degil. Kayit formunda olculdu.
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.email_taken",
};

export function authErrorCode(
  error: { code?: string; message?: string } | null | undefined,
): string | null {
  const mapped = error?.code ? CODES[error.code] : undefined;
  if (mapped) {
    return mapped;
  }

  // ESLENMEYEN HATA KONSOLA DUSUYOR.
  //
  // Olmadan: kullanici "Bir seyler ters gitti" goruyor ve GERIYE HICBIR IZ
  // KALMIYOR - ne kod, ne mesaj. Nitekim kayit formunda tam olarak bu oldu
  // ve teshis, elenerek ilerlemek zorunda kaldi.
  //
  // Kullaniciya gosterilen cumle yine GENEL kaliyor: Better Auth'un
  // Ingilizce metnini basmak, Turkce arayuzde Ingilizce cumle demek olurdu
  // (ADR-017). Ama gelistirici konsolunda ham hali durmali.
  if (error) {
    console.error("[auth] eşlenmemiş hata:", error);
  }
  return null;
}
