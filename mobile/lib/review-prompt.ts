import * as SecureStore from "expo-secure-store";
import * as StoreReview from "expo-store-review";

/**
 * UYGULAMAYI DEGERLENDIRME ISTEGI (ADR-056).
 *
 * PENCERE APPLE'IN. Apple, puan istemek icin yalnizca kendi penceresine izin
 * veriyor (Guideline 5.6.1) ve pencerenin GERCEKTEN gorunup gorunmeyecegine
 * de kendisi karar veriyor: bir kullaniciya yilda en fazla UC kez. Yani
 * requestReview() "goster" demek degil, "gostermek istersen simdi uygun"
 * demek. TestFlight'ta hic gorunmuyor.
 *
 * BU DOSYANIN ISI O UC HAKKI KORUMAK. Kural yoksa ilk kayitta sorulur ve
 * hak, uygulamayi henuz tanimayan birine harcanir. Kural su:
 *
 *   - en az MIN_SAVES basarili kayit (harcama ya da odeme),
 *   - uygulamanin ilk acilisindan bu yana en az MIN_DAYS_SINCE_FIRST_SEEN gun,
 *   - son sorudan bu yana en az MIN_DAYS_BETWEEN_ASKS gun.
 *
 * NE ZAMAN: bir kayit BASARIYLA BITTIKTEN sonra - is bittiginde, ortasinda
 * degil. Cagiran taraf bunu kaydin basari dalinin sonunda cagiriyor.
 *
 * GIZLILIK: sayaclar YALNIZCA TELEFONDA. Sunucuya hicbir sey gitmiyor;
 * gizlilik politikasinin "analiz araci yok" sozu bozulmuyor.
 */

const KEY = "owezy.review-prompt";
const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_SAVES = 5;
export const MIN_DAYS_SINCE_FIRST_SEEN = 7;
export const MIN_DAYS_BETWEEN_ASKS = 120;

/**
 * App Store'daki yorum sayfasi. Hesap ekranindaki satir buraya gidiyor -
 * kullanicinin KENDI istedigi yol, kurala tabi degil.
 */
export const WRITE_REVIEW_URL = "https://apps.apple.com/app/id6805650395?action=write-review";

export type ReviewState = {
  /** Uygulamanin bu cihazda ilk acildigi an (ms). */
  firstSeenAt: number;
  /** Basarili kayit sayisi. */
  saves: number;
  /** Son kez requestReview() cagrildigi an; hic cagrilmadiysa null. */
  lastAskedAt: number | null;
};

/** Kuralin kendisi. Saf: saati disaridan aliyor, depoya dokunmuyor. */
export function shouldAskForReview(state: ReviewState, now: number): boolean {
  if (state.saves < MIN_SAVES) return false;
  if (now - state.firstSeenAt < MIN_DAYS_SINCE_FIRST_SEEN * DAY_MS) return false;
  if (state.lastAskedAt !== null && now - state.lastAskedAt < MIN_DAYS_BETWEEN_ASKS * DAY_MS) {
    return false;
  }
  return true;
}

/**
 * Depodaki degeri okur. BOZUKSA YOK SAYILIYOR: yanlis bicimli bir kayit
 * "hic kayit yok" gibi davranir ve sayac bastan baslar. En kotu sonuc bir
 * soru gecikmesi - bozuk veriye guvenip erken sormaktan iyi.
 */
export function parseReviewState(raw: string | null): ReviewState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { firstSeenAt, saves, lastAskedAt } = value as Record<string, unknown>;
    if (typeof firstSeenAt !== "number" || !Number.isFinite(firstSeenAt)) return null;
    if (typeof saves !== "number" || !Number.isInteger(saves) || saves < 0) return null;
    if (lastAskedAt !== null && (typeof lastAskedAt !== "number" || !Number.isFinite(lastAskedAt))) {
      return null;
    }
    return { firstSeenAt, saves, lastAskedAt };
  } catch {
    return null;
  }
}

async function readState(now: number): Promise<ReviewState> {
  const stored = parseReviewState(await SecureStore.getItemAsync(KEY));
  return stored ?? { firstSeenAt: now, saves: 0, lastAskedAt: null };
}

async function writeState(state: ReviewState): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(state));
}

/**
 * Uygulama acildiginda cagriliyor: ilk acilis anini BIR KEZ yaziyor.
 *
 * Buraya konmasaydi "ilk acilis" ilk KAYDIN ani olurdu ve kullaniciya
 * soylenen kural ("uygulamayi ilk acali 7 gun") dogru olmazdi.
 */
export async function noteAppOpened(now = Date.now()): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (parseReviewState(raw)) return;
    await writeState({ firstSeenAt: now, saves: 0, lastAskedAt: null });
  } catch (error) {
    console.error("Değerlendirme sayacı yazılamadı", error);
  }
}

/**
 * Basarili bir kaydi sayar ve kural izin veriyorsa Apple'a "sorabilirsin"
 * der. Soruldugunda true doner (testler icin; cagiran taraf kullanmiyor).
 *
 * HICBIR ZAMAN FIRLATMIYOR: kayit zaten basarili oldu. Keychain ya da
 * StoreKit'teki bir aksaklik kullaniciya "kaydedilemedi" gibi gorunmemeli.
 *
 * ONCE YAZILIYOR, SONRA SORULUYOR: requestReview() takilir ya da dusarse
 * lastAskedAt yine kayitli olsun - yoksa bir sonraki kayitta tekrar
 * sorulurdu.
 */
export async function noteSaveAndMaybeAskForReview(now = Date.now()): Promise<boolean> {
  try {
    const state = await readState(now);
    const next: ReviewState = { ...state, saves: state.saves + 1 };
    const ask = shouldAskForReview(next, now) && (await StoreReview.isAvailableAsync());
    if (ask) next.lastAskedAt = now;
    await writeState(next);
    if (ask) await StoreReview.requestReview();
    return ask;
  } catch (error) {
    console.error("Değerlendirme isteği yapılamadı", error);
    return false;
  }
}
