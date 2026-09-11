/**
 * OCR PARCALARINI GORSEL SATIRLARA TOPLAR (ADR-055).
 *
 * NEDEN VAR: Apple Vision bir fisi satir satir vermiyor. Bir fis satirinda
 * ad solda, birim fiyat ortada, satir toplami sagda durur ve Vision bunlari
 * AYRI GOZLEMLER olarak dondurur - aralarindaki bosluk yuzunden. Ustelik
 * dondurdugu SIRA satira gore degil SUTUNA gore gruplanir: once butun
 * adlar, sonra butun fiyatlar, baska bir sirada.
 *
 * OLCULDU (gercek fis, fixtures/receipt-swiss.json):
 *     8: 2xLatte Macchiato
 *     9: 1xGloki
 *    10: 1xSchweinschnitzel     <- once dort ad
 *    14: 4.50
 *    21: 9.00                   <- sonra fiyatlar
 *
 * Yani "hangi fiyat hangi ada ait" bilgisi METINDE YOK. Konumda var:
 * o dort ad ile fiyatlari AYNI y'de, farkli x'te duruyor.
 *
 * BU MODULUN ISI o bilgiyi geri kurmak. Sonucu iki sey birden kullaniyor:
 * kalem cikarma (receipt-items.ts) ve toplam okuma (receipt-amount.ts) -
 * ikincisi gruplamadan ONCE de calisiyordu ama YANLIS: "TOPLAM" etiketi ile
 * tutari ayri satirlar oldugu icin etiket yolu hic devreye girmiyor, is
 * "en buyuk kuruslu sayi" yedegine kaliyordu. Gercek bir fiste bu, toplam
 * 27,96 iken odenen nakit 28,00'i secti.
 */

/**
 * Vision'in dondurdugu tek bir metin parcasi.
 *
 * KOORDINATLAR 0..1 VE ORIJIN SOL ALTTA - yani y BUYUDUKCE YUKARI. Bu
 * Vision'in kendi duzeni; native taraf donusturmuyor, cunku donusum
 * testlenebilir bir yerde durmali (bkz. modules/receipt-ocr).
 */
export type TextBlock = {
  text: string;
  /** Sol kenar. */
  x: number;
  /** Dikey ORTA nokta. */
  y: number;
  width: number;
  height: number;
};

/** Bir gorsel satir: soldan saga siralanmis parcalar ve birlesik metni. */
export type ReceiptLine = {
  /** Parcalarin bosluklarla birlestirilmis hali. */
  text: string;
  /** Soldan saga. */
  parts: TextBlock[];
};

/**
 * IKI PARCA AYNI SATIRDA MI?
 *
 * SABIT BIR ESIK KULLANILMIYOR ve bunun sebebi olculdu. Iki gercek fiste
 * "ayni satirdaki en buyuk fark" ile "satirlar arasi en kucuk fark"
 * ortanca harf yuksekligine oranla soyleydi:
 *
 *     Isvicre fisi    ayni 0.09  ·  arasi 1.06     -> genis aralik
 *     Officeworks     ayni 0.38  ·  arasi 0.45     -> DAR aralik
 *
 * Ikisini birden ayiran bir sabit 0.38 ile 0.45 arasina sikismak zorunda
 * kalirdi - iki ornekten tutturulmus, ucuncu fiste kirilacak bir sayi.
 *
 * ONUN YERINE GEOMETRIK BIR KURAL: parcalarin dikey araliklari, KUCUK
 * OLANIN yuksekliginin yarisindan fazla ortusuyorsa ayni satirdalar. Bu
 * kural kendiliginden olcekleniyor - fisin yazi boyu degisince esik de
 * degisiyor. Olculdu: k 0.3 ile 0.5 arasinda her iki fiste de AYNI dogru
 * sonucu veriyor, yani secim bir bicak sirtinda degil.
 */
const OVERLAP_RATIO = 0.4;

function sameLine(a: TextBlock, b: TextBlock): boolean {
  const aTop = a.y + a.height / 2;
  const aBottom = a.y - a.height / 2;
  const bTop = b.y + b.height / 2;
  const bBottom = b.y - b.height / 2;

  const overlap = Math.min(aTop, bTop) - Math.max(aBottom, bBottom);
  return overlap > OVERLAP_RATIO * Math.min(a.height, b.height);
}

/**
 * Parcalari gorsel satirlara toplar. Sonuc USTTEN ALTA sirali; her satirin
 * parcalari SOLDAN SAGA.
 *
 * Bos metinli parcalar atiliyor: Vision zaman zaman gorunmez bir sey
 * "okuyor" ve bos bir gozlem birakiyor.
 */
export function groupIntoLines(blocks: TextBlock[]): ReceiptLine[] {
  const usable = blocks.filter((block) => block.text.trim().length > 0);
  // Orijin sol altta: y BUYUK olan USTTE. Ustten alta = y'ye gore AZALAN.
  const byY = [...usable].sort((a, b) => b.y - a.y);

  const groups: TextBlock[][] = [];
  for (const block of byY) {
    /**
     * SON GRUBA bakiliyor, butun gruplara degil. Parcalar zaten ustten alta
     * sirali; bir parca kendinden cok yukaridaki bir grupla ortusemez.
     *
     * Grubun HERHANGI BIR uyesiyle ortusmesi yetiyor: bir satirda kucuk ve
     * buyuk punto yan yana olabilir (ornegin "TOPLAM" ile tutari) ve
     * yalnizca ilk uyeye bakmak onlari ayirirdi.
     */
    const current = groups[groups.length - 1];
    if (current && current.some((member) => sameLine(block, member))) {
      current.push(block);
    } else {
      groups.push([block]);
    }
  }

  return groups.map((group) => {
    const parts = [...group].sort((a, b) => a.x - b.x);
    return { text: parts.map((part) => part.text).join(" "), parts };
  });
}

/** Yalnizca metinler - toplam okuyucusu bunu bekliyor. */
export function linesFrom(blocks: TextBlock[]): string[] {
  return groupIntoLines(blocks).map((line) => line.text);
}
