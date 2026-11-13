import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { onRefreshSignal } from "./refresh-signal";

/**
 * Uygulama ARKA PLANDAN one geldiginde - ya da acikken bir bildirim
 * geldiginde - bu ekrani tazeler (sinyalin kaynagi: lib/refresh-signal.ts).
 *
 * YALNIZCA GORUNEN EKRAN. Abonelik useFocusEffect icinde kuruluyor ve ekran
 * odagi kaybedince birakiliyor. Yiginda altta duran ekranlar (grup listesinin
 * ustune acilmis bir grup ekrani gibi) sinyali duymuyor: kullanici onlara
 * donunce kendi odaklanma tazelemeleri zaten calisiyor. Hepsini birden
 * tazelemek, gorunmeyen ekranlar icin istek atmak olurdu.
 *
 * ODAKLANMANIN KENDISI TAZELEMIYOR - yalnizca abone oluyor. Yani refresh'in
 * kimligi degisirse abonelik yeniden kurulur ama bosuna istek gitmez. Yine de
 * refresh useCallback ile SABIT tutulmali (CONVENTIONS.md, "Mobil").
 *
 * FORM EKRANLARINDA KULLANILMAZ (harcama ekleme/duzenleme, grup duzenleme,
 * harcama detayi): orada tazeleme, kullanicinin yazmakta oldugu seyin
 * uzerine sunucudaki eski hali yazabilirdi.
 */
export function useForegroundRefresh(refresh: () => unknown) {
  useFocusEffect(
    useCallback(
      () =>
        onRefreshSignal(() => {
          void refresh();
        }),
      [refresh],
    ),
  );
}

/**
 * ASAGI CEKIP YENILEME. ScrollView'un refreshControl'una verilecek iki deger.
 *
 * GOSTERGE YALNIZCA KULLANICI CEKTIGINDE DONUYOR. Otomatik tazelemeler
 * (odaklanma, one gelme) bu bayragi acmiyor: RefreshControl'un refreshing'i
 * true olunca iOS listeyi asagi itip gostergeyi aciyor - kullanicinin
 * dokunmadigi bir anda ekranin oynamasi demek.
 *
 * refresh BIR SOZ DONDURMELI ve gosterge o soz cozulunce kapaniyor -
 * basarili ya da degil. Basarisizligi ekran kendisi soyluyor
 * (components/refresh-notice.tsx); burada yutulan bir hata yok.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
