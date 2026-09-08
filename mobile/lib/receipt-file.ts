import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Fis fotografini SECME ve YUKLEME isi.
 *
 * IKI EKRAN KULLANIYOR ve bu yuzden burada: harcamayi duzenleme ekrani
 * (components/receipt-photo.tsx) ve YENI HARCAMA ekrani. Ikincisinde
 * fotograf, harcama daha KAYDEDILMEDEN seciliyor - baglanacagi kimlik
 * henuz yok - ve kayit basarili olunca yukleniyor.
 */

/** Uzun kenar. Bir fisi okumaya fazlasiyla yetiyor, dosyayi ~10 kat kucultuyor. */
const MAX_EDGE = 1600;

export type PickResult =
  | { kind: "picked"; uri: string }
  /** Kullanici vazgecti - hata DEGIL, sessizce donuluyor. */
  | { kind: "cancelled" }
  | { kind: "error"; code: string };

/**
 * Izin ister, sectirir ve KUCULTUR.
 *
 * IZIN SECIMDEN SONRA isteniyor: galeriden secen kisiden kamera izni
 * istemek, vermeyecegi bir seyi sormak olurdu.
 *
 * KUCULTME ZORUNLU, susleme degil: Vercel'in istek govdesi siniri 4.5MB ve
 * telefon fotografi 3-8MB. Kucultmeseydik yukleme, bizim yazdigimiz hata
 * cumlesine ulasamadan platform tarafindan kesilirdi. HEIC de bu adimda
 * JPEG oluyor - sunucu yalnizca JPEG ve PNG kabul ediyor.
 */
export async function pickReceipt(source: "camera" | "library"): Promise<PickResult> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { kind: "error", code: "receipt.permission_denied" };
  }

  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });

  if (picked.canceled || !picked.assets[0]) {
    return { kind: "cancelled" };
  }

  const context = ImageManipulator.ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize({ width: MAX_EDGE });
  const image = await context.renderAsync();
  const shrunk = await image.saveAsync({
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { kind: "picked", uri: shrunk.uri };
}

/**
 * Kucultulmus dosyayi uca yukler.
 *
 * DOSYAYI expo-file-system TASIYOR, fetch DEGIL. Baytlari JS'e okuyup fetch
 * govdesine koymak iki sorun cikardi: File'in Blob arayuzundeki bytes()
 * PROMISE donuyor (await unutulunca govdeye bir Promise gidiyor) ve React
 * Native'in fetch'i ArrayBuffer govdesini guvenilir tasimiyor. upload()
 * dosyayi diskten dogrudan istegin govdesine akitiyor; varsayilan
 * BINARY_CONTENT, sunucunun bekledigi ham govde.
 */
export async function uploadReceipt(
  localUri: string,
  endpoint: string,
  token: string | null,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const result = await new File(localUri).upload(endpoint, {
    httpMethod: "PUT",
    mimeType: "image/jpeg",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "image/jpeg",
    },
  });

  if (result.status >= 200 && result.status < 300) {
    return { ok: true };
  }

  // Sunucunun kodunu cevirebilmek icin ayikliyoruz; govde JSON degilse
  // genel cumleye dusuyoruz.
  try {
    const payload: unknown = JSON.parse(result.body);
    if (
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
    ) {
      return { ok: false, code: payload.code };
    }
  } catch {
    // Govde JSON degil.
  }
  return { ok: false, code: "server.unexpected" };
}

/** Fisin uc adresi. Iki ekran da ayni adresi kuruyor; tek yerde dursun. */
export function receiptEndpoint(baseUrl: string, groupId: string, expenseId: string): string {
  return `${baseUrl}/api/v1/groups/${groupId}/expenses/${expenseId}/receipt`;
}
