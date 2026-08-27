import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Mobilin birim testleri. KOKTEKI vitest.config.ts'ten AYRI ve bu bilincli.
 *
 * NEDEN AYRI - IKI OLCULMUS SEBEP:
 *
 * 1. IKI AYRI REACT KOPYASI VAR. Kokte 19.2.4, mobilde 19.2.3 (package.json'lar
 *    boyle yaziyor). lib/i18n.tsx'in yorumu bunun ne yaptigini anlatiyor:
 *    web'in bir React bilesenini mobilden import etmek "Cannot read property
 *    'useContext' of null" ile dusuyor, cunku kanca cagrilari bos bir
 *    dispatcher'a gidiyor. Kokten kosan bir test mobilin SessionProvider'ini
 *    KOKUN React'iyle render ederdi - yani kacinilan seyin aynisi. Buradan
 *    kosunca "react" mobile/node_modules'tan cozuluyor, uygulamada oldugu gibi.
 *
 * 2. MOBILIN tsconfig'i "**\/*.ts"i kapsiyor ve CI "cd mobile && npx tsc
 *    --noEmit" kosuyor. Test dosyalari burada durup vitest mobilde KURULU
 *    olmasaydi, tipleri hicbir yerde kontrol edilmezdi.
 *
 * KAPSAM SINIRI: yalnizca REACT NATIVE'E DOKUNMAYAN dosyalar. Olculdu -
 * lib/api.ts, lib/auth.tsx, lib/i18n.tsx ve lib/use-api.ts "react-native"i
 * hic import etmiyor; lib/theme.ts (useColorScheme), components/* ve app/*
 * ediyor. Onlar icin @testing-library/react-native + jest-expo gerekiyor,
 * ayri bir kosucu demek - bilerek disarida (PROGRESS.md, aday listesi).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom, SessionProvider'i gercek bir React agacinda render edebilmek
    // icin. Testlerin cogu DOM'a hic dokunmuyor ama ayri ortamlarla iki
    // proje tanimlamak, kazandirdigindan fazla yapilandirma isterdi.
    environment: "jsdom",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // node_modules disarida: kurulu paketlerin kendi testleri toplanmasin.
    exclude: ["node_modules/**"],
    /**
     * SABIT VE SAHTE bir API adresi. lib/api.ts bunu MODUL YUKLENIRKEN
     * process.env'den okuyor, yani test icinde degistirmek islemiyor.
     *
     * mobile/.env.local'den OKUMUYORUZ ve bu bilincli: testlerin sonucu
     * gelistiricinin makinesindeki bir dosyaya bagli olmamali. Zaten hicbir
     * test gercekten ag'a cikmiyor - fetch her yerde taklit ediliyor - yani
     * adresin dogru olmasi degil, SABIT olmasi onemli.
     */
    env: {
      EXPO_PUBLIC_API_BASE_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      // mobile/tsconfig.json'daki takma adin AYNISI. Iki agacin PAYLASTIGI
      // saf moduller burada: @/lib/auth-errors, @/lib/messages, @/lib/locale.
      // Bunlar React icermiyor, yani 1. maddedeki tuzaga girmiyorlar.
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      // expo-secure-store NATIVE bir modul; Node'da yuklenemez. Testler
      // Keychain'i degil, ONUN PATLAMASI HALINDE ne oldugumuzu olcuyor -
      // yani gercek modul zaten istenmiyor.
      "expo-secure-store": fileURLToPath(
        new URL("./test/expo-secure-store.mock.ts", import.meta.url),
      ),
    },
  },
});
