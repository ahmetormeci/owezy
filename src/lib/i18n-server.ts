import "server-only";

// Sunucu tarafinin metne erisim kapisi. Karsiligi istemcide useTranslate().
//
// Ayri dosyada olmasinin sebebi "server-only" paketi: bu modul yanlislikla
// bir Client Component'tan import edilirse derleme HATA veriyor. Aksi halde
// cerez okuyan kod istemci paketine sizabilir ve orada sessizce calismaz.
//
// Su an dil sabit "tr". 11.4c'de burasi cerezi okuyacak; cagiran sayfalarin
// hicbiri degismeyecek - zaten async, zaten await ediliyor.

import { translate, type MessageParams } from "@/lib/messages";
import type { Locale } from "@/lib/money";
import type { Translator } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  // 11.4c: cookies() ile "locale" cerezi, yoksa hesap tercihi, yoksa "tr".
  return "tr";
}

export async function getTranslate(): Promise<Translator> {
  const locale = await getLocale();
  return (code, params?: MessageParams) => translate(code, params, locale);
}
