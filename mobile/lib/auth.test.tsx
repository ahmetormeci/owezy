import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __peek, __reset, __seed } from "../test/expo-secure-store.mock";
import { SessionProvider, useSession } from "./auth";

/**
 * BU DOSYA NEYI KORUYOR: mobilde giris yapmanin BUTUN durum makinesini.
 *
 * Faz 27.4'e kadar bu akisin tek dogrulamasi elle, simulatorde yapiliyordu -
 * ve tam da orada, elle denemenin kacirdigi bir hata bulundu: iki adimli
 * dogrulama acik bir hesapta sunucu 200 donuyor ama belirtec YERINE
 * { twoFactorRedirect: true } tasiyor. Kod bunu basari sanip "belirtec yok"
 * dalina giriyor ve kullaniciya "Bir seyler ters gitti" diyordu. Yani 2FA
 * acan kullanici mobilde HIC giremiyordu.
 *
 * O hatanin ailesi burada sabitleniyor: "200 her zaman iceri girdik demek
 * degildir" ve "meydan okuma cerezi tek bir cagriya elle tasiniyor".
 *
 * NEDEN BURADA RENDER EDEBILIYORUZ: lib/auth.tsx "react-native"i HIC import
 * etmiyor - yalnizca react, ./api, ./session-store ve @/lib/auth-errors.
 * Olculdu. O yuzden jsdom yetiyor, @testing-library/react-native gerekmiyor.
 */

const KEY = "owezy.session-token";
const BASE = "http://localhost:3000";
const CHALLENGE = "better-auth.two_factor=meydan.imza";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __reset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// --- yanit kuruculari -------------------------------------------------------

type Headers = { "set-auth-token"?: string; "set-cookie"?: string };

function ok(body: unknown, headers: Headers = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => headers[name as keyof Headers] ?? null },
    json: async () => body,
  } as unknown as Response;
}

function fail(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

/** Oturum acan basarili yanit: belirtec basligi dolu. */
function signedIn(token: string): Response {
  return ok({ redirect: false }, { "set-auth-token": token });
}

/** 2FA acik hesabin parola yaniti: 200, belirtec YOK, meydan okuma cerezi VAR. */
function twoFactorChallenge(setCookie: string | null = `${CHALLENGE}; Max-Age=600; Path=/`) {
  return ok(
    { twoFactorRedirect: true, twoFactorMethods: ["totp"] },
    setCookie === null ? {} : { "set-cookie": setCookie },
  );
}

// --- provider'i surmek ------------------------------------------------------

type Captured = ReturnType<typeof useSession>;

/**
 * SessionProvider'i render eder ve icerideki oturum nesnesini disari verir.
 * Nesne HER RENDER'DA tazeleniyor, yani `session.current` her zaman guncel.
 */
function renderSession() {
  const captured: { current: Captured | null } = { current: null };

  function Probe() {
    captured.current = useSession();
    return <span>{captured.current.status}</span>;
  }

  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );

  return {
    get session(): Captured {
      if (!captured.current) throw new Error("Provider render edilmedi");
      return captured.current;
    },
  };
}

/** Acilisttaki Keychain okumasi bitene kadar bekler. */
async function booted(harness: ReturnType<typeof renderSession>) {
  await waitFor(() => expect(harness.session.status).not.toBe("loading"));
  return harness;
}

/** Son fetch cagrisinin adresi ve secenekleri. */
function lastCall() {
  const call = fetchMock.mock.calls.at(-1);
  return {
    url: call?.[0] as string,
    init: call?.[1] as RequestInit,
    headers: (call?.[1] as RequestInit)?.headers as Record<string, string>,
  };
}

// --- acilis -----------------------------------------------------------------

describe("acilis", () => {
  it("Keychain'de belirtec varsa GIRISLI baslar", async () => {
    __seed(KEY, "eski-belirtec");

    const h = await booted(renderSession());

    expect(h.session.status).toBe("signed-in");
    await expect(h.session.getToken()).resolves.toBe("eski-belirtec");
  });

  it("belirtec yoksa CIKISLI baslar", async () => {
    const h = await booted(renderSession());

    expect(h.session.status).toBe("signed-out");
    await expect(h.session.getToken()).resolves.toBeNull();
  });

  it("getToken, Keychain okumasini BEKLER", async () => {
    /**
     * Belirtec state'te degil ref'te ve getToken acilis okumasini bekliyor.
     * Beklemeseydi girisli kullanicinin ILK istegi belirtecsiz gider ve 401
     * yerdi - yani her aciliste bir kez disari atilirdi.
     *
     * Burada BILEREK booted() cagirmiyoruz: daha ilk render'da soruyoruz.
     */
    __seed(KEY, "eski-belirtec");
    const h = renderSession();

    await expect(h.session.getToken()).resolves.toBe("eski-belirtec");
  });

  it("useSession, provider DISINDA cagrilirsa firlatir", () => {
    function Yalniz() {
      useSession();
      return null;
    }

    // Sessizce bos bir oturum dondurmek daha kotu olurdu: uygulama "cikis
    // yapilmis" gibi davranir ve sebebi hicbir yerde gorunmezdi.
    expect(() => render(<Yalniz />)).toThrow(/SessionProvider/);
  });
});

// --- parolayla giris --------------------------------------------------------

describe("parolayla giris", () => {
  it("2FA KAPALIYSA belirteci saklar ve iceri alir", async () => {
    fetchMock.mockResolvedValue(signedIn("yeni-belirtec"));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    expect(result).toEqual({ ok: true, twoFactor: false });
    expect(h.session.status).toBe("signed-in");
    expect(__peek(KEY)).toBe("yeni-belirtec");
    expect(lastCall().url).toBe(`${BASE}/api/auth/sign-in/email`);
  });

  it("2FA ACIKSA iceri ALMAZ, ikinci adimi bildirir", async () => {
    /**
     * 27.4'TE BULUNAN HATANIN TESTI. Sunucu 200 donuyor ama belirtec yok;
     * eklenti once bir oturum yaratip sonra onu SILIYOR ve yerine imzali bir
     * meydan okuma cerezi birakiyor.
     *
     * Bu dal olmadan accept(null) cagriliyor ve kullanici "Bir seyler ters
     * gitti" goruyordu.
     */
    fetchMock.mockResolvedValue(twoFactorChallenge());
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    expect(result).toEqual({ ok: true, twoFactor: true });
    // ICERI GIRMEDIK: ne ekran girisli, ne Keychain'e bir sey yazildi.
    expect(h.session.status).toBe("signed-out");
    expect(__peek(KEY)).toBeNull();
  });

  it("2FA yaniti geldi ama CEREZ OKUNAMADIYSA hata dondurur", async () => {
    // Devam etmenin anlami yok: ikinci adim cerezsiz TAMAMLANAMAZ ve
    // kullaniciyi bos bir kod ekraninda birakirdik.
    fetchMock.mockResolvedValue(twoFactorChallenge(null));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    expect(result).toEqual({ ok: false, code: "ui.sign_in_failed" });
    expect(h.session.status).toBe("signed-out");
  });

  it("200 dondu ama BELIRTEC YOKSA girisli saymaz", async () => {
    // Bu ancak sunucuda bearer() eklentisi dusmusse olur. Sessizce "girisli"
    // saymak, hicbir istegi calismayan bir uygulama demek olurdu.
    fetchMock.mockResolvedValue(ok({ redirect: false }));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    expect(result).toEqual({ ok: false, code: "ui.sign_in_failed" });
    expect(h.session.status).toBe("signed-out");
    expect(console.error).toHaveBeenCalled();
  });

  it("sunucunun hata KODUNU mesaj koduna cevirir", async () => {
    fetchMock.mockResolvedValue(fail(401, { code: "INVALID_EMAIL_OR_PASSWORD" }));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "yanlis");
    });

    // Ham Ingilizce metin degil, sozlukteki cumlenin kodu (ADR-017).
    expect(result).toEqual({ ok: false, code: "auth.invalid_credentials" });
  });

  it("ESLENMEYEN kodda genel cumleye duser", async () => {
    fetchMock.mockResolvedValue(fail(500, { code: "BEKLENMEYEN_SEY" }));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    // Yanlis bir cumle gostermektense genel bir cumle.
    expect(result).toEqual({ ok: false, code: "ui.sign_in_failed" });
  });

  it("AG HATASINDA server.offline dondurur", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const h = await booted(renderSession());

    let result;
    await act(async () => {
      result = await h.session.signInWithPassword("a@b.co", "parola");
    });

    // Ekranlara ham hata metni degil, sozlukteki cumle gidiyor.
    expect(result).toEqual({ ok: false, code: "server.offline" });
  });
});

// --- e-posta koduyla giris --------------------------------------------------

describe("e-posta koduyla giris", () => {
  it("kod istemek uca type: sign-in ile gider", async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));
    const h = await booted(renderSession());

    await act(async () => {
      await h.session.sendCode("a@b.co");
    });

    expect(lastCall().url).toBe(`${BASE}/api/auth/email-otp/send-verification-otp`);
    // type: "sign-in" - kullanici YOKSA Better Auth onu bu akista yaratiyor.
    // Mobilde ayri bir kayit ekrani olmamasinin sebebi bu.
    expect(lastCall().init.body).toBe('{"email":"a@b.co","type":"sign-in"}');
  });

  it("dogru kod belirteci saklar", async () => {
    fetchMock.mockResolvedValue(signedIn("kod-belirteci"));
    const h = await booted(renderSession());

    await act(async () => {
      await h.session.signInWithCode("a@b.co", "123456");
    });

    expect(h.session.status).toBe("signed-in");
    expect(__peek(KEY)).toBe("kod-belirteci");
  });
});

// --- ikinci faktor ----------------------------------------------------------

describe("ikinci faktor", () => {
  /** Once parolayla girip meydan okumayi elde eder. */
  async function withChallenge() {
    fetchMock.mockResolvedValue(twoFactorChallenge());
    const h = await booted(renderSession());
    await act(async () => {
      await h.session.signInWithPassword("a@b.co", "parola");
    });
    return h;
  }

  it("MEYDAN OKUMA YOKKEN suresi dolmus sayar ve ISTEK ATMAZ", async () => {
    const h = await booted(renderSession());
    fetchMock.mockClear();

    let result;
    await act(async () => {
      result = await h.session.verifySecondFactor("123456", false);
    });

    expect(result).toEqual({ ok: false, code: "auth.two_factor_expired" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cerezi VE Origin'i elle tasir", async () => {
    const h = await withChallenge();
    fetchMock.mockResolvedValue(signedIn("2fa-belirteci"));

    await act(async () => {
      await h.session.verifySecondFactor("123456", false);
    });

    const { url, headers, init } = lastCall();
    expect(url).toBe(`${BASE}/api/auth/two-factor/verify-totp`);
    expect(headers.Cookie).toBe(CHALLENGE);
    /**
     * ORIGIN YALNIZCA CEREZLE BIRLIKTE gidiyor ve bu bilincli. Sunucuda
     * olculdu: cerez + Origin yok -> 403 MISSING_OR_NULL_ORIGIN. Ama Origin'i
     * HER cagriya koymak da zararsiz degil - formCsrfMiddleware Origin gorunce
     * dogrulamayi ZORLUYOR.
     */
    expect(headers.Origin).toBe(BASE);
    // Cerez elle tasiniyor; RN'in kendi cerez kavanozu KAPALI kaliyor.
    expect(init.credentials).toBe("omit");
  });

  it("normal girislerde Origin GONDERMEZ", async () => {
    // Gonderseydi, biri EXPO_PUBLIC_API_BASE_URL'i baska bir adrese cevirdigi
    // gun BUTUN giris akisi 403 almaya baslardi.
    fetchMock.mockResolvedValue(signedIn("t"));
    const h = await booted(renderSession());

    await act(async () => {
      await h.session.signInWithPassword("a@b.co", "parola");
    });

    expect(lastCall().headers).not.toHaveProperty("Origin");
    expect(lastCall().headers).not.toHaveProperty("Cookie");
  });

  it("yedek kod AYRI uca gider", async () => {
    const h = await withChallenge();
    fetchMock.mockResolvedValue(signedIn("yedek-belirteci"));

    await act(async () => {
      await h.session.verifySecondFactor("YEDEK-1", true);
    });

    expect(lastCall().url).toBe(`${BASE}/api/auth/two-factor/verify-backup-code`);
  });

  it("trustDevice GONDERMEZ - 'bu cihazi hatirla' yalnizca web'de", async () => {
    const h = await withChallenge();
    fetchMock.mockResolvedValue(signedIn("t"));

    await act(async () => {
      await h.session.verifySecondFactor("123456", false);
    });

    // Ozellik bir cereze daha dayaniyor; mobilde tasinmasi ikinci bir kalici
    // sir demek olurdu (ADR-040).
    expect(lastCall().init.body).toBe('{"code":"123456"}');
  });

  it("dogru kod belirteci saklar ve iceri alir", async () => {
    const h = await withChallenge();
    fetchMock.mockResolvedValue(signedIn("2fa-belirteci"));

    let result;
    await act(async () => {
      result = await h.session.verifySecondFactor("123456", false);
    });

    expect(result).toEqual({ ok: true });
    expect(h.session.status).toBe("signed-in");
    expect(__peek(KEY)).toBe("2fa-belirteci");
  });

  it("YANLIS KOD meydan okumayi YAKMAZ - kullanici yeniden deneyebilir", async () => {
    /**
     * 6 haneli kodu yanlis yazmak en sik yasanacak sey; orada cerezi yakmak
     * kullaniciyi parolasini bastan girmeye zorlardi.
     *
     * Kaba kuvveti durduran sey cerezin tukenmesi DEGIL, sunucunun hiz
     * siniri: /two-factor/* uclari 10 saniyede 3 istekle sinirli (olculdu,
     * better-auth two-factor eklentisi).
     */
    const h = await withChallenge();
    fetchMock.mockResolvedValue(fail(401, { code: "INVALID_CODE" }));

    let first;
    await act(async () => {
      first = await h.session.verifySecondFactor("000000", false);
    });
    expect(first).toEqual({ ok: false, code: "auth.invalid_two_factor_code" });

    // Ikinci deneme: cerez HALA elimizde olmali, "suresi doldu" DEGIL.
    fetchMock.mockResolvedValue(signedIn("2fa-belirteci"));
    let second;
    await act(async () => {
      second = await h.session.verifySecondFactor("123456", false);
    });

    expect(second).toEqual({ ok: true });
    expect(lastCall().headers.Cookie).toBe(CHALLENGE);
  });

  it("BASARILI dogrulamadan sonra meydan okuma TUKENIR", async () => {
    const h = await withChallenge();
    fetchMock.mockResolvedValue(signedIn("2fa-belirteci"));
    await act(async () => {
      await h.session.verifySecondFactor("123456", false);
    });

    // Sunucu meydan okumayi kapatti; elimizdeki deger artik bir ise yaramaz.
    let again;
    await act(async () => {
      again = await h.session.verifySecondFactor("123456", false);
    });

    expect(again).toEqual({ ok: false, code: "auth.two_factor_expired" });
  });

  it("forgetChallenge, bekleyen meydan okumayi atar", async () => {
    // Kullanici giristen vazgecti: geri dondugunde eski meydan okumayla
    // devam etmemeli.
    const h = await withChallenge();

    act(() => {
      h.session.forgetChallenge();
    });

    let result;
    await act(async () => {
      result = await h.session.verifySecondFactor("123456", false);
    });

    expect(result).toEqual({ ok: false, code: "auth.two_factor_expired" });
  });
});

// --- cikis ------------------------------------------------------------------

describe("cikis", () => {
  it("belirteci siler, ekrani cikisli yapar, sunucuya haber verir", async () => {
    __seed(KEY, "belirtec");
    fetchMock.mockResolvedValue(ok({ success: true }));
    const h = await booted(renderSession());

    await act(async () => {
      await h.session.signOut();
    });

    expect(h.session.status).toBe("signed-out");
    expect(__peek(KEY)).toBeNull();
    expect(lastCall().url).toBe(`${BASE}/api/auth/sign-out`);
    expect(lastCall().headers.Authorization).toBe("Bearer belirtec");
  });

  it("SUNUCU CAGRISI DUSSE BILE kullanici cikmis olur", async () => {
    /**
     * SIRA BILEREK BOYLE: once yerel, sonra sunucu. Sunucuyu once cagirip
     * cagri basarisiz olsaydi (cevrimdisi, sunucu kapali) kullanici cikis
     * dugmesine basmis ama ICERIDE kalmis olurdu - Faz 24'te bu hatanin bir
     * baskasi duzeltildi.
     */
    __seed(KEY, "belirtec");
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const h = await booted(renderSession());

    await act(async () => {
      await h.session.signOut();
    });

    expect(h.session.status).toBe("signed-out");
    expect(__peek(KEY)).toBeNull();
    await expect(h.session.getToken()).resolves.toBeNull();
  });

  it("bekleyen meydan okumayi da atar", async () => {
    fetchMock.mockResolvedValue(twoFactorChallenge());
    const h = await booted(renderSession());
    await act(async () => {
      await h.session.signInWithPassword("a@b.co", "parola");
    });

    fetchMock.mockResolvedValue(ok({ success: true }));
    await act(async () => {
      await h.session.signOut();
    });

    let result;
    await act(async () => {
      result = await h.session.verifySecondFactor("123456", false);
    });

    expect(result).toEqual({ ok: false, code: "auth.two_factor_expired" });
  });
});
