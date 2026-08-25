import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// NEDEN KENDI EKRANIMIZ: Clerk'in Expo tarafinda web'deki <SignIn /> bilesenin
// dengi yok; giris akisini kancalarla kendimiz kuruyoruz.
//
// NEDEN E-POSTA KODU, OAUTH DEGIL: e-posta kodu hicbir yonlendirme
// yapilandirmasi istemiyor ve development orneginin +clerk_test kullanicilari
// ile sabit 424242 kodu burada da calisiyor - yani E2E icin kurdugumuz
// kimlikler mobilde dogrudan ise yariyor. Google/GitHub sonraki bir is.

type Step = "email" | "code";

export default function SignInScreen() {
  // @clerk/expo v4'te useSignIn'in SOZLESMESI DEGISTI (core-3). Eskiden
  // { signIn, setActive, isLoaded } donuyordu; artik { signIn, fetchStatus }
  // ve signIn "future" API'si. Farklar:
  //   - create() + supportedFirstFactors icinde email_code faktorunu bulup
  //     prepareFirstFactor cagirmak GEREKMIYOR: emailCode.sendCode() adresi
  //     dogrudan aliyor. O yuzden burasi eskisinden KISA.
  //   - Hatalar FIRLATILMIYOR, { error } olarak DONUYOR. try/catch yine
  //     duruyor ama yalnizca ag/beklenmeyen arizalar icin.
  //   - setActive yerine signIn.finalize().
  //   - isLoaded yok; kanca signIn'i hazir veriyor.
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kanca kendi istegini surdururken de dugmeler kapali kalmali.
  const working = busy || fetchStatus === "fetching";

  async function sendCode() {
    if (working) return;
    setBusy(true);
    setError(null);

    try {
      const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email });
      if (sendError) {
        setError(describe(sendError));
        return;
      }
      setStep("code");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (working) return;
    setBusy(true);
    setError(null);

    try {
      const { error: verifyError } = await signIn.emailCode.verifyCode({ code });
      if (verifyError) {
        setError(describe(verifyError));
        return;
      }

      if (signIn.status !== "complete") {
        // Ikinci faktor gibi tamamlanmamis durumlar. Kapsamimizda degil ama
        // sessiz kalmiyoruz - kullanici neden iceri giremedigini gormeli.
        setError(`Giriş tamamlanamadı: ${signIn.status}`);
        return;
      }

      // setActive'in yerini aliyor: tamamlanmis girisi aktif oturuma cevirir.
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) {
        setError(describe(finalizeError));
        return;
      }
      router.replace("/");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <Text style={styles.title}>Owezy</Text>

        {step === "email" ? (
          <>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="ornek@owezy.net"
              editable={!working}
            />
            <Pressable style={styles.button} onPress={() => void sendCode()} disabled={working}>
              {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kod gönder</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Doğrulama kodu</Text>
            <Text style={styles.muted}>{email} adresine gönderildi.</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="000000"
              editable={!working}
            />
            <Pressable style={styles.button} onPress={() => void verifyCode()} disabled={working}>
              {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş yap</Text>}
            </Pressable>
            <Pressable onPress={() => setStep("email")} disabled={working}>
              <Text style={styles.link}>E-postayı değiştir</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Clerk hatasini okunur bir cumleye cevirir. Ham nesneyi ekrana basmak
 * kullaniciya hicbir sey anlatmaz.
 *
 * IKI SEKIL BIRDEN ele aliniyor cunku v4'te ikisi de gelebiliyor:
 *   - DONEN hata: ClerkError - duz nesne, { message, longMessage, code }.
 *     Yeni emailCode.sendCode/verifyCode/finalize bunu doniyor.
 *   - FIRLATILAN hata: {errors:[{message}]} - eski Clerk sekli, ag katmaninda
 *     hala cikabiliyor.
 *
 * longMessage ONCE deneniyor: Clerk'in kendi tarifine gore kullaniciya
 * gosterilmek uzere yazilan alan o; message gelistiriciye bakan metin.
 */
function describe(caught: unknown): string {
  if (caught && typeof caught === "object") {
    if ("longMessage" in caught && typeof caught.longMessage === "string" && caught.longMessage) {
      return caught.longMessage;
    }
    if (
      "errors" in caught &&
      Array.isArray(caught.errors) &&
      caught.errors.length > 0
    ) {
      const first: unknown = caught.errors[0];
      if (
        first &&
        typeof first === "object" &&
        "message" in first &&
        typeof first.message === "string"
      ) {
        return first.message;
      }
    }
    if ("message" in caught && typeof caught.message === "string" && caught.message) {
      return caught.message;
    }
  }
  return "Bir şeyler ters gitti. Tekrar dener misin?";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  form: { flex: 1, padding: 24, gap: 8, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "600", marginBottom: 24 },
  label: { fontSize: 11, letterSpacing: 2, color: "#888" },
  muted: { fontSize: 14, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    padding: 16,
    backgroundColor: "#111",
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16 },
  link: { color: "#666", paddingVertical: 12, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 14 },
});
