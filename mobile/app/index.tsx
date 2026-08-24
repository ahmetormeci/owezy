import { useAuth } from "@clerk/clerk-expo";
import { Link, Redirect } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../lib/i18n";
import { useApiGet } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";

/**
 * Uygulamanin girisi.
 *
 * BURASI BIR "GRUPLAR LISTESI" DEGIL, bir YONLENDIRME. Web'de ADR-016 ile
 * verilmis karari mobilde de uyguluyor: tek grubu olan kullanici listeyi HIC
 * gormuyor, dogrudan grubunun icine dusuyor.
 *
 * Sebep: kullanicilarin cogunun bir, bilemedin iki grubu olacak. Onlari once
 * tek satirlik bir listeye dusurmek, bos bir ekrani varis noktasi yapmak
 * olurdu. Liste 2+ grupta bir GECIS yuzeyi olarak kaliyor - varis degil.
 */
type Group = { id: string; name: string; description: string | null; role: "OWNER" | "MEMBER" };

export default function EntryScreen() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const t = useTranslate();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Kancalar kosulsuz cagrilmali; "henuz istek atma" durumunu path=null
  // tasiyor.
  const { state, reload } = useApiGet<{ groups: Group[] }>(
    isLoaded && isSignedIn ? "/api/v1/groups" : null,
  );

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (state.kind === "loading") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>{state.text}</Text>
        <Pressable style={styles.button} onPress={reload}>
          <Text style={styles.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const groups = state.data.groups;

  // Tek grup: listeyi atla.
  if (groups.length === 1) {
    return <Redirect href={`/groups/${groups[0].id}`} />;
  }

  // Ilk acilis. Bos oldugu icin degil, BASLANGIC oldugu icin nefes aliyor.
  if (groups.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.firstRun}>
          <Text style={styles.wordmark}>Owezy</Text>
          <Text style={styles.firstRunText}>{t("ui.no_groups")}</Text>
        </View>
        <SignOutRow styles={styles} label={t("ui.sign_out")} onPress={() => void signOut()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>{t("ui.my_groups")}</Text>

      <ScrollView style={styles.list}>
        {groups.map((group) => (
          <Link key={group.id} href={`/groups/${group.id}`} asChild>
            <Pressable style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {group.name}
                </Text>
                {group.description ? (
                  <Text style={styles.rowDescription} numberOfLines={1}>
                    {group.description}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.rowRole}>
                {group.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>

      <SignOutRow styles={styles} label={t("ui.sign_out")} onPress={() => void signOut()} />
    </SafeAreaView>
  );
}

function SignOutRow({
  styles,
  label,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.signOut} onPress={onPress}>
      <Text style={styles.signOutText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: 24 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.paper,
    },
    title: { fontSize: 17, fontWeight: "600", color: theme.foreground, paddingTop: 8 },
    // flex: 1 SART. flexGrow: 0 ile liste yalnizca kendi yuksekligini
    // kapliyordu ve "cikis yap" son satirin hemen altina yapisip UCUNCU BIR
    // LISTE SATIRI gibi okunuyordu. Simdi liste kalan alani aliyor, cikis
    // alta iniyor - ilk acilis ekraniyla da tutarli.
    list: { flex: 1, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    // Her grup bir KART degil bir SATIR (ADR-021): kart deseninde iki grup
    // iki ayri yuzey demekti.
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    rowText: { flexShrink: 1 },
    rowName: { fontSize: 16, fontWeight: "500", color: theme.foreground },
    rowDescription: { marginTop: 2, fontSize: 12, color: theme.muted },
    rowRole: { fontSize: 12, color: theme.muted },
    firstRun: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    wordmark: { fontSize: 34, fontWeight: "600", color: theme.brand },
    firstRunText: { textAlign: "center", color: theme.muted, maxWidth: 300, lineHeight: 22 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
    signOut: { paddingVertical: 16 },
    signOutText: { color: theme.muted, fontSize: 14 },
  });
}
