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
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
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
 */
async function post(
  path: string,
  body: unknown,
  token: string | null,
): Promise<{ ok: true; token: string | null } | { ok: false; code: string }> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${AUTH_PATH}${path}`, {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  return { ok: true, token: response.headers.get("set-auth-token") };
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
    async (email: string, password: string): Promise<AuthResult> => {
      const result = await post("/sign-in/email", { email, password }, null);
      return result.ok ? accept(result.token) : result;
    },
    [accept],
  );

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
    await clearSessionToken();
    setStatus("signed-out");
    if (token) {
      await post("/sign-out", {}, token);
    }
  }, []);

  const value = useMemo<Session>(
    () => ({ status, getToken, sendCode, signInWithCode, signInWithPassword, signOut }),
    [status, getToken, sendCode, signInWithCode, signInWithPassword, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
