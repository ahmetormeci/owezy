import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";
import MembersScreen from "../../app/groups/[groupId]/members";

/**
 * BU DOSYA NEYI KORUYOR: mobilde misafirin (ADR-057) eklenmesini, adinin
 * degistirilmesini ve listede ne oldugunun SOYLENMESINI.
 *
 * Sunucu kurallari (kim ekleyebilir, tavan, giris yapamama) src/lib'de ve
 * E2E'de sinaniyor. Burada sinanan EKRAN: dogru uca dogru govdeyi gonderiyor
 * mu, bos adi sunucuya gondermeden durduruyor mu, liste yenileniyor mu.
 */

const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockReload = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok", signOut: jest.fn() }),
}));

const ME = "u-me";
const GUEST = "u-guest";

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") return { user: { id: ME } };
  if (path?.endsWith("/invites")) return { invites: [] };
  return {
    members: [
      { userId: ME, displayName: "Ben", role: "OWNER", isGuest: false },
      { userId: GUEST, displayName: "Selin", role: "MEMBER", isGuest: true },
    ],
  };
}

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    post: mockPost,
    patch: mockPatch,
    get: jest.fn(),
    put: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: { kind: "ok", data: mockDataFor(path) },
    reload: mockReload,
  }),
}));

beforeEach(() => {
  mockPost.mockResolvedValue({ ok: true, data: { guest: { userId: "u-new" } } });
  mockPatch.mockResolvedValue({ ok: true, data: {} });
});

it("misafir LISTEDE 'misafir' diye yaziyor - rolu degil", async () => {
  await render(<MembersScreen />);

  expect(screen.getByText("Selin")).toBeTruthy();
  expect(screen.getByText("misafir")).toBeTruthy();
});

it("AD YAZILIP eklenince dogru uca gidiyor ve liste yenileniyor", async () => {
  await render(<MembersScreen />);

  await fireEvent.changeText(screen.getByTestId("guest-name"), "  Deniz  ");
  await fireEvent.press(screen.getByText("Misafir ekle"));

  await waitFor(() =>
    // Bosluklar kirpiliyor - web'le AYNI sema.
    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups/g1/guests", { displayName: "Deniz" }),
  );
  expect(mockReload).toHaveBeenCalled();
});

it("BOS AD sunucuya GITMIYOR ve ekranda soyleniyor", async () => {
  await render(<MembersScreen />);

  await fireEvent.press(screen.getByText("Misafir ekle"));

  expect(mockPost).not.toHaveBeenCalled();
  expect(screen.getByText("Misafirin adını yaz")).toBeTruthy();
});

/**
 * MISAFIRIN EYLEMLERI TEK MENUDE (satira uc metin sigmiyordu). Menude
 * davet ve ad HER UYEYE, cikarma yalnizca sahibe - sunucu kurali ayni.
 */
function openGuestMenu() {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  return {
    alert,
    buttons: () =>
      alert.mock.calls[0][2] as { text: string; onPress?: () => void; style?: string }[],
  };
}

it("ADI DEGISTIRILEBILIYOR - kendisi giris yapamiyor, grup duzeltiyor", async () => {
  const prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
  const menu = openGuestMenu();
  await render(<MembersScreen />);

  await fireEvent.press(screen.getByText("Seçenekler"));
  menu.buttons().find((b) => b.text === "Adını değiştir")?.onPress?.();

  // Diyalog mevcut adla aciliyor.
  expect(prompt.mock.calls[0][4]).toBe("Selin");
  const buttons = prompt.mock.calls[0][2] as { onPress?: (value?: string) => void }[];
  buttons[1].onPress?.("Selin K.");

  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/groups/g1/guests/u-guest", {
      displayName: "Selin K.",
    }),
  );
});

it("DAVET: misafire OZEL link uretiliyor, paylasiliyor ve kimin icin oldugu yaziyor", async () => {
  mockPost.mockResolvedValue({ ok: true, data: { invite: { token: "tok123" } } });
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  const menu = openGuestMenu();
  await render(<MembersScreen />);

  await fireEvent.press(screen.getByText("Seçenekler"));
  await act(async () => {
    menu.buttons().find((b) => b.text === "Davet et")?.onPress?.();
  });

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith("/api/v1/groups/g1/guests/u-guest/invite", {}),
  );
  expect(share.mock.calls[0][0].message).toMatch(/\/join\/tok123$/);
  expect(screen.getByText("SELİN İÇİN LİNK HAZIR")).toBeTruthy();
});

it("menude CIKARMA yalnizca SAHIBE gorunuyor", async () => {
  // Bu dosyada ben SAHIBIM (mockDataFor, role: OWNER).
  const menu = openGuestMenu();
  await render(<MembersScreen />);

  await fireEvent.press(screen.getByText("Seçenekler"));

  const texts = menu.buttons().map((b) => b.text);
  expect(texts).toEqual(["Davet et", "Adını değiştir", "Çıkar", "Vazgeç"]);
});
