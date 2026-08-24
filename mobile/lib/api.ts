/**
 * Mobil istemcinin /api/v1'e eristigi tek yer.
 *
 * ONEMLI - CLERK ORNEGI ILE API AYNI OLMAK ZORUNDA: gelistirmede mobil
 * "pk_test_" kullaniyor (web'in yerel gelistirmesiyle ayni development
 * ornegi), dolayisiyla cagirdigi API de o ornekle calisan sunucu olmali.
 * Canli API (https://owezy.net) "pk_live_" bekliyor; test ornegindeki bir
 * kullanicidan alinmis Bearer orada dogrulanmaz ve 401 doner.
 *
 * iOS Simulator ana makinenin localhost'una erisebiliyor, yani
 * "http://localhost:3000" calisiyor. Fiziksel cihazda makinenin LAN adresi
 * gerekiyor - orada "localhost" cihazin kendisi demek.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export function apiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL tanimli degil. mobile/.env.local dosyasini " +
        "mobile/.env.local.example'a bakarak doldur.",
    );
  }
  return API_BASE_URL;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string };

/**
 * Oturumlu GET. Belirteci cagiran veriyor cunku onu almanin tek yolu Clerk'in
 * React kancasi (useAuth().getToken) ve kanca bir bilesenin disinda cagrilamaz.
 */
export async function apiGet<T>(path: string, token: string | null): Promise<ApiResult<T>> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "server.unexpected";
    return { ok: false, status: response.status, code };
  }

  return { ok: true, data: body as T };
}
