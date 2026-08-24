import { useSignIn } from "@clerk/clerk-expo";
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
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);

    try {
      await signIn.create({ identifier: email });

      // Clerk hangi e-posta adresine kod gonderilecegini bir "factor" olarak
      // donuyor; strateji adiyla degil, o adresin kimligiyle isteniyor.
      const factor = signIn.supportedFirstFactors?.find(
        (candidate) => candidate.strategy === "email_code",
      );

      if (!factor || !("emailAddressId" in factor)) {
        setError("Bu hesap için e-posta ile giriş açık değil.");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
      setStep("code");
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!isLoaded || busy) return;
    setBusy(true);
    setError(null);

    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: "email_code", code });

      if (attempt.status !== "complete") {
        // Ikinci faktor gibi tamamlanmamis durumlar. 18.2'nin kapsaminda
        // degil ama sessiz kalmiyoruz.
        setError(`Giriş tamamlanamadı: ${attempt.status}`);
        return;
      }

      await setActive({ session: attempt.createdSessionId });
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
              editable={!busy}
            />
            <Pressable style={styles.button} onPress={() => void sendCode()} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kod gönder</Text>}
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
              editable={!busy}
            />
            <Pressable style={styles.button} onPress={() => void verifyCode()} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş yap</Text>}
            </Pressable>
            <Pressable onPress={() => setStep("email")} disabled={busy}>
              <Text style={styles.link}>E-postayı değiştir</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Clerk hatalari {errors:[{message,longMessage}]} seklinde geliyor. Ham nesneyi
// ekrana basmak kullaniciya hicbir sey anlatmaz.
function describe(caught: unknown): string {
  if (
    caught &&
    typeof caught === "object" &&
    "errors" in caught &&
    Array.isArray(caught.errors) &&
    caught.errors.length > 0
  ) {
    const first: unknown = caught.errors[0];
    if (first && typeof first === "object" && "message" in first && typeof first.message === "string") {
      return first.message;
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
