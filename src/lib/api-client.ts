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
    throw new Error(translate("server.bad_response"));
  }

  const parsed = body as ApiErrorBody;
  if (!response.ok || parsed.ok === false) {
    throw new Error(
      parsed.code ? translate(parsed.code, parsed.params) : translate("server.unexpected"),
    );
  }

  return body as T;
}
