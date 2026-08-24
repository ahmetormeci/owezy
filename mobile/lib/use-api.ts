import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api";

export type QueryState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; text: string };

/**
 * Oturumlu bir GET'i ekrana baglar.
 *
 * NEDEN AYRI BIR KANCA: getToken'i dogru kullanmak gorunenden zor.
 * useAuth() her render'da YENI bir getToken donduruyor; onu bir bagimlilik
 * listesine koymak sonsuz donguye yol aciyor (18.2'de simulatorde bizzat
 * yasandi, bkz. CONVENTIONS.md "Mobil"). Bu tuzagi her ekranda yeniden
 * kurmak yerine tek yerde cozuyoruz.
 *
 * path null ise istek ATILMAZ - "henuz hangi adresi cagiracagimi bilmiyorum"
 * durumu icin (orn. yonlendirme bekleyen bir ekran).
 */
export function useApiGet<T>(path: string | null) {
  const { getToken } = useAuth();

  // Fonksiyonun kendisi degil, HER ZAMAN GUNCEL bir referansi.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const [state, setState] = useState<QueryState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) {
      return;
    }

    // Ekran, cevap gelmeden once degisebilir. Iptal bayragi olmasaydi geri
    // donen istek artik gorunmeyen bir ekrani guncellemeye calisirdi.
    let cancelled = false;
    setState({ kind: "loading" });

    void (async () => {
      try {
        const token = await getTokenRef.current();
        const result = await apiGet<T>(path, token);
        if (cancelled) return;

        setState(
          result.ok
            ? { kind: "ok", data: result.data }
            : { kind: "error", text: `${result.status} · ${result.code}` },
        );
      } catch (error) {
        // Genelde ag hatasi: dev sunucusu kapali ya da
        // EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres.
        if (!cancelled) setState({ kind: "error", text: String(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Bagimliliklar BILEREK yalnizca bu ikisi: ikisi de sabit deger, yani
    // efekt yalnizca gercekten yeni bir istek gerektiginde calisiyor.
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, reload };
}
