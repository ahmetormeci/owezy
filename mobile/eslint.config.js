const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/**
 * Mobilin lint yapilandirmasi.
 *
 * NEDEN AYRI BIR DOSYA GEREKIYOR: kokun eslint.config.mjs'i "mobile/**"i yok
 * sayiyor ve sebebi gecerli - React Native dosyalarini next/core-web-vitals
 * ile denetlemek anlamsiz uyarilar uretiyor (orn. <img> yerine next/image).
 * Ama bu dosya yazilana kadar mobil kodu KARSILIGINDA HICBIR SEY ALMIYORDU:
 * 3745 satir hicbir kural gormuyordu. Kokun yorumu bir ara "mobil kendi
 * kurallariyla dogrulaniyor (mobile/eslint.config.js)" diyordu ve o dosya HIC
 * VAR OLMAMISTI - 27 Agustos 2026'da olculdu, 28'inde bu dosyayla kapandi.
 *
 * "npx expo lint" BU DOSYAYI URETMEDI ve sebebi ogretici: mobile/ icinde
 * config olmadigi icin ESLint yukari yuruyup KOKUN config'ini buluyor, arac da
 * "zaten yapilandirilmis" sanip geciyor. Sonra lint kosunca kokun
 * globalIgnores'i devreye giriyor ve "all of the files matching the glob
 * pattern .../mobile/app are ignored" hatasi geliyor. Yani sessiz degil,
 * yaniltici bir basarisizlik.
 *
 * PRETTIER BILEREK YOK: web tarafinda da yok. Yalnizca mobile eklemek iki
 * agac arasinda tutarsizlik ve 3745 satirlik bir bicimlendirme gurultusu
 * demekti. Buradaki kurallar DOGRULUKLA ilgileniyor, bicimle degil.
 */
module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/**",
      // Expo'nun paket ciktisi ve onbellegi - bizim yazdigimiz kod degil.
      "dist/**",
      ".expo/**",
      "expo-env.d.ts",
    ],
  },
]);
