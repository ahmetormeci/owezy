import { useAuth } from "@clerk/clerk-expo";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../../lib/i18n";
import { useApiGet } from "../../lib/use-api";
import { useTheme, type Theme } from "../../lib/theme";
import { GroupCreator } from "../../components/group-creator";

/**
 * Gruplar listesi. HER ZAMAN gorunur, grup sayisi ne olursa olsun.
 *
 * Girisle ("/") ayri tutulmasi bir HATAYI kapatiyor: once ikisi ayni
 * dosyadaydi ve grup ekranindaki "Gruplarim" baglantisi "/" adresine
 * gidiyordu, orasi da tek grupta gruba GERI yonlendiriyordu. Yani baglanti
 * hicbir sey yapmiyor, tek gruplu kullanici da listeye - dolayisiyla "grup
 * olustur"a - hic ulasamiyordu (Faz 18.7).
 *
 * Liste hala bir VARIS DEGIL, gecis yuzeyi: tek grubu olan buraya ancak
 * kendi isteyerek geliyor.
 */
type Group = { id: string; name: string; description: string | null; role: "OWNER" | "MEMBER" };

export default function GroupsScreen() {
  const { signOut } = useAuth();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const { state, reload } = useApiGet<{ groups: Group[] }>("/api/v1/groups");

  // Yeni grup olusturup geri donuldugunde liste guncel olsun. Ilk odaklanma
  // atlaniyor: mount aninda veri zaten cekiliyor.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  if (state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={s.centered}>
        <Text style={s.error}>{state.text}</Text>
        <Pressable style={s.button} onPress={reload}>
          <Text style={s.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const groups = state.data.groups;

  // Ilk acilis. Bos oldugu icin degil, BASLANGIC oldugu icin nefes aliyor -
  // ve artik yalnizca "grup olustur" DEMIYOR, olusturmayi da sunuyor.
  if (groups.length === 0) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.firstRun}>
          <Text style={s.wordmark}>Owezy</Text>
          <Text style={s.firstRunText}>{t("ui.no_groups")}</Text>
          <View style={s.firstRunForm}>
            <GroupCreator onCreated={reload} />
          </View>
        </View>
        <Pressable style={s.signOut} onPress={() => void signOut()}>
          <Text style={s.signOutText}>{t("ui.sign_out")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <Text style={s.title}>{t("ui.my_groups")}</Text>

      <ScrollView style={s.list}>
        {groups.map((group) => (
          <Link key={group.id} href={`/groups/${group.id}`} asChild>
            <Pressable style={s.row}>
              <View style={s.rowText}>
                <Text style={s.rowName} numberOfLines={1}>
                  {group.name}
                </Text>
                {group.description ? (
                  <Text style={s.rowDescription} numberOfLines={1}>
                    {group.description}
                  </Text>
                ) : null}
              </View>
              <Text style={s.rowRole}>
                {group.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
              </Text>
            </Pressable>
          </Link>
        ))}

        <View style={s.creator}>
          <GroupCreator onCreated={reload} />
        </View>
      </ScrollView>

      <Pressable style={s.signOut} onPress={() => void signOut()}>
        <Text style={s.signOutText}>{t("ui.sign_out")}</Text>
      </Pressable>
    </SafeAreaView>
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
    list: { flex: 1, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    // Her grup bir KART degil bir SATIR (ADR-021).
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
    creator: { paddingTop: 18 },
    firstRun: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    wordmark: { fontSize: 34, fontWeight: "600", color: theme.brand },
    firstRunText: { textAlign: "center", color: theme.muted, maxWidth: 300, lineHeight: 22 },
    firstRunForm: { alignSelf: "stretch", marginTop: 12 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
    signOut: { paddingVertical: 16 },
    signOutText: { color: theme.muted, fontSize: 14 },
  });
}
