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
import { useSession } from "../lib/auth";
import { useTranslate } from "../lib/i18n";

// NEDEN KENDI EKRANIMIZ: mobilde hazir bir giris bileseni kullanmiyoruz;
// akisi kendimiz kuruyoruz. Web'deki src/components/sign-in-form.tsx ile
// AYNI adimlar, ayni sirada - iki istemcinin ayni akisi farkli sunmasi, ayni
// uygulamayi iki ayri urun gibi gosterirdi.
//
// NEDEN E-POSTA KODU, OAUTH DEGIL: e-posta kodu hicbir yonlendirme
// yapilandirmasi istemiyor. Google/Apple girisi sonraki bir is (ADR-030'daki
// acik maddelerden biri).
//
// KAYIT EKRANI YOK ve bu bir eksiklik degil: Better Auth'un e-posta kodu
// akisi, adres kayitli degilse kullaniciyi KENDISI yaratiyor. Web'de ayri bir
// kayit formu olmasinin tek sebebi gorunen ADI sorabilmek; mobilde ad
// e-postaya dusuyor (better-auth.ts'teki databaseHooks) - web'de koddan giren
// birinin durumuyla ayni.

/**
 * Ekran bir DURUM MAKINESI. Adimlarin ayrintisi degil, sirasi burada.
 *
 * "password" adiminin varlik sebebi App Store incelemesi (ADR-035):
 * inceleyici uygulamaya girmek zorunda ve e-posta koduyla girmesi, onun
 * okuyabildigi bir posta kutusu vermemizi gerektirirdi - gonderimin kaderi
 * bizim kontrol etmedigimiz bir posta saglayicisina baglanirdi. Parola o
 * bagimliligi kaldiriyor.
 *
 * BIRINCIL YOL YINE E-POSTA KODU. Parola ikincil bir baglantinin arkasinda;
 * normal kullanicinin gordugu akis degismedi.
 *
 * IKINCI FAKTOR ADIMI SIMDILIK YOK: Clerk'in MFA akisini yuruten adim
 * (ADR-036) bu fazda kaldirildi, cunku ikinci faktoru artik Better Auth'un
 * twoFactor eklentisi saglayacak ve uclari farkli. Faz 25.6'da geri geliyor.
 */
type Step = "email" | "code" | "password";

export default function SignInScreen() {
  const { sendCode, signInWithCode, signInWithPassword } = useSession();
  const router = useRouter();
  const t = useTranslate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Butun yollarin ORTAK kuyrugu.
   *
   * Cagrilar HATA FIRLATMIYOR: lib/auth.tsx her durumda { ok } donduruyor ve
   * basarisizlikta hazir bir MESAJ KODU veriyor (ag hatasi dahil). Yani
   * burada try/catch'e gerek yok ve ekranda ham hata metni cikmasi mumkun
   * degil.
   */
  async function run(call: () => Promise<{ ok: true } | { ok: false; code: string }>) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const result = await call();
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code));
      return false;
    }
    return true;
  }

  async function requestCode() {
    if (await run(() => sendCode(email))) {
      setStep("code");
    }
  }

  async function verifyCode() {
    if (await run(() => signInWithCode(email, code))) {
      // Oturum zaten kaydedildi; buradan sonrasini "/" karar veriyor
      // (0 / 1 / 2+ grup). Yonlendirme replace: giris ekrani gecmise
      // yazilmamali, yoksa geri tusu girisli kullaniciyi forma dondururdu.
      router.replace("/");
    }
  }

  async function usePassword() {
    if (await run(() => signInWithPassword(email, password))) {
      router.replace("/");
    }
  }

  /** Basa donus: adimi VE girilen degerleri birlikte temizliyor. */
  function startOver() {
    setError(null);
    setCode("");
    setPassword("");
    setStep("email");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <Text style={styles.title}>{t("ui.app_name")}</Text>

        {step === "code" ? (
          <>
            <Text style={styles.label}>{t("ui.verification_code")}</Text>
            <Text style={styles.muted}>{t("ui.code_sent_to", { email })}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder={t("ui.code_placeholder")}
              editable={!busy}
            />
            <Pressable style={styles.button} onPress={() => void verifyCode()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("ui.sign_in")}</Text>
              )}
            </Pressable>
            <Pressable onPress={startOver} disabled={busy}>
              <Text style={styles.link}>{t("ui.change_email")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t("ui.email")}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder={t("ui.email_placeholder")}
              editable={!busy}
            />

            {step === "password" ? (
              <>
                <Text style={styles.label}>{t("ui.password")}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType="password"
                  editable={!busy}
                />
              </>
            ) : null}

            <Pressable
              style={styles.button}
              onPress={() => void (step === "password" ? usePassword() : requestCode())}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {step === "password" ? t("ui.sign_in") : t("ui.send_code")}
                </Text>
              )}
            </Pressable>

            {/* Iki yol arasinda gecis. Parola IKINCIL: varsayilan akis kodla
                girmek ve oyle kaliyor. */}
            <Pressable
              onPress={() => {
                setError(null);
                setStep(step === "password" ? "email" : "password");
              }}
              disabled={busy}
            >
              <Text style={styles.link}>
                {step === "password" ? t("ui.sign_in_with_code") : t("ui.sign_in_with_password")}
              </Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
