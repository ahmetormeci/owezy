/**
 * expo-clipboard'un bellekteki ikizi.
 *
 * Gercek modul NATIVE (UIPasteboard): Node'da yuklenemiyor. jest tarafinda
 * jest-setup.ts'teki jest.mock ile yerine geciyor - expo-store-review.mock.ts
 * ile ayni yol. (lib/** onu kullanmiyor, o yuzden vitest takma adi yok.)
 */

let last: string | null = null;
let failWith: Error | null = null;

export async function setStringAsync(text: string): Promise<boolean> {
  if (failWith) {
    const error = failWith;
    failWith = null;
    throw error;
  }
  last = text;
  return true;
}

export async function getStringAsync(): Promise<string> {
  return last ?? "";
}

// --- testlerin kullandigi kontroller (gercek modulde bunlar YOK) ---

export function __reset(): void {
  last = null;
  failWith = null;
}

/** Panoya en son yazilan metin; hic yazilmadiysa null. */
export function __last(): string | null {
  return last;
}

export function __failNext(message = "Pano yazilamadi"): void {
  failWith = new Error(message);
}
