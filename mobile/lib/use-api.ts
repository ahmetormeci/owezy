import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, type ApiResult } from "./api";
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

  const patch = useCallback(
    async <T,>(path: string, body: unknown): Promise<ApiResult<T>> =>
      guard(await apiPatch<T>(path, await getTokenRef.current(), body)),
    [guard],
  );

  const remove = useCallback(
    async <T,>(path: string): Promise<ApiResult<T>> =>
      guard(await apiDelete<T>(path, await getTokenRef.current())),
    [guard],
  );

  return useMemo(
    () => ({ get, post, put, patch, remove }),
    [get, post, put, patch, remove],
  );
}

/** Bekleyen refresh() sozlerini cozer. */
function settle(waiters: { current: (() => void)[] }) {
  const done = waiters.current;
  waiters.current = [];
  for (const resolve of done) resolve();
}

/**
 * Bir GET'i ekrana baglar. path null ise istek ATILMAZ.
 *
 * IKI YENIDEN CEKME YOLU VAR ve farklari HATADA:
 *
 *   reload()  - "yeniden yukle". Basarisiz olursa ekran HATA HALINE geciyor.
 *               Hata ekranindaki "Tekrar dene" ve bir islemin ardindan
 *               (uye cikarildi, davet uretildi) listeyi yenilemek bunu
 *               kullaniyor; davranisi eskisiyle ayni.
 *   refresh() - "arka planda tazele". Basarisiz olursa ELDEKI VERI KALIYOR
 *               ve refreshError doluyor; ekran onu kucuk bir uyari olarak
 *               gosteriyor (components/refresh-notice.tsx).
 *
 * NEDEN AYRI BIR YOL: uygulama one gelince tazeleme eklendi (lib/
 * refresh-signal.ts). Metroda uygulamayi acan kisinin elindeki liste,
 * reload'un davranisiyla "Baglanti yok" sayfasina donusurdu - tazeleme
 * eklenmeden once hic olmayan bir kayip. Gordugu veri eski olabilir ve bunu
 * soylemek dogru; ama onu elinden almak degil.
 *
 * refresh() BIR SOZ DONDURUYOR ve istek bitince cozuluyor - basarili ya da
 * degil. Asagi cekip yenilemenin donen gostergesi tam o an kapanabilsin
 * diye (lib/screen-refresh.ts). Tahmini bir sure beklemek ya da "istek
 * suruyor mu" bayragini izlemek ya erken ya gec kapanirdi.
 */
export function useApiGet<T>(path: string | null) {
  const { get } = useApiClient();
  const [state, setState] = useState<QueryState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Hangi adresin verisi elimizde? Ayni adres TAZELENIRKEN eldeki veri
  // korunuyor; yoksa harcama eklendikten sonra ozet yeniden cekilirken butun
  // ekran spinner'a duserdi - en sik yapilan isin ardindan sayfanin
  // kaybolmasi demek bu.
  const loadedPath = useRef<string | null>(null);

  /**
   * Siradaki istegin turu ve ekranda GECERLI veri olup olmadigi.
   *
   * hasData loadedPath'ten AYRI: reload basarisiz olunca loadedPath yerinde
   * kaliyor (yeniden denerken spinner'a dusmemek icin) ama ekranda artik
   * veri degil hata var. Korunacak bir sey yokken "veriyi koru" denemez.
   */
  const mode = useRef<"reload" | "refresh">("reload");
  const hasData = useRef(false);
  const waiters = useRef<(() => void)[]>([]);

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
      // Istek atilmayacak; bekleyen bir refresh() varsa sonsuza dek asili
      // kalmasin.
      settle(waiters);
      return;
    }

    // Ekran, cevap gelmeden once degisebilir. Iptal bayragi olmasaydi geri
    // donen istek artik gorunmeyen bir ekrani guncellemeye calisirdi.
    let cancelled = false;
    if (loadedPath.current !== path) {
      hasData.current = false;
      setState({ kind: "loading" });
    }

    // Karar istegin BASINDA veriliyor: cevap beklenirken baska bir
    // reload/refresh cagrilirsa bu istek zaten iptal ediliyor.
    const keepDataOnError = mode.current === "refresh" && hasData.current;

    const fail = (text: string) => {
      if (keepDataOnError) {
        setRefreshError(text);
        return;
      }
      hasData.current = false;
      // Hata ekrani zaten sebebi yaziyor; ustune bir de uyari satiri koymak
      // ayni seyi iki kez soylemek olurdu.
      setRefreshError(null);
      setState({ kind: "error", text });
    };

    void (async () => {
      try {
        const result = await get<T>(path);
        if (cancelled) return;

        if (result.ok) {
          loadedPath.current = path;
          hasData.current = true;
          setRefreshError(null);
          setState({ kind: "ok", data: result.data });
        } else {
          // Kod DEGIL, cumle gosteriliyor. Onceden "404 · expense.not_found"
          // yaziyordu - gelistirici metni. Cevrimdisi yolu (0 · server.offline)
          // eklenince bu artik bir ayrinti degil: kullanicinin en sik
          // gorecegi hata o ve ona kod gostermek olmaz.
          // translate bilinmeyen kodda kodun kendisini donduruyor, yani en
          // kotu ihtimalde eski davranisa dusuyoruz.
          fail(tRef.current(result.code));
        }
      } catch (error) {
        // Genelde ag hatasi: dev sunucusu kapali ya da
        // EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres.
        if (!cancelled) fail(String(error));
      } finally {
        // Iptal edilen istegin sozlerini YENISI cozuyor - o da ayni
        // adresin guncel cevabini getiriyor.
        if (!cancelled) settle(waiters);
      }
    })();

    return () => {
      cancelled = true;
    };
    // get SABIT (useApiClient bunu garanti ediyor), yani efekt yalnizca
    // gercekten yeni bir istek gerektiginde calisiyor.
  }, [path, attempt, get]);

  // Ekran kapanirken bekleyen sozler cozuluyor: iptal edilen istegin yerine
  // gelecek bir istek artik yok.
  useEffect(() => () => settle(waiters), []);

  const reload = useCallback(() => {
    mode.current = "reload";
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        mode.current = "refresh";
        setAttempt((n) => n + 1);
      }),
    [],
  );

  // Donen nesne MEMOIZE ediliyor. Her render'da yeni bir nesne dondurmek,
  // onu bir bagimlilik listesine koyan her cagriyi sonsuz donguye sokuyor -
  // 18.6'da useFocusEffect'te tam olarak bu yasandi. Kural CONVENTIONS.md'de.
  return useMemo(
    () => ({ state, reload, refresh, refreshError }),
    [state, reload, refresh, refreshError],
  );
}
