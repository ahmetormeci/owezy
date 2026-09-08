import { AwsClient } from "aws4fetch";
import { ServiceError } from "@/lib/errors";

/**
 * Nesne deposu (Cloudflare R2).
 *
 * NEDEN R2: varsayilan olarak OZEL - herkese acik bir adres uretmiyor - ve
 * cikis ucreti yok. S3 uyumlu, yani imzalama standart.
 *
 * NEDEN @aws-sdk/client-s3 DEGIL: o paket bu is icin devasa (onlarca alt
 * bagimlilik, megabaytlarca kod) ve bize gereken uc islem var: koy, oku, sil.
 * aws4fetch ~5KB ve yaptigi tek sey SigV4 imzalamak; gerisi duz fetch.
 *
 * BAYTLAR BURADAN GECIYOR, ISTEMCIYE ACILMIYOR. Fis fotografi kisisel veri
 * tasiyor - uzerinde isim, adres, kartin son hanesi olabilir. Herkese acik
 * ya da imzali bir adres verseydik, o adresi eline gecirenin yetkisi bir
 * daha kontrol edilmezdi. Okuma da yazma da kendi ucumuzdan geciyor ve HER
 * ISTEKTE grup uyeligi sorgulaniyor (bkz. api/v1/.../receipt).
 */

/**
 * YAPILANDIRMA MODUL YUKLENIRKEN OKUNMUYOR, cagri aninda okunuyor.
 *
 * Modul seviyesinde okusaydik, degiskenler tanimli degilken bu dosyayi
 * ICE AKTARAN her sey patlardi - fis ozelligini hic kullanmayan sayfalar
 * dahil. Boylece eksik yapilandirma yalnizca fis islemlerini durduruyor.
 */
type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function readConfig(): StorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    /**
     * SESSIZCE DEVAM ETMIYOR. Yapilandirma eksikken "fotograf yuklenemedi"
     * demek, sebebi gizlemek olurdu; gelistirici .env.local'de bir satirin
     * eksik oldugunu asla ogrenemezdi. Hata cagirana kadar cikiyor ve orada
     * kullaniciya cevrilmis bir cumleye donuyor.
     */
    console.error(
      "R2 yapilandirmasi eksik. Tanimli olmasi gerekenler: R2_ACCOUNT_ID, " +
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.",
    );
    throw new ServiceError("storage.not_configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/**
 * R2_ACCOUNT_ID'yi bir SUNUCU ADINA cevirir.
 *
 * NEDEN IKI BICIM DE KABUL EDILIYOR: Cloudflare bu degeri panelde bir ADRES
 * icinde gosteriyor ("https://<kimlik>.r2.cloudflarestorage.com"), yani
 * yalnizca kimligi ayiklamak kullanicidan beklenen fazladan bir adim. Ilk
 * kurulumda tam olarak bu yasandi: deger "https://<kimlik>" olarak
 * yapistirildi ve istek "https://https://..." adresine gidip
 * ENOTFOUND (hostname: 'https') ile dustu - sebebi hicbir yerde yazmayan bir
 * DNS hatasi.
 *
 * TAM ADRES YAPISTIRILDIYSA OLDUGU GIBI KULLANILIYOR, kimligi ayiklayip
 * yeniden kurmuyoruz. Sebebi onemli: R2'nin yargi bolgesine ozel adresleri
 * var (ornegin "<kimlik>.eu.r2.cloudflarestorage.com"). Kimligi ayiklayip
 * varsayilan alan adini eklemek, AB kovasi olan birinin isteklerini SESSIZCE
 * yanlis yere gonderirdi.
 *
 * Ayirt etme kurali: sema ve yol atildiktan sonra geriye NOKTA iceren bir sey
 * kaliyorsa o bir sunucu adi; kalmiyorsa hesap kimligidir.
 */
export function storageHost(accountId: string): string {
  const withoutScheme = accountId.trim().replace(/^https?:\/\//i, "");
  const host = withoutScheme.split("/")[0];
  return host.includes(".") ? host : `${host}.r2.cloudflarestorage.com`;
}

function endpoint(config: StorageConfig, key: string): string {
  // Anahtar adres parcasi olarak gidiyor; ureten taraf yalnizca [a-z0-9/-]
  // kullaniyor (lib/receipts.ts) ama yine de bolum bolum kaciliyor.
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${storageHost(config.accountId)}/${config.bucket}/${path}`;
}

function client(config: StorageConfig): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    // R2 tek bir bolge gibi davraniyor; S3 imzasi yine de bir bolge istiyor.
    region: "auto",
    service: "s3",
  });
}

export async function putObject(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const config = readConfig();
  const response = await client(config).fetch(endpoint(config, key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!response.ok) {
    console.error("R2 yazma hatasi", response.status, await response.text());
    throw new ServiceError("storage.unavailable");
  }
}

/** Nesnenin baytlari. Bulunamazsa null - cagiran 404 doner. */
export async function getObject(key: string): Promise<ArrayBuffer | null> {
  const config = readConfig();
  const response = await client(config).fetch(endpoint(config, key));
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error("R2 okuma hatasi", response.status);
    throw new ServiceError("storage.unavailable");
  }
  return response.arrayBuffer();
}

/**
 * EN IYI GAYRET ve bu ADR-046'nin acik kurali: veritabani kaydi KESIN
 * siliniyor, depodaki nesne denenmis oluyor. Sira tersine olsaydi nesne
 * gider, kayit kalir ve arayuz kirik gorsel gosterirdi.
 *
 * Basarisizlik OKSUZ BIR NESNE birakiyor: kimse goremez ama faturasi
 * odenir. Bilinen ve kabul edilen bedel (ADR-046, "temizlik gerekir").
 */
export async function deleteObject(key: string): Promise<boolean> {
  try {
    const config = readConfig();
    const response = await client(config).fetch(endpoint(config, key), {
      method: "DELETE",
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
