import * as Sentry from "@sentry/nextjs";

// Next.js bu dosyayi sunucu baslarken bir kez calistirir. Sentry'yi burada
// kuruyoruz ki uygulama kodundan once devrede olsun ve acilis sirasindaki
// hatalari da yakalayabilsin.
export function register() {
  // DSN yoksa Sentry hic devreye girmiyor. Yerel gelistirmede .env.local'a
  // DSN koymuyoruz; boylece kendi denemelerimiz uzaktaki hata listesini
  // kirletmiyor. Vercel'de tanimli oldugu icin orada calisiyor.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Kisisel veri gondermiyoruz: IP adresi, cerezler, istek govdesi ve
    // kullanici bilgisi Sentry'ye gitmez. Varsayilan zaten false; kararin
    // bilincli oldugunu belgelemek icin acikca yaziyoruz.
    sendDefaultPii: false,

    // tracesSampleRate bilerek verilmedi: performans izleme kapali. Acilirsa
    // her istek Sentry'ye bir kayit gonderir ve ucretsiz kotayi hizla doldurur.
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

// Next.js, sunucuda render sirasinda olusan hatalari bu fonksiyona bildirir.
// Baglamadan (hangi route, hangi render asamasi) faydalanmak icin Sentry'nin
// hazir yardimcisini kullaniyoruz.
export const onRequestError = Sentry.captureRequestError;
