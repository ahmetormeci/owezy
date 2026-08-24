import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, type ApiResult } from "./api";

export type QueryState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; text: string };

/**
 * Oturumlu GET'i cagirabilen SABIT bir fonksiyon.
 *
 * NEDEN AYRI BIR KANCA: getToken'i dogru kullanmak gorunenden zor.
 * useAuth() her render'da YENI bir getToken donduruyor; onu bir bagimlilik
 * listesine koymak sonsuz donguye yol aciyor (18.2'de simulatorde bizzat
 * yasandi, bkz. CONVENTIONS.md "Mobil"). Burada fonksiyonun kendisi degil
 * HER ZAMAN GUNCEL bir referansi tutuluyor, boylece donen "get" bir kez
 * uretiliyor ve kimligi hic degismiyor.
 */
export function useApiClient() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const get = useCallback(async <T,>(path: string): Promise<ApiResult<T>> => {
    const token = await getTokenRef.current();
    return apiGet<T>(path, token);
  }, []);

  const post = useCallback(async <T,>(path: string, body: unknown): Promise<ApiResult<T>> => {
    const token = await getTokenRef.current();
    return apiPost<T>(path, token, body);
  }, []);

  return useMemo(() => ({ get, post }), [get, post]);
}

/** Bir GET'i ekrana baglar. path null ise istek ATILMAZ. */
export function useApiGet<T>(path: string | null) {
  const { get } = useApiClient();
  const [state, setState] = useState<QueryState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Hangi adresin verisi elimizde? Ayni adres TAZELENIRKEN eldeki veri
  // korunuyor; yoksa harcama eklendikten sonra ozet yeniden cekilirken butun
  // ekran spinner'a duserdi - en sik yapilan isin ardindan sayfanin
  // kaybolmasi demek bu.
  const loadedPath = useRef<string | null>(null);

  useEffect(() => {
    if (path === null) {
      return;
    }

    // Ekran, cevap gelmeden once degisebilir. Iptal bayragi olmasaydi geri
    // donen istek artik gorunmeyen bir ekrani guncellemeye calisirdi.
    let cancelled = false;
    if (loadedPath.current !== path) {
      setState({ kind: "loading" });
    }

    void (async () => {
      try {
        const result = await get<T>(path);
        if (cancelled) return;

        if (result.ok) {
          loadedPath.current = path;
          setState({ kind: "ok", data: result.data });
        } else {
          setState({ kind: "error", text: `${result.status} · ${result.code}` });
        }
      } catch (error) {
        // Genelde ag hatasi: dev sunucusu kapali ya da
        // EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres.
        if (!cancelled) setState({ kind: "error", text: String(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
    // get SABIT (useApiClient bunu garanti ediyor), yani efekt yalnizca
    // gercekten yeni bir istek gerektiginde calisiyor.
  }, [path, attempt, get]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, reload };
}
