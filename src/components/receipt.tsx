/**
 * Fis: grup sayfasinin tasidigi kagit.
 *
 * NEDEN KART DEGIL: ADR-021 kutu yerine cizgi diyor ve bu hala gecerli -
 * fis bir "kart deseni" degil, sayfanin KENDISI. Grup sayfasinda tek bir
 * fis var; icindeki bolumler kutulanmiyor, noktali ayraclar ve cift
 * cizgilerle ayriliyor.
 *
 * Kagit hissini uc sey tasiyor ve ucu de BILGI TASIMIYOR:
 *   - cok hafif bir gren (paper-grain)
 *   - alttaki yirtik kenar
 *   - yuzeyden bir ton acik olmasi
 * Ucu de kaldirilinca sayfa calismaya devam eder; oradalar cunku ekranin
 * bir arayuz degil bir NESNE oldugunu soyluyorlar.
 */
export function Receipt({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[36.25rem] flex-col">
      <div className="paper rounded-t-[3px] border border-b-0 border-border px-6 py-8 shadow-[0_1px_1px_oklch(0.255_0.008_265/0.05),0_10px_30px_oklch(0.255_0.008_265/0.06)] sm:px-10">
        {/* Gren, icerigin ustunde degil ARKASINDA durmali: pointer-events yok
            ve mix-blend-mode ile zemine karisiyor. */}
        <span aria-hidden="true" className="paper-grain rounded-t-[3px]" />
        <div className="relative flex flex-col gap-6">{children}</div>
      </div>

      {/* Yirtik kenar. Iki capraz gradyan bir zikzak uretiyor; kagit rengi
          ustte, altindan tezgah goruniyor. drop-shadow kenarligin devam
          ettigi izlenimini veriyor. */}
      <span
        aria-hidden="true"
        className="block h-[7px]"
        // Tailwind'in arbitrary deger sozdizimi burada calismadi: iki
        // gradyanli background-image virgul iceriyor ve sinif adi icinde
        // virgul ayirici sayiliyor. Inline style tek dogru yol.
        style={{
          // Iki gradyanli ilk deneme calismadi: desen 14px yuksekti ama
          // serit 7px, yani yalnizca ustteki DUZ yari cizildi ve kenar
          // duz gorundu (ekran goruntusunde yakalandi).
          // Maske daha dogru arac: ucgen maskede, renk --paper'dan geliyor,
          // yani koyu tema da kendiliginden dogru.
          background: "var(--paper)",
          maskImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='7'%3E%3Cpath d='M0 0H14L7 7Z'/%3E%3C/svg%3E\")",
          maskSize: "14px 7px",
          maskRepeat: "repeat-x",
        }}
      />
    </div>
  );
}

/**
 * Fisin bir satiri: solda metin, sagda tutar, arada noktali ayrac.
 *
 * Ayrac ayri bir eleman (bos <span>) cunku noktalarin GENISLIGI degisken:
 * aciklama uzadikca ayrac kisaliyor, tutar hep ayni sutunda kaliyor.
 * border-bottom yerine text-decoration ile yapilsaydi nokta araligi yazi
 * tipine gore degisirdi.
 */
export function ReceiptLine({
  children,
  amount,
  muted = false,
}: {
  children: React.ReactNode;
  amount: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline text-sm ${muted ? "text-muted-foreground" : ""}`}>
      {children}
      <span aria-hidden="true" className="leader" />
      <span className="money shrink-0">{amount}</span>
    </div>
  );
}

/**
 * Ay sinirindaki perfore cizgi: ortada ay adi, iki yanda kesikli cizgi.
 *
 * Ay basliklari Faz 13'te zaten vardi; burada metaforun parcasi oluyorlar.
 * Cizgiler ::before/::after ile uretiliyor ki baslik ne kadar uzun olursa
 * olsun iki yan esit bolunsun.
 */
export function ReceiptPerforation({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 before:h-px before:flex-1 before:border-t before:border-dashed before:border-border after:h-px after:flex-1 after:border-t after:border-dashed after:border-border">
      <span className="cap">{children}</span>
    </div>
  );
}
