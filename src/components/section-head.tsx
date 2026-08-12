import Link from "next/link";

/**
 * Bolum basligi: kucuk etiket + altinda cizgi + istege bagli bir baglanti.
 *
 * ADR-021: bolumler buyuk baslikla degil, kucuk bir etiketle ayriliyor.
 * Kart basliklarinin (CardHeader/CardTitle) yerini bu aldi - kutu kalkinca
 * basligin da kutu icinde durmasi gerekmiyor.
 *
 * Paylasilan bir bilesen olmasinin sebebi tek: ayni desen artik dort
 * sayfada var ve birinde 2px degisirse digerleri onunla birlikte
 * degismeli. Kopyalanan bir duzen, sessizce ayrisan bir duzendir.
 */
export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-4 border-b border-border pb-2">
      <span className="label">{title}</span>
      {action ? (
        <Link
          href={action.href}
          className="text-xs text-muted-foreground transition-colors hover:text-brand"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}
