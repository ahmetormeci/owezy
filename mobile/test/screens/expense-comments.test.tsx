import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { ExpenseComments } from "../../components/expense-comments";

/**
 * BU DOSYA NEYI KORUYOR: yorum bolumunun KIM NEYI GORUR mantigini.
 *
 * Sunucu iki kurali zaten uyguluyor (lib/comments.ts): silmeyi yalnizca
 * YAZAN yapabilir, silinmis harcamaya yorum yazilamaz. Ekran bu kurallari
 * AYNALIYOR - reddedilecek bir dugmeyi hic cizmemek icin.
 *
 * Aynalama sessizce bozulabilecek turden: yanlis tarafa dusen bir kosul
 * derlenir, testler gecer, ve sonucu ya olmayan bir yetkiyi gostermek ya da
 * olani saklamaktir. Ikisi de ekrana bakmadan gorunmez - ve bu ekran
 * telefonda, yani bakmak bir build gerektiriyor.
 *
 * DIKKAT - @testing-library/react-native 14'te render VE fireEvent ASENKRON.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockRemove = jest.fn();

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: jest.fn(),
    patch: jest.fn(),
    remove: mockRemove,
  }),
}));

const ME = "u-me";
const OTHER = "u-other";

function comment(id: string, userId: string, body: string) {
  return {
    id,
    body,
    createdAt: new Date().toISOString(),
    author: { userId, displayName: userId === ME ? "Ben" : "Baskasi", avatarUrl: null, hasImage: false },
  };
}

function shown(comments: unknown[], truncated = false) {
  mockGet.mockResolvedValue({ ok: true, data: { comments, truncated } });
}

beforeEach(() => {
  jest.clearAllMocks();
  shown([]);
  mockPost.mockResolvedValue({ ok: true, data: { comment: comment("c9", ME, "yeni") } });
  mockRemove.mockResolvedValue({ ok: true, data: {} });
});

function subject(isDeleted = false, currentUserId: string | null = ME) {
  return (
    <ExpenseComments
      groupId="g1"
      expenseId="e1"
      currentUserId={currentUserId}
      isDeleted={isDeleted}
    />
  );
}

const BASE = "/api/v1/groups/g1/expenses/e1/comments";

describe("okuma", () => {
  it("yorum yoksa bunu SOYLUYOR", async () => {
    await render(subject());
    await waitFor(() => expect(screen.getByText("Henüz yorum yok.")).toBeTruthy());
  });

  it("yorumlar ciziliyor", async () => {
    shown([comment("c1", OTHER, "bahşiş dahil değil")]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("bahşiş dahil değil")).toBeTruthy());
  });

  it("sinira dayanildiysa SOYLUYOR", async () => {
    shown([comment("c1", ME, "bir")], true);
    await render(subject());
    await waitFor(() =>
      expect(screen.getByText("Yalnızca ilk 100 yorum gösteriliyor.")).toBeTruthy(),
    );
  });

  it("okuma hatasi ekranda gorunuyor", async () => {
    mockGet.mockResolvedValue({ ok: false, status: 403, code: "group.not_member" });
    await render(subject());
    await waitFor(() => expect(screen.getByText("Bu grubun üyesi değilsiniz")).toBeTruthy());
  });
});

describe("silme yetkisi", () => {
  it("KENDI yorumunda silme gorunuyor", async () => {
    shown([comment("c1", ME, "benim")]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("Sil")).toBeTruthy());
  });

  it("BASKASININ yorumunda silme GORUNMUYOR", async () => {
    shown([comment("c1", OTHER, "onun")]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("onun")).toBeTruthy());
    expect(screen.queryByText("Sil")).toBeNull();
  });

  it("onaylanınca DELETE atiliyor ve satir listeden kalkiyor", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    shown([comment("c1", ME, "benim")]);
    await render(subject());
    await waitFor(() => expect(screen.getByText("Sil")).toBeTruthy());

    await fireEvent.press(screen.getByText("Sil"));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons?.find((button: { style?: string }) => button.style === "destructive")?.onPress?.();

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(`${BASE}/c1`));
    // Listeden DUSMESI sart: kalirsa kullanici silmenin ise yaramadigini sanar.
    await waitFor(() => expect(screen.queryByText("benim")).toBeNull());
  });
});

describe("yazma", () => {
  it("bos alanla gonderilmiyor", async () => {
    await render(subject());
    await waitFor(() => expect(screen.getByText("Gönder")).toBeTruthy());

    await fireEvent.press(screen.getByText("Gönder"));

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("yazilan yorum gonderiliyor ve listeye ekleniyor", async () => {
    await render(subject());
    await waitFor(() => expect(screen.getByText("Gönder")).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText("Bu harcama hakkında bir not…"),
      "  yeni  ",
    );
    await fireEvent.press(screen.getByText("Gönder"));

    // KIRPILARAK gidiyor: bastaki/sondaki bosluk yorumun parcasi degil.
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(BASE, { body: "yeni" }));
    await waitFor(() => expect(screen.getByText("yeni")).toBeTruthy());
  });

  it("SILINMIS harcamada yazma alani HIC cizilmiyor", async () => {
    await render(subject(true));
    await waitFor(() =>
      expect(screen.getByText("Silinmiş bir harcama; yeni yorum yazılamaz.")).toBeTruthy(),
    );
    expect(screen.queryByText("Gönder")).toBeNull();
  });

  it("gonderim hatasi kullaniciya soyleniyor", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockPost.mockResolvedValue({ ok: false, status: 400, code: "comment.expense_deleted" });
    await render(subject());
    await waitFor(() => expect(screen.getByText("Gönder")).toBeTruthy());

    await fireEvent.changeText(screen.getByPlaceholderText("Bu harcama hakkında bir not…"), "x");
    await fireEvent.press(screen.getByText("Gönder"));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Silinmiş bir harcamaya yorum yazılamaz"),
    );
  });
});
