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
  return send<T>(path, token, "GET");
}

/** Oturumlu POST. Govde JSON olarak gonderiliyor. */
export async function apiPost<T>(
  path: string,
  token: string | null,
  body: unknown,
): Promise<ApiResult<T>> {
  return send<T>(path, token, "POST", body);
}

/** Oturumlu PUT. Sunucu govdenin TAMAMINI bekliyor, kismi guncelleme yok. */
export async function apiPut<T>(
  path: string,
  token: string | null,
  body: unknown,
): Promise<ApiResult<T>> {
  return send<T>(path, token, "PUT", body);
}

/** Oturumlu DELETE. Silme YUMUSAK: sunucu kaydi isaretliyor, fiziksel silme yok. */
export async function apiDelete<T>(path: string, token: string | null): Promise<ApiResult<T>> {
  return send<T>(path, token, "DELETE");
}

async function send<T>(
  path: string,
  token: string | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
        ? payload.code
        : "server.unexpected";
    return { ok: false, status: response.status, code };
  }

  return { ok: true, data: payload as T };
}
