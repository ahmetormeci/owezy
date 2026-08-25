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
import { SecondFactor, type SecondFactorKind } from "../components/second-factor";
import { describeClerkError } from "../lib/clerk-errors";
import { useTranslate } from "../lib/i18n";

// NEDEN KENDI EKRANIMIZ: Clerk'in Expo tarafinda web'deki <SignIn /> bilesenin
// dengi yok; giris akisini kancalarla kendimiz kuruyoruz.
//
// BUNUN BEDELI: web'de Clerk'in kendi formu her adimi biliyor, burada
// BILDIGIMIZ kadari calisiyor. Ikinci faktor tam da bu yuzden bir sure
// eksik kaldi ve 2FA'yi acan kullaniciyi mobilden kilitleyecekti.
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
 * Ekran bir DURUM MAKINESI. Adimlarin ayrintisi degil, sirasi burada.
 *
 * "password" adiminin varlik sebebi App Store incelemesi: inceleyici
 * uygulamaya girmek zorunda ve e-posta koduyla girmesi, onun okuyabildigi bir
 * posta kutusu vermemizi gerektirirdi - gonderimin kaderi bizim kontrol
 * etmedigimiz bir posta saglayicisina baglanirdi. Parola o bagimliligi
 * kaldiriyor.
 *
 * BIRINCIL YOL YINE E-POSTA KODU. Parola ikincil bir baglantinin arkasinda;
 * normal kullanicinin gordugu akis degismedi.
 *
 * "mfa" adimi ILK IKISININ ARDINDAN gelebilir: hangi yolla girdigin fark
 * etmeksizin Clerk ikinci bir dogrulama isteyebiliyor.
 */
type Step = "email" | "code" | "password" | "mfa";

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
  const [factor, setFactor] = useState<SecondFactorKind | null>(null);
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
        setError(describeClerkError(passwordError) ?? t("ui.sign_in_failed"));
        return;
      }
      await finishSignIn();
    } catch (caught) {
      setError(describeClerkError(caught) ?? t("ui.sign_in_failed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Butun yollarin ORTAK kuyrugu: Clerk'in durumuna bak, ne gerekiyorsa ona
   * gonder. Ilk faktorden de, ikinci faktor bittikten sonra da buraya
   * geliniyor.
   *
   * DIKKAT: signIn bir KAYNAK nesnesi ve YERINDE degisiyor. Yukaridaki
   * await'ten sonra .status taze degeri veriyor; kancayi yeniden okumaya
   * ya da yeni bir render beklemeye gerek yok.
   */
  async function finishSignIn() {
    switch (signIn.status) {
      case "complete":
        break;

      // IKISI DE AYNI YERE GIDIYOR. needs_second_factor kullanicinin kendi
      // actigi 2FA; needs_client_trust ise Clerk'in cihazi tanimamasi
      // (Device Trust). Clerk ikincisini de ikinci faktor olarak yurutuyor.
      case "needs_second_factor":
      case "needs_client_trust":
        await enterSecondFactor();
        return;

      // Geriye kalan durumlar (needs_new_password, needs_protect_check, ...)
      // mobilde YURUTULMUYOR. Ham durum adini ekrana basmak yerine
      // kullaniciyi CALISAN yola gonderiyoruz: web'de Clerk'in kendi formu
      // hepsini biliyor.
      default:
        setError(t("ui.sign_in_needs_web"));
        return;
    }

    // setActive'in yerini aliyor: tamamlanmis girisi aktif oturuma cevirir.
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) {
      setError(describeClerkError(finalizeError) ?? t("ui.sign_in_failed"));
      return;
    }
    router.replace("/");
  }

  /**
   * Hangi ikinci faktorle devam edecegimizi SUNUCU soyluyor.
   * supportedSecondFactors yalnizca ilk faktor dogrulandiktan sonra doluyor -
   * yani tam da buraya geldigimizde.
   *
   * SIRA: authenticator > e-posta kodu > yalnizca yedek kod. Yedek kod
   * normalde bir CIKIS KAPISI, ilk secenek degil; tek secenek kaldiysa
   * elbette o.
   *
   * phone_code KASTEN LISTEDE YOK: SMS ornek genelinde kapali. Yalnizca o
   * destekleniyorsa bos bir ekran gostermek yerine web'e yonlendiriyoruz.
   */
  async function enterSecondFactor() {
    const strategies = new Set(signIn.supportedSecondFactors.map((f) => f.strategy));

    const chosen: SecondFactorKind | null = strategies.has("totp")
      ? "totp"
      : strategies.has("email_code")
        ? "email_code"
        : strategies.has("backup_code")
          ? "backup_code"
          : null;

    if (!chosen) {
      setError(t("ui.sign_in_needs_web"));
      return;
    }

    // Kodu BURADA gonderiyoruz, bilesenin icinde degil: cagiran taraf zaten
    // dondurucuyu gosteriyor. Iceride gondermek, once bos bir kod alani
    // gosterip sonra "gonderildi" demek olurdu.
    if (chosen === "email_code") {
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        setError(describeClerkError(sendError) ?? t("ui.sign_in_failed"));
        return;
      }
    }

    setFactor(chosen);
    setStep("mfa");
  }

  async function sendCode() {
    if (working) return;
    setBusy(true);
    setError(null);

    try {
      const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email });
      if (sendError) {
        setError(describeClerkError(sendError) ?? t("ui.sign_in_failed"));
        return;
      }
      setStep("code");
    } catch (caught) {
      setError(describeClerkError(caught) ?? t("ui.sign_in_failed"));
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
        setError(describeClerkError(verifyError) ?? t("ui.sign_in_failed"));
        return;
      }
      await finishSignIn();
    } catch (caught) {
      setError(describeClerkError(caught) ?? t("ui.sign_in_failed"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Basa donus. EKRANI temizlemek yetmiyor: Clerk kendi tarafinda yarim
   * kalmis giris denemesini tutuyor ve reset() onu birakmanin yolu.
   * Ikinci faktor gelene kadar bu fark gorunmuyordu; artik yarim kalan sey
   * dogrulanmis bir ilk faktor olabiliyor.
   */
  async function startOver() {
    setError(null);
    setCode("");
    setPassword("");
    setFactor(null);
    setStep("email");
    // API cagrisi yapmiyor, yalnizca yerel durumu siliyor - o yuzden
    // hatasini gosterecek bir yer de yok.
    await signIn.reset();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <Text style={styles.title}>{t("ui.app_name")}</Text>

        {step === "mfa" && factor ? (
          <SecondFactor
            kind={factor}
            onVerified={finishSignIn}
            onCancel={() => void startOver()}
          />
        ) : step === "code" ? (
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
            <Pressable onPress={() => void startOver()} disabled={working}>
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
