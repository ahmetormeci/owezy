import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate, type MessageParams } from "@/lib/messages";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { readStoredLocale, writeStoredLocale } from "./locale-store";

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

/**
 * Dili DEGISTIRMENIN yolu. Ayri bir baglam cunku dili OKUYAN her bilesen
 * (neredeyse hepsi) degistirenin degismesiyle yeniden cizilmemeli.
 */
const SetLocaleContext = createContext<(next: Locale) => void>(() => {});

/**
 * Dil saglayicisi.
 *
 * ONCE SABITTI: cihaz dili prop olarak veriliyordu ve uygulama icinden
 * degistirmenin yolu yoktu. Simdi state tasiyor ve sirasi soyle:
 *
 *   1. Cihaz dili ile basliyor - HIC BEKLEMEDEN bir sey cizilebilsin.
 *   2. Cihazda saklanmis bir SECIM varsa ona geciyor (locale-store).
 *   3. Kullanici Hesap ekranindan degistirince hem buraya hem cihaza hem de
 *      sunucuya yaziliyor (PATCH /me).
 *
 * 2. ADIM NEDEN SUNUCUDAN DEGIL: acilista /me'yi beklemek ilk ekrani ag
 * turu kadar geciktirirdi. Sunucudaki kayit yine yaziliyor ve WEB onu
 * okuyor (i18n-server.ts: cerez -> User.locale), yani telefondan yapilan
 * secim web'de de gecerli oluyor.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    let cancelled = false;
    void readStoredLocale().then((stored) => {
      // Saklanmis tercih yoksa cihaz dili KALIYOR - bu bir hata degil,
      // "kullanici henuz secim yapmadi" demek.
      if (!cancelled && stored) setLocale(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ekran once degisiyor, cihaza yazma arkada: kullanici dokunuslarinin
  // diskin hizini beklemesi icin bir sebep yok.
  const change = useCallback((next: Locale) => {
    setLocale(next);
    void writeStoredLocale(next);
  }, []);

  return (
    <SetLocaleContext.Provider value={change}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </SetLocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Dili degistirir: ekrani, cihazdaki onbellegi. SUNUCUYA yazan cagiran taraf. */
export function useSetLocale(): (next: Locale) => void {
  return useContext(SetLocaleContext);
}

export function useTranslate(): Translator {
  const locale = useContext(LocaleContext);
  return useMemo<Translator>(() => (code, params) => translate(code, params, locale), [locale]);
}
