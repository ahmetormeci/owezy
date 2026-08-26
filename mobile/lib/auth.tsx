import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authErrorCode } from "@/lib/auth-errors";
import { apiBaseUrl } from "./api";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session-store";

/**
 * Mobilin Better Auth ile konustugu TEK yer.
 *
 * NEDEN KUTUPHANE DEGIL, ELLE: Better Auth'un tarayici istemcisini
 * (better-auth/react) buraya koymayi olctuk ve React Native'de dogru
 * calismasi icin bir dizi kosul gerekiyordu - paketin oturum makinesi
 * localStorage, document.visibilitychange ve navigator.onLine uzerine kurulu;
 * RN'de `window` TANIMLI ama bu ucunun hicbiri yok, yani kod "tarayicidayim"
 * sanip yanlis dala giriyor (session-refresh.mjs'teki shouldRefetch()
 * navigator.onLine olmadigi icin surekli false doner). Kutuphanenin
 * DESTEKLEDIGI RN yolu zaten @better-auth/expo ve o cerez tabanli - onu
 * ADR-029'un Bearer sozlesmesini korumak icin reddettik.
 *
 * Desteklenmeyen bir yapilandirmayi surmektense mobilin Better Auth'tan
 * gercekten ihtiyac duydugu seyi yaziyoruz: DORT HTTP CAGRISI. Mobil zaten
 * /api/v1 uclarini lib/api.ts icinde boyle cagiriyor.
 *
 * PAYLASILAN SEY HATA ESLEMESI: @/lib/auth-errors web ile ORTAK. Bu dosya
 * saf (React icermiyor), yani i18n.tsx'in anlattigi "React bilesenleri siniri
 * gecmez" kurali ihlal edilmiyor. Ortak olmasi onemli: ayni Better Auth hata
 * kodunun web'de ve mobilde farkli cumleye baglanmasi, ayni uygulamayi iki
 * ayri urun gibi gosterirdi.
 */
const AUTH_PATH = "/api/auth";

/** Cagiran taraf ya basarili ya da GOSTERILECEK bir mesaj kodu aliyor. */
export type AuthResult = { ok: true } | { ok: false; code: string };

/**
 * Parolayla giris IKI sonuca cikabiliyor ve ikisi de BASARILI: ya oturum
 * acildi, ya da hesapta iki adimli dogrulama var ve ikinci adim bekleniyor.
 *
 * Ayri bir alan olmasi sart: "ok" tek basina "iceri girdik" demiyor. Onceden
 * boyle bir ayrim yoktu ve 2FA acan kullanici mobilde "Bir seyler ters gitti"
 * goruyordu - cunku yanit 200 donuyor ama belirtec tasimiyor.
 */
export type PasswordSignInResult =
  | { ok: true; twoFactor: boolean }
  | { ok: false; code: string };

/**
 * MEYDAN OKUMA CEREZININ ADI. Sunucudan gercek bir yanitla olculdu; yanit UC
 * Set-Cookie satiri tasiyor (ikisi oturum cerezlerini SILEN bos satirlar,
 * biri bu). Yani "gelen Set-Cookie'yi oldugu gibi geri gonder" yanlis olurdu.
 */
const TWO_FACTOR_COOKIE = "better-auth.two_factor";

/**
 * Set-Cookie basligindan yalnizca meydan okuma cerezini cikarir.
 *
 * React Native, birden fazla Set-Cookie satirini TEK bir baslikta ", " ile
 * birlestirerek veriyor. O yuzden ada gore ariyoruz ve degeri ilk ";" ye
 * kadar aliyoruz - degerin kendisi imzali, icinde nokta ve yuzde isareti
 * olabiliyor, ama ";" olamiyor.
 */
function readChallengeCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const start = setCookie.indexOf(`${TWO_FACTOR_COOKIE}=`);
  if (start === -1) return null;
  const end = setCookie.indexOf(";", start);
  const pair = end === -1 ? setCookie.slice(start) : setCookie.slice(start, end);
  // Max-Age=0 ile gelen bir SILME satirini meydan okuma sanmayalim.
  return pair === `${TWO_FACTOR_COOKIE}=` ? null : pair;
}

type SessionStatus = "loading" | "signed-in" | "signed-out";

type Session = {
  status: SessionStatus;
  /**
   * Belirteci OKUMANIN yolu. Deger degil fonksiyon, ve async: uygulama ilk
   * acildiginda deger henuz Keychain'den okunmamis oluyor. Bunu beklemeden
   * istek atmak, girisli kullanicinin ilk isteginin belirtecsiz gitmesi ve
   * 401 yemesi demekti - yani her aciliste bir kez disari atilirdi.
   */
  getToken: () => Promise<string | null>;
  sendCode: (email: string) => Promise<AuthResult>;
  signInWithCode: (email: string, code: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<PasswordSignInResult>;
  /** Ikinci faktor: uygulama kodu ya da yedek kod. */
  verifySecondFactor: (code: string, useBackupCode: boolean) => Promise<AuthResult>;
  /** Kullanici giristen vazgecti: bekleyen meydan okumayi at. */
  forgetChallenge: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    // Sessizce bos bir oturum dondurmek daha kotu olurdu: uygulama "cikis
    // yapilmis" gibi davranir ve sebebi hicbir yerde gorunmezdi.
    throw new Error("useSession, <SessionProvider> disinda cagrildi.");
  }
  return session;
}

/**
 * Better Auth'a POST atar ve yanitin `set-auth-token` basligini dondurur.
 *
 * credentials: "omit" ZORUNLU VE OLCULDU. React Native'in fetch'i varsayilan
 * olarak cerez tutuyor (XMLHttpRequest.withCredentials varsayilani true,
 * whatwg-fetch yalnizca "include"/"omit" icin bunu eziyor). Yani ilk giriste
 * gelen Set-Cookie cihazda saklanir ve SONRAKI her auth istegi Cookie basligi
 * tasir. Better Auth'un CSRF kontrolu tam da o basliga bakiyor:
 *     if (!(forceValidate || headers.has("cookie"))) return;
 * Sunucuda uc istekle olculdu:
 *     cerezsiz + Origin yok  -> uca ulasiyor        (mobilin hali)
 *     cerezsiz + Origin var  -> uca ulasiyor
 *     CEREZ VAR + Origin yok -> 403 MISSING_OR_NULL_ORIGIN
 * Yani "omit" olmadan giris BIR KEZ calisir, sonra bozulurdu - bulunmasi en
 * zor hata sekli. trustedOrigins'e ise HIC gerek yok; CURRENT_TASK bir ara
 * onu yaziyordu, olcum aksini soyledi.
 *
 * IKI ADIMLI DOGRULAMA ICIN CEREZ ELLE TASINIYOR (Faz 27.4) - ve "omit"
 * DEGISMIYOR. Eklentinin meydan okumasi imzali bir cerezle yuruyor
 * (verify-two-factor.mjs) ve baska bir tasiyicisi yok. RN'in kendi cerez
 * kavanozunu acmak yerine cerezi bir kez yakalayip TEK bir cagriya elle
 * koyuyoruz: kavanoz kapali kaliyor, cerez tam olarak iki uca gidiyor.
 *
 * ORIGIN YALNIZCA CEREZLE BIRLIKTE GONDERILIYOR ve bu bilincli. Sunucuda
 * gercek isteklerle olculdu:
 *     cerez + Origin yok -> 403 MISSING_OR_NULL_ORIGIN
 *     cerez + dogru Origin -> 200 + set-auth-token
 *     cerez + yanlis Origin -> 403 INVALID_ORIGIN
 * Origin'i HER cagriya koymak zararsiz degil: formCsrfMiddleware, Origin
 * gorunce dogrulamayi ZORLUYOR (validateOrigin(ctx, true)). O zaman bugun
 * calisan giris akisi, biri EXPO_PUBLIC_API_BASE_URL'i baska bir adrese
 * cevirdigi gun 403 almaya baslardi. Simdi yalnizca ikinci faktor adimi
 * etkilenir - ve sebebi de 403 INVALID_ORIGIN diye acikca yazar.
 *
 * SUNUCUDA trustedOrigins'E DOKUNULMADI: varsayilan liste BETTER_AUTH_URL'i
 * iceriyor ve gonderdigimiz Origin apiBaseUrl(), yani iki ortamda da ayni
 * adres (dev: localhost:3000, uretim: owezy.net).
 */
async function post(
  path: string,
  body: unknown,
  token: string | null,
  cookie?: string | null,
): Promise<
  | { ok: true; token: string | null; payload: unknown; setCookie: string | null }
  | { ok: false; code: string }
> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${AUTH_PATH}${path}`, {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie, Origin: apiBaseUrl() } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Ag hatasi: sunucu kapali, cihaz cevrimdisi ya da
    // EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres. Ekranlara
    // ham hata metni degil, sozlukteki cumle gidiyor.
    return { ok: false, code: "server.offline" };
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error =
      payload && typeof payload === "object"
        ? (payload as { code?: string; message?: string })
        : null;
    // Eslenmeyen kod null doner ve genel cumleye duseriz - yanlis bir cumle
    // gostermektense genel bir cumle. Ham hali auth-errors konsola basiyor.
    return { ok: false, code: authErrorCode(error) ?? "ui.sign_in_failed" };
  }

  // bearer() eklentisinin cevaba koydugu baslik. Cerez yerine bunu
  // sakliyoruz; /api/v1'in tamami "Authorization: Bearer" bekliyor (ADR-029).
  //
  // GOVDE DE DONUYOR cunku basari her zaman "iceri girdik" demiyor: 2FA acik
  // bir hesapta /sign-in/email 200 doner ama belirtec YERINE
  // { twoFactorRedirect: true } tasir. Bunu yalnizca govdeden anlayabiliyoruz.
  return {
    ok: true,
    token: response.headers.get("set-auth-token"),
    payload: await response.json().catch(() => null),
    setCookie: response.headers.get("set-cookie"),
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");

  /**
   * Belirtecin GERCEK kaynagi burasi, state degil.
   *
   * Sebep: state guncellemesi bir render bekliyor, oysa girisin hemen
   * ardindan atilan istek belirteci O AN istiyor. Ikisini ayirmak, "giris
   * basarili ama ilk istek yine 401" seklindeki en can sikici hatayi
   * bastan engelliyor. state yalnizca EKRANIN ne gosterecegini soyluyor.
   */
  const tokenRef = useRef<string | null>(null);

  /**
   * Keychain'den ilk okuma. Render sirasinda TEMBEL kuruluyor cunku
   * getToken() bunu bekleyebilmeli ve bir efektin calismasini beklerse
   * "ilk istek belirtecsiz gitti" durumu geri gelir.
   */
  /**
   * Bekleyen ikinci faktor meydan okumasinin cerezi.
   *
   * SADECE BELLEKTE - SecureStore'a YAZILMIYOR. Sunucudaki omru 600 saniye
   * (olculdu: Max-Age=600) ve tek kullanimlik. Kalici olarak saklamak,
   * kimseye yaramayan bir sirri cihazda birakmak olurdu; uygulama kapanip
   * acildiginda kullanici zaten bastan giris yapiyor.
   */
  const challengeRef = useRef<string | null>(null);

  const readyRef = useRef<Promise<void> | null>(null);
  if (readyRef.current === null) {
    readyRef.current = (async () => {
      tokenRef.current = await readSessionToken();
    })();
  }

  useEffect(() => {
    let cancelled = false;
    void readyRef.current?.then(() => {
      if (cancelled) return;
      setStatus(tokenRef.current ? "signed-in" : "signed-out");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getToken = useCallback(async () => {
    await readyRef.current;
    return tokenRef.current;
  }, []);

  /** Giris uclarinin ORTAK kuyrugu: belirteci sakla, ekrani girisli yap. */
  const accept = useCallback(async (token: string | null): Promise<AuthResult> => {
    if (!token) {
      // Uc 200 dondu ama belirtec yok. Bu ancak sunucuda bearer() eklentisi
      // dusmusse olur; sessizce "girisli" saymak, hicbir istegi calismayan
      // bir uygulama demek olurdu.
      console.error("[auth] yanıtta set-auth-token başlığı yok");
      return { ok: false, code: "ui.sign_in_failed" };
    }
    tokenRef.current = token;
    await writeSessionToken(token);
    setStatus("signed-in");
    return { ok: true };
  }, []);

  const sendCode = useCallback(async (email: string): Promise<AuthResult> => {
    // type: "sign-in" - kullanici YOKSA Better Auth onu bu akista yaratiyor.
    // Mobilde ayri bir kayit ekrani olmamasinin sebebi bu.
    const result = await post("/email-otp/send-verification-otp", { email, type: "sign-in" }, null);
    return result.ok ? { ok: true } : result;
  }, []);

  const signInWithCode = useCallback(
    async (email: string, code: string): Promise<AuthResult> => {
      const result = await post("/sign-in/email-otp", { email, otp: code }, null);
      return result.ok ? accept(result.token) : result;
    },
    [accept],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<PasswordSignInResult> => {
      const result = await post("/sign-in/email", { email, password }, null);
      if (!result.ok) return result;

      /**
       * 2FA ACIKKEN BU CAGRI HATA DONDURMUYOR - sunucuda olculdu:
       *     200 { twoFactorRedirect: true, twoFactorMethods: ["totp"] }
       *     set-auth-token YOK
       *     set-cookie: better-auth.two_factor=...; Max-Age=600
       * Eklenti parola dogruysa once bir oturum yaratiyor, sonra 2FA'nin
       * bekledigini fark edip O OTURUMU SILIYOR ve yerine imzali bir meydan
       * okuma cerezi birakiyor.
       *
       * Bu dal olmadan ne oluyordu: accept(null) cagriliyor, "bearer eklentisi
       * dusmus" diye konsola yaziyor ve kullaniciya "Bir seyler ters gitti"
       * diyordu. Yani 2FA acan kullanici mobilde giremiyordu ve sebebi
       * ekranda hicbir yerde yazmiyordu.
       */
      const twoFactorRedirect =
        typeof result.payload === "object" &&
        result.payload !== null &&
        "twoFactorRedirect" in result.payload;

      if (!twoFactorRedirect) {
        const accepted = await accept(result.token);
        return accepted.ok ? { ok: true, twoFactor: false } : accepted;
      }

      const cookie = readChallengeCookie(result.setCookie);
      if (!cookie) {
        // Cerez okunamadi. Devam etmenin anlami yok: ikinci adim onsuz
        // TAMAMLANAMAZ ve kullaniciyi bos bir kod ekraninda birakirdik.
        console.error("[auth] iki adımlı doğrulama çerezi okunamadı");
        return { ok: false, code: "ui.sign_in_failed" };
      }
      challengeRef.current = cookie;
      return { ok: true, twoFactor: true };
    },
    [accept],
  );

  const verifySecondFactor = useCallback(
    async (code: string, useBackupCode: boolean): Promise<AuthResult> => {
      const cookie = challengeRef.current;
      if (!cookie) {
        // Meydan okuma yok: kullanici bastan giris yapmali.
        return { ok: false, code: "auth.two_factor_expired" };
      }
      const path = useBackupCode
        ? "/two-factor/verify-backup-code"
        : "/two-factor/verify-totp";
      // trustDevice GONDERILMIYOR: "bu cihazi hatirla" yalnizca web'de
      // (ADR-040). Ozellik bir cereze daha dayaniyor ve mobilde tasinmasi
      // ikinci bir kalici sir demek olurdu.
      const result = await post(path, { code }, null, cookie);
      if (!result.ok) return result;
      // Meydan okuma tek kullanimlik; basarili ya da degil, bu cerez bitti.
      challengeRef.current = null;
      return accept(result.token);
    },
    [accept],
  );

  const forgetChallenge = useCallback(() => {
    challengeRef.current = null;
  }, []);

  /**
   * SIRA BILEREK BOYLE: once yerel, sonra sunucu.
   *
   * Sunucuyu once cagirsaydik ve cagri basarisiz olsaydi (cevrimdisi, sunucu
   * kapali) kullanici cikis dugmesine basmis ama ICERIDE kalmis olurdu -
   * Faz 24'te tam olarak bu hatanin bir baskasini duzelttik. Cihazdaki
   * belirteci silmek her zaman calisiyor; sunucudaki satiri silmek en iyi
   * gayret. Silinemezse belirtec yine de kimsenin elinde degil.
   */
  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    tokenRef.current = null;
    challengeRef.current = null;
    await clearSessionToken();
    setStatus("signed-out");
    if (token) {
      await post("/sign-out", {}, token);
    }
  }, []);

  const value = useMemo<Session>(
    () => ({
      status,
      getToken,
      sendCode,
      signInWithCode,
      signInWithPassword,
      verifySecondFactor,
      forgetChallenge,
      signOut,
    }),
    [
      status,
      getToken,
      sendCode,
      signInWithCode,
      signInWithPassword,
      verifySecondFactor,
      forgetChallenge,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
