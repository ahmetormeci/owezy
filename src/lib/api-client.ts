// Istemci tarafindan /api/v1 endpoint'lerini cagirmak icin tek giris noktasi.
//
// Tum API'lerimiz ayni sozlesmeyi kullaniyor: basarili cevaplar { ok: true, ... },
// hatalar { ok: false, code, params? }. Bu fonksiyon o sozlesmeyi tek yerde
// yorumluyor ki her form ayni kontrolu tekrar yazmasin.
//
// KODU METNE BURADA CEVIRIYORUZ. Boylece cagiran bileşenler degismedi: hepsi
// hala "catch (e) { e.message }" yapiyor ve okunabilir bir cumle goruyor.
// Ceviriyi her forma tek tek yaptirmak, 9 ayri yerde ayni hatayi yapma
// firsati demekti.

import { translate, type MessageParams } from "@/lib/messages";

type ApiErrorBody = {
  ok?: boolean;
  code?: string;
  params?: MessageParams;
};

/**
 * Hata METNINE ek olarak HTTP durumunu ve sunucu kodunu da tasir.
 *
 * Neden gerekti: cagiran taraf bazen hatayi ayirt etmek zorunda. Ilk ornegi
 * optimistic locking (ADR-032) - 409 + "expense.version_conflict" geldiginde
 * form, diger hatalardan farkli davraniyor: sunucudaki hali cekip neyin
 * degistigini gosteriyor. Duz Error ile bu ayrim yapilamiyordu.
 *
 * `message` eskisi gibi CEVRILMIS cumle, yani mevcut "catch (e) { e.message }"
 * yazan her yer degismeden calismaya devam ediyor.
 */
export class ApiClientError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(translate("server.bad_response"), response.status, null);
  }

  const parsed = body as ApiErrorBody;
  if (!response.ok || parsed.ok === false) {
    throw new ApiClientError(
      parsed.code ? translate(parsed.code, parsed.params) : translate("server.unexpected"),
      response.status,
      parsed.code ?? null,
    );
  }

  return body as T;
}
