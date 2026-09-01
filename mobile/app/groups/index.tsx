import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../lib/auth";
import { useTranslate, type Translator } from "../../lib/i18n";
import { useApiGet } from "../../lib/use-api";
import { useTheme, type Theme } from "../../lib/theme";
import { GroupCreator } from "../../components/group-creator";
import { InviteJoiner } from "../../components/invite-joiner";

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
  const { signOut } = useSession();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const { state, reload } = useApiGet<{ groups: Group[] }>("/api/v1/groups");
  // Sayac listeyle AYNI cevapta geliyor; limit=1 bir kayit indirmenin
  // bedeliyle sayiyi veriyor (notifications/route.ts).
  const unread = useApiGet<{ unreadCount: number }>("/api/v1/notifications?limit=1");
  const unreadCount = unread.state.kind === "ok" ? unread.state.data.unreadCount : 0;

  // Yeni grup olusturup geri donuldugunde liste guncel olsun. Ilk odaklanma
  // atlaniyor: mount aninda veri zaten cekiliyor.
  const firstFocus = useRef(true);
  // Kancanin bagimliligi olarak nesnenin KENDISI degil, uzerindeki KARARLI
  // fonksiyon aliniyor: "unread" her cizimde yeni bir nesne, efekt bosuna
  // yeniden kurulurdu.
  const reloadUnread = unread.reload;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
      reloadUnread();
    }, [reload, reloadUnread]),
  );

  if (state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
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
      <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
        <View style={s.firstRun}>
          <Text style={s.wordmark}>Owezy</Text>
          <Text style={s.firstRunText}>{t("ui.no_groups")}</Text>
          {/* IKI YOL, ESIT AGIRLIKTA. Davet edilen kisi giristen sonra tam
              buraya dusuyor: katilma yolu burada olmasaydi uygulamayi
              kurmasinin sebebi olan isi yapamazdi. */}
          <View style={s.firstRunForm}>
            <GroupCreator onCreated={reload} />
            <InviteJoiner onJoined={reload} />
          </View>
        </View>
        <Footer styles={s} t={t} unreadCount={unreadCount} onSignOut={signOut} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>

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
          <InviteJoiner onJoined={reload} />
        </View>
      </ScrollView>

      {/* HESAP EKRANINA KAPI. Cikis burada KALIYOR: en sik yapilan islemi
          bir dokunus derine gommemek icin. Hesap silme icerideki ekranda
          (App Store Guideline 5.1.1(v) uygulama ici silmeyi zorunlu tutuyor). */}
      <Footer styles={s} t={t} unreadCount={unreadCount} onSignOut={signOut} />
    </SafeAreaView>
  );
}

/**
 * Alt satir. IKI DONUSTE DE ayni: bos hal ve dolu liste.
 *
 * Once iki yere KOPYALANMISTI ve bildirimler eklenirken biri unutulabilirdi -
 * kopyalanan bir satir, zamanla ayrisan bir satirdir.
 *
 * Bildirimler HESAP DUZEYINDE bir sey, o yuzden gruplarin degil bu satirin
 * yaninda duruyor. Okunmamis sayisi varsa yazi ile birlikte yaziliyor;
 * yoksa hic - sifir gostermek olmayan bir isi varmis gibi gosterirdi.
 */
function Footer({
  styles: s,
  t,
  unreadCount,
  onSignOut,
}: {
  styles: ReturnType<typeof createStyles>;
  t: Translator;
  unreadCount: number;
  onSignOut: () => Promise<void> | void;
}) {
  return (
    <View style={s.footer}>
      <Link href="/notifications" asChild>
        <Pressable style={s.signOut}>
          <Text style={s.signOutText}>
            {unreadCount > 0
              ? `${t("ui.notifications")} · ${unreadCount > 9 ? "9+" : unreadCount}`
              : t("ui.notifications")}
          </Text>
        </Pressable>
      </Link>
      <Link href="/account" asChild>
        <Pressable style={s.signOut}>
          <Text style={s.signOutText}>{t("ui.account")}</Text>
        </Pressable>
      </Link>
      <Pressable style={s.signOut} onPress={() => void onSignOut()}>
        <Text style={s.signOutText}>{t("ui.sign_out")}</Text>
      </Pressable>
    </View>
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
    creator: { paddingTop: 18, gap: 18 },
    firstRun: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    wordmark: { fontSize: 34, fontWeight: "600", color: theme.brand },
    firstRunText: { textAlign: "center", color: theme.muted, maxWidth: 300, lineHeight: 22 },
    firstRunForm: { alignSelf: "stretch", marginTop: 12, gap: 18 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
    footer: { flexDirection: "row", justifyContent: "center", gap: 20 },
    signOut: { paddingVertical: 16 },
    signOutText: { color: theme.muted, fontSize: 14 },
  });
}
