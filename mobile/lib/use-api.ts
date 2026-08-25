import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut, type ApiResult } from "./api";
import { useSession } from "./auth";
import { useTranslate } from "./i18n";

export type QueryState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; text: string };

/**
 * Oturumlu istek atabilen SABIT fonksiyonlar.
 *
 * NEDEN AYRI BIR KANCA: belirteci dogru kullanmak gorunenden zor. Kanca her
 * render'da yeni bir nesne uretirse, onu bir bagimlilik listesine koyan her
 * cagri sonsuz donguye giriyor (18.2'de simulatorde bizzat yasandi, bkz.
 * CONVENTIONS.md "Mobil"). Burada fonksiyonlarin kendisi degil HER ZAMAN
 * GUNCEL bir referansi tutuluyor, boylece donen "get" bir kez uretiliyor ve
 * kimligi hic degismiyor.
 *
 * getToken() ARTIK FIRLATMIYOR. Clerk'te cevrimdisiyken hata firlatiyordu
 * (clerk_offline) ve burada yakalanip "server.offline" sozlesmesine
 * cevriliyordu. Bizim belirtecimiz Keychain'den okunuyor - ag yok. Cevrimdisi
 * durumu artik ISTEGIN KENDISINDE yakalaniyor (lib/api.ts) ve orasi butun
 * ag hatalarini kapsiyor, yalnizca Clerk'in fark ettiklerini degil.
 */
export function useApiClient() {
  const { getToken, signOut } = useSession();
  const getTokenRef = useRef(getToken);
  const signOutRef = useRef(signOut);
  useEffect(() => {
    getTokenRef.current = getToken;
    signOutRef.current = signOut;
  });

  /**
   * BELIRTEC ARTIK GECERSIZSE OTURUMU BIRAK.
   *
   * Clerk'te bu gerekmiyordu: SDK kisa omurlu JWT'yi arka planda yeniliyor,
   * yenileyemezse kendisi cikis yapiyordu. Better Auth'un Bearer belirteci
   * oturumun kendisi ve suresi dolabilir ya da sunucudan iptal edilebilir.
   * Ele almasaydik uygulama "girisli gorunen ama her istegi hata veren" bir
   * halde takilirdi - kullanicinin cikamadigi bir hal, cunku ekranlar acik.
   *
   * KOSUL DAR TUTULDU (401 VE auth.not_signed_in): baska bir sebeple gelen
   * 401 kullaniciyi disari atmamali. /api/v1'in tamami yetkisiz istege bu
   * kodu donuyor.
   */
  const guard = useCallback(async <T,>(result: ApiResult<T>): Promise<ApiResult<T>> => {
    if (!result.ok && result.status === 401 && result.code === "auth.not_signed_in") {
      await signOutRef.current();
    }
    return result;
  }, []);

  const get = useCallback(
    async <T,>(path: string): Promise<ApiResult<T>> =>
      guard(await apiGet<T>(path, await getTokenRef.current())),
    [guard],
  );

  const post = useCallback(
    async <T,>(path: string, body: unknown): Promise<ApiResult<T>> =>
      guard(await apiPost<T>(path, await getTokenRef.current(), body)),
    [guard],
  );

  const put = useCallback(
    async <T,>(path: string, body: unknown): Promise<ApiResult<T>> =>
      guard(await apiPut<T>(path, await getTokenRef.current(), body)),
    [guard],
  );

  const remove = useCallback(
    async <T,>(path: string): Promise<ApiResult<T>> =>
      guard(await apiDelete<T>(path, await getTokenRef.current())),
    [guard],
  );

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
