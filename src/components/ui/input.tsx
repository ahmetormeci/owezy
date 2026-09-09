import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
                /*
         * KUTU DEGIL ALT CIZGI (kagit & petrol yonu).
         *
         * ADR-021 "kutu yerine cizgi" diyor ve sayfanin geri kalani oyle
         * ayriliyordu; form denetimleri bu kuralin disinda kalmisti ve
         * kagidin uzerinde yabanci duruyorlardi. Mobilde de ayni degisiklik
         * yapildi (components/field.tsx).
         *
         * ODAK ISARETI HALKA DEGIL, KALINLASAN CIZGI - ve bu bir zayiflatma
         * degil, duzeltme. Halka (ring-3) TAM BIR KUTU ciziyor: alani
         * kutudan cikardik, odaklaninca kutu geri geliyordu. Ekran
         * goruntusunde goruldu.
         *
         * Yerine alt cizgi 2px'e cikip markaya donuyor - alt cizgili
         * alanlarin yerlesik odak isareti bu. Kontrast yeterli (petrol/kagit
         * 7.37:1) ve isaret alanin butun genisligini kapliyor.
         *
         * pb duzeltmesi SART: kenarlik 1px'ten 2px'e cikinca alan bir piksel
         * buyuyup satiri zipletiyordu.
         */
        "h-9 w-full min-w-0 border-b border-input-line bg-transparent px-0 py-1.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-2 focus-visible:border-brand focus-visible:pb-[calc(0.375rem-1px)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
