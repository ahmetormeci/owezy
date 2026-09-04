/**
 * Sunucunun verdigi dosya adini Content-Disposition basligindan cikarir.
 *
 * NEDEN SUNUCUDAN OKUNUYOR, ISTEMCIDE URETILMIYOR: adi uc kuruyor
 * (expenses/export/route.ts) ve icinde grup adi ile tarih var. Mobilde
 * yeniden uretseydik iki ayri kural olurdu ve zamanla ayrisirdi - web'den
 * inen dosya bir ad, telefondan inen baska bir ad tasirdi.
 *
 * BASLIK IKI BICIM BIRDEN TASIYOR ve bu bilincli (bkz. route.ts): ASCII
 * yedegi eski istemciler icin, RFC 5987 bicimi (yildizli) gercek ad icin.
 * Turkce harf iceren bir grup adinda ikisi FARKLI olur - ASCII yedeginde
 * harfler bozulur. O yuzden ONCE yildizli olana bakiyoruz.
 */

/**
 * YALNIZCA yol ayiraclari ve kontrol karakterleri temizleniyor. Bosluk,
 * tire, nokta ve kesme isareti DOKUNULMADAN kaliyor.
 *
 * ONCE DAHA GENIS BIR LISTE YAZILDI VE YANLISTI: bu modulun VARLIK SEBEBI
 * web ile ayni dosya adini uretmek, genis temizlik ise tam da kacinilmak
 * istenen ayrismayi uretiyordu. Ustelik " -/" bir ARALIK (0x20-0x2F) ve
 * ".csv"deki noktayi da yiyordu - dosya "..._csv" olarak inerdi.
 *
 * Gercekten tehlikeli olan tek sey yol ayiraci: grup adini KULLANICI
 * yaziyor ve "A/B" gibi bir ad, dosyayi baska bir dizine yazmak olurdu.
 * iOS'ta bosluk, kesme isareti ve iki nokta dosya adinda sorun degil.
 *
 * "/" KARAKTER SINIFI ICINDE DE KACISLI YAZILIYOR: kacissiz hali
 * ayristiricilar arasinda belirsiz davraniyor ve sessizce eslesmeyen bir
 * regex uretebiliyor - ilk yazimda tam olarak bu oldu, hicbir karakter
 * degismedi ve test bunu yakaladi.
 */
const UNSAFE = /[\/\\\u0000-\u001f]/g;

function sanitize(name: string): string {
  return name.replace(UNSAFE, "_").trim();
}

export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  // RFC 5987 bicimi: filename*=UTF-8'<dil>'<yuzde-kodlanmis>. Gercek adi
  // yalnizca bu tasiyor, o yuzden once bakiliyor.
  const extended = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      const decoded = sanitize(decodeURIComponent(extended[1].trim()));
      if (decoded) return decoded;
    } catch {
      // Bozuk yuzde kodlamasi: yildizsiz bicime dusuyoruz. Burada patlamak,
      // elimizde kullanilabilir bir ad dururken dosyayi hic vermemek olurdu.
    }
  }

  // Duz bicim: filename="..." ya da filename=...
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  if (plain) {
    const cleaned = sanitize((plain[1] ?? plain[2] ?? "").trim());
    if (cleaned) return cleaned;
  }

  return null;
}
