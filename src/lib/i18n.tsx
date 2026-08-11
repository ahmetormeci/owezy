"use client";

// Metne erisimin TEK sekli. Bilesenler translate()'i dogrudan cagirmiyor,
// buradan geciyor.
//
// NEDEN: su an dil her yerde "tr". 11.4c'de dil cerezden gelecek. Eger
// bilesenler translate()'i dogrudan cagirsaydi, o asamada 120 cagri yerini
// tekrar acip dil parametresi eklemek gerekirdi. Buradaki iki fonksiyonun
// ICI degisecek, cagiran taraf degismeyecek.
//
// NEDEN IKI TANE: React'in kendi siniri. Server Component'lar hook
// kullanamaz - grup sayfasi sunucuda render ediliyor, harcama formu
// istemcide. Ayni isi yapan iki kapi:
//
//   istemci -> useTranslate()   (hook, context'ten okur)
//   sunucu  -> getTranslate()   (async, 11.4c'de cerezden okuyacak)

import { createContext, useContext, useMemo } from "react";
import { translate, type MessageParams } from "@/lib/messages";
import type { Locale } from "@/lib/money";

export type Translator = (code: string, params?: MessageParams) => string;

// Varsayilan "tr": saglayici olmadan render edilen bir bilesen bos metin
// yerine dogru Turkce metni gosterir. 11.4c'de saglayici gercek dili verecek.
const LocaleContext = createContext<Locale>("tr");

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
