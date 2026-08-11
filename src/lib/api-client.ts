// Istemci tarafindan /api/v1 endpoint'lerini cagirmak icin tek giris noktasi.
//
// Tum API'lerimiz ayni sozlesmeyi kullaniyor: basarili cevaplar { ok: true, ... },
// hatalar { ok: false, error: "..." }. Bu fonksiyon o sozlesmeyi tek yerde
// yorumluyor ki her form ayni kontrolu tekrar yazmasin.

type ApiErrorBody = {
  ok?: boolean;
  error?: string;
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
    throw new Error("Sunucudan beklenmeyen bir cevap alındı");
  }

  const parsed = body as ApiErrorBody;
  if (!response.ok || parsed.ok === false) {
    throw new Error(parsed.error ?? "Beklenmeyen bir hata oluştu");
  }

  return body as T;
}
