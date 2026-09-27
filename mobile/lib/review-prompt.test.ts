import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __failNextCall,
  __peek,
  __reset as resetStore,
  __seed,
} from "../test/expo-secure-store.mock";
import {
  __failNextRequest,
  __requestCount,
  __reset as resetReview,
  __setAvailable,
} from "../test/expo-store-review.mock";
import {
  MIN_DAYS_BETWEEN_ASKS,
  MIN_DAYS_SINCE_FIRST_SEEN,
  MIN_SAVES,
  noteAppOpened,
  noteSaveAndMaybeAskForReview,
  parseReviewState,
  shouldAskForReview,
  type ReviewState,
} from "./review-prompt";

/**
 * BU DOSYA NEYI KORUYOR: Apple'in yilda UC olan degerlendirme hakkinin
 * DOGRU KULLANICIYA ve DOGRU ANDA harcanmasini (ADR-056).
 *
 * Kural kiriliginde hic kimse fark etmez: pencere Apple'in ve gorunmemesi
 * de bir hata mesaji uretmez. Tersi de sessiz: kural gevserse ilk kayitta
 * sorulur ve hak, uygulamayi henuz tanimayan birine gider. Ikisini de
 * yalnizca bu testler gorur.
 */

const KEY = "owezy.review-prompt";
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 1);

function state(partial: Partial<ReviewState>): ReviewState {
  return { firstSeenAt: T0, saves: 0, lastAskedAt: null, ...partial };
}

function stored(): ReviewState | null {
  return parseReviewState(__peek(KEY));
}

beforeEach(() => {
  resetStore();
  resetReview();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("kural", () => {
  const ready = T0 + MIN_DAYS_SINCE_FIRST_SEEN * DAY;

  it("sinirlar kullaniciya soylenenle ayni: 5 kayit, 7 gun, 120 gun", () => {
    // Sabitler degisirse kullaniciya anlatilan kural da degismeli.
    expect([MIN_SAVES, MIN_DAYS_SINCE_FIRST_SEEN, MIN_DAYS_BETWEEN_ASKS]).toEqual([5, 7, 120]);
  });

  it("5 KAYITTAN AZSA sorulmuyor", () => {
    expect(shouldAskForReview(state({ saves: 4 }), ready)).toBe(false);
    expect(shouldAskForReview(state({ saves: 5 }), ready)).toBe(true);
  });

  it("ILK ACILISTAN 7 GUN GECMEDIYSE sorulmuyor - sinir dahil", () => {
    const s = state({ saves: 5 });
    expect(shouldAskForReview(s, ready - 1)).toBe(false);
    expect(shouldAskForReview(s, ready)).toBe(true);
  });

  it("SON SORUDAN 120 GUN GECMEDIYSE sorulmuyor - sinir dahil", () => {
    const asked = ready + 10 * DAY;
    const s = state({ saves: 50, lastAskedAt: asked });
    expect(shouldAskForReview(s, asked + MIN_DAYS_BETWEEN_ASKS * DAY - 1)).toBe(false);
    expect(shouldAskForReview(s, asked + MIN_DAYS_BETWEEN_ASKS * DAY)).toBe(true);
  });
});

describe("depodaki kayit", () => {
  it("BOZUK kayit yok sayiliyor - erken sormaktansa gec sormak", () => {
    expect(parseReviewState("{bozuk")).toBeNull();
    expect(parseReviewState(JSON.stringify({ firstSeenAt: "dun", saves: 3, lastAskedAt: null }))).toBeNull();
    expect(parseReviewState(JSON.stringify({ firstSeenAt: T0, saves: -1, lastAskedAt: null }))).toBeNull();
    expect(parseReviewState(JSON.stringify({ firstSeenAt: T0, saves: 2.5, lastAskedAt: null }))).toBeNull();
    expect(parseReviewState(JSON.stringify(state({ saves: 3 })))).toEqual(state({ saves: 3 }));
  });

  it("ILK ACILIS BIR KEZ yaziliyor, sonraki acilislar ezmiyor", async () => {
    await noteAppOpened(T0);
    await noteAppOpened(T0 + 30 * DAY);

    expect(stored()?.firstSeenAt).toBe(T0);
  });
});

describe("kayit sonrasi", () => {
  it("5. KAYITTA ama ILK HAFTADA sorulmuyor", async () => {
    await noteAppOpened(T0);
    for (let i = 0; i < 5; i += 1) await noteSaveAndMaybeAskForReview(T0 + DAY);

    expect(__requestCount()).toBe(0);
    expect(stored()?.saves).toBe(5);
  });

  it("KOSULLAR TUTUNCA BIR KEZ soruluyor, hemen arkasindaki kayitta TEKRAR SORULMUYOR", async () => {
    await noteAppOpened(T0);
    for (let i = 0; i < 4; i += 1) await noteSaveAndMaybeAskForReview(T0 + DAY);

    const later = T0 + 8 * DAY;
    expect(await noteSaveAndMaybeAskForReview(later)).toBe(true);
    expect(await noteSaveAndMaybeAskForReview(later + DAY)).toBe(false);

    expect(__requestCount()).toBe(1);
    expect(stored()?.lastAskedAt).toBe(later);
  });

  it("TESTFLIGHT'TA (pencere yok) sorulmuyor ve HAK HARCANMIS SAYILMIYOR", async () => {
    __setAvailable(false);
    __seed(KEY, JSON.stringify(state({ saves: 10 })));

    expect(await noteSaveAndMaybeAskForReview(T0 + 30 * DAY)).toBe(false);
    // lastAskedAt bos kaldi: pencere mumkun oldugunda ilk kayitta sorulabilir.
    expect(stored()?.lastAskedAt).toBeNull();
  });

  it("APPLE'IN PENCERESI DUSERSE soru YINE KAYITLI - bir sonraki kayitta tekrar sormuyor", async () => {
    __seed(KEY, JSON.stringify(state({ saves: 10 })));
    __failNextRequest();
    const now = T0 + 30 * DAY;

    await noteSaveAndMaybeAskForReview(now);

    expect(stored()?.lastAskedAt).toBe(now);
    expect(await noteSaveAndMaybeAskForReview(now + DAY)).toBe(false);
  });

  it("KEYCHAIN DUSERSE FIRLATMIYOR - kayit zaten basarili oldu", async () => {
    __failNextCall();

    await expect(noteSaveAndMaybeAskForReview(T0)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("ACILIS HIC KAYDEDILMEDIYSE ilk kayit ani ilk acilis sayiliyor", async () => {
    // noteAppOpened bir sebeple calismadiysa (ornegin keychain o an dustu)
    // sayac yine de baslamali - yoksa hic sorulmazdi.
    await noteSaveAndMaybeAskForReview(T0);

    expect(stored()).toEqual(state({ saves: 1 }));
  });
});
