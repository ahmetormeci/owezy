import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetOrCreateCurrentUser,
  mockUserUpdate,
  mockEnforceWriteLimit,
  mockAccountFindFirst,
  mockSendIbanChangedEmail,
} = vi.hoisted(() => ({
  mockEnforceWriteLimit: vi.fn(),
  mockGetOrCreateCurrentUser: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockAccountFindFirst: vi.fn(),
  mockSendIbanChangedEmail: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendIbanChangedEmail: mockSendIbanChangedEmail,
}));

vi.mock("@/lib/api-rate-limit", () => ({
  enforceWriteLimit: mockEnforceWriteLimit,
}));

vi.mock("@/lib/auth", () => ({
  findCurrentUser: mockGetOrCreateCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mockUserUpdate },
    account: { findFirst: mockAccountFindFirst },
  },
}));

const { GET, PATCH } = await import("./route");

const USER_ID = "22222222-2222-4222-8222-222222222222";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // Hiz siniri bu testlerin konusu DEGIL: varsayilan "asilmadi".
  // Sinirin kendisi kendi olcumuyle dogrulandi (bkz. lib/api-rate-limit.ts).
  mockEnforceWriteLimit.mockReset();
  mockEnforceWriteLimit.mockResolvedValue(null);
  mockGetOrCreateCurrentUser.mockReset();
  mockUserUpdate.mockReset();
  mockAccountFindFirst.mockReset();
  mockAccountFindFirst.mockResolvedValue(null);
  mockSendIbanChangedEmail.mockReset();
  mockSendIbanChangedEmail.mockResolvedValue(undefined);

  mockGetOrCreateCurrentUser.mockResolvedValue({ id: USER_ID });
  mockUserUpdate.mockImplementation(async ({ data }: { data: { locale: string } }) => ({
    id: USER_ID,
    locale: data.locale,
  }));
});

describe("PATCH /api/v1/me", () => {
  it("giris yapilmamissa 401 doner ve veritabanina yazmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ locale: "en" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "auth.not_signed_in" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("dil tercihini kaydeder", async () => {
    const response = await PATCH(patchRequest({ locale: "en" }));

    expect(response.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { locale: "en" },
    });
  });

  it("yalnizca OTURUMDAKI kullaniciyi gunceller", async () => {
    // Govdeden gelen bir userId'ye ITIBAR EDILMEMELI; kimin guncellendigi
    // yalnizca oturumdan belirlenir.
    await PATCH(patchRequest({ locale: "en", userId: "baskasi" }));

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { locale: "en" },
    });
  });

  it("desteklenmeyen dili reddeder", async () => {
    const response = await PATCH(patchRequest({ locale: "klingon" }));

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("locale alani yoksa reddeder", async () => {
    const response = await PATCH(patchRequest({}));

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("hata METNI degil KOD doner", async () => {
    // API sozlesmesi: metni okuyan taraf uretiyor (ADR-017).
    const response = await PATCH(patchRequest({ locale: "klingon" }));
    const json = await response.json();

    expect(json.ok).toBe(false);
    expect(typeof json.code).toBe("string");
    expect(json.code).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
});

/**
 * IBAN (ADR-059). Ornek IBAN'lar SWIFT kaydindaki orneklerdir.
 */
describe("PATCH /api/v1/me - IBAN", () => {
  const IBAN = "TR330006100519786457841326";
  const OTHER_IBAN = "DE89370400440532013000";

  beforeEach(() => {
    mockGetOrCreateCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "ali@example.com",
      locale: "en",
      iban: null,
    });
    mockUserUpdate.mockImplementation(async ({ data }: { data: object }) => ({
      id: USER_ID,
      ...data,
    }));
  });

  it("bosluklu ve kucuk harfli IBAN'i normalize edip degisiklik aniyla birlikte kaydeder", async () => {
    const response = await PATCH(patchRequest({ iban: "tr33 0006 1005 1978 6457 8413 26" }));

    expect(response.status).toBe(200);
    const { data } = mockUserUpdate.mock.calls[0][0];
    expect(data.iban).toBe(IBAN);
    expect(data.ibanUpdatedAt).toBeInstanceOf(Date);
  });

  it("degisince sahibine MASKELI IBAN'la ve hesap diliyle e-posta gonderir", async () => {
    await PATCH(patchRequest({ iban: IBAN }));

    expect(mockSendIbanChangedEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      maskedIban: "TR•• •••• 1326",
      locale: "en",
    });
  });

  it("AYNI IBAN yeniden kaydedilirse yazmaz ve e-posta gondermez", async () => {
    // Yeniden yazmak "yakinda degisti" notunu yeniden baslatir ve sahibine
    // bosuna "IBAN'in degisti" postasi giderdi.
    mockGetOrCreateCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "ali@example.com",
      locale: "tr",
      iban: IBAN,
    });

    const response = await PATCH(patchRequest({ iban: "TR33 0006 1005 1978 6457 8413 26" }));

    expect(response.status).toBe(200);
    const { data } = mockUserUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty("iban");
    expect(data).not.toHaveProperty("ibanUpdatedAt");
    expect(mockSendIbanChangedEmail).not.toHaveBeenCalled();
  });

  it("baska bir IBAN'a gecince yazar ve bildirir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "ali@example.com",
      locale: "tr",
      iban: IBAN,
    });

    await PATCH(patchRequest({ iban: OTHER_IBAN }));

    expect(mockUserUpdate.mock.calls[0][0].data.iban).toBe(OTHER_IBAN);
    expect(mockSendIbanChangedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ maskedIban: "DE•• •••• 3000" }),
    );
  });

  it("null IBAN'i ve degisiklik anini BIRLIKTE siler ve kaldirildigini bildirir", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "ali@example.com",
      locale: "tr",
      iban: IBAN,
    });

    await PATCH(patchRequest({ iban: null }));

    expect(mockUserUpdate.mock.calls[0][0].data).toEqual({ iban: null, ibanUpdatedAt: null });
    expect(mockSendIbanChangedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ maskedIban: null }),
    );
  });

  it("bos metni kaldirma sayar", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "ali@example.com",
      locale: "tr",
      iban: IBAN,
    });

    await PATCH(patchRequest({ iban: "   " }));

    expect(mockUserUpdate.mock.calls[0][0].data).toEqual({ iban: null, ibanUpdatedAt: null });
  });

  it("kontrol hanesi tutmayan IBAN'i reddeder ve hicbir sey yazmaz", async () => {
    const response = await PATCH(patchRequest({ iban: "TR330006100519786457841327" }));

    expect(response.status).toBe(400);
    // Dogrulama hatalarinin genel sekli (lib/api.ts): kod "validation.invalid",
    // alanin kendi kodu issues icinde.
    const json = await response.json();
    expect(json.code).toBe("validation.invalid");
    expect(json.issues[0].message).toBe("validation.iban_invalid");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSendIbanChangedEmail).not.toHaveBeenCalled();
  });

  it("e-posta gidemese de kayit yapilmis sayilir (200)", async () => {
    mockSendIbanChangedEmail.mockRejectedValue(new Error("Resend kapali"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await PATCH(patchRequest({ iban: IBAN }));

    expect(response.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalled();
    // Hata KAYBOLMUYOR: teslimat bozuldugunda tek isaretimiz bu satir.
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("dil degisikligi IBAN'a dokunmaz", async () => {
    await PATCH(patchRequest({ locale: "tr" }));

    expect(mockUserUpdate.mock.calls[0][0].data).toEqual({ locale: "tr" });
    expect(mockSendIbanChangedEmail).not.toHaveBeenCalled();
  });
});

/**
 * GET'in hasPassword alani ARAYUZ ICIN KRITIK, o yuzden testi var.
 *
 * Guvenlik ekrani buna bakip "2FA'yi ac" dugmesini gosteriyor ya da yerine
 * "once parola belirle" diyor. Yanlis hesaplanirsa iki yonde de kotu:
 * parolasiz kullanici basip INVALID_PASSWORD aliyor ("dugme calismiyor"),
 * ya da parolasi olan kullanici hic acamiyor.
 */
describe("GET /api/v1/me", () => {
  it("giris yapilmamissa 401 doner ve hesap tablosuna hic bakmaz", async () => {
    mockGetOrCreateCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, code: "auth.not_signed_in" });
    expect(mockAccountFindFirst).not.toHaveBeenCalled();
  });

  it("parolali hesapta hasPassword true doner", async () => {
    mockAccountFindFirst.mockResolvedValue({ id: "hesap-1" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, hasPassword: true });
  });

  it("parolasiz hesapta hasPassword false doner", async () => {
    mockAccountFindFirst.mockResolvedValue(null);

    expect(await (await GET()).json()).toMatchObject({ hasPassword: false });
  });

  it("yalnizca OTURUMDAKI kullanicinin parolali hesabini arar", async () => {
    // Uc kosulun ucu de onemli: baskasinin satiri sayilmamali, sosyal
    // saglayici hesabi parola sayilmamali, ve parolasi NULL olan bir
    // credential satiri da parola sayilmamali.
    await GET();

    expect(mockAccountFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, providerId: "credential", password: { not: null } },
      select: { id: true },
    });
  });

  it("hesap satirini DEGIL, yalnizca 'var mi' bilgisini doner", async () => {
    // Yanitin ALANLARI sayiliyor, icerigi degil: boylece ileride biri
    // findFirst'un sonucunu dogrudan yanita eklerse (icinde parola hash'i
    // olabilecek bir nesne) bu test duser.
    mockAccountFindFirst.mockResolvedValue({ id: "hesap-1" });

    const json = await (await GET()).json();

    expect(Object.keys(json).sort()).toEqual(["hasPassword", "ok", "user"]);
    expect(json.hasPassword).toBe(true);
  });
});
