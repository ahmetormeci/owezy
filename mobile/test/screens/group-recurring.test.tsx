import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { RecurringList } from "../../components/recurring-list";

/**
 * BU DOSYA NEYI KORUYOR: tekrarlayan harcama bolumunun KIM NEYI GORUR
 * mantigini (ADR-051).
 *
 * Sunucu yetkiyi zaten uyguluyor (assertCanModifyRecord: kuran kisi, ya da
 * kuran ayrildiysa OWNER). Ekran bunu AYNALIYOR - reddedilecek bir dugmeyi
 * hic cizmemek icin. Aynalama sessizce bozulabilecek turden: kosulun
 * tersine donmesi derlenir, testler gecer, ve sonucu ya olmayan bir yetkiyi
 * gostermek ya da olani saklamaktir.
 *
 * IKINCI KORUDUGU SEY: DURAKLATILMIS sablonun listede KALMASI. Gizlenseydi
 * sistemin durdurdugu bir kayit kayip gorunurdu ve kullanicinin onu geri
 * acmasinin hicbir yolu kalmazdi.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockRemove = jest.fn();

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    patch: mockPatch,
    remove: mockRemove,
  }),
}));

const ME = "u-me";
const OTHER = "u-other";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    description: "Kira",
    amount: 500000,
    interval: "MONTHLY",
    nextRunOn: "2026-10-01T00:00:00.000Z",
    pausedAt: null,
    createdById: ME,
    ...overrides,
  };
}

function shown(rows: unknown[]) {
  mockGet.mockResolvedValue({ ok: true, data: { recurring: rows } });
}

beforeEach(() => {
  jest.clearAllMocks();
  shown([]);
  mockPatch.mockResolvedValue({ ok: true, data: {} });
  mockRemove.mockResolvedValue({ ok: true, data: {} });
});

function subject(currentUserId: string | null = ME) {
  return <RecurringList groupId="g1" currency="TRY" currentUserId={currentUserId} />;
}

describe("liste", () => {
  it("hic yoksa bunu SOYLUYOR - bos bir baslik birakmiyor", async () => {
    await render(subject());
    await waitFor(() => expect(screen.getByText("Henüz tekrarlayan bir harcama yok.")).toBeTruthy());
  });

  it("satiri, donemi ve SONRAKI tarihi gosteriyor", async () => {
    shown([row()]);
    await render(subject());

    await waitFor(() => expect(screen.getByText("Kira")).toBeTruthy());
    expect(screen.getByText(/Aylık/)).toBeTruthy();
    expect(screen.getByText(/Sonraki/)).toBeTruthy();
  });

  it("DURAKLATILMIS sablon listede KALIYOR ve durumunu yaziyor", async () => {
    // NEGATIF KONTROL: gizlenirse kullanicinin onu geri acma yolu kalmaz.
    shown([row({ pausedAt: "2026-09-10T00:00:00.000Z" })]);
    await render(subject());

    await waitFor(() => expect(screen.getByText("Kira")).toBeTruthy());
    expect(screen.getByText(/Duraklatıldı/)).toBeTruthy();
    // Duraklatilmisin dugmesi "Devam ettir" olmali, "Duraklat" degil.
    expect(screen.getByText("Devam ettir")).toBeTruthy();
    expect(screen.queryByText("Duraklat")).toBeNull();
  });
});

describe("yetki aynalamasi", () => {
  it("KURAN kisi duraklatma ve silme goruyor", async () => {
    shown([row()]);
    await render(subject());

    await waitFor(() => expect(screen.getByText("Duraklat")).toBeTruthy());
    expect(screen.getByText("Sil")).toBeTruthy();
  });

  it("BASKASININ kurdugu sablonda dugme YOK", async () => {
    shown([row({ createdById: OTHER })]);
    await render(subject());

    await waitFor(() => expect(screen.getByText("Kira")).toBeTruthy());
    expect(screen.queryByText("Duraklat")).toBeNull();
    expect(screen.queryByText("Sil")).toBeNull();
  });

  it("ben kimim BILINMIYORKEN dugme cizilmiyor", async () => {
    // /me henuz donmemis olabilir. Yanlis tarafa dusen bir varsayim,
    // reddedilecek bir dugme gostermek olurdu.
    shown([row()]);
    await render(subject(null));

    await waitFor(() => expect(screen.getByText("Kira")).toBeTruthy());
    expect(screen.queryByText("Duraklat")).toBeNull();
  });
});

describe("duraklat / devam", () => {
  it("duraklatma dogru uca ve dogru govdeyle gidiyor", async () => {
    shown([row()]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("Duraklat")).toBeTruthy());

    await fireEvent.press(screen.getByText("Duraklat"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/groups/g1/recurring-expenses/r1", {
      paused: true,
    });
  });

  it("duraklattiktan sonra dugme DEVAM ETTIR oluyor", async () => {
    shown([row()]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("Duraklat")).toBeTruthy());

    await fireEvent.press(screen.getByText("Duraklat"));
    await waitFor(() => expect(screen.getByText("Devam ettir")).toBeTruthy());
  });

  it("duraklatilmis satirda govde paused:false gidiyor", async () => {
    shown([row({ pausedAt: "2026-09-10T00:00:00.000Z" })]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("Devam ettir")).toBeTruthy());

    await fireEvent.press(screen.getByText("Devam ettir"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0][1]).toEqual({ paused: false });
  });

  it("hata satirin altinda yaziliyor, Alert acilmiyor", async () => {
    shown([row()]);
    mockPatch.mockResolvedValue({
      ok: false,
      status: 409,
      code: "recurring.already_paused",
      params: undefined,
    });
    const alert = jest.spyOn(Alert, "alert");

    await render(subject());
    await waitFor(() => expect(screen.getByText("Duraklat")).toBeTruthy());
    await fireEvent.press(screen.getByText("Duraklat"));

    await waitFor(() =>
      expect(screen.getByText("Bu tekrarlayan harcama zaten duraklatılmış")).toBeTruthy(),
    );
    expect(alert).not.toHaveBeenCalled();
  });
});

describe("silme", () => {
  it("ONAY SORUYOR - tek dokunusla silmiyor", async () => {
    shown([row()]);
    const alert = jest.spyOn(Alert, "alert");

    await render(subject());
    await waitFor(() => expect(screen.getByText("Sil")).toBeTruthy());
    await fireEvent.press(screen.getByText("Sil"));

    expect(alert).toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("onaylaninca siliyor ve satir listeden cikiyor", async () => {
    shown([row()]);
    const alert = jest.spyOn(Alert, "alert");

    await render(subject());
    await waitFor(() => expect(screen.getByText("Sil")).toBeTruthy());
    await fireEvent.press(screen.getByText("Sil"));

    const buttons = alert.mock.calls[0][2];
    buttons?.find((button) => button.style === "destructive")?.onPress?.();

    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(1));
    expect(mockRemove).toHaveBeenCalledWith("/api/v1/groups/g1/recurring-expenses/r1");
    await waitFor(() => expect(screen.queryByText("Kira")).toBeNull());
  });

  it("onay metni URETILMISLERIN KALDIGINI soyluyor", async () => {
    // Kullanici neyin gidip neyin kaldigini silmeden ONCE bilmeli.
    shown([row()]);
    const alert = jest.spyOn(Alert, "alert");

    await render(subject());
    await waitFor(() => expect(screen.getByText("Sil")).toBeTruthy());
    await fireEvent.press(screen.getByText("Sil"));

    expect(alert.mock.calls[0][1]).toContain("grupta kalır");
  });
});
