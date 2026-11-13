import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { emitRefreshSignal } from "../../lib/refresh-signal";
import GroupsScreen from "../../app/groups";

/**
 * BU DOSYA NEYI KORUYOR: mobilde listenin TAZELENME yollarini - gruplar
 * listesi uzerinden, GERCEK useApiGet ile. Yalnizca ag katmani (lib/api'nin
 * apiGet'i) taklit; ekran, kanca ve sinyal gercek.
 *
 * Kullanici bildirdi: zamanlanmis gorevin urettigi harcama web'de aninda
 * gorunuyor, telefondaki listeye ancak dakikalar sonra dusuyordu - uygulama
 * arka plandan one gelince hicbir ekran veriyi yeniden cekmiyordu. Bu dosya:
 *   - sinyal gelince (one gelme / acikken bildirim) liste yeniden cekiliyor
 *   - ODAKTA OLMAYAN ekran sinyali duymuyor
 *   - tazeleme basarisiz olursa liste KALIYOR, ustte uyari cikiyor
 *     (kullanici karari; eskiden ekran hata sayfasina donerdi)
 *   - asagi cekince yeniden cekiliyor ve gosterge veri gelince kapaniyor
 *   - otomatik tazelemede gosterge DONMUYOR (ekran kendiliginden oynamasin)
 *
 * DIKKAT - @testing-library/react-native 14'te render, fireEvent VE act
 * ASENKRON. Beklenmeyen tek bir act, SONRAKI testlerin kapsamini bozuyor:
 * once boyle yazildi ve ilk iki test gecip gerisi "Ev bulunamadi" diye
 * dustu - hatanin yeri ile sebebi ayri testlerdeydi.
 */

const mockApiGet = jest.fn();

/**
 * Odaklanma taklidi: efekt baglaninca calisiyor, temizleme fonksiyonlari
 * biriktiriliyor. blur() hepsini calistiriyor - ekranin ustune baska bir
 * ekran acilmis gibi.
 */
const mockFocus: { cleanups: (() => void)[] } = { cleanups: [] };

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    // Satirlari Link SARIYOR (asChild): cocuklari cizilmezse grup adlari da
    // cizilmez ve test bos bir ekrana bakar.
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => {
        const cleanup = effect();
        if (cleanup) mockFocus.cleanups.push(cleanup);
        return cleanup;
      }, [effect]);
    },
  };
});

jest.mock("../../lib/api", () => ({
  ...jest.requireActual("../../lib/api"),
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

// SABIT nesne: useApiClient her cizimde yeni bir getToken gorurse bu
// dosyanin konusu olmayan bir dongu kurulur (CONVENTIONS.md, "Mobil").
jest.mock("../../lib/auth", () => {
  const session = { status: "signed-in", getToken: async () => "tok", signOut: async () => {} };
  return { useSession: () => session, useOptionalSession: () => session };
});

const EV = { id: "g1", name: "Ev", description: null, role: "OWNER" };
const TATIL = { id: "g2", name: "Tatil", description: null, role: "MEMBER" };
const OFFLINE = { ok: false, status: 0, code: "server.offline" };
const NOTICE = "Güncellenemedi; gördüklerin eski olabilir.";

function groups(...list: (typeof EV)[]) {
  return { ok: true, data: { groups: list } };
}

/** Elle cozulen bir cevap: "cevap gelmeden once" ani olculebilsin diye. */
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function pullControl() {
  return screen.getByTestId("groups-scroll").props.refreshControl.props as {
    refreshing: boolean;
    onRefresh: () => Promise<void>;
  };
}

async function shown() {
  mockApiGet.mockResolvedValueOnce(groups(EV));
  await render(<GroupsScreen />);
  expect(await screen.findByText("Ev")).toBeTruthy();
}

beforeEach(() => {
  mockApiGet.mockReset();
  mockFocus.cleanups = [];
});

describe("one gelince / acikken bildirim gelince", () => {
  it("liste yeniden cekiliyor", async () => {
    await shown();

    mockApiGet.mockResolvedValueOnce(groups(EV, TATIL));
    await act(async () => {
      emitRefreshSignal();
    });

    expect(await screen.findByText("Tatil")).toBeTruthy();
  });

  it("ODAKTA OLMAYAN ekran sinyali duymuyor", async () => {
    // Yiginda altta kalan ekran tazelenseydi, gorunmeyen bir ekran icin
    // istek gitmis olurdu. Kullanici ona donunce odaklanma zaten tazeliyor.
    await shown();
    await act(async () => {
      for (const cleanup of mockFocus.cleanups) cleanup();
    });

    await act(async () => {
      emitRefreshSignal();
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it("otomatik tazelemede asagi cekme gostergesi DONMUYOR", async () => {
    // refreshing true olunca iOS listeyi asagi itip gostergeyi aciyor;
    // kullanicinin dokunmadigi bir anda ekranin oynamasi istenmedi.
    await shown();
    const pending = deferred();
    mockApiGet.mockReturnValueOnce(pending.promise);

    await act(async () => {
      emitRefreshSignal();
    });
    expect(mockApiGet).toHaveBeenCalledTimes(2);
    expect(pullControl().refreshing).toBe(false);

    await act(async () => {
      pending.resolve(groups(EV, TATIL));
    });
    expect(await screen.findByText("Tatil")).toBeTruthy();
  });
});

describe("tazeleme basarisiz olursa", () => {
  it("liste KALIYOR ve ustte uyari cikiyor", async () => {
    await shown();

    mockApiGet.mockResolvedValueOnce(OFFLINE);
    await act(async () => {
      emitRefreshSignal();
    });

    expect(await screen.findByText(NOTICE)).toBeTruthy();
    // Sebebi de yaziyor; kullanici neden guncellenmedigini bilsin.
    expect(screen.getByText("Bağlantı yok. İnternete bağlanıp tekrar dene.")).toBeTruthy();
    expect(screen.getByText("Ev")).toBeTruthy();
  });

  it("uyariya dokununca yeniden deniyor; basarida uyari kalkiyor", async () => {
    await shown();
    mockApiGet.mockResolvedValueOnce(OFFLINE);
    await act(async () => {
      emitRefreshSignal();
    });
    await screen.findByText(NOTICE);

    mockApiGet.mockResolvedValueOnce(groups(EV, TATIL));
    await fireEvent.press(screen.getByText(NOTICE));

    expect(await screen.findByText("Tatil")).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe("asagi cekip yenileme", () => {
  it("yeniden cekiyor; gosterge cevap GELINCE kapaniyor", async () => {
    await shown();
    const pending = deferred();
    mockApiGet.mockReturnValueOnce(pending.promise);

    await act(async () => {
      void pullControl().onRefresh();
    });
    // Cevap gelmeden gosterge donuyor...
    expect(pullControl().refreshing).toBe(true);

    await act(async () => {
      pending.resolve(groups(EV, TATIL));
    });

    // ...cevap gelince yeni veri ekranda ve gosterge kapali.
    expect(await screen.findByText("Tatil")).toBeTruthy();
    await waitFor(() => expect(pullControl().refreshing).toBe(false));
  });

  it("basarisiz olsa da gosterge kapaniyor ve liste kaliyor", async () => {
    // Takili kalan bir gosterge, kullanicinin "hala yukleniyor" sanip
    // bekledigi bir ekran demek.
    await shown();
    mockApiGet.mockResolvedValueOnce(OFFLINE);

    await act(async () => {
      void pullControl().onRefresh();
    });

    expect(await screen.findByText(NOTICE)).toBeTruthy();
    await waitFor(() => expect(pullControl().refreshing).toBe(false));
    expect(screen.getByText("Ev")).toBeTruthy();
  });
});
