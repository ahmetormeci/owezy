/**
 * EKRAN testleri. Mobilde IKINCI test kosucusu ve bu bilincli.
 *
 * NEDEN VITEST YETMIYOR: vitest'in kapsadigi katman (lib/*) "react-native"i
 * hic import etmiyor, o yuzden jsdom yetiyordu (ADR-042). Ekranlar ve
 * components/* GERCEKTEN React Native import ediyor - <View>, <Pressable>,
 * StyleSheet. Onlari render etmek RN'in kendi donusumunu gerektiriyor ve
 * bunu saglayan sey jest-expo preset'i. Vitest'i RN'i anlayacak sekilde
 * zorlamak mumkun ama desteklenmeyen bir yapilandirma olurdu; ayni gerekceyle
 * ADR-038'de Better Auth istemcisini de reddetmistik.
 *
 * SINIR DIZINE GORE CIZILDI, dosya adina gore degil:
 *     lib/**      -> vitest   (RN'e dokunmuyor)
 *     components/**, app/**  -> jest  (RN'e dokunuyor)
 * Boylece "bu dosya hangi kosucuya ait" sorusunun cevabi dosyanin YERINDEN
 * okunuyor. Ikisi ayni dosyayi toplarsa test iki kez kosar ve biri kesin
 * duser - vitest.config.mts'teki include de bu yuzden lib/ ile sinirli.
 */
module.exports = {
  preset: "jest-expo",

  // YALNIZCA RN'e dokunan iki dizin. Kok dizindeki lib/ vitest'in.
  testMatch: [
    "<rootDir>/components/**/*.test.tsx",
    "<rootDir>/app/**/*.test.tsx",
  ],

  /**
   * jest-expo'nun setup'i "expo-modules-core"u KENDI konumundan ariyor ve o
   * paket UST DIZINE HOIST EDILMIYOR - expo/node_modules icinde duruyor.
   * Bulunamayinca butun kosu "Cannot find module 'expo-modules-core'" ile
   * dusuyor.
   *
   * DOGRUDAN BAGIMLILIK OLARAK EKLEMEK DENENDI VE GERI ALINDI: calisiyordu
   * ama expo-doctor hakli olarak itiraz etti - "should not be installed
   * directly, use the exported API from the expo package". Onun yerine jest'e
   * nerede arayacagini soyluyoruz; package.json temiz kaliyor.
   */
  moduleDirectories: ["node_modules", "node_modules/expo/node_modules"],

  moduleNameMapper: {
    // mobile/tsconfig.json'daki takma adin AYNISI: paylasilan saf moduller
    // (@/lib/messages, @/lib/locale) kok agactaki src/'ten geliyor.
    "^@/(.*)$": "<rootDir>/../src/$1",
  },

  /**
   * node_modules VARSAYILAN OLARAK DONUSTURULMUYOR, ama React Native
   * ekosistemi ES modulu olarak yayinlaniyor - donusturulmezlerse
   * "Unexpected token 'export'" ile duserler. Bu liste Expo'nun kendi
   * belgesinden alindi (docs.expo.dev/develop/unit-testing).
   */
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],

  // ONCE env (modul yuklenmeden), SONRA taklitler.
  setupFiles: ["<rootDir>/test/jest-env.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.ts"],
};
