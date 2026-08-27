/**
 * Bir kisinin gorsel karsiligi: fotografi varsa fotografi, yoksa bas harfi.
 *
 * NEDEN hasImage'e BAKIYORUZ, avatarUrl'e degil: Clerk, fotograf yuklememis
 * kullaniciya da bir image_url veriyordu - kendi urettigi bas-harf gorseli.
 * "avatarUrl varsa bas" deseydik, fotografi olanlar gercek yuz, olmayanlar
 * CLERK'IN tasarimiyla gorunurdu ve ayni listede iki ayri gorsel sistem yan
 * yana dururdu. hasImage bu ayrimi tasiyor (bkz. schema.prisma).
 *
 * FAZ 25.7 SONRASI: iki alani da YAZAN KIMSE YOK. Clerk gitti, yerine gelen
 * kayit akisi fotograf sormuyor. Yani yeni her kullanici bas harfiyle
 * gorunuyor ve kod, eski satirlardaki degerler icin duruyor. Silmedik: bir
 * profil fotografi ozelligi geldiginde yazacak yer hazir - ve o gun geldiginde
 * hasImage ayrimi yine gerekecek.
 *
 * AMA ESKI SATIRLARDAKI DEGERLER YUKLENEMIYOR ve bu KULLANICI TARAFINDAN
 * BULUNDU: uye listesinde kirik bir gorsel kutusu goruluyordu.
 *
 * Iki sebep birden var:
 *   1. Adresler Clerk'in CDN'ini gosteriyor; o ornek sokuldu (Faz 25.7).
 *   2. Sokulmasaydi bile CSP gecirmezdi: img-src 'self' data: blob:
 *      (next.config.ts). Yani UZAK ADRESLI HICBIR GORSEL yuklenemez.
 *
 * Bu yuzden adres CSP'den gecemeyecekse GORSEL HIC DENENMIYOR. Denemek
 * kirik bir kutu gostermek demekti; denememek bas harfe dusmek. Kontrol
 * sunucuda yapiliyor - onError ile istemcide yakalamak, once kirik gorseli
 * gostermek ve ustune her sayfaya JavaScript eklemek olurdu.
 *
 * BIR FOTOGRAF OZELLIGI GELIRSE: gorseller kendi kokenimizden servis
 * edilirse burasi kendiliginden calisir. Uzak bir depodan gelecekse CSP de
 * ONUNLA BIRLIKTE degismeli - ADR-039 zaten bunu ongoruyor.
 *
 * Renk isimden TURETILIYOR, veritabaninda saklanmiyor: ayni kisi her
 * ekranda ayni rengi aliyor ve yeni bir kolon gerekmiyor. Ton araligi
 * bilerek genis, doygunluk ve aciklik sabit - boylece dort daire yan yana
 * geldiginde birbirinden ayriliyor ama hicbiri sayfadaki tek renk olan
 * bakiye isaretiyle yarismiyor (ADR-021).
 */

const SIZES = {
  sm: "size-5 text-[0.5625rem]",
  md: "size-6 text-[0.625rem]",
} as const;

/**
 * Isimden kararli bir ton uretir. Basit bir toplama yetiyor: amac
 * kriptografik dagilim degil, "ayni isim ayni renk" ve gozle ayrilabilirlik.
 */
function hueFromName(name: string): number {
  let total = 0;
  for (let i = 0; i < name.length; i += 1) {
    total = (total + name.charCodeAt(i) * (i + 1)) % 360;
  }
  return total;
}

/** Bas harf. Grafem kumesi degil kod noktasi bazli - "Ş" gibi harfler icin yeterli. */
function initial(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase("tr") ?? "?";
}

/**
 * Bu adres CSP'den gecer mi? (img-src 'self' data: blob:)
 *
 * Ayni kokenden gelen goreli adresler ve gomulu veri gecer; "https://..."
 * gibi mutlak bir adres gecmez. Kontrol dar tutuluyor: emin olamadigimiz
 * her adres "gecmez" sayiliyor, cunku yanlis tarafta hata yapmanin bedeli
 * kullanicinin gordugu kirik bir kutu.
 */
export function canRenderAvatar(url: string): boolean {
  // "//example.com/a.png" DE "/" ile basliyor ama ayni koken DEGIL -
  // protokol-goreli bir adres, tarayici onu dis bir sunucudan cekmeye
  // calisir. Ilk yazimda gozden kacti; testi yakaladi.
  if (url.startsWith("//")) return false;
  return url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:");
}

export function PersonAvatar({
  displayName,
  avatarUrl,
  hasImage,
  size = "md",
  className = "",
}: {
  displayName: string;
  avatarUrl?: string | null;
  hasImage?: boolean | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = `${SIZES[size]} shrink-0 rounded-full ${className}`;

  if (hasImage && avatarUrl && canRenderAvatar(avatarUrl)) {
    return (
      // next/image DEGIL duz img: next/image her dis kaynak icin
      // next.config'de bir remotePatterns tanimi ister; bu goruntuler ise
      // kucuk ve olculeri sabit, yani optimizasyonun getirisi yok.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className={`${base} object-cover`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} grid place-items-center font-semibold text-white`}
      style={{ backgroundColor: `oklch(0.55 0.1 ${hueFromName(displayName)})` }}
    >
      {initial(displayName)}
    </span>
  );
}
