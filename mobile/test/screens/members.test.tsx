import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import MembersScreen from "../../app/groups/[groupId]/members";

/**
 * BU DOSYA NEYI KORUYOR: uyeler ekraninin KIM NEYI GORUR mantigini.
 *
 * Uye cikarma ve davet iptali, iznin sunucuda oldugu iki islem:
 *   - cikarmayi yalnizca SAHIP yapabiliyor ve KENDINI cikaramiyor
 *     (groups.ts: member.remove_owner_only, member.owner_cannot_remove_self)
 *   - daveti yalnizca OLUSTURAN ya da SAHIP iptal edebiliyor
 *     (groups.ts: invite.revoke_forbidden)
 *
 * Ekran bu kurallari AYNALIYOR - reddedilecek bir dugmeyi hic cizmemek icin.
 * Aynalama sessizce bozulabilecek turden: yanlis tarafa dusen bir kosul
 * derlenir, testler gecer ve sonucu ya kullaniciya olmayan bir yetki
 * gostermek ya da olan bir yetkiyi saklamaktir. Ikisi de ekrana bakmadan
 * gorunmez.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON
 * (ayrintisi sign-in.test.tsx'te). Ikisini de await et.
 */

const mockRemove = jest.fn();
const mockPost = jest.fn();
const mockReload = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ groupId: "g1" }),
}));

const OWNER = { userId: "u-owner", displayName: "Sahip Kisi", role: "OWNER" as const };
const MEMBER = { userId: "u-member", displayName: "Uye Kisi", role: "MEMBER" as const };

/** Testin degistirdigi dunya: kim baktI ve ekranda ne var. */
let mockViewerId = OWNER.userId;
let mockMembers = [OWNER, MEMBER];
let mockInvites: unknown[] = [];

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: mockPost,
    put: jest.fn(),
    patch: jest.fn(),
    remove: mockRemove,
  }),
  useApiGet: (path: string | null) => {
    const data =
      path === "/api/v1/me"
        ? { user: { id: mockViewerId } }
        : path?.endsWith("/members")
          ? { members: mockMembers }
          : { invites: mockInvites };
    return { state: { kind: "ok", data }, reload: mockReload };
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockViewerId = OWNER.userId;
  mockMembers = [OWNER, MEMBER];
  mockInvites = [];
  mockRemove.mockResolvedValue({ ok: true, data: {} });
  mockPost.mockResolvedValue({ ok: true, data: {} });
});

/** Onay penceresindeki YIKICI dugmeye basar. */
function pressDestructive() {
  const alert = jest.spyOn(Alert, "alert");
  const buttons = alert.mock.calls[0][2];
  const destructive = buttons?.find((button) => button.style === "destructive");
  destructive?.onPress?.();
}

describe("uye cikarma", () => {
  it("SAHIP baskasinin satirinda cikarma dugmesini gorur", async () => {
    await render(<MembersScreen />);
    expect(screen.getAllByText("Çıkar")).toHaveLength(1);
  });

  it("SAHIP KENDI satirinda cikarma dugmesini GORMEZ", async () => {
    // Sunucu zaten reddediyor (member.owner_cannot_remove_self). Sahip kendi
    // cikisini "Gruptan ayril" ile yapiyor - sahiplik devri orada.
    mockMembers = [OWNER];
    await render(<MembersScreen />);
    expect(screen.queryByText("Çıkar")).toBeNull();
  });

  it("SAHIP OLMAYAN hic cikarma dugmesi gormez", async () => {
    mockViewerId = MEMBER.userId;
    await render(<MembersScreen />);
    expect(screen.queryByText("Çıkar")).toBeNull();
  });

  it("onaylanınca DELETE atiliyor ve liste tazeleniyor", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<MembersScreen />);

    await fireEvent.press(screen.getByText("Çıkar"));
    pressDestructive();

    await waitFor(() =>
      expect(mockRemove).toHaveBeenCalledWith("/api/v1/groups/g1/members/u-member"),
    );
    // Tazeleme SART: yoksa cikarilan kisi listede durmaya devam eder ve
    // kullanici islemin ise yaramadigini sanar.
    await waitFor(() => expect(mockReload).toHaveBeenCalled());
  });

  it("cikarma reddedilirse sunucunun cumlesi TUTARIYLA gosteriliyor", async () => {
    // Bakiyesi olan uye cikarilamiyor ve sunucu tutari params ile yolluyor.
    // Bu deger 1.0.2'de DUSUYORDU; kullanici "{amount}" goruyordu.
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockRemove.mockResolvedValue({
      ok: false,
      status: 409,
      code: "member.has_credit",
      params: { amount: 12500 },
    });

    await render(<MembersScreen />);
    await fireEvent.press(screen.getByText("Çıkar"));
    pressDestructive();

    await waitFor(() => expect(screen.getByText(/12500/)).toBeTruthy());
    expect(screen.queryByText(/\{amount\}/)).toBeNull();
  });
});

describe("davet iptali", () => {
  const INVITE = {
    id: "i1",
    invitedById: MEMBER.userId,
    expiresAt: "2027-01-01T00:00:00.000Z",
    maxUses: 10,
    useCount: 3,
  };

  /**
   * BASLIK BUYUK HARFLE ARANIYOR: <Cap> metni toLocaleUpperCase(locale) ile
   * ceviriyor ve TURKCEDE "i" -> "İ" oluyor. "Aktif davetler" diye aramak
   * hicbir sey bulmuyor ve testi "bolum cizilmemis" gibi gosteriyor - ilk
   * yazimda tam olarak bu oldu.
   */
  const HEADING = "AKTİF DAVETLER";

  it("aktif davet yoksa bolum HIC cizilmiyor", async () => {
    await render(<MembersScreen />);
    expect(screen.queryByText(HEADING)).toBeNull();
  });

  it("daveti OLUSTURAN kisi iptal dugmesini gorur", async () => {
    mockViewerId = MEMBER.userId;
    mockInvites = [INVITE];
    await render(<MembersScreen />);
    expect(screen.getByText(HEADING)).toBeTruthy();
    expect(screen.getByText("İptal et")).toBeTruthy();
  });

  it("SAHIP baskasinin davetini de iptal edebilir", async () => {
    // Bilincli sapma: davet, sahibine ait finansal bir kayit degil, grubun
    // tamamini ilgilendiren bir guvenlik nesnesi (groups.ts).
    mockInvites = [INVITE];
    await render(<MembersScreen />);
    expect(screen.getByText("İptal et")).toBeTruthy();
  });

  it("ne olusturan ne sahip olan uye iptal dugmesi GORMEZ", async () => {
    const third = { userId: "u-third", displayName: "Ucuncu", role: "MEMBER" as const };
    mockMembers = [OWNER, MEMBER, third];
    mockViewerId = third.userId;
    mockInvites = [INVITE];
    await render(<MembersScreen />);
    expect(screen.getByText(HEADING)).toBeTruthy();
    expect(screen.queryByText("İptal et")).toBeNull();
  });

  it("davetin kullanimi ekranda yaziyor, BAGLANTI yazmiyor", async () => {
    mockInvites = [INVITE];
    await render(<MembersScreen />);
    expect(screen.getByText("3/10 kullanıldı")).toBeTruthy();
    // Sunucu token'i hicbir cevapta dondurmuyor; liste "iptal et" listesi.
    expect(screen.queryByText(/join\//)).toBeNull();
  });
});
