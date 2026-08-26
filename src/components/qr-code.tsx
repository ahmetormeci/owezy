import { encode } from "uqr";

/**
 * Bir metni QR koduna cevirip SVG olarak cizer.
 *
 * NEDEN uqr'nin renderSVG'si DEGIL: o, hazir bir SVG METNI donduruyor ve onu
 * ekrana basmanin tek yolu dangerouslySetInnerHTML olurdu. Burada bunun
 * yerine encode() cagriliyor - dondugu sey bir boolean matrisi - ve <path>
 * React'in kendi icinde uretiliyor. Yani sayfaya ham HTML enjekte eden bir
 * satir hic yok.
 *
 * SIYAH-BEYAZ SABIT, temaya UYMUYOR ve bu bilincli: tersine cevrilmis
 * (koyu zeminde acik modul) bir QR'i pek cok telefon tarayicisi okumuyor.
 * Karanlik temada beyaz bir kare gorunecek - kasitli gorunmesi icin
 * cagiran taraf onu yuvarlatilmis bir kutunun icine koyuyor.
 *
 * SESSIZ BOLGE (quiet zone) 4 MODUL: standardin istedigi deger bu. Daha
 * darinda tarayici kodun nerede bittigini kestiremeyebiliyor.
 */
const QUIET_ZONE = 4;

export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, data } = encode(text);

  // Her dolu hucre icin bir birim kare. Tek bir <path> olarak birlestiriliyor:
  // 35x35'lik bir kod ~600 dolu hucre demek ve her biri ayri <rect> olsaydi
  // DOM'a alti yuz dugum eklenirdi.
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y][x]) {
        path += `M${x + QUIET_ZONE},${y + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  const side = size + QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      // role="img" + aria-label: ekran okuyucu icin. Icerigi (gizli anahtar)
      // okumanin anlami yok; kullaniciya ne oldugunu soylemek yeterli.
      role="img"
      aria-label={label}
      className="size-40 rounded-md"
      // shape-rendering: modul kenarlarinda yumusatma olursa kucuk boyutta
      // kod bulaniklasiyor ve tarayici zorlaniyor.
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
