import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";
import { bridgedCookieHeader } from "@/lib/two-factor-cookie-bridge";

/**
 * Better Auth'un kendi uclari: /api/auth/*
 *
 * NEDEN /api/v1 ALTINDA DEGIL: /api/v1 BIZIM sozlesmemiz - ADR-017'ye gore
 * hata METNI degil hata KODU donduruyor, ve yollarini biz belirliyoruz.
 * Buradaki uclarin sekli ise Better Auth'a ait; istemci kutuphanesi
 * (authClient) tam olarak bu yollari cagiriyor. Ikisini ayni ad alanina
 * koymak, bizim olmayan bir sozlesmeyi bizimmis gibi gostermek olurdu.
 *
 * Butun yollar - giris, cikis, kod gonderme, dogrulama - tek bir catch-all
 * segmentten geciyor ve isi auth ornegi yapiyor. TEK ISTISNA asagidaki
 * kopru; gerekcesi two-factor-cookie-bridge.ts'de.
 */
const handler = toNextJsHandler(auth);

export const GET = handler.GET;

/**
 * KOPRU YALNIZCA BU IKI YOLDA. GECICI - 1.0.1 yayilinca bu dosya eski haline
 * doner.
 *
 * Dar tutulmasinin sebebi two-factor-cookie-bridge.ts'de yazili: onekli ad
 * tarayicilar icin bir garanti tasiyor ve onu oneksiz bir cerezden turetmek
 * o garantiyi bu uclarda gevsetiyor. Butun /api/auth'a uygulamak, hicbir
 * karsiligi olmayan bir yuzey acmak olurdu - kirik olan yalnizca ikinci
 * adim.
 */
const BRIDGED_PATHS = new Set([
  "/api/auth/two-factor/verify-totp",
  "/api/auth/two-factor/verify-backup-code",
]);

/** Eklentinin sabiti - plugins/two-factor/constant.mjs:2 */
const TWO_FACTOR_COOKIE = "two_factor";

export async function POST(request: Request) {
  if (!BRIDGED_PATHS.has(new URL(request.url).pathname)) {
    return handler.POST(request);
  }

  /**
   * ADI KUTUPHANEYE SORUYORUZ, sabit yazmiyoruz.
   *
   * "__Secure-" onegi ortama gore ekleniyor ve kurali Better Auth'un kendi
   * icinde: cookies/index.mjs:23. Burada tekrar tahmin etmek, duzeltmeye
   * calistigimiz hatanin aynisini ikinci kez yapmak olurdu. $context,
   * createAuthCookie'yi disari aciyor (auth/base.mjs) ve sunucunun GERCEKTEN
   * aradigi adi veriyor.
   */
  const context = await auth.$context;
  const expectedName = context.createAuthCookie(TWO_FACTOR_COOKIE).name;

  const bridged = bridgedCookieHeader(request.headers.get("cookie"), expectedName);
  if (!bridged) {
    return handler.POST(request);
  }

  const headers = new Headers(request.headers);
  headers.set("cookie", bridged);

  /**
   * ISTEK PARCALARINDAN KURULUYOR, NESNEDEN KLONLANMIYOR.
   *
   * "new Request(request, { headers })" URETIMDE PATLADI:
   *     TypeError: Cannot read private member #state from an object whose
   *     class did not declare it
   * Next rotaya kendi NextRequest'ini veriyor ve undici'nin Request
   * yapicisi girdiyi gercek bir Request sanip ozel alanini okumaya
   * calisiyor. Duz Node'da ayni satir SORUNSUZ calisiyor - once oyle
   * olculdu ve YANILTTI; belirti 500 ve govdesi bos, yani mobil tarafta
   * "Bir seyler ters gitti" diye gorunuyor.
   *
   * Govdeyi metin olarak okumak burada guvenli: bu uclara giden sey
   * {"code":"123456"} buyuklugunde bir JSON.
   */
  const body = await request.text();
  return handler.POST(
    new Request(request.url, { method: request.method, headers, body }),
  );
}
