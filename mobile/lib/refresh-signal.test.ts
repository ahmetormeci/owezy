import { describe, expect, it, vi } from "vitest";
import { createForegroundDetector, emitRefreshSignal, onRefreshSignal } from "./refresh-signal";

/**
 * BU DOSYA NEYI KORUYOR: "uygulama arka plandan dondu" kararini.
 *
 * Kararin iki yonu de sessizce bozulabilir:
 *   - fazla tetiklerse Denetim Merkezi'ni her indirisinde istek gider ve
 *     ekran bosuna kipirdar - kimse fark etmez, pil ve kota harcanir;
 *   - az tetiklerse kullanicinin bildirdigi kusur (liste ancak dakikalar
 *     sonra guncelleniyor) geri gelir.
 * Gecis dizileri RN'in iOS kaynagindan (RCTAppState.mm) alindi.
 */

/** Bir gecis dizisini dedektore verir, hangi adimlarda "dondu" dedigini dondurur. */
function feed(initial: string, steps: string[]): boolean[] {
  const detect = createForegroundDetector(initial);
  return steps.map((step) => detect(step));
}

describe("createForegroundDetector", () => {
  it("arka plandan donuste BIR KEZ tetikliyor", () => {
    expect(feed("active", ["inactive", "background", "active"])).toEqual([false, false, true]);
  });

  it("Denetim Merkezi / Face ID (inactive -> active) TETIKLEMIYOR", () => {
    // NEGATIF KONTROL: uygulama arka plana hic dusmedi.
    expect(feed("active", ["inactive", "active", "inactive", "active"])).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("donuste araya inactive girse de donus kacmiyor", () => {
    expect(feed("active", ["background", "inactive", "active"])).toEqual([false, false, true]);
  });

  it("donusten sonraki ikinci 'active' tekrar tetiklemiyor", () => {
    expect(feed("active", ["background", "active", "inactive", "active"])).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("uygulama ARKA PLANDA baslatildiysa ilk 'active' bir donus", () => {
    expect(feed("background", ["active"])).toEqual([true]);
  });

  it("baslangic durumu bilinmiyorsa ilk 'active' donus SAYILMIYOR", () => {
    expect(feed("unknown", ["active"])).toEqual([false]);
  });
});

describe("tazeleme sinyali", () => {
  it("abonelere ulasiyor, birakilan aboneye ulasmiyor", () => {
    const first = vi.fn();
    const second = vi.fn();
    const leaveFirst = onRefreshSignal(first);
    const leaveSecond = onRefreshSignal(second);

    emitRefreshSignal();
    leaveFirst();
    emitRefreshSignal();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    leaveSecond();
  });

  it("dinleyici calisirken abonelik birakilirsa digerleri yine duyuyor", () => {
    // Bir ekran sinyal uzerine kapanip aboneligini birakabilir; yineleme
    // ayni anda degisen kumeden etkilenmemeli.
    const other = vi.fn();
    const leaveSelf: { current: () => void } = { current: () => {} };
    leaveSelf.current = onRefreshSignal(() => leaveSelf.current());
    const leaveOther = onRefreshSignal(other);

    emitRefreshSignal();

    expect(other).toHaveBeenCalledTimes(1);
    leaveOther();
  });
});
