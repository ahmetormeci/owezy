import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, apiDelete, apiGet, apiPost, apiPut } from "./api";

/**
 * BU DOSYA NEYI KORUYOR: /api/v1'den donen HER SEYIN ekranlarin anladigi TEK
 * sozlesmeye ({ ok, status, code } / { ok, data }) cevrilmesi.
 *
 * Ozellikle iki sey ucuz gorunup pahali: "credentials" ve "Content-Type".
 * Ikisinin de yanlis hali BIR KEZ calisip sonra bozuluyor ya da yalnizca
 * sunucunun bir kosesinde bozuluyor - yani elle denemede kolayca kaciyor.
 */

const BASE = "http://localhost:3000";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // apiBaseUrl() bu degiskeni process.env'den MODUL YUKLENIRKEN okuyor,
  // yani testler arasinda degistirmek islemiyor. Sabit tutuyoruz.
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Sunucunun verdigi yaniti taklit eder. */
function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Govdesi hic JSON olmayan yanit (HTML hata sayfasi, bos govde, proxy cevabi). */
function respondWithGarbage(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  } as unknown as Response;
}

/** Son cagriya verilen fetch secenekleri. */
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
}

function lastHeaders(): Record<string, string> {
  return lastInit().headers as Record<string, string>;
}

describe("apiBaseUrl", () => {
  it("yapilandirilan adresi dondurur", () => {
    expect(apiBaseUrl()).toBe(BASE);
  });

  it("tanimsizsa NE YAPILACAGINI SOYLEYEN bir hata firlatir", async () => {
    // Modulu SIFIRDAN yuklemek gerekiyor: adres modul yuklenirken bir kez
    // okunuyor, sonradan degistirmek islemiyor.
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    const fresh = await import("./api");
    // Sessizce "undefined/api/v1/groups" adresine istek atmak, cihazda
    // anlamsiz bir ag hatasina donusurdu. Mesaj DOSYANIN ADINI vermeli.
    expect(() => fresh.apiBaseUrl()).toThrow(/mobile\/\.env\.local/);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("basarili yanit", () => {
  it("govdeyi data olarak gecirir", async () => {
    fetchMock.mockResolvedValue(respond(200, { id: "g1", name: "Ev" }));

    const result = await apiGet<{ id: string; name: string }>("/api/v1/groups/g1", "tok");

    expect(result).toEqual({ ok: true, data: { id: "g1", name: "Ev" } });
  });
});

describe("hata yanitlari sozlesmeye cevriliyor", () => {
  it("AG HATASI: status 0 ve server.offline", async () => {
    // Cihaz cevrimdisi, sunucu kapali ya da EXPO_PUBLIC_API_BASE_URL cihazdan
    // erisilemeyen bir adres. Ortada HTTP yaniti YOK, o yuzden status 0.
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    const result = await apiGet("/api/v1/groups", "tok");

    expect(result).toEqual({ ok: false, status: 0, code: "server.offline" });
  });

  it("sunucunun kodunu OLDUGU GIBI gecirir", async () => {
    fetchMock.mockResolvedValue(respond(404, { code: "expense.not_found" }));

    const result = await apiGet("/api/v1/expenses/yok", "tok");

    expect(result).toEqual({ ok: false, status: 404, code: "expense.not_found" });
  });

  it("KOD TASIMAYAN hata yanitinda server.unexpected", async () => {
    fetchMock.mockResolvedValue(respond(500, { message: "boom" }));

    const result = await apiGet("/api/v1/groups", "tok");

    expect(result).toEqual({ ok: false, status: 500, code: "server.unexpected" });
  });

  it("govdesi JSON bile olmayan hata yanitinda server.unexpected", async () => {
    // Gercek ornek: arada bir proxy'nin dondurdugu HTML hata sayfasi.
    // json() firlatirsa cokmemeliyiz.
    fetchMock.mockResolvedValue(respondWithGarbage(502));

    const result = await apiGet("/api/v1/groups", "tok");

    expect(result).toEqual({ ok: false, status: 502, code: "server.unexpected" });
  });
});

describe("istegin sekli", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(respond(200, {}));
  });

  it("CEREZ TASIMIYOR - bu satir duserse giris BIR KEZ calisip bozulur", async () => {
    await apiGet("/api/v1/me", "tok");

    /**
     * credentials: "omit" ZORUNLU. React Native'in fetch'i varsayilan olarak
     * cerez tutuyor; ilk giriste gelen Set-Cookie cihazda kalir ve SONRAKI her
     * istek Cookie basligi tasir. Better Auth'un CSRF kontrolu tam da o
     * basliga bakip Origin istiyor, mobil Origin gondermiyor -> 403.
     *
     * Belirtisi en zor hata sekli: giris ilk denemede calisir, ertesi gun
     * bozulur. O yuzden testle sabitleniyor.
     */
    expect(lastInit().credentials).toBe("omit");
  });

  it("belirtec varsa Authorization koyar", async () => {
    await apiGet("/api/v1/me", "tok-123");

    expect(lastHeaders().Authorization).toBe("Bearer tok-123");
  });

  it("belirtec yoksa Authorization basligini HIC koymaz", async () => {
    await apiGet("/api/v1/me", null);

    // "Bearer null" gondermek 401 yerine kafa karistirici bir hata uretirdi.
    expect(lastHeaders()).not.toHaveProperty("Authorization");
  });

  it("GOVDESIZ isteklerde Content-Type koymaz", async () => {
    await apiGet("/api/v1/me", "tok");
    expect(lastHeaders()).not.toHaveProperty("Content-Type");

    await apiDelete("/api/v1/expenses/e1", "tok");
    expect(lastHeaders()).not.toHaveProperty("Content-Type");
  });

  it("govdeli isteklerde Content-Type koyar ve govdeyi JSON'lar", async () => {
    await apiPost("/api/v1/groups", "tok", { name: "Ev" });

    expect(lastHeaders()["Content-Type"]).toBe("application/json");
    expect(lastInit().body).toBe('{"name":"Ev"}');
  });

  it("yolu adresin sonuna ekler ve yontemi gecirir", async () => {
    await apiPut("/api/v1/expenses/e1", "tok", { amount: 100 });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${BASE}/api/v1/expenses/e1`);
    expect(lastInit().method).toBe("PUT");
  });
});
