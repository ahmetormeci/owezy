"use client";

// Metne erisimin TEK sekli. Bilesenler translate()'i dogrudan cagirmiyor,
// buradan geciyor.
//
// NEDEN: dil cerezden geliyor ve kok layout'ta okunuyor. Eger bilesenler
// translate()'i dogrudan cagirsaydi, ~190 cagri yerinin her birine dil
// parametresi eklemek gerekirdi. Bu iki fonksiyonun ICI degisti, cagiran
// taraf hic acilmadi.
//
// NEDEN IKI TANE: React'in kendi siniri. Server Component'lar hook
// kullanamaz - grup sayfasi sunucuda render ediliyor, harcama formu
// istemcide. Ayni isi yapan iki kapi:
//
//   istemci -> useTranslate()   (hook, context'ten okur)
//   sunucu  -> getTranslate()   (async, 11.4c'de cerezden okuyacak)

import { createContext, useContext, useMemo } from "react";
import { translate, type MessageParams } from "@/lib/messages";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

export type Translator = (code: string, params?: MessageParams) => string;

// Varsayilan deger: saglayici olmadan render edilen bir bilesen (ornegin bir
// birim testinde) bos metin yerine dogru Turkce metni gosterir. Uygulamada
// saglayici her zaman kok layout'ta ve gercek dili veriyor.
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
  // Dil degismedigi surece ayni fonksiyon: bunu prop olarak alan alt
  // bilesenler gereksiz yere yeniden render olmuyor.
  return useMemo<Translator>(
    () => (code, params) => translate(code, params, locale),
    [locale],
  );
}
