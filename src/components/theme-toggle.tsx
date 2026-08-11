"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Acik/koyu tema dugmesi.
 *
 * Hangi ikonun gorunecegini JavaScript degil CSS seciyor: iki ikon da
 * basiliyor, "dark:" varyanti hangisinin gorunecegine karar veriyor.
 *
 * Nedeni hydration: sunucu hangi temanin secili oldugunu bilemez (secim
 * tarayicidaki localStorage'da ve isletim sistemi tercihinde). Ikonu state'e
 * baglasaydik sunucu ile istemci farkli HTML uretir; "mounted" bayragiyla
 * cozmek ise effect icinde setState demek olurdu ve zincirleme render acardi.
 * CSS ile secmek her iki sorunu da ortadan kaldiriyor - ustelik ilk karede
 * bos bir yer tutucu da gorunmuyor.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      // Etiket duruma gore degismiyor: sunucuda hangi temada oldugumuzu
      // bilmedigimiz icin durum bildiren bir metin yanlis olabilirdi.
      // "Temayi degistir" her iki durumda da dogru.
      aria-label="Temayı değiştir"
      className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Moon className="size-5 dark:hidden" />
      <Sun className="hidden size-5 dark:block" />
    </button>
  );
}
