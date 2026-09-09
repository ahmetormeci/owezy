import { fonts } from "../lib/fonts";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/locale";
import { useSession } from "../lib/auth";
import { disablePush } from "../lib/push";
import { useLocale, useSetLocale, useTranslate } from "../lib/i18n";
import { useApiClient, useApiGet } from "../lib/use-api";
import { useTheme, useThemeChoice, type Theme } from "../lib/theme";
import { Cap } from "../components/receipt";

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

/**
 * Diller KENDI dillerinde yaziliyor, cevrilmiyor.
 *
 * "Turkce"yi Ingilizce arayuzde "Turkish" diye gostermek, o secenegi
 * arayan kisinin -- yani Turkce bilen ama ekrani Ingilizce acilmis kisinin --
 * onu tanimasini zorlastirirdi. Dil listeleri her yerde boyle yazilir.
 */
const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };

export default function AccountScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { signOut, getToken } = useSession();
  const { choice: themeChoice, setChoice: setThemeChoice } = useThemeChoice();
  const { remove } = useApiClient();

  const { state } = useApiGet<Me>("/api/v1/me");
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { patch } = useApiClient();
  const [localeBusy, setLocaleBusy] = useState<Locale | null>(null);

  /**
   * Dil secimi.
   *
   * EKRAN ONCE DEGISIYOR, sunucu sonra. Dil bir gorunum tercihi; kullaniciyi
   * ag turu boyunca eski dilde bekletmenin bir karsiligi yok.
   *
   * SUNUCUYA YAZMAK YINE DE GEREKLI: web ayni degeri okuyor (i18n-server.ts,
   * cerez yoksa User.locale), yani telefondan yapilan secim web'de de
   * geceriyor. Basarisiz olursa ekrandaki secim GERI ALINIYOR - yoksa
   * kullanici sectigini sanip bir sonraki aciliste eskisini bulurdu.
   */
  async function chooseLocale(next: Locale) {
    if (next === locale || localeBusy) return;

    const previous = locale;
    setLocale(next);
    setLocaleBusy(next);
    setError(null);

    const result = await patch("/api/v1/me", { locale: next });
    setLocaleBusy(null);

    if (!result.ok) {
      setLocale(previous);
      setError(t(result.code, result.params));
    }
  }
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
      setError(t(result.code, result.params));
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

  /**
   * CIKIS - ama once CIHAZ ADRESI SILINIYOR.
   *
   * Adres sunucuda kalirsa telefon bu hesabin bildirimlerini almaya devam
   * eder; ayni telefona baska biri giris yapmis olsa bile. Yani bu bir
   * temizlik degil, bir sizinti kapatma.
   *
   * SIRA ONEMLI: silme istegi oturum belirteci gerektiriyor, o yuzden
   * signOut()'tan ONCE. Basarisiz olursa da cikis yine yapiliyor - kullanici
   * cikamamis olmaktansa adres kalsin (ve yeni kullanicinin kaydi zaten onu
   * devralir, bkz. lib/push.ts).
   */
  async function leave() {
    await disablePush(await getToken());
    await signOut();
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
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

        {/* GORUNUM. DILDEN FARKLI OLARAK SUNUCUYA GITMIYOR: kagidin rengi
            yalnizca bu cihazda anlamli. Ayni hesabin telefonu koyu,
            tarayicisi acik olabilir ve bu bir tutarsizlik degil.

            "Sistem" AYRI BIR SECENEK ve gerekli: telefonunu gun batiminda
            koyuya geciren biri uygulamanin da gecmesini bekler. Yalnizca
            acik/koyu sunmak o kisiyi elle secime mahkum ederdi.

            BUGUNE KADAR HIC YOKTU ve bu bir karar degildi - DECISIONS.md'de
            karsiligi yok, yani hic ele alinmamis. Web'de bastan beri var. */}
        <View style={s.section}>
          <Cap>{t("ui.appearance")}</Cap>
          <View style={s.chips}>
            {(["system", "light", "dark"] as const).map((value) => {
              const active = themeChoice === value;
              return (
                <Pressable
                  key={value}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setThemeChoice(value)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {t(`ui.theme_${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* DIL. Hesabin bir parcasi cunku kayit da hesapta duruyor
            (User.locale) ve cihazdan cihaza tasiniyor. */}
        <View style={s.section}>
          <Cap>{t("ui.language")}</Cap>
          <View style={s.chips}>
            {SUPPORTED_LOCALES.map((value) => {
              const active = locale === value;
              return (
                <Pressable
                  key={value}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => void chooseLocale(value)}
                  disabled={localeBusy !== null}
                >
                  {localeBusy === value ? (
                    <ActivityIndicator size="small" color={active ? "#fff" : theme.brand} />
                  ) : (
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {LOCALE_LABELS[value]}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable style={s.secondary} onPress={() => void leave()} disabled={busy}>
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
    title: { fontSize: 26, fontFamily: fonts.semibold, color: theme.foreground },
    card: { gap: 4 },
    name: { fontSize: 17, fontFamily: fonts.medium, color: theme.foreground },
    muted: { fontFamily: fonts.body, fontSize: 14, color: theme.muted },
    section: { gap: 10, marginTop: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 92,
      alignItems: "center",
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.foreground, fontFamily: fonts.body, fontSize: 14 },
    chipTextActive: { color: "#fff", fontFamily: fonts.semibold },
    secondary: { paddingVertical: 12 },
    secondaryText: { color: theme.muted, fontFamily: fonts.body, fontSize: 15, textAlign: "center" },
    danger: {
      gap: 12,
      padding: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.destructive,
      marginTop: 12,
    },
    dangerTitle: { fontSize: 16, fontFamily: fonts.semibold, color: theme.foreground },
    dangerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.muted },
    destructive: {
      backgroundColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    destructiveText: { color: "#fff", fontSize: 15, fontFamily: fonts.semibold },
    destructiveOutline: {
      borderWidth: 1,
      borderColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    destructiveOutlineText: { color: theme.destructive, fontSize: 15, fontFamily: fonts.semibold },
    error: { color: theme.destructive, fontFamily: fonts.body, fontSize: 14 },
  });
}
