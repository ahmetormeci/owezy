import { useSignIn } from "@clerk/expo";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { describeClerkError } from "../lib/clerk-errors";
import { useTranslate } from "../lib/i18n";

/**
 * Girisin IKINCI FAKTOR adimi.
 *
 * NEDEN AYRI BIR BILESEN: sign-in.tsx bir DURUM MAKINESI (e-posta -> kod /
 * parola -> ikinci faktor). Makineyi ve her adimin ayrintisini ayni dosyaya
 * koymak dordunculerde okunmaz hale geliyordu. expense-composer.tsx ve
 * group-creator.tsx da ayni sebeple ekranlarindan cikarilmisti: kendi
 * durumunu tasi, bitince callback cagir.
 *
 * IKI DURUM BURAYA GELIYOR ve ikisi de AYNI metotlarla cozuluyor:
 *   needs_second_factor - kullanici 2FA'yi kendi acmis
 *   needs_client_trust  - Clerk cihazi tanimiyor (Device Trust)
 * Bu bir tahmin degil: clerk-js kaynaginda needs_client_trust dogrudan
 * prepareSecondFactor'a gidiyor.
 *
 * SMS DALI BILEREK YOK. SMS ornek genelinde kapali (mesaj basina maliyet +
 * SIM-swap). Test edemedigimiz bir yolu yazmak, calistigini sanmak demek.
 * Yalnizca phone_code destekleniyorsa EBEVEYN buraya hic gelmiyor, calisan
 * yola (web) yonlendiriyor.
 */
export type SecondFactorKind = "totp" | "email_code" | "backup_code";

export function SecondFactor({
  kind,
  onVerified,
  onCancel,
}: {
  /** Ebeveynin sectigi baslangic faktoru. E-posta koduysa ZATEN gonderildi. */
  kind: SecondFactorKind;
  onVerified: () => Promise<void>;
  onCancel: () => void;
}) {
  // signIn PROP OLARAK GECILMIYOR: useSignIn ayni Clerk kaynagini baglamdan
  // veriyor, yani burada cagirmak da ebeveynde cagirmakla ayni nesneyi
  // getiriyor. group-creator.tsx'in useApiClient'i kendi cagirmasiyla ayni
  // tercih - bilesen kendi ihtiyacini kendi aliyor.
  const { signIn, fetchStatus } = useSignIn();
  const t = useTranslate();

  const [current, setCurrent] = useState<SecondFactorKind>(kind);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const working = busy || fetchStatus === "fetching";

  // Yedek kod SUNUCU soyluyorsa var. Kullanici yedek kodlari kurmadiysa
  // listede hic olmuyor ve baglanti da gorunmuyor - olmayan bir cikis
  // kapisi gostermek en kotusu olurdu.
  const hasBackupCode = signIn.supportedSecondFactors.some((f) => f.strategy === "backup_code");

  // Maskeli adres ("a***@example.com"). Clerk boyle veriyor; tam adresi
  // giris yapmamis birine gostermek bilgi sizdirmak olurdu.
  const emailFactor = signIn.supportedSecondFactors.find((f) => f.strategy === "email_code");
  const safeIdentifier =
    emailFactor && "safeIdentifier" in emailFactor ? emailFactor.safeIdentifier : "";

  async function verify() {
    const value = code.trim();
    if (working || !value) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { error: verifyError } =
        current === "totp"
          ? await signIn.mfa.verifyTOTP({ code: value })
          : current === "backup_code"
            ? await signIn.mfa.verifyBackupCode({ code: value })
            : await signIn.mfa.verifyEmailCode({ code: value });

      if (verifyError) {
        setError(describeClerkError(verifyError) ?? t("ui.sign_in_failed"));
        return;
      }
      await onVerified();
    } catch (caught) {
      setError(describeClerkError(caught) ?? t("ui.sign_in_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (working) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        setError(describeClerkError(sendError) ?? t("ui.sign_in_failed"));
        return;
      }
      setNotice(t("ui.code_resent"));
    } catch (caught) {
      setError(describeClerkError(caught) ?? t("ui.sign_in_failed"));
    } finally {
      setBusy(false);
    }
  }

  function switchTo(next: SecondFactorKind) {
    setCurrent(next);
    setCode("");
    setError(null);
    setNotice(null);
  }

  const isDeviceTrust = signIn.status === "needs_client_trust";
  const label = current === "backup_code" ? t("ui.backup_code") : t("ui.verification_code");
  const hint =
    current === "backup_code"
      ? t("ui.backup_code_hint")
      : current === "totp"
        ? t("ui.totp_hint")
        : isDeviceTrust
          ? t("ui.device_trust_hint", { email: safeIdentifier })
          : t("ui.code_sent_to", { email: safeIdentifier });

  return (
    <>
      <Text style={styles.heading}>{t("ui.two_factor_title")}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.muted}>{hint}</Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        // Yedek kodlar harf de iceriyor; sayi tusunu acmak onlari
        // yazilamaz yapardi.
        keyboardType={current === "backup_code" ? "default" : "number-pad"}
        textContentType={current === "backup_code" ? "none" : "oneTimeCode"}
        placeholder={current === "backup_code" ? undefined : t("ui.code_placeholder")}
        editable={!working}
      />

      <Pressable style={styles.button} onPress={() => void verify()} disabled={working}>
        {working ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t("ui.sign_in")}</Text>
        )}
      </Pressable>

      {current === "email_code" ? (
        <Pressable onPress={() => void resend()} disabled={working}>
          <Text style={styles.link}>{t("ui.resend_code")}</Text>
        </Pressable>
      ) : null}

      {hasBackupCode && current !== "backup_code" ? (
        <Pressable onPress={() => switchTo("backup_code")} disabled={working}>
          <Text style={styles.link}>{t("ui.use_backup_code")}</Text>
        </Pressable>
      ) : null}

      {current === "backup_code" ? (
        <Pressable onPress={() => switchTo(kind)} disabled={working}>
          <Text style={styles.link}>
            {kind === "totp" ? t("ui.use_authenticator") : t("ui.use_emailed_code")}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onCancel} disabled={working}>
        <Text style={styles.link}>{t("ui.change_email")}</Text>
      </Pressable>

      {notice ? <Text style={styles.muted}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

// EBEVEYNIN STILLERININ AYNISI, bilerek kopyalandi. sign-in.tsx tema
// sistemini (lib/theme.ts) HENUZ kullanmiyor, renkleri sabit yaziyor.
// Burayi temali yapmak, temasiz bir ekranin ortasinda karanlik modda
// bozuk gorunen bir ada birakirdi. Giris ekrani temaya baglandiginda
// ikisi BIRLIKTE tasinacak.
const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
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
