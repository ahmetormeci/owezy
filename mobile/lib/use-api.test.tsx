import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "./api";
import { useApiGet } from "./use-api";

/**
 * BU DOSYA NEYI KORUYOR: useApiGet'in IKI yeniden cekme yolunun HATADAKI
 * farkini (lib/use-api.ts'in ust yorumu).
 *
 *   reload()  basarisiz -> ekran hata hali (eski davranis, degismemeli)
 *   refresh() basarisiz -> eldeki veri KALIYOR, refreshError doluyor
 *
 * Ikincisi kullanicinin karari: uygulama one gelince tazeleme eklendi ve
 * cevrimdisi bir donuste listenin "Baglanti yok" sayfasina donusmesi
 * istenmedi. Iki yol yer degistirirse ikisi de derlenir; fark yalnizca
 * cevrimdisi bir telefonda gorunur.
 */

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn<(path: string, token: string | null) => Promise<ApiResult<unknown>>>(),
}));

vi.mock("./api", () => ({
  apiGet: mocks.apiGet,
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

// Oturum: sabit bir belirtec. Kimligi SABIT nesne - useApiClient her cizimde
// yeni bir getToken gorurse bu testin konusu olmayan bir dongu kurulur.
const session = { getToken: async () => "tok", signOut: vi.fn(async () => {}) };
vi.mock("./auth", () => ({ useSession: () => session }));

const OFFLINE: ApiResult<unknown> = { ok: false, status: 0, code: "server.offline" };

function ok(data: unknown): ApiResult<unknown> {
  return { ok: true, data };
}

/** Elle cozulen bir cevap: sozun istek BITINCE cozuldugunu olcmek icin. */
function deferred() {
  let resolve!: (value: ApiResult<unknown>) => void;
  const promise = new Promise<ApiResult<unknown>>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.apiGet.mockReset();
});

/**
 * refresh()'i cagirip sozunu bekler. IKI AYRI act SART: act kapsami icindeki
 * durum guncellemeleri kapsam bitene kadar bekletiliyor. Soz ayni kapsamin
 * icinde beklenseydi istegi baslatacak efekt hic calismaz, soz de hic
 * cozulmezdi - test kilitlenir.
 */
async function refreshed(hook: { current: { refresh: () => Promise<void> } }) {
  let done!: Promise<void>;
  act(() => {
    done = hook.current.refresh();
  });
  await act(async () => {
    await done;
  });
}

async function mounted(first: ApiResult<unknown>) {
  mocks.apiGet.mockResolvedValueOnce(first);
  const hook = renderHook(() => useApiGet<{ n: number }>("/api/v1/x"));
  await waitFor(() => expect(hook.result.current.state.kind).not.toBe("loading"));
  return hook;
}

describe("refresh", () => {
  it("BASARISIZ olursa eldeki veri kaliyor ve refreshError doluyor", async () => {
    const { result } = await mounted(ok({ n: 1 }));
    mocks.apiGet.mockResolvedValueOnce(OFFLINE);

    await refreshed(result);

    expect(result.current.state).toEqual({ kind: "ok", data: { n: 1 } });
    // Cumle, kod degil - ekran bunu dogrudan gosteriyor.
    expect(result.current.refreshError).toBe("Bağlantı yok. İnternete bağlanıp tekrar dene.");
  });

  it("sonraki BASARILI tazeleme yeni veriyi koyuyor ve uyariyi kaldiriyor", async () => {
    const { result } = await mounted(ok({ n: 1 }));
    mocks.apiGet.mockResolvedValueOnce(OFFLINE);
    await refreshed(result);

    mocks.apiGet.mockResolvedValueOnce(ok({ n: 2 }));
    await refreshed(result);

    expect(result.current.state).toEqual({ kind: "ok", data: { n: 2 } });
    expect(result.current.refreshError).toBeNull();
  });

  it("VERI YOKKEN basarisiz olursa hata hali - korunacak bir sey yok", async () => {
    const { result } = await mounted(OFFLINE);
    expect(result.current.state.kind).toBe("error");

    mocks.apiGet.mockResolvedValueOnce(OFFLINE);
    await refreshed(result);

    expect(result.current.state.kind).toBe("error");
    // Hata sayfasi sebebi zaten yaziyor; ustune ikinci bir uyari yok.
    expect(result.current.refreshError).toBeNull();
  });

  it("sozu istek BITINCE cozuluyor, once degil", async () => {
    // Asagi cekme gostergesi bu soza bakarak kapaniyor: erken cozulurse
    // gosterge veri gelmeden kapanir.
    const { result } = await mounted(ok({ n: 1 }));
    const pending = deferred();
    mocks.apiGet.mockReturnValueOnce(pending.promise);

    let settled = false;
    let done!: Promise<void>;
    act(() => {
      done = result.current.refresh().then(() => {
        settled = true;
      });
    });
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));
    expect(settled).toBe(false);

    await act(async () => {
      pending.resolve(ok({ n: 2 }));
      await done;
    });
    expect(settled).toBe(true);
    expect(result.current.state).toEqual({ kind: "ok", data: { n: 2 } });
  });

  it("adres null iken sozu asili kalmiyor", async () => {
    const { result } = renderHook(() => useApiGet<{ n: number }>(null));
    await refreshed(result);
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });

  it("ekran kapanirken bekleyen soz cozuluyor", async () => {
    const hook = await mounted(ok({ n: 1 }));
    mocks.apiGet.mockReturnValueOnce(new Promise(() => {}));

    let done!: Promise<void>;
    act(() => {
      done = hook.result.current.refresh();
    });
    hook.unmount();

    await expect(done).resolves.toBeUndefined();
  });
});

describe("reload - davranisi DEGISMEDI", () => {
  it("basarisiz olursa ekran hata haline geciyor", async () => {
    const { result } = await mounted(ok({ n: 1 }));
    mocks.apiGet.mockResolvedValueOnce(OFFLINE);

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    expect(result.current.refreshError).toBeNull();
  });

  it("refresh'ten SONRA cagrilan reload yine hata haline geciyor", async () => {
    // Tur bayragi bir onceki cagrida takili kalirsa reload sessizce
    // refresh gibi davranirdi.
    const { result } = await mounted(ok({ n: 1 }));
    mocks.apiGet.mockResolvedValueOnce(ok({ n: 2 }));
    await refreshed(result);

    mocks.apiGet.mockResolvedValueOnce(OFFLINE);
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.state.kind).toBe("error"));
  });
});
