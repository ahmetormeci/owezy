import { render, screen } from "@testing-library/react-native";
import { NotificationBell } from "./notification-bell";

/**
 * BU DOSYA NEYI KORUYOR: rozetin NE ZAMAN gorunecegini.
 *
 * Zil baslik cubugunda ve butun ekranlarda ayni; yanlis bir sayi ya da
 * olmayan bir isi varmis gibi duran bir "0", her ekranda gorunur. Once grup
 * ekraninin altindaki kartta duruyordu ve o kartin testi yoktu - tasinirken
 * kural da yaziliyor.
 *
 * expo-router'in Link'i BURADA COCUKLARI CIZIYOR. Ortak kurulumdaki taklit
 * (test/jest-setup.ts) onu "() => null" yapiyor cunku oradaki testlerin
 * sorusu "hangi adrese gidildi"; burada soru rozetin KENDISI, yani cizilmesi
 * gerekiyor.
 */
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseUnread = jest.fn();
jest.mock("../lib/unread", () => ({
  useUnread: () => mockUseUnread(),
}));

describe("NotificationBell", () => {
  it("okunmamis YOKKEN rozet cizilmiyor", async () => {
    // "0" yazmak, olmayan bir isi varmis gibi gostermek olurdu.
    mockUseUnread.mockReturnValue({ unreadCount: 0, refresh: jest.fn() });

    await render(<NotificationBell />);

    expect(screen.queryByText("0")).toBeNull();
  });

  it("okunmamis sayisini gosteriyor", async () => {
    mockUseUnread.mockReturnValue({ unreadCount: 3, refresh: jest.fn() });

    await render(<NotificationBell />);

    expect(screen.getByText("3")).toBeTruthy();
  });

  it("dokuzdan fazlasini 9+ olarak gosteriyor", async () => {
    // Rozet zilin uzerine biniyor; uc haneli bir sayi onu tasirirdi.
    mockUseUnread.mockReturnValue({ unreadCount: 42, refresh: jest.fn() });

    await render(<NotificationBell />);

    expect(screen.getByText("9+")).toBeTruthy();
    expect(screen.queryByText("42")).toBeNull();
  });

  it("tam DOKUZ hala sayi olarak yaziliyor", async () => {
    // Sinir: "9+" ancak 9'dan SONRA basliyor.
    mockUseUnread.mockReturnValue({ unreadCount: 9, refresh: jest.fn() });

    await render(<NotificationBell />);

    expect(screen.getByText("9")).toBeTruthy();
  });
});
