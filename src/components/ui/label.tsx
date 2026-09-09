"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        /*
         * ALAN ETIKETI ARTIK BAKIR KAPITEL (.cap) - mobildeki Field ile ayni.
         * Onceden 14 punto, yari kalin, notr bir metindi ve alanin
         * degerinden ayrilmiyordu; kutu kalkinca ikisi ayni agirlikta iki
         * satir haline geldi. Kucuk, aralikli ve bakir bir etiket "burasi
         * ad, asagisi deger" demenin en sessiz yolu.
         */
        "cap flex items-center gap-2 leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
