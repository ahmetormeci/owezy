import { isClerkRuntimeError, useAuth } from "@clerk/expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, type ApiResult } from "./api";
import { useTranslate } from "./i18n";

/**
 * Belirteci okur; cihaz cevrimdisiysa bunu API sozlesmesine cevirir.
 *
 * NEDEN VAR: @clerk/expo v4'te getToken() cevrimdisiyken HATA FIRLATIYOR
 * (kod "clerk_offline"); eski surumde sessizce basarisiz oluyordu. Burada
 * yakalamasaydik ekranlar ham hata metnini gosterirdi - her ekranda ayri
 * ayri "String(caught)" yaziyor.
 *
 * Kontrol @clerk/expo'nun KENDI disari verdigi isClerkRuntimeError ile
 * yapiliyor. ClerkOfflineError sinifi yalnizca gecisli bir pakette
 * (@clerk/shared) duruyor; oradan import etmek, dogrudan bagimliligimiz
 * olmayan bir paketin ic yerlesimine bel baglamak olurdu.
 *
 * status 0: ortada bir HTTP cevabi YOK. Istek hic gonderilmedi.
 *
 * Cevrimdisi olmayan hatalar OLDUGU GIBI firlatiliyor - yutmak, gercek bir
 * arizayi "baglanti yok" diye gostermek olurdu.
 */
async function readToken(
  getToken: () => Promise<string | null>,
): Promise<{ ok: true; token: string | null } | { ok: false; result: ApiResult<never> }> {
  try {
    return { ok: true, token: await getToken() };
  } catch (error) {
    if (isClerkRuntimeError(error) && error.code === "clerk_offline") {
      return { ok: false, result: { ok: false, status: 0, code: "server.offline" } };
    }
    throw error;
  }
}

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
    const read = await readToken(getTokenRef.current);
    if (!read.ok) return read.result;
    return apiGet<T>(path, read.token);
  }, []);

  const post = useCallback(async <T,>(path: string, body: unknown): Promise<ApiResult<T>> => {
    const read = await readToken(getTokenRef.current);
    if (!read.ok) return read.result;
    return apiPost<T>(path, read.token, body);
  }, []);

  const put = useCallback(async <T,>(path: string, body: unknown): Promise<ApiResult<T>> => {
    const read = await readToken(getTokenRef.current);
    if (!read.ok) return read.result;
    return apiPut<T>(path, read.token, body);
  }, []);

  const remove = useCallback(async <T,>(path: string): Promise<ApiResult<T>> => {
    const read = await readToken(getTokenRef.current);
    if (!read.ok) return read.result;
    return apiDelete<T>(path, read.token);
  }, []);

  return useMemo(() => ({ get, post, put, remove }), [get, post, put, remove]);
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

  // Ceviriciyi REF'te tutuyoruz, bagimlilik listesinde degil. Bu dosyanin
  // getToken icin ogrendigi dersin aynisi: efekt bagimliligina konan bir
  // fonksiyon gereksiz istek - kotu durumda sonsuz dongu - uretiyor.
  // useTranslate yalnizca dil degistiginde yenileniyor ve o an yeniden
  // veri cekmek istemiyoruz.
  const t = useTranslate();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

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
          // Kod DEGIL, cumle gosteriliyor. Onceden "404 · expense.not_found"
          // yaziyordu - gelistirici metni. Cevrimdisi yolu (0 · server.offline)
          // eklenince bu artik bir ayrinti degil: kullanicinin en sik
          // gorecegi hata o ve ona kod gostermek olmaz.
          // translate bilinmeyen kodda kodun kendisini donduruyor, yani en
          // kotu ihtimalde eski davranisa dusuyoruz.
          setState({ kind: "error", text: tRef.current(result.code) });
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

  // Donen nesne MEMOIZE ediliyor. Her render'da yeni bir nesne dondurmek,
  // onu bir bagimlilik listesine koyan her cagriyi sonsuz donguye sokuyor -
  // 18.6'da useFocusEffect'te tam olarak bu yasandi. Kural CONVENTIONS.md'de.
  return useMemo(() => ({ state, reload }), [state, reload]);
}
