import * as SecureStore from "expo-secure-store";

/**
 * Giris yapmamis birinin actigi davet baglantisini AKLINDA TUTAR.
 *
 * NEDEN GEREKLI: davet baglantisina dokunan kisi cogu zaman HENUZ KAYITLI
 * DEGIL - uygulamayi kurmasinin sebebi zaten o baglanti. Universal link
 * uygulamayi aciyor, AuthGuard onu giris ekranina yolluyor ve giris bitince
 * router.replace("/") calisiyor. O anda elinde davet kodu kalmazsa kisi
 * gruplar listesine dusuyor ve NEDEN uygulamayi actigini kendisi hatirlamak
 * zorunda kaliyor.
 *
 * NEDEN SecureStore, basit bir modul degiskeni degil: giris e-posta koduyla
 * yapiliyor ve kullanici kodu okumak icin UYGULAMADAN CIKIYOR. iOS arka
 * plandaki uygulamayi bellekten atabiliyor; o durumda modul degiskeni
 * kaybolur, kullanici geri geldiginde davet yok olur. Kod ayrica bir gruba
 * erisim veriyor, yani zaten guvenli depoya ait.
 *
 * TEK KULLANIMLIK: take() okuyup SILIYOR. Kalsaydi kullanici her acilista
 * ayni davete geri dondurulurdu - ve o davet coktan kullanilmis olabilir.
 */
const KEY = "pending-invite-token";

export async function rememberInvite(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // Depo yazilamadi. Akis DURMUYOR: kullanici giris yapip daveti elle
    // yapistirabiliyor. Burada patlamak, calisan bir yolu da kapatirdi.
  }
}

export async function takeInvite(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KEY);
    if (token) {
      await SecureStore.deleteItemAsync(KEY);
    }
    return token;
  } catch {
    return null;
  }
}

export async function forgetInvite(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Yoksa da sorun degil.
  }
}
