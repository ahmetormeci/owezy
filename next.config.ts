import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Kaynak haritalari (source map) yalnizca token varken yuklenir. Onlar
  // olmadan Sentry'de yigin izi kucultulmus kod olarak gorunur - okunabilir
  // ama satir numaralari isimizi gormez. Token yoksa yukleme denemesi build'i
  // uzatip uyari uretecegi icin tamamen kapatiyoruz.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  // Sentry'nin kendi debug loglarini bundle'dan cikarir.
  disableLogger: true,

  silent: true,
});
