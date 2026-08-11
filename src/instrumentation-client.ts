import * as Sentry from "@sentry/nextjs";

// Tarayici tarafi. Dosya adi Next.js'in (ve Sentry'nin) bekledigi isim;
// eski "sentry.client.config.ts" Turbopack ile artik calismiyor.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Sunucu tarafiyla ayni gizlilik karari: kisisel veri yok.
    sendDefaultPii: false,

    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

// Sayfa gecislerinin izlenebilmesi icin Next.js'in router'ina baglaniyoruz.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
