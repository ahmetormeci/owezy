import { createContext, useContext, useMemo } from "react";
import { translate, type MessageParams } from "@/lib/messages";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

/**
 * Metne erisimin mobildeki kapisi. Web'deki src/lib/i18n.tsx'in AYNISI, ve
 * bu tekrar BILEREK yapildi.
 *
 * NEDEN PAYLASILMIYOR: web'in i18n.tsx'ini dogrudan import etmeyi denedik ve
 * "Cannot read property 'useContext' of null" ile dustu. Sebep: o dosya
 * mobil agacin DISINDA (../src/lib) ve oradan "react" cozulunce Node yukari
 * dogru yuruyup KOKTEKI React'i buluyor - mobilinkinden farkli bir kopya
 * (19.2.4 / 19.2.3). Iki React kopyasi demek, kanca cagrilarinin bos bir
 * dispatcher'a gitmesi demek.
 *
 * KURAL: saf moduller sinirI gecer, REACT BILESENLERI GECMEZ. Bundler'i
 * zorlayip tek React'e baglamak mumkundu ama o zaman web bilesenlerini
 * paylasmanin yolu acilirdi - oysa onlar <div> kullaniyor, React Native'de
 * <div> yok. Yani o kapiyi acmak istemiyoruz.
 *
 * PAYLASILAN SEY DEGERLI OLANI: sozlugun kendisi (@/lib/messages, 700+
 * satir) ve translate(). Bu dosya yalnizca 20 satirlik bir tasiyici; ADR-020
 * garantisi (eksik ceviri = derleme hatasi) sozlukten geliyor, buradan degil.
 */
export type Translator = (code: string, params?: MessageParams) => string;

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useTranslate(): Translator {
  const locale = useContext(LocaleContext);
  return useMemo<Translator>(() => (code, params) => translate(code, params, locale), [locale]);
}
