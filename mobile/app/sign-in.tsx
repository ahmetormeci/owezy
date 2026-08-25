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
import { useTranslate } from "../lib/i18n";

// NEDEN KENDI EKRANIMIZ: Clerk'in Expo tarafinda web'deki <SignIn /> bilesenin
// dengi yok; giris akisini kancalarla kendimiz kuruyoruz.
//
// NEDEN E-POSTA KODU, OAUTH DEGIL: e-posta kodu hicbir yonlendirme
// yapilandirmasi istemiyor ve development orneginin +clerk_test kullanicilari
// ile sabit 424242 kodu burada da calisiyor - yani E2E icin kurdugumuz
// kimlikler mobilde dogrudan ise yariyor. Google/GitHub sonraki bir is.
//
// PAROLA DA VAR ama IKINCIL (asagidaki Step notu). Web'de zaten calisiyordu:
// Clerk'in <SignIn /> bileseni parola acikken alani kendisi gosteriyor ve
// e2e/global.setup.ts kullanicilari bastan beri parolayla giriyor.

/**
 * "password" adiminin varlik sebebi App Store incelemesi: inceleyici
 * uygulamaya girmek zorunda ve e-posta koduyla girmesi, onun okuyabildigi bir
 * posta kutusu vermemizi gerektirirdi - gonderimin kaderi bizim kontrol
 * etmedigimiz bir posta saglayicisina baglanirdi. Parola o bagimliligi
 * kaldiriyor.
 *
 * BIRINCIL YOL YINE E-POSTA KODU. Parola ikincil bir baglantinin arkasinda;
 * normal kullanicinin gordugu akis degismedi.
 */
type Step = "email" | "code" | "password";

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
  const t = useTranslate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kanca kendi istegini surdururken de dugmeler kapali kalmali.
  const working = busy || fetchStatus === "fetching";

  /**
   * Parolayla giris. BIRINCIL YOL DEGIL - ikincil bir baglantinin arkasinda.
   *
   * App Store incelemesi icin gerekli (bkz. Step tipinin yanindaki not):
   * inceleyicinin bir posta kutusuna erisebilmesini gerektirmeyen tek yol bu.
   * Gercek kullanicilar da parola tercih ederse kullanabilir.
   */
  async function signInWithPassword() {
    if (working) return;
    setBusy(true);
    setError(null);

    try {
      const { error: passwordError } = await signIn.password({
        emailAddress: email,
        password,
      });
      if (passwordError) {
        setError(describeError(passwordError) ?? t("ui.sign_in_failed"));
        return;
      }
      await finishSignIn();
    } catch (caught) {
      setError(describeError(caught) ?? t("ui.sign_in_failed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Iki yolun ORTAK kuyrugu: durumu kontrol et, oturumu ac.
   *
   * "complete" DISINDAKI durumlar bugun yurutulmuyor - ikinci faktor
   * (needs_second_factor) ve taninmayan cihaz dogrulamasi
   * (needs_client_trust) siradaki isin konusu. Ham durum adini ekrana
   * basmak yerine kullaniciyi CALISAN yola gonderiyoruz: web'de Clerk'in
   * kendi formu bu adimlarin hepsini biliyor.
   */
  async function finishSignIn() {
    if (signIn.status !== "complete") {
      setError(t("ui.sign_in_needs_web"));
      return;
    }

    // setActive'in yerini aliyor: tamamlanmis girisi aktif oturuma cevirir.
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) {
      setError(describeError(finalizeError) ?? t("ui.sign_in_failed"));
      return;
    }
    router.replace("/");
  }

  async function sendCode() {
    if (working) return;
    setBusy(true);
    setError(null);

    try {
      const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email });
      if (sendError) {
        setError(describeError(sendError) ?? t("ui.sign_in_failed"));
        return;
      }
      setStep("code");
    } catch (caught) {
      setError(describeError(caught) ?? t("ui.sign_in_failed"));
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
        setError(describeError(verifyError) ?? t("ui.sign_in_failed"));
        return;
      }
      await finishSignIn();
    } catch (caught) {
      setError(describeError(caught) ?? t("ui.sign_in_failed"));
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
        <Text style={styles.title}>{t("ui.app_name")}</Text>

        {step === "email" || step === "password" ? (
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
              editable={!working}
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
                  editable={!working}
                />
              </>
            ) : null}

            <Pressable
              style={styles.button}
              onPress={() => void (step === "password" ? signInWithPassword() : sendCode())}
              disabled={working}
            >
              {working ? (
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
              disabled={working}
            >
              <Text style={styles.link}>
                {step === "password" ? t("ui.sign_in_with_code") : t("ui.sign_in_with_password")}
              </Text>
            </Pressable>
          </>
        ) : (
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
              editable={!working}
            />
            <Pressable style={styles.button} onPress={() => void verifyCode()} disabled={working}>
              {working ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("ui.sign_in")}</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setStep("email")} disabled={working}>
              <Text style={styles.link}>{t("ui.change_email")}</Text>
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
function describeError(caught: unknown): string | null {
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
  // null = "tanidik bir sekil bulamadim". Cumleyi cagiran taraf sozlukten
  // koyuyor; bu fonksiyon bilesenin DISINDA ve ceviriciye erisemiyor.
  return null;
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
