/**
 * IBAN: temizleme, dogrulama, gosterim (ADR-059).
 *
 * SAF MODUL - sunucu, web ve mobil ayni dosyayi kullaniyor. Bir alanin
 * formda kabul edilip API'de reddedilmesi (ya da tersi) iki ayri kural
 * yazmanin dogal sonucu olurdu.
 *
 * DOGRULAMA IKI KATMANLI ve ikincisi asil koruma:
 *   1. Ulke + uzunluk: her ulkenin IBAN'i SABIT uzunlukta (TR 26). Eksik ya
 *      da fazla yazilmis bir hane burada yakalaniyor.
 *   2. Kontrol hanesi (ISO 7064 mod-97): IBAN'in 3-4. haneleri geri kalanin
 *      ozeti. Tek bir yanlis hane ve yer degistirmis iki hanenin cogu
 *      burada yakalaniyor. Yanlis IBAN'a para gitmesinin onundeki duvar bu.
 *
 * KAYITTA BICIM TEK: bosluksuz, buyuk harf ("TR330006100519786457841326").
 * Ekranda 4'erli gruplanarak gosteriliyor. Veritabani da ayni bicimi
 * zorluyor (User_iban_shape) - bu dosya atlanirsa bile bozuk bicim giremez.
 */

/**
 * IBAN kullanan ulkeler ve IBAN uzunluklari - SWIFT IBAN kaydi.
 *
 * LISTEDE OLMAYAN ULKE REDDEDILIYOR ve bu bilincli: "US" ile baslayip kontrol
 * hanesi tutan bir dizi IBAN degildir, cunku ABD IBAN kullanmiyor. Kayda yeni
 * bir ulke eklenirse buraya da eklenmeli; o gune kadar o ulkeden biri IBAN
 * giremez - yanlis bir IBAN'i kabul etmekten iyidir.
 */
const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BI: 27, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27,
  DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27,
  GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28,
  LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22,
  MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23,
  PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24,
  SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
};

/**
 * Kullanicinin yazdigini kayit bicimine cevirir: butun bosluklar gider,
 * harfler buyur. Kopyala-yapistirda gelen "TR33 0006 1005 ..." ve bankanin
 * kucuk harfli ciktisi ayni kayda donusuyor.
 *
 * toUpperCase, toLocaleUpperCase DEGIL: Turkce yerel ayarda "i" -> "İ"
 * olurdu ve IBAN'da noktali I diye bir harf yok.
 */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/**
 * Kayit bicimindeki bir IBAN gecerli mi. Girdi normalizeIban'dan GECMIS
 * olmali - burada bosluk ya da kucuk harf toleransi yok.
 */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
  const expectedLength = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expectedLength === undefined || iban.length !== expectedLength) return false;
  return mod97(iban) === 1;
}

/**
 * ISO 7064 MOD 97-10. Ilk dort karakter sona tasiniyor, harfler sayiya
 * donuyor (A=10 ... Z=35) ve sayinin 97'ye bolumunden kalan 1 olmali.
 *
 * SAYI PARCA PARCA isleniyor: 34 karakterlik bir IBAN harfler acilinca 60+
 * haneli bir sayi oluyor ve Number'a sigmiyor. BigInt de olurdu; parcali
 * kalan hem daha eski ortamlarda calisiyor hem yeterince acik.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    // 0-9 -> 0-9, A-Z -> 10-35. Bicim kontrolu yukarida yapildi.
    const value = code >= 65 ? code - 55 : code - 48;
    remainder = value >= 10 ? (remainder * 100 + value) % 97 : (remainder * 10 + value) % 97;
  }
  return remainder;
}

/** Ekran icin: 4'erli gruplar. "TR33 0006 1005 1978 6457 8413 26" */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * E-posta icin: ulke kodu ve son dort hane, arasi gizli. "TR•• •••• 1326"
 *
 * TAMAMI YAZILMIYOR: bildirim e-postasi, hesabi ele gecirilmis birinin
 * gelen kutusuna da dusebilir ve orada bir IBAN'in tamamina gerek yok -
 * sahibi kendi IBAN'ini son hanelerinden tanir.
 */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 2)}•• •••• ${iban.slice(-4)}`;
}

/**
 * "Yakinda degisti" penceresi. Odeyecek kisi, son bu kadar gunde degismis
 * bir IBAN'a para gondermeden once uyariliyor: hesabi ele gecirilen birinin
 * IBAN'i degistirilirse bunu fark etmenin tek yolu, parayi gonderecek
 * kisinin gormesi.
 */
export const IBAN_RECENT_CHANGE_DAYS = 7;

export function isIbanRecentlyChanged(
  updatedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!updatedAt) return false;
  const changedAt = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  return now.getTime() - changedAt.getTime() < IBAN_RECENT_CHANGE_DAYS * 24 * 60 * 60 * 1000;
}
