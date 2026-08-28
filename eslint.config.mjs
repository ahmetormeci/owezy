import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /**
     * Buradaki yapilandirma NEXT icin: React Native dosyalarini
     * next/core-web-vitals ile denetlemek anlamsiz uyarilar uretir (orn.
     * <img> yerine next/image). Disarida kalma sebebi bu ve gecerli.
     *
     * MOBIL ARTIK KENDI KURALLARIYLA DENETLENIYOR: mobile/eslint.config.js
     * (eslint-config-expo), "cd mobile && npm run lint", CI'da ayri bir adim.
     *
     * Bu cumle 27 Agustos 2026'da BIR YALANDI - ayni seyi soyluyordu ama o
     * dosya hic var olmamisti, yani mobil kodu hicbir lint gormuyordu. 28'inde
     * dosya gercekten yazildi. Ikisini ayirt etmek icin: dosyanin VARLIGINA
     * bak, bu yoruma degil.
     */
    "mobile/**",
  ]),
]);

export default eslintConfig;
