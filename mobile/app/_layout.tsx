import { ClerkProvider } from "@clerk/clerk-expo";
import { Slot } from "expo-router";
import { tokenCache } from "../lib/token-cache";

// Yayimlanabilir anahtar gizli degil (web'de de tarayiciya gidiyor), ama yine
// de dosyaya gomulmuyor: gelistirme "pk_test_", yayin "pk_live_" kullanacak
// ve ikisini kod degistirmeden ayirabilmek gerekiyor.
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  if (!publishableKey) {
    // Sessizce devam etmek daha kotu olurdu: Clerk anahtarsiz da yukleniyor
    // ama her giris denemesi anlamsiz bir hatayla dusuyor.
    throw new Error(
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY tanimli degil. mobile/.env.local " +
        "dosyasini mobile/.env.local.example'a bakarak doldur.",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
    </ClerkProvider>
  );
}
