/**
 * Mobil istemcinin /api/v1'e eristigi tek yer.
 *
 * ONEMLI - BELIRTECI VEREN SUNUCU ILE CAGRILAN SUNUCU AYNI OLMAK ZORUNDA:
 * oturum belirteci sunucunun BETTER_AUTH_SECRET'i ile imzalaniyor ve yine
 * onunla dogrulaniyor. Gelistirmede mobil yerel sunucuya baglaniyor; canli
 * API (https://owezy.net) baska bir secret kullaniyor ve yerelden alinmis
 * bir belirtec orada 401 doner.
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
 * Oturumlu GET. Belirteci CAGIRAN veriyor: bu dosya saf kalsin diye. Belirtec
 * React baglamindan geliyor (useSession().getToken) ve kanca bir bilesenin
 * disinda cagrilamaz - okuma isi lib/use-api.ts'te.
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

/**
 * Oturumlu PATCH. PUT'tan farki KISMI guncelleme: govdede yalnizca degisen
 * alanlar gidiyor. Grup duzenlemede uc bunu bekliyor (updateGroupSchema
 * currency'yi disariyor ve alanlar optional).
 */
export async function apiPatch<T>(
  path: string,
  token: string | null,
  body: unknown,
): Promise<ApiResult<T>> {
  return send<T>(path, token, "PATCH", body);
}

/** Oturumlu DELETE. Silme YUMUSAK: sunucu kaydi isaretliyor, fiziksel silme yok. */
export async function apiDelete<T>(path: string, token: string | null): Promise<ApiResult<T>> {
  return send<T>(path, token, "DELETE");
}

async function send<T>(
  path: string,
  token: string | null,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      // credentials: "omit" - sebebi lib/auth.tsx'te uzun uzun yazili. Kisaca:
      // React Native'in fetch'i varsayilan olarak cerez tutuyor ve Better
      // Auth'un CSRF kontrolu cerez GORDUGU anda Origin istiyor. Mobil Origin
      // gondermiyor, yani cerez tasinirsa istek 403 olur. Bizim tasidigimiz
      // sey zaten Bearer; cerez hicbir ise yaramiyor.
      credentials: "omit",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    /**
     * AG HATASI SOZLESMEYE CEVRILIYOR: cihaz cevrimdisi, sunucu kapali ya da
     * EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres.
     *
     * BURADA OLMASI BIR REGRESYONU KAPATIYOR: bu kod ("server.offline")
     * onceden lib/use-api.ts'te uretiliyordu ve kaynagi Clerk'in getToken()
     * cagrisinin cevrimdisiyken firlattigi hataydi. Clerk gidince o dal da
     * gitti; yakalamayi buraya almasaydik kullanici ham "TypeError: Network
     * request failed" metnini gorurdu. Buradaki hali daha genis: yalnizca
     * Clerk'in fark ettigi durumlari degil, BUTUN ag hatalarini kapsiyor.
     *
     * status 0: ortada bir HTTP cevabi YOK. Istek hic gonderilmedi.
     */
    return { ok: false, status: 0, code: "server.offline" };
  }

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
