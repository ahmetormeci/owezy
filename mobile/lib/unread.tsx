import { usePathname } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useSession } from "./auth";
import { useApiGet } from "./use-api";

/**
 * Okunmamis bildirim sayisinin TEK kaynagi.
 *
 * NEDEN PAYLASILAN BIR SAGLAYICI GEREKTI: sayac onceden grup ekraninin kendi
 * sorgusundan geliyordu ve bu yeterliydi, cunku bildirimlere giden kart o
 * ekranin altindaydi. Zil artik BASLIK CUBUGUNDA ve baslik butun ekranlarda
 * ayni - yani sayiyi tek bir ekran besleyemez.
 *
 * NEDEN useFocusEffect DEGIL: o kanca bir EKRANIN odaklanmasini dinliyor.
 * Zil bir ekran degil; Stack'in screenOptions'inda duran bir baslik parcasi.
 * Odaklanacak bir ekrani yok.
 *
 * ONUN YERINE ADRES DINLENIYOR. Kullanici nereye giderse gitsin pathname
 * degisiyor ve sayi tazeleniyor - "bir ekrandan donuldugunde o ekranin
 * sorgulari tazelenmeli" kuralinin baslik icin karsiligi bu. Bildirimler
 * ekrani hepsini okundu isaretliyor; oradan cikildiginda adres degisiyor ve
 * sayi kendiliginden sifirlaniyor.
 *
 * limit=1 BILEREK: uc, sayiyi listeyle AYNI cevapta donduruyor
 * (notifications/route.ts). Bir kayit indirmenin bedeliyle sayiyi aliyoruz;
 * sayac icin ayri bir uc de ikinci bir istek de gerekmiyor.
 */
type Unread = { unreadCount: number; refresh: () => void };

const UnreadContext = createContext<Unread>({ unreadCount: 0, refresh: () => {} });

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  // Girisi olmayana sormuyoruz: cevap 401 olurdu ve giris ekraninda zil
  // zaten yok (o ekranda headerShown: false).
  const query = useApiGet<{ unreadCount: number }>(
    status === "signed-in" ? "/api/v1/notifications?limit=1" : null,
  );
  const reload = query.reload;

  /**
   * ILK CALISMA ATLANIYOR - ve burada dogru olan bu.
   *
   * useApiGet zaten baglandiginda bir kez cekiyor; bu efekt de calissaydi
   * acilista IKI istek giderdi. (Bildirimler ekraninda ayni koruma YANLISTI,
   * cunku orada yukleyen tek sey odaklanma efektiydi. Kural ezberlenmez,
   * "bu ekranda veriyi baska kim cekiyor" diye bakilir.)
   */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (status !== "signed-in") return;
    reload();
  }, [pathname, status, reload]);

  const unreadCount = query.state.kind === "ok" ? query.state.data.unreadCount : 0;

  const value = useMemo<Unread>(
    () => ({ unreadCount, refresh: reload }),
    [unreadCount, reload],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): Unread {
  return useContext(UnreadContext);
}
