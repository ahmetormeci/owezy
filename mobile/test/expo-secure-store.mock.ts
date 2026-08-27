/**
 * expo-secure-store'un test ikizi.
 *
 * Gercek modul NATIVE: iOS'ta Keychain'e, Android'de EncryptedSharedPreferences'a
 * baglaniyor ve Node'da yuklenemiyor bile. Ama session-store.ts'in test etmeye
 * degen davranisi zaten Keychain'in kendisi DEGIL: Keychain PATLADIGINDA ne
 * yaptigi. Orasi ucunde de "firlatma, yut ve loga birak" diyor ve sebepleri
 * dosyanin icinde yazili - girisi ya da cikisi yarida kesmemek.
 *
 * O yuzden burasi bellekte bir Map, ustune "bir sonraki cagrida patla"
 * dugmesiyle. vitest.config.ts bu dosyayi takma adla gercek modulun yerine
 * koyuyor.
 */

const store = new Map<string, string>();

/** Kurulan hata, bir sonraki cagrida firlatilir ve sonra TEMIZLENIR. */
let failWith: Error | null = null;

export async function getItemAsync(key: string): Promise<string | null> {
  throwIfArmed();
  return store.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  throwIfArmed();
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  throwIfArmed();
  store.delete(key);
}

function throwIfArmed(): void {
  if (failWith) {
    const error = failWith;
    // Tek seferlik: bir cagriyi dusuruyoruz, sonrakini degil. Testin
    // "yazma dustu ama okuma calisiyor" gibi bir durumu kurabilmesi icin.
    failWith = null;
    throw error;
  }
}

// --- testlerin kullandigi kontroller (gercek modulde bunlar YOK) ---

/** Depoyu bosaltir ve kurulmus hatayi kaldirir. Her testin basinda cagrilir. */
export function __reset(): void {
  store.clear();
  failWith = null;
}

/** Bir sonraki SecureStore cagrisini dusurur. */
export function __failNextCall(message = "Keychain erişilemedi"): void {
  failWith = new Error(message);
}

/** Depoda gercekten ne yaziyor - testin dogrudan bakabilmesi icin. */
export function __peek(key: string): string | null {
  return store.get(key) ?? null;
}

/** Depoya dogrudan yazar: "uygulama daha once girisliydi" durumunu kurmak icin. */
export function __seed(key: string, value: string): void {
  store.set(key, value);
}
