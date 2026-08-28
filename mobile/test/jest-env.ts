/**
 * Test ortaminin env degiskenleri. setupFiles ile TEST MODULUNDEN ONCE
 * calisiyor ve bu sart: lib/api.ts adresi MODUL YUKLENIRKEN okuyor, yani
 * setupFilesAfterEach cok gec kalirdi.
 *
 * SABIT VE SAHTE bir adres; mobile/.env.local'den OKUNMUYOR. Testlerin sonucu
 * gelistiricinin makinesindeki bir dosyaya bagli olmamali ve hicbir test
 * gercekten ag'a cikmiyor. vitest.config.mts'te de ayni deger duruyor.
 */
process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000";
