/**
 * expo-store-review'un bellekteki ikizi.
 *
 * Gercek modul NATIVE (StoreKit): Node'da yuklenemiyor. vitest tarafinda
 * vitest.config.mts'teki takma adla, jest tarafinda jest-setup.ts'teki
 * jest.mock ile yerine geciyor - expo-secure-store.mock.ts ile ayni yol.
 */

let available = true;
let requests = 0;
let failWith: Error | null = null;

export async function isAvailableAsync(): Promise<boolean> {
  return available;
}

export async function requestReview(): Promise<void> {
  if (failWith) {
    const error = failWith;
    failWith = null;
    throw error;
  }
  requests += 1;
}

export function storeUrl(): string | null {
  return null;
}

export async function hasAction(): Promise<boolean> {
  return available;
}

// --- testlerin kullandigi kontroller (gercek modulde bunlar YOK) ---

export function __reset(): void {
  available = true;
  requests = 0;
  failWith = null;
}

/** TestFlight'ta ya da web'de oldugu gibi: pencere yok. */
export function __setAvailable(value: boolean): void {
  available = value;
}

export function __requestCount(): number {
  return requests;
}

export function __failNextRequest(message = "StoreKit erişilemedi"): void {
  failWith = new Error(message);
}
