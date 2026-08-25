import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";

/**
 * Better Auth'un kendi uclari: /api/auth/*
 *
 * NEDEN /api/v1 ALTINDA DEGIL: /api/v1 BIZIM sozlesmemiz - ADR-017'ye gore
 * hata METNI degil hata KODU donduruyor, ve yollarini biz belirliyoruz.
 * Buradaki uclarin sekli ise Better Auth'a ait; istemci kutuphanesi
 * (authClient) tam olarak bu yollari cagiriyor. Ikisini ayni ad alanina
 * koymak, bizim olmayan bir sozlesmeyi bizimmis gibi gostermek olurdu.
 *
 * Bu dosya BILEREK bos: butun yollar - giris, cikis, kod gonderme,
 * dogrulama - tek bir catch-all segmentten geciyor ve isi auth ornegi
 * yapiyor.
 */
export const { GET, POST } = toNextJsHandler(auth);
