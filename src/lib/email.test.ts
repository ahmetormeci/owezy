import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GIDEN POSTANIN SEKLI. Junk sorunu (27 Eylul) uzerine: posta tam bir HTML
 * belgesi, kimligini soyleyen bir alt bilgi tasiyor ve yanit adresi gercek
 * bir kutu. Bunlar bir gun sessizce kaybolmasin diye test ediliyor.
 */

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

process.env.RESEND_API_KEY = "test-anahtari";
const { sendIbanChangedEmail, sendOtpEmail } = await import("./email");

type Sent = { from: string; replyTo: string; to: string; subject: string; html: string; text: string };
const sent = (): Sent => mockSend.mock.calls[0][0];

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ data: { id: "e1" }, error: null });
});

describe("sendOtpEmail", () => {
  it("tam bir HTML belgesi gonderir: doctype, dil, karakter seti, body", async () => {
    await sendOtpEmail({ to: "ali@example.com", code: "123456", type: "sign-in", expiresInSeconds: 300 });

    const { html } = sent();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="tr">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<body");
    expect(html).toContain("123456");
  });

  it("yanit adresi gercek bir kutu, gonderen adresi degismedi", async () => {
    await sendOtpEmail({ to: "ali@example.com", code: "123456", type: "sign-in", expiresInSeconds: 300 });

    expect(sent().replyTo).toBe("destek@owezy.net");
    expect(sent().from).toBe("Owezy <noreply@owezy.net>");
  });

  it("alt bilgi kim gonderdi ve neden aldin diyor - HTML'de de duz metinde de", async () => {
    await sendOtpEmail({ to: "ali@example.com", code: "123456", type: "sign-in", expiresInSeconds: 300 });

    for (const part of [sent().html, sent().text]) {
      expect(part).toContain("owezy.net'te bu adresle bir giriş ya da doğrulama istendiği için");
      expect(part).toContain("destek@owezy.net");
    }
  });

  it("dil cerezine gore Ingilizce gonderir - belge dili de", async () => {
    await sendOtpEmail({
      to: "ali@example.com",
      code: "123456",
      type: "sign-in",
      expiresInSeconds: 300,
      headers: new Headers({ cookie: "locale=en" }),
    });

    expect(sent().html).toContain('<html lang="en">');
    expect(sent().text).toContain("You received this because a sign-in");
  });

  it("Resend hata donerse firlatir - teslimat bozuklugu kaybolmasin", async () => {
    mockSend.mockResolvedValue({ data: null, error: { name: "x", message: "kapali" } });

    await expect(
      sendOtpEmail({ to: "ali@example.com", code: "1", type: "sign-in", expiresInSeconds: 60 }),
    ).rejects.toThrow(/Resend gönderemedi/);
  });
});

describe("sendIbanChangedEmail", () => {
  it("maskeli IBAN'i hesap diliyle, hesap degisikligi alt bilgisiyle gonderir", async () => {
    await sendIbanChangedEmail({ to: "ali@example.com", maskedIban: "TR•• •••• 1326", locale: "en" });

    const { html, text, replyTo } = sent();
    expect(html).toContain('<html lang="en">');
    expect(text).toContain("TR•• •••• 1326");
    expect(text).toContain("something changed on your Owezy account");
    expect(replyTo).toBe("destek@owezy.net");
  });

  it("kaldirmada 'kaldirildi' der", async () => {
    await sendIbanChangedEmail({ to: "ali@example.com", maskedIban: null, locale: "tr" });

    expect(sent().text).toContain("IBAN kaldırıldı");
  });

  it("hesap dili yoksa varsayilana duser", async () => {
    await sendIbanChangedEmail({ to: "ali@example.com", maskedIban: null, locale: null });

    expect(sent().html).toContain('<html lang="tr">');
  });
});
