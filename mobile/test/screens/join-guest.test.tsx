import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import JoinScreen from "../../app/join/[token]";

/**
 * BU DOSYA NEYI KORUYOR: davet linkiyle katilmanin IKI YOLUNU (ADR-057).
 *
 *   - Normal davet: linke dokunmak onaydir, ekran ANINDA katiliyor (eski,
 *     bilincli karar - araya bir onay ekrani koymak ayni isi iki kez
 *     yaptirmak olurdu).
 *   - Misafire ozel davet: kisi misafirin BORCUNU da ustleniyor. Sunucu
 *     onaysiz istegi reddediyor; ekran grubu ve misafiri gosterip karari
 *     bekliyor. Onaysiz ikinci bir istek GITMEMELI.
 */

const mockPost = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ token: "tok123" }),
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ status: "signed-in", getToken: async () => "tok", signOut: jest.fn() }),
}));

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({ post: mockPost, get: jest.fn(), put: jest.fn(), patch: jest.fn(), remove: jest.fn() }),
}));

it("NORMAL davet: onay sormadan ANINDA katiliyor", async () => {
  mockPost.mockResolvedValue({ ok: true, data: { membership: { groupId: "g1" } } });

  await render(<JoinScreen />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/groups/g1"));
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith("/api/v1/invites/accept", { token: "tok123" });
});

it("MISAFIR daveti: grubu ve misafiri GOSTERIP bekliyor - kendiliginden katilmiyor", async () => {
  mockPost.mockResolvedValue({
    ok: false,
    status: 409,
    code: "invite.guest_confirm",
    params: { guestId: "u-guest", guestName: "Selin", groupName: "Ev" },
  });

  await render(<JoinScreen />);

  expect(await screen.findByText("Ev grubuna Selin olarak katılıyorsun")).toBeTruthy();
  expect(
    screen.getByText("Selin adına girilen harcamalar, paylar ve ödemeler senin hesabına geçecek."),
  ).toBeTruthy();
  // Onay beklenirken ikinci bir istek GITMEDI.
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

it("MISAFIR daveti: 'Selin olarak katil' ONAYI misafirin kimligiyle gidiyor", async () => {
  mockPost
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: "invite.guest_confirm",
      params: { guestId: "u-guest", guestName: "Selin", groupName: "Ev" },
    })
    .mockResolvedValueOnce({ ok: true, data: { membership: { groupId: "g1" } } });

  await render(<JoinScreen />);
  await fireEvent.press(await screen.findByText("SELİN OLARAK KATIL"));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/groups/g1"));
  expect(mockPost).toHaveBeenLastCalledWith("/api/v1/invites/accept", {
    token: "tok123",
    confirmGuestId: "u-guest",
  });
});

it("MISAFIR daveti: VAZGECMEK hicbir sey gondermiyor", async () => {
  mockPost.mockResolvedValue({
    ok: false,
    status: 409,
    code: "invite.guest_confirm",
    params: { guestId: "u-guest", guestName: "Selin", groupName: "Ev" },
  });

  await render(<JoinScreen />);
  await fireEvent.press(await screen.findByText("Vazgeç"));

  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(mockPost).toHaveBeenCalledTimes(1);
});
