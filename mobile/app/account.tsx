import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../lib/auth";
import { useTranslate } from "../lib/i18n";
import { useApiClient, useApiGet } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";

/**
 * Hesap ekrani. MOBILDE BOYLE BIR EKRAN YOKTU.
 *
 * NEDEN EKLENDI: App Store Guideline 5.1.1(v), hesap acilabilen uygulamalarda
 * UYGULAMA ICI hesap silmeyi zorunlu kiliyor. Owezy hesap aciyor (e-posta
 * koduyla giren biri kayitli degilse yaratiliyor). Karar ADR-031'de 24
 * Agustos'ta alinmisti ama uygulanmamisti; eksiklik Apple'in 2.1 reddi
 * sirasinda ortaya cikti - inceleyici kayitta "account deletion flow"
 * gormek istiyor ve gosterecek bir sey yoktu.
 *
 * CIKIS YAPMA HALA GRUPLAR EKRANINDA DA DURUYOR. Buraya tasiyip oradan
 * kaldirmak, en sik kullanilan islemi bir dokunus derine gomerdi.
 */
type Me = { user: { displayName: string; email: string } };

export default function AccountScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { signOut } = useSession();
  const { remove } = useApiClient();

  const { state } = useApiGet<Me>("/api/v1/me");
  /** Silme IKI ADIMLI: once uyari, sonra onay. */
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await remove("/api/v1/me");
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code));
      return;
    }

    /**
     * SUNUCU OTURUMU ZATEN SILDI (deleteAccount, Session satirlarini
     * temizliyor). Yine de signOut() cagriliyor: cihazdaki belirteci
     * temizlemek ve ekrani cikisli yapmak GEREKIYOR, yoksa uygulama
     * silinmis bir hesapla girisli gorunur ve her istegi 401 alirdi.
     *
     * signOut() sunucuya da bir istek atiyor ve o istek basarisiz olacak -
     * oturum artik yok. Sorun degil: lib/auth.tsx once yereli temizliyor,
     * sunucu cagrisi en iyi gayret (Faz 24'te bu sira bilerek boyle
     * kuruldu).
     */
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{t("ui.account")}</Text>

        {state.kind === "loading" ? (
          <ActivityIndicator color={theme.brand} />
        ) : state.kind === "error" ? (
          <Text style={s.error}>{state.text}</Text>
        ) : (
          <View style={s.card}>
            <Text style={s.name}>{state.data.user.displayName}</Text>
            <Text style={s.muted}>{state.data.user.email}</Text>
          </View>
        )}

        <Pressable style={s.secondary} onPress={() => void signOut()} disabled={busy}>
          <Text style={s.secondaryText}>{t("ui.sign_out")}</Text>
        </Pressable>

        <View style={s.danger}>
          <Text style={s.dangerTitle}>{t("ui.delete_account_title")}</Text>
          {/* Kaybedilecek sey SOMUT yaziliyor; "geri alinamaz" demek yetmiyor. */}
          <Text style={s.dangerText}>{t("ui.delete_account_warning")}</Text>
          <Text style={s.dangerText}>{t("ui.delete_account_balance_warning")}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {confirming ? (
            <>
              <Pressable
                style={s.destructive}
                onPress={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.destructiveText}>{t("ui.delete_account_confirm")}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} disabled={busy}>
                <Text style={s.secondaryText}>{t("ui.cancel")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              testID="delete-account"
              style={s.destructiveOutline}
              onPress={() => setConfirming(true)}
              disabled={busy}
            >
              <Text style={s.destructiveOutlineText}>{t("ui.delete_account")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.paper },
    content: { padding: 20, gap: 20 },
    title: { fontSize: 26, fontWeight: "600", color: theme.foreground },
    card: { gap: 4 },
    name: { fontSize: 17, fontWeight: "500", color: theme.foreground },
    muted: { fontSize: 14, color: theme.muted },
    secondary: { paddingVertical: 12 },
    secondaryText: { color: theme.muted, fontSize: 15, textAlign: "center" },
    danger: {
      gap: 12,
      padding: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.destructive,
      marginTop: 12,
    },
    dangerTitle: { fontSize: 16, fontWeight: "600", color: theme.foreground },
    dangerText: { fontSize: 13, lineHeight: 19, color: theme.muted },
    destructive: {
      backgroundColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    destructiveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    destructiveOutline: {
      borderWidth: 1,
      borderColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    destructiveOutlineText: { color: theme.destructive, fontSize: 15, fontWeight: "600" },
    error: { color: theme.destructive, fontSize: 14 },
  });
}
