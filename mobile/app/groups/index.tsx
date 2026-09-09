import { fonts } from "../../lib/fonts";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../../lib/i18n";
import { useApiGet } from "../../lib/use-api";
import { useTheme, type Theme } from "../../lib/theme";
import { SectionRule } from "../../components/receipt";
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

        {/* Listenin ALTINDA ve bakir bir cizgiyle ayrilmis: bunlar liste
            satiri degil, listeye satir EKLEYEN seyler. */}
        <View style={s.creator}>
          <SectionRule label={t("ui.add_a_group")} />
          <View style={s.creatorForms}>
            <GroupCreator onCreated={reload} />
            <InviteJoiner onJoined={reload} />
          </View>
        </View>
      </ScrollView>

      {/* HESAP VE CIKIS ARTIK BURADA DEGIL - baslik cubugundaki kisi
          simgesinde (components/header-actions.tsx), her ekranda.

          CIKISIN BURADAN KALKMASI BIR KUSURU DA KAPATIYOR: bu dugme
          signOut()'u DOGRUDAN cagiriyordu, yani cihazin push adresini
          silmiyordu (temizlik account.tsx'te). O yoldan cikan birinin
          telefonu, hesabin bildirimlerini almaya devam ederdi. Artik tek
          cikis yolu var ve o yol adresi siliyor. */}
    </SafeAreaView>
  );
}

/**
 * Alt satir. IKI DONUSTE DE ayni: bos hal ve dolu liste.
 *
 * Once iki yere KOPYALANMISTI ve bildirimler eklenirken biri unutulabilirdi -
 * kopyalanan bir satir, zamanla ayrisan bir satirdir.
 *
 * BILDIRIMLER ARTIK BURADA DEGIL: zil baslik cubuguna tasindi
 * (components/notification-bell.tsx). Buradaki baglanti onunla AYNI yere
 * gidiyordu; iki yol birakmak, ikisinden birinin zamanla ayrismasi demekti.
 */

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.background,
    },
    title: { fontSize: 17, fontFamily: fonts.semibold, color: theme.foreground, paddingTop: 8 },
    list: { flex: 1, marginTop: 8 },
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
    rowName: { fontSize: 16, fontFamily: fonts.medium, color: theme.foreground },
    rowDescription: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    rowRole: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    creator: { paddingTop: 28, paddingBottom: 24 },
    creatorForms: { paddingTop: 18, gap: 18 },
    firstRun: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    // Kelime isareti SERIF - giris ekraninda ve web basliginda da oyle.
    wordmark: { fontSize: 40, fontFamily: fonts.heading, color: theme.brand },
    firstRunText: { textAlign: "center", color: theme.muted, maxWidth: 300, lineHeight: 22 },
    firstRunForm: { alignSelf: "stretch", marginTop: 12, gap: 18 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: theme.onBrand, fontFamily: fonts.body, fontSize: 15 },
    footer: { flexDirection: "row", justifyContent: "center", gap: 20 },
    signOut: { paddingVertical: 16 },
    signOutText: { color: theme.muted, fontFamily: fonts.body, fontSize: 14 },
  });
}
