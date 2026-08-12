import "server-only";

// Sunucu tarafinin metne erisim kapisi. Karsiligi istemcide useTranslate().
//
// Ayri dosyada olmasinin sebebi "server-only" paketi: bu modul yanlislikla
// bir Client Component'tan import edilirse derleme HATA veriyor. Aksi halde
// cerez okuyan kod istemci paketine sizabilir ve orada sessizce calismaz.

import { cookies } from "next/headers";
import { translate, type MessageParams } from "@/lib/messages";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/locale";
import type { Translator } from "@/lib/i18n";

/**
 * Istegin dili.
 *
 * Cerezden okunuyor; URL'de dil segmenti yok (ADR-017). Bu, sunucunun da
 * istemcinin de ayni degeri gorebilecegi tek yer: localStorage sunucuya
 * ulasmaz, Accept-Language ise kullanicinin SECIMI degil tarayici ayaridir.
 *
 * Gelen deger normalizeLocale'den geciyor - cerez kullanicinin kontrolunde
 * ve ham hali bicimlendiricilere verilemez (gerekcesi locale.ts'te).
 *
 * NOT: cookies() bir "request-time API"; okuyan rota dinamik render'a gecer.
 * Bu projede zaten her rota dinamik (Clerk her istegi sunucuda calistiriyor),
 * yani olculebilir bir kaybi yok - build ciktisiyla dogrulandi.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

export async function getTranslate(): Promise<Translator> {
  const locale = await getLocale();
  return (code, params?: MessageParams) => translate(code, params, locale);
}
