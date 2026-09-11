/**
 * Fisten okunan TEK BIR metin parcasi ve KONUMU.
 *
 * Koordinatlar 0..1 araliginda ve Vision'in duzeninde: orijin SOL ALT,
 * yani y buyudukce YUKARI cikiliyor. Cevrimi saf modul yapiyor
 * (lib/receipt-blocks.ts) - boylece donusum testlenebilir bir yerde
 * duruyor, native tarafta degil.
 */
export type TextBlock = {
  text: string;
  /** Sol kenar. */
  x: number;
  /** Dikey ORTA nokta - satir gruplamasi buna gore yapiliyor. */
  y: number;
  width: number;
  height: number;
};
