import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";

/**
 * BU DOSYA NEYI KORUYOR: kalem kalem bolusumun (ADR-052) IKI sessiz
 * kusurunu.
 *
 *   1. KATILIMCI LISTESININ GONDERILMESI. Sunucu katilimcilari kalem
 *      atamalarindan TURETIYOR; istemci ayrica bir liste gonderirse ikisi
 *      celisebilir. Govdede boyle bir alan OLMAMALI.
 *   2. TEKRARLAMA ANAHTARININ CIZILMESI. Kalem kalem bir SABLON yok -
 *      anahtar cizilirse kullanici isaretler, kaydeder ve sunucudan
 *      dogrulama hatasi alir. Olmayan bir yetenegi vaat etmis oluruz.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockPost = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  // MemberAvatar bunu cagiriyor (ADR-054). null = belirtec yok -> bas harf.
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok" }),
}));

const ME = { user: { id: "u1" } };
const MEMBERS = {
  members: [
    { userId: "u1", displayName: "Ben" },
    { userId: "u2", displayName: "Veli" },
  ],
};
const GROUP = { group: { id: "g1", name: "Ev", currency: "TRY" } };

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: {
      kind: "ok",
      data: path === "/api/v1/me" ? ME : path?.endsWith("/members") ? MEMBERS : GROUP,
    },
    reload: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ ok: true, data: { expense: { id: "e-yeni" } } });
});

/** Kalem kalem moduna gecer ve tek bir kalem doldurur. */
async function fillOneItem() {
  await render(<NewExpenseScreen />);
  await fireEvent.changeText(screen.getByTestId("description"), "Akşam yemeği");
  await fireEvent.changeText(screen.getByTestId("amount"), "300");
  await fireEvent.press(screen.getByText("kalem kalem"));

  await fireEvent.changeText(screen.getByTestId("item-name-0"), "Pizza");
  await fireEvent.changeText(screen.getByTestId("item-amount-0"), "200");
  await fireEvent.press(screen.getByText("Veli"));
}

describe("kalem editoru", () => {
  it("segment secilince kalem alanlari beliriyor", async () => {
    await render(<NewExpenseScreen />);
    expect(screen.queryByTestId("item-name-0")).toBeNull();

    await fireEvent.press(screen.getByText("kalem kalem"));
    expect(screen.getByTestId("item-name-0")).toBeTruthy();
  });

  it("TEKRARLAMA ANAHTARI kalem kalem modunda CIZILMIYOR", async () => {
    // NEGATIF KONTROL: cizilirse kullanici olmayan bir yetenegi denemis olur.
    await render(<NewExpenseScreen />);
    expect(screen.getByText("Bunu tekrarla")).toBeTruthy();

    await fireEvent.press(screen.getByText("kalem kalem"));
    expect(screen.queryByText("Bunu tekrarla")).toBeNull();
  });

  it("kalem toplami ve BAHSIS farki gosteriliyor", async () => {
    // Kullanici bahsisi kaydetmeden ONCE gormeli.
    await fillOneItem();

    expect(screen.getByText("Kalem toplamı")).toBeTruthy();
    expect(screen.getByText("Bahşiş / servis")).toBeTruthy();
  });
});

describe("gonderim", () => {
  it("govde KALEMLERI tasiyor ve KATILIMCI LISTESI TASIMIYOR", async () => {
    await fillOneItem();
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const body = mockPost.mock.calls[0][1];

    expect(body.splitType).toBe("ITEMIZED");
    expect(body.items).toEqual([
      { description: "Pizza", amount: 20000, userIds: ["u2"] },
    ]);
    // NEGATIF KONTROL: bu iki alandan biri govdeye girerse sunucudaki
    // turetme ile celisebilir.
    expect(body.participantUserIds).toBeUndefined();
    expect(body.shares).toBeUndefined();
  });

  it("kalemsiz kisi varsa GONDERMIYOR ve sebebini yaziyor", async () => {
    await render(<NewExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("description"), "Akşam yemeği");
    await fireEvent.changeText(screen.getByTestId("amount"), "300");
    await fireEvent.press(screen.getByText("kalem kalem"));
    await fireEvent.changeText(screen.getByTestId("item-name-0"), "Pizza");
    await fireEvent.changeText(screen.getByTestId("item-amount-0"), "300");
    // Kimse isaretlenmedi.

    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() =>
      expect(screen.getByText("her kalemi en az bir kişi paylaşmalı")).toBeTruthy(),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("adsiz kalem GONDERILMIYOR", async () => {
    await render(<NewExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("description"), "Akşam yemeği");
    await fireEvent.changeText(screen.getByTestId("amount"), "300");
    await fireEvent.press(screen.getByText("kalem kalem"));
    await fireEvent.changeText(screen.getByTestId("item-amount-0"), "300");
    await fireEvent.press(screen.getByText("Veli"));

    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(screen.getByText("Her kaleme bir ad ver")).toBeTruthy());
    expect(mockPost).not.toHaveBeenCalled();
  });
});
