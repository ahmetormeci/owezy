/**
 * Bir kisinin gorsel karsiligi: fotografi varsa fotografi, yoksa bas harfi.
 *
 * NEDEN hasImage'e BAKIYORUZ, avatarUrl'e degil:
 * Clerk, fotograf yuklememis kullaniciya da bir image_url veriyor - kendi
 * urettigi bas-harf gorseli. "avatarUrl varsa bas" deseydik, fotografi
 * olanlar gercek yuz, olmayanlar CLERK'IN tasarimiyla gorunurdu ve ayni
 * listede iki ayri gorsel sistem yan yana dururdu. hasImage bu ayrimi
 * tasiyor (bkz. schema.prisma).
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

  if (hasImage && avatarUrl) {
    return (
      // next/image DEGIL duz img: next/image, img.clerk.com icin
      // next.config'de remotePatterns tanimi ister ve bu goruntuler zaten
      // kucuk, Clerk'in CDN'inden geliyor ve olculeri sabit.
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
