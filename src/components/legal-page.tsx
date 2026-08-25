import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PublicControls } from "@/components/public-controls";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/locale";
import type { LegalDocument } from "@/content/legal/types";

/**
 * Gizlilik politikasi ve destek sayfasinin ortak duzeni.
 *
 * SERVER COMPONENT, bilerek: "use client" yok. Belge metni boylece istemci
 * paketine hic inmiyor - iki dilde birkac bin kelime, hicbiri tarayiciya
 * gonderilmiyor.
 *
 * TASARIM: uygulamanin geri kaliniyla ayni malzeme - tek kenarlik, kucuk
 * kose, kilcal ayraclar. Bir "hukuk sayfasi" gibi degil, uygulamanin bir
 * parcasi gibi gorunmeli; kullanici buraya guvenmek icin geliyor ve yabanci
 * duran bir sayfa bunun tersini yapar.
 *
 * OLCU: metin max-w-2xl. Uzun paragraflarda satir uzunlugu okunabilirligin
 * kendisi; sinirsiz genislik, genis ekranda satir basina 150 karaktere cikar
 * ve goz satir sonunda kaybolur.
 */
export function LegalPage({
  document,
  locale,
  footer,
}: {
  document: LegalDocument;
  locale: Locale;
  /** Sayfanin altindaki caprazlama baglantilar. */
  footer: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <PublicControls />

      <article className="w-full max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark className="size-4 text-brand" />
          <span className="text-sm font-medium">Owezy</span>
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight">{document.title}</h1>

        {/* Tarih locale'e gore bicimleniyor - sayfanin geri kaliniyla ayni
            yoldan (dates.ts). Sabit bir metin, Ingilizce arayuzde Turkce
            tarih birakirdi. */}
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(new Date(document.updated), locale)}
        </p>

        <p className="mt-6 text-muted-foreground">{document.intro}</p>

        <div className="mt-10 flex flex-col gap-10">
          {document.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="border-b border-border pb-2 text-lg font-semibold">
                {section.heading}
              </h2>
              {section.blocks.map((block, index) =>
                block.kind === "p" ? (
                  // Blok listesi statik bir dosyadan geliyor ve hicbir zaman
                  // yeniden siralanmiyor; index burada kararli bir anahtar.
                  <p key={index} className="text-muted-foreground">
                    {block.text}
                  </p>
                ) : (
                  <ul key={index} className="flex flex-col gap-2">
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="border-b border-line-soft pb-2 text-muted-foreground last:border-b-0"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </div>

        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm">
          {footer.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </article>
    </div>
  );
}
