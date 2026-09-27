import "server-only";
import { Resend } from "resend";
import { translate } from "@/lib/messages";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/locale";

/**
 * Giden e-posta: tek seferlik kod ve IBAN degisikligi bildirimi.
 *
 * NEDEN BIZDE: Clerk butun postayi kendisi gonderiyordu. Better Auth
 * headless - kodu uretiyor, gondermeyi bize birakiyor. Bu, gocun en gercek
 * bedeli: artik teslimat BIZIM sorunumuz.
 *
 * "server-only": bu modul yanlislikla bir istemci bileseninden import
 * edilirse DERLEME HATASI veriyor. API anahtari burada; sessizce paketlenip
 * tarayiciya gitmesi kabul edilemez.
 */

const FROM = "Owezy <noreply@owezy.net>";

/**
 * YANIT ADRESI GERCEK BIR KUTU. "noreply"a yazan kisinin yazdigi kaybolmasin;
 * ayrica calisan bir iletisim adresi, posta servislerinin ve okuyanin gozunde
 * bir guven isareti (junk sorunu, 27 Eylul). destek@ Cloudflare Email Routing
 * ile kullanicinin kutusuna yonleniyor.
 */
const REPLY_TO = "destek@owezy.net";

/**
 * Butun postalarin ortak kabugu.
 *
 * NEDEN TAM BIR BELGE: once govde ciplak bir <div>'di - <html>, <body>,
 * karakter seti yoktu. Bazi filtreler bunu (HTML_MIME_NO_HTML_TAG) eksi puan
 * sayiyor; posta zaten "yalnizca bir kod" iceren kisa bir metin ve oltalama
 * postalarina benzemesi kolay.
 *
 * ALT BILGI KIMLIGI SOYLUYOR: kim gonderdi, neden aldin, nereye yazarsin.
 * Oltalama postasi bunlari soylemez; soylemek hem okuyanin hem filtrenin
 * guvenini artiriyor.
 *
 * Gorsel dil ADR-021: kisitlama. Logo yok, gorsel yok, dis font yok - hepsi
 * ayri birer teslimat riski.
 */
function emailDocument({
  locale,
  subject,
  content,
  reason,
}: {
  locale: Locale;
  subject: string;
  /** Kabugun icine giren, zaten KACISLANMIS HTML. */
  content: string;
  /** Alt bilgideki "bu postayi neden aldin" cumlesi. */
  reason: string;
}): string {
  const contact = translate("email.footer_contact", undefined, locale);
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
${content}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#888">${escapeHtml(reason)}<br>${escapeHtml(contact)}</p>
</div>
</body>
</html>`;
}

/** Duz metin surumunun alt bilgisi - HTML'dekiyle ayni iki cumle. */
function textFooter(reason: string, locale: Locale): string {
  return `\n\n--\n${reason}\n${translate("email.footer_contact", undefined, locale)}`;
}

// Modul yuklenirken degil, ILK KULLANIMDA olusturuluyor. Sebep: bu dosyayi
// import eden her sey (ornegin bir test) anahtar yokken de yuklenebilmeli;
// modul seviyesinde new Resend(undefined) atmak, ilgisiz yerleri dusururdu.
let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY tanımlı değil; e-posta gönderilemiyor.");
    }
    client = new Resend(key);
  }
  return client;
}

/**
 * Istegin dili. Yalnizca CEREZE bakiyor.
 *
 * getLocale() burada KULLANILAMAZ: o next/headers'in cookies()'ini cagiriyor
 * ve hesap tercihine dusmek icin findCurrentUser()'i kullaniyor - ikisi de
 * bir Next istek baglaminda olmayi varsayiyor. Buraya ise Better Auth kendi
 * ucundan geliyor ve elimizde yalnizca ham basliklar var.
 *
 * HESAP TERCIHI BILEREK OKUNMUYOR: kod, kimligi HENUZ kanitlanmamis birine
 * gonderiliyor. "Bu adresin hesap dili nedir" diye sormak, adresin kayitli
 * olup olmadigini gonderim davranisindan sizdirmanin bir yolu olurdu.
 *
 * Mobil istemci cerez gondermiyor; oradan gelen istekler varsayilana
 * dusuyor. Cihaz dilini basliga koymak 25.5'in isi.
 */
function localeFromHeaders(headers: Headers | undefined): Locale {
  const cookie = headers?.get("cookie");
  if (!cookie) {
    return DEFAULT_LOCALE;
  }
  // Cerez basligi "a=1; b=2" seklinde. Kendi ayristiricimiz kucuk ama
  // tam da bu yuzden guvenli: degeri normalizeLocale beyaz listeden
  // geciriyor, yani basliga ne yazilirsa yazilsin gecerli bir dil cikiyor.
  const match = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  return normalizeLocale(match?.slice(LOCALE_COOKIE.length + 1));
}

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const SUBJECT_KEY: Record<OtpType, string> = {
  "sign-in": "email.otp_subject_sign_in",
  "email-verification": "email.otp_subject_email_verification",
  "forget-password": "email.otp_subject_forget_password",
  "change-email": "email.otp_subject_change_email",
};

/**
 * Tek seferlik kodu gonderir.
 *
 * DUZ METIN SURUMU DE VAR ve bu bir suslemesi degil: yalnizca HTML tasiyan
 * postalar spam puani aliyor. Giris kodunun spam'e dusmesi, kullanicinin
 * uygulamaya hic girememesi demek.
 */
export async function sendOtpEmail({
  to,
  code,
  type,
  expiresInSeconds,
  headers,
}: {
  to: string;
  code: string;
  type: OtpType;
  expiresInSeconds: number;
  headers?: Headers;
}): Promise<void> {
  const locale = localeFromHeaders(headers);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(key, params, locale);

  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
  const subject = t(SUBJECT_KEY[type]);
  const heading = t("email.otp_heading");
  const body = t("email.otp_body", { minutes });
  const ignore = t("email.otp_ignore");

  const reason = t("email.footer_reason_otp");

  const { error } = await resend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject,
    // Kodun kendisi tek vurgulu oge; kabuk ve alt bilgi emailDocument'ta.
    html: emailDocument({
      locale,
      subject,
      reason,
      content: `<p style="margin:0 0 24px;font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">${escapeHtml(heading)}</p>
<p style="margin:0 0 24px;font-size:34px;font-weight:600;letter-spacing:6px">${escapeHtml(code)}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#666">${escapeHtml(ignore)}</p>`,
    }),
    text: `${heading}\n\n${code}\n\n${body}\n\n${ignore}${textFooter(reason, locale)}`,
  });

  if (error) {
    // FIRLATIYORUZ. Cagiran taraf (better-auth.ts) bunu yakalayip loga
    // birakiyor ve kullaniciya "kod gonderildi" demeye devam ediyor -
    // adresin kayitli olup olmadigini sizdirmamak icin. Ama hatanin
    // KENDISI kaybolmamali; teslimat bozuldugunda tek isaretimiz bu.
    throw new Error(`Resend gönderemedi: ${error.name} - ${error.message}`);
  }
}

/**
 * IBAN DEGISTI BILDIRIMI (ADR-059).
 *
 * NEDEN VAR: hesabi ele gecirilen birinin IBAN'i degistirilirse, grup
 * arkadaslarinin ona gonderdigi para BASKASINA gider. Sahibinin bunu
 * ogrenmesinin en hizli yolu bu e-posta. Bankalarin "hesap bilgin
 * degisti" postasiyla ayni mantik.
 *
 * IBAN'IN TAMAMI YAZILMIYOR (maskIban): posta, hesabi ele gecirilmis
 * birinin gelen kutusuna da dusebilir; sahibi kendi IBAN'ini son
 * hanelerinden tanir.
 *
 * DIL HESAP TERCIHINDEN: OTP'nin aksine burada kimlik KANITLANMIS - istek
 * oturum acmis kullanicidan geldi. Tercih yoksa varsayilan.
 */
export async function sendIbanChangedEmail({
  to,
  maskedIban,
  locale: preferred,
}: {
  to: string;
  /** Yeni IBAN'in maskelenmis hali; null = IBAN kaldirildi. */
  maskedIban: string | null;
  locale: string | null;
}): Promise<void> {
  const locale = normalizeLocale(preferred);
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(key, params, locale);

  const subject = t("email.iban_changed_subject");
  const heading = t("email.iban_changed_heading");
  const body =
    maskedIban === null
      ? t("email.iban_removed_body")
      : t("email.iban_set_body", { iban: maskedIban });
  const notYou = t("email.iban_not_you");

  const reason = t("email.footer_reason_account");

  const { error } = await resend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject,
    html: emailDocument({
      locale,
      subject,
      reason,
      content: `<p style="margin:0 0 24px;font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">${escapeHtml(heading)}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#666">${escapeHtml(notYou)}</p>`,
    }),
    text: `${heading}\n\n${body}\n\n${notYou}${textFooter(reason, locale)}`,
  });

  if (error) {
    // Cagiran (PATCH /me) yakaliyor: bildirim gidemedi diye IBAN kaydi
    // geri alinmiyor - kayit zaten yapildi ve kullanicinin istedigi o.
    throw new Error(`Resend gönderemedi: ${error.name} - ${error.message}`);
  }
}

// Metinler sozlukten geliyor, yani bizim yazdigimiz sabitler - ama kod
// Better Auth'tan gelen bir deger ve HTML'e giriyor. Kacisi tek yerde
// yapmak, bir gun sozluge tirnak ya da "&" girdiginde de dogru kalmasini
// sagliyor.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
