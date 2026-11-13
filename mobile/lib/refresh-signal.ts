/**
 * "GORUNEN EKRAN VERISINI TAZELESIN" SINYALI.
 *
 * NEDEN VAR: uygulama arka plandan one geldiginde hicbir ekran veriyi yeniden
 * cekmiyordu. useFocusEffect yalnizca uygulama ICINDEKI gezinmeyi duyuyor;
 * telefonun ana ekranindan geri donmek bir odaklanma degil. Kullanici bildirdi:
 * zamanlanmis gorevin urettigi harcama web'de aninda gorunuyor, telefondaki
 * listeye ise ancak 3-5 dakika sonra - bir ekrana girip cikinca - dusuyordu.
 *
 * IKI KAYNAK, TEK SINYAL:
 *   - uygulama ARKA PLANDAN one geldi (AppState)
 *   - uygulama ACIKKEN bir push bildirimi geldi (expo-notifications)
 * Ikisini de app/_layout.tsx dinliyor ve buraya yayinliyor. Ekranlar hangi
 * kaynaktan geldigini bilmiyor; yalnizca "simdi tazele" diyen bir sinyal
 * duyuyorlar (lib/screen-refresh.ts).
 *
 * BU DOSYA REACT NATIVE'E DOKUNMUYOR ve bu bilincli: lib/ vitest'in alani ve
 * vitest RN'i yukleyemiyor (vitest.config.mts). Kararin kendisi - hangi
 * gecis "arka plandan dondu" sayilir - burada ve saf; dinleyen taraf ince.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Sinyale abone olur. Donen fonksiyon aboneligi birakir. */
export function onRefreshSignal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Butun abonelere "tazele" der. */
export function emitRefreshSignal(): void {
  // KOPYA uzerinde donuluyor: bir dinleyici calisirken abonelik degisirse
  // (ekran kapanip aboneligi birakirsa) yineleme bozulmasin.
  for (const listener of [...listeners]) {
    listener();
  }
}

/**
 * AppState degisimlerinden "uygulama arka plandan dondu" anini cikarir.
 *
 * YALNIZCA GERCEK ARKA PLAN SAYILIYOR. iOS'ta Denetim Merkezi'ni indirmek
 * ya da Face ID penceresi uygulamayi "inactive" yapiyor, arka plana
 * ATMIYOR: active -> inactive -> active. Bunlarda tazelemek, kullanicinin
 * hicbir sey yapmadigi bir anda istek atmak olurdu. (Bildirim perdesi ise
 * iOS 27'de uygulamayi arka plana atiyor - simulatorde olculdu; perde
 * kapaninca tazeleme olmasi dogru, bildirimlere bakan guncel liste bekler.)
 * Gercek donus ise background -> active (RN'in RCTAppState.mm'si: one
 * gelirken once "background", sonra "active" bildiriyor).
 *
 * "ONCEKI DURUM" DEGIL "ARKA PLANDA BULUNDU MU" tutuluyor: arka plandan
 * donerken araya bir "inactive" girse de (background -> inactive -> active)
 * donus kacirilmasin.
 *
 * initial: AppState.currentState. Uygulama arka planda baslatildiysa
 * (ornegin bir bildirim yuzunden) ilk "active" de bir donus sayiliyor.
 */
export function createForegroundDetector(initial: string | null | undefined) {
  let wasInBackground = initial === "background";

  return (next: string): boolean => {
    if (next === "background") {
      wasInBackground = true;
      return false;
    }
    if (next === "active" && wasInBackground) {
      wasInBackground = false;
      return true;
    }
    return false;
  };
}
