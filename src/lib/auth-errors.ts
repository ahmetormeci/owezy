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
  PASSWORD_TOO_LONG: "auth.password_too_long",

  /**
   * E-POSTANIN BICIMI BOZUK - "boyle bir hesap yok" DEGIL.
   *
   * Ayri bir cumle sizinti riski TASIMIYOR: bu kod adresin kayitli olup
   * olmadigina degil, bicimine bakiyor. "Kullanici yok" hala
   * auth.invalid_credentials'a bagli ve oyle kalmali.
   *
   * MOBILDE GERCEKTEN GORULDU (27.4, simulatorde): adres yarim girildi ve
   * kullaniciya "Bir seyler ters gitti" dendi. Yazim hatasi, kullanicinin
   * kendi duzeltebilecegi en yaygin hata - ve en anlamsiz cumleyi aliyordu.
   */
  INVALID_EMAIL: "auth.invalid_email",

  /**
   * PAROLA YANLIS - ve bu, "e-posta ya da parola hatali"dan AYRI bir cumle
   * olmak zorunda.
   *
   * Bu kod yalnizca kullanicinin ZATEN GIRMIS oldugu ekranlarda cikiyor:
   * iki adimli dogrulamayi acarken, kapatirken, yedek kodlari yenilerken
   * (/two-factor/*, hepsi parola istiyor). Orada e-posta diye bir alan yok;
   * "e-posta ya da parola hatali" demek kullaniciyi olmayan bir alani
   * kontrol etmeye gonderirdi.
   *
   * ESLENMEDIGI SURECE "Bir seyler ters gitti" gorunuyordu - yani guvenlik
   * ekranindaki EN OLASI hata, en anlamsiz cumleyi aliyordu.
   */
  INVALID_PASSWORD: "auth.invalid_password",

  /**
   * IKI ADIMLI DOGRULAMA. Kodlar paketten geldi
   * (two-factor/error-code.mjs), ezberden yazilmadi.
   */
  // Bizim kendi kancamizin firlattigi kod (bkz. better-auth.ts): 2FA acik
  // olan hesap e-posta koduyla giremiyor.
  TWO_FACTOR_REQUIRES_PASSWORD: "auth.two_factor_requires_password",
  // Yanlis TOTP ya da yanlis yedek kod: kullanicinin yapacagi sey ayni,
  // o yuzden ayni cumle. "Hangisi yanlisti" bilgisi saldirgana da yarar.
  INVALID_CODE: "auth.invalid_two_factor_code",
  INVALID_BACKUP_CODE: "auth.invalid_two_factor_code",
  OTP_HAS_EXPIRED: "auth.invalid_two_factor_code",
  // Hesap gecici olarak kilitlendi (ardarda yanlis kod).
  ACCOUNT_TEMPORARILY_LOCKED: "auth.two_factor_locked",
  // Meydan okuma suresi doldu ya da cerez kayboldu: bastan baslamak gerek.
  INVALID_TWO_FACTOR_COOKIE: "auth.two_factor_expired",
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
