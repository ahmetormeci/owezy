import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiDelete, apiPost } from "./api";

/**
 * Telefona bildirim gelmesi.
 *
 * IZIN ACILISTA ISTENMIYOR. iOS bu istemi UYGULAMA OMRUNDE BIR KEZ veriyor;
 * reddedilirse bir daha sorulamiyor, kullanici Ayarlar'a gitmek zorunda
 * kaliyor. Daha ne oldugunu anlamamis birine sormak "reddet"i garantiler.
 * O yuzden istem, bildirimler ekranindaki acik bir dugmenin arkasinda.
 *
 * ADRES CIHAZDA URETILIYOR (Expo), sunucu uretemez. Sunucuya yalnizca
 * kaydediliyor.
 */

/** Silinirken hangi adresi silecegimizi bilmek icin saklaniyor. */
const KEY = "push-token";

export type PushState = "granted" | "denied" | "undetermined" | "unsupported";

/**
 * SIMULATORDE PUSH YOK ve bu bir kusur degil: gercek bir APNs adresi
 * yalnizca fiziksel cihazda uretilebiliyor. Ayirt etmek onemli, cunku
 * "izin verilmedi" ile "bu cihaz zaten alamaz" kullaniciya farkli seyler
 * soylemeli - ve gelistirme simulatorde yapiliyor.
 */
function isSupported(): boolean {
  return Constants.isDevice !== false && Platform.OS === "ios";
}

export async function pushState(): Promise<PushState> {
  if (!isSupported()) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

/**
 * Expo'nun urettigi adresi alir.
 *
 * projectId ELLE VERILIYOR: expo-notifications onu otomatik cozmeye
 * calisiyor ama uretim paketinde bulamayip firlatiyor. app.json'daki deger
 * derleme aninda pakete giriyor, yani burada her zaman elimizde.
 */
async function readDeviceToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    // Simulator, aga erisilemiyor ya da izin sonradan kaldirilmis. Cagiran
    // taraf bunu "kaydedilemedi" olarak ele aliyor; uygulama CALISMAYA DEVAM
    // ediyor - bildirim bir ek, on kosul degil.
    return null;
  }
}

async function remember(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    // Saklanamadi: cikista sunucudaki satiri silemeyecegiz ama akis durmuyor.
  }
}

async function forget(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KEY);
    if (token) await SecureStore.deleteItemAsync(KEY);
    return token;
  } catch {
    return null;
  }
}

/**
 * IZNI ISTER ve kabul edilirse adresi sunucuya kaydeder.
 * Yalnizca kullanici acikca istediginde cagriliyor.
 */
export async function enablePush(authToken: string | null): Promise<PushState> {
  if (!isSupported()) return "unsupported";

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return status === "denied" ? "denied" : "undetermined";

  const token = await readDeviceToken();
  if (!token) return "granted";

  const result = await apiPost("/api/v1/push-tokens", authToken, {
    token,
    platform: Platform.OS,
  });
  if (result.ok) await remember(token);
  return "granted";
}

/**
 * IZIN ZATEN VARSA adresi tazeler. Acilista cagriliyor ve IZIN ISTEMIYOR -
 * yalnizca daha once izin vermis kullanicinin adresini guncel tutuyor.
 *
 * NEDEN GEREKLI: Expo adresleri degisebiliyor (uygulama yeniden kurulunca,
 * bazen kendiliginden). Tazelenmezse bildirimler bir gun sessizce kesilir ve
 * kimse sebebini bilmez.
 */
export async function syncPushToken(authToken: string | null): Promise<void> {
  if ((await pushState()) !== "granted") return;

  const token = await readDeviceToken();
  if (!token) return;

  const result = await apiPost("/api/v1/push-tokens", authToken, {
    token,
    platform: Platform.OS,
  });
  if (result.ok) await remember(token);
}

/**
 * CIKISTA cagriliyor - ve cagrilmasi SART. Adres sunucuda kalirsa telefon o
 * hesabin bildirimlerini almaya devam eder; ayni telefona baska biri giris
 * yapmis olsa bile. Yani bu, bir temizlik degil, bir sizinti kapatma.
 *
 * IZIN GERI ALINMIYOR: kullanici izni bize verdi, cikis yapmasi onu geri
 * aldigi anlamina gelmiyor. Tekrar girdiginde tekrar sorulmasi -
 * ki iOS bir daha sormuyor - kotu olurdu.
 */
export async function disablePush(authToken: string | null): Promise<void> {
  const token = await forget();
  if (!token) return;
  await apiDelete("/api/v1/push-tokens", authToken, { token });
}
