/**
 * Migration komutlarinin kullanacagi baglanti dizesini uretir.
 *
 * Iki is yapiyor:
 *
 * 1) Degisken yoksa OKUNAKLI hata verir. Prisma'nin kendi hatasi
 *    ("PrismaConfigEnvError: Cannot resolve environment variable") yapilandirma
 *    dosyasi yuklenirken olustugu icin tek satir bile log basmadan cikiyor;
 *    Vercel'de ilk deploy'da bu yuzden vakit kaybetmistik.
 *
 * 2) Neon'un HAVUZLU adresini dogrudan adrese cevirir ("-pooler" atilir).
 *    Prisma migrate, ayni anda iki migration calismasin diye oturum omurlu bir
 *    advisory lock aliyor. Havuzlu baglantida (PgBouncer) "oturum" surec bitince
 *    kapanmaz: baglanti havuza doner, kilit uzerinde asili kalir ve sonraki
 *    butun migration'lar zaman asimina ugrar. Bunu bir kez yasadik - kilidi
 *    tutan baglanti sonrasinda siradan uygulama sorgulari calistiriyordu.
 *
 * Uygulamanin KENDISI havuzlu adresi kullanmaya devam ediyor (src/lib/prisma.ts);
 * havuz orada dogru arac - sorun yalnizca migration'larin oturum kilidiyle.
 */
export function migrationUrl(variableName: string): string {
  const url = process.env[variableName];

  if (!url) {
    throw new Error(
      `${variableName} tanimli degil. Yerelde .env.local dosyasina, Vercel'de ` +
        `proje ayarlarindaki Environment Variables bolumune ekleyin.`,
    );
  }

  return url.replace("-pooler.", ".");
}
