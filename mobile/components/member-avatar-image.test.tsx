import { render, screen } from "@testing-library/react-native";
import { MemberAvatar } from "./receipt";

/**
 * BU DOSYA NEYI KORUYOR: fotografin CIZILDIGI dali ve o dalin SINIRINI
 * (ADR-054).
 *
 * AYRI BIR DOSYA, cunku burada BELIRTEC VAR. member-avatar.test.tsx bilerek
 * hicbir seyi taklit etmiyor - onun konusu "saglayici yokken patlamamak".
 * Belirtec olmadan dis-adres kontrolunu sinamak MUMKUN DEGIL: token null
 * oldugu surece gorsel dali zaten hic calismiyor ve test yanlis sebepten
 * gecerdi. Tam boyle bir test yazildi ve bu yuzden buraya tasindi.
 */
jest.mock("../lib/auth", () => ({
  useOptionalSession: () => ({ getToken: async () => "tok" }),
}));

jest.mock("../lib/api", () => ({
  apiBaseUrl: () => "https://owezy.test",
}));

describe("MemberAvatar - belirtec varken", () => {
  it("KENDI ADRESIMIZ ciziliyor ve Authorization basligi tasiyor", async () => {
    await render(
      <MemberAvatar name="Selin" avatarUrl="/api/v1/users/u2/avatar?v=abc" hasImage />,
    );

    // Bas harf YOK: fotograf cizildi.
    expect(screen.queryByText("SE")).toBeNull();

    const source = screen.getByTestId("avatar-image").props.source as {
      uri: string;
      headers: Record<string, string>;
    };
    expect(source.uri).toBe("https://owezy.test/api/v1/users/u2/avatar?v=abc");
    // Basliksiz istek 401 doner ve gorsel hic cizilmez.
    expect(source.headers.Authorization).toBe("Bearer tok");
  });

  it("DIS ADRES CIZILMIYOR - belirtec yabanci sunucuya gitmemeli", async () => {
    /**
     * "//ornek.com/a.png" DE "/" ile basliyor ama ayni koken DEGIL -
     * protokol-goreli bir adres. Clerk devrinde avatarUrl tam boyle uzak
     * bir adres tasiyordu; simdi baslikta oturum belirtecimiz var, yani
     * yanlis adrese gitmenin bedeli sizdirilmis bir belirtec olurdu.
     */
    await render(<MemberAvatar name="Selin" avatarUrl="//ornek.com/a.png" hasImage />);

    expect(screen.getByText("SE")).toBeTruthy();
  });

  it("hasImage false ise fotograf CIZILMIYOR", async () => {
    // hasImage'in avatarUrl'den ayri durmasinin sebebi (prisma/schema.prisma):
    // adresi olup fotografi olmayan kayitlar vardi.
    await render(
      <MemberAvatar name="Selin" avatarUrl="/api/v1/users/u2/avatar?v=abc" hasImage={false} />,
    );

    expect(screen.getByText("SE")).toBeTruthy();
  });
});
