import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * SU AN HICBIR YERDEN IMPORT EDILMIYOR - ve bu bir kaza degil.
 *
 * Son dort kullanicisi /sign-in, /sign-up, /reset-password ve /join'di;
 * dorduncusu de AuthShell'e gecince (ADR-048, kagit & petrol yonu) kart
 * arayuzden tamamen cikti. Sebep: <Card> bir HALKA (ring-1) ve yuvarlak
 * koseyle sayfadan AYRI bir yuzey uretiyor; bu yonde yuzey tek - kagidin
 * kendisi - ve bolumleri kutu degil CIZGI ayiriyor (ADR-021).
 *
 * DOSYA NEDEN DURUYOR: shadcn'in vendor'lanmis parcasi, elle yazilmis kod
 * degil. Silmek yeni bir sey kazandirmiyor (uretim paketine girmiyor -
 * import edilmeyen modul agaca dahil olmuyor), geri getirmek ise
 * "npx shadcn add card" demek.
 *
 * YENI BIR KART EKLEMEDEN ONCE OKU: buraya donmek bir yuzey karari, bicim
 * karari degil. Yeni bir yuzeye gercekten ihtiyac varsa ADR-021 ve ADR-048
 * once tartisilmali.
 */

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
