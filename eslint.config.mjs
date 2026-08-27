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
     * AMA BU SATIR BIR ARA "mobil kendi kurallariyla dogrulaniyor
     * (mobile/eslint.config.js)" DIYORDU VE O DOSYA HIC VAR OLMADI - 27
     * Agustos 2026'da olculdu. Yani mobil kodu bugun HICBIR lint gormuyor.
     * Bosluk PROGRESS.md'de aday olarak duruyor; buradaki cumle, kapanmadan
     * once kapandi sanilmasin diye duzeltildi.
     */
    "mobile/**",
  ]),
]);

export default eslintConfig;
