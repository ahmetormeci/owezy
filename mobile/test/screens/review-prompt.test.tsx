import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import AccountScreen from "../../app/account";
import NewExpenseScreen from "../../app/groups/[groupId]/expenses/new";
import SettlementsScreen from "../../app/groups/[groupId]/settlements";
import { ExpenseComposer } from "../../components/expense-composer";
import { ThemeProvider } from "../../lib/theme";
import { WRITE_REVIEW_URL } from "../../lib/review-prompt";

/**
 * BU DOSYA NEYI KORUYOR: degerlendirme isteginin DOGRU ANDA tetiklenmesini
 * (ADR-056) - yani is BITTIKTEN sonra, ortasinda ya da basarisizlikta degil.
 *
 * Kuralin kendisi (5 kayit, 7 gun, 120 gun) lib/review-prompt.test.ts'te.
 * Burada sinanan sey BAGLANTI: dort kayit yolunun her biri basarida BIR KEZ
 * haber veriyor mu, basarisizlikta susuyor mu. Bu baglanti koparsa hicbir
 * sey hata vermez - yalnizca kimseye hic sorulmaz.
 */

const mockNote = jest.fn(async () => false);
const mockPost = jest.fn();
const mockUpload = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { groupId: "g1" };

jest.mock("../../lib/review-prompt", () => ({
  ...jest.requireActual("../../lib/review-prompt"),
  noteSaveAndMaybeAskForReview: () => mockNote(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

jest.mock("../../lib/auth", () => ({
  useOptionalSession: () => null,
  useSession: () => ({ getToken: async () => "tok", signOut: jest.fn() }),
}));

jest.mock("../../lib/push", () => ({ disablePush: jest.fn(async () => {}) }));

jest.mock("../../lib/receipt-file", () => ({
  pickReceipt: jest.fn(async () => ({ kind: "picked", uri: "file:///fis.jpg" })),
  uploadReceipt: (...args: unknown[]) => mockUpload(...args),
  receiptEndpoint: (b: string, g: string, e: string) =>
    `${b}/api/v1/groups/${g}/expenses/${e}/receipt`,
}));

function mockDataFor(path: string | null): unknown {
  if (path === "/api/v1/me") {
    return { user: { id: "u1", displayName: "Ben", email: "ben@example.com" } };
  }
  if (path?.endsWith("/members")) {
    return {
      members: [
        { userId: "u1", displayName: "Ben" },
        { userId: "u2", displayName: "Selin" },
      ],
    };
  }
  if (path?.endsWith("/balances")) return { currency: "TRY" };
  if (path?.endsWith("/settlements")) return { settlements: [], nextCursor: null };
  return { group: { id: "g1", name: "Ev", currency: "TRY" } };
}

jest.mock("../../lib/use-api", () => ({
  useApiClient: () => ({
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    remove: jest.fn(),
  }),
  useApiGet: (path: string | null) => ({
    state: { kind: "ok", data: mockDataFor(path) },
    reload: jest.fn(),
  }),
}));

beforeEach(() => {
  mockParams = { groupId: "g1" };
  mockPost.mockResolvedValue({ ok: true, data: { expense: { id: "e1" } } });
  mockUpload.mockResolvedValue({ ok: true });
});

describe("yeni harcama ekrani", () => {
  async function fillAndSave() {
    await render(<NewExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("description"), "Market");
    await fireEvent.changeText(screen.getByTestId("amount"), "120,50");
    await fireEvent.press(screen.getByTestId("save"));
  }

  it("KAYIT BASARILIYSA ekran kapandiktan sonra BIR KEZ haber veriyor", async () => {
    await fillAndSave();

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockNote).toHaveBeenCalledTimes(1);
  });

  it("HARCAMA KAYDEDILDI AMA FIS YUKLENEMEDIYSE haber VERMIYOR - kullanici hatayi okuyor", async () => {
    mockUpload.mockResolvedValue({ ok: false, status: 0, code: "server.offline" });

    await render(<NewExpenseScreen />);
    await fireEvent.changeText(screen.getByTestId("description"), "Market");
    await fireEvent.changeText(screen.getByTestId("amount"), "120,50");
    // Fis ekle -> galeriden sec. Secimin OTURMASI bekleniyor; beklenmezse
    // kayit fissiz gider ve test yanlis seyi dogrular.
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await fireEvent.press(screen.getByText("Fiş ekle"));
    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });
    await fireEvent.press(screen.getByTestId("save"));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNote).not.toHaveBeenCalled();
  });

  it("KAYIT REDDEDILIRSE haber VERMIYOR", async () => {
    mockPost.mockResolvedValue({ ok: false, status: 400, code: "server.offline" });

    await fillAndSave();

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNote).not.toHaveBeenCalled();
  });
});

describe("odeme ekrani", () => {
  it("ODEME KAYDEDILINCE haber veriyor", async () => {
    // Fisteki bir oneriden gelinmis gibi: karsi taraf ve tutar dolu.
    mockParams = { groupId: "g1", to: "u2", amount: "5000" };
    mockPost.mockResolvedValue({ ok: true, data: {} });

    await render(<SettlementsScreen />);
    await fireEvent.press(screen.getByText("Kaydet"));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockNote).toHaveBeenCalledTimes(1);
  });
});

describe("hizli ekleme satiri", () => {
  it("SATIR EKLENINCE haber veriyor", async () => {
    const onAdded = jest.fn();
    await render(
      <ExpenseComposer groupId="g1" memberIds={["u1", "u2"]} currentUserId="u1" onAdded={onAdded} />,
    );

    await fireEvent.changeText(screen.getByPlaceholderText("Ne aldın?"), "Simit");
    await fireEvent.changeText(screen.getByPlaceholderText("0,00"), "30");
    await fireEvent.press(screen.getByText("EKLE"));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(mockNote).toHaveBeenCalledTimes(1);
  });
});

describe("hesap ekrani", () => {
  it("'Uygulamayı değerlendir' App Store'un YORUM SAYFASINI aciyor", async () => {
    await render(
      <ThemeProvider>
        <AccountScreen />
      </ThemeProvider>,
    );

    await fireEvent.press(await screen.findByText("Uygulamayı değerlendir"));

    expect(Linking.openURL).toHaveBeenCalledWith(WRITE_REVIEW_URL);
    // Kullanicinin kendi istedigi yol: otomatik sorunun sayacina DOKUNMUYOR.
    expect(mockNote).not.toHaveBeenCalled();
  });
});
