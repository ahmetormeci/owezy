import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../../../lib/i18n";
import { apiBaseUrl } from "../../../lib/api";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { Cap } from "../../../components/receipt";

/**
 * Uyeler ve davet.
 *
 * DAVETI KABUL ETMEK ARTIK MOBILDE VAR - gruplar ekraninda, baglantiyi
 * yapistirarak (components/invite-joiner.tsx). Buradaki eski gerekce
 * "onaylanmis Apple hesabi bekleniyor" diyordu; hesap onaylandi ama
 * universal link'in kendisi hala uc sey birden istiyor ve biri Expo Go'da
 * denenemiyor - ayrintisi lib/invite-link.ts'de. Baglanti uygulamada
 * ACILMIYOR, ama gonderilen kisi onu uygulamaya YAPISTIRABILIYOR.
 *
 * KAPSAM DISI (bilincli): daveti iptal etme, uye cikarma, sahiplik devri.
 */
type MembersResponse = {
  members: { userId: string; displayName: string; role: "OWNER" | "MEMBER" }[];
};
type InviteResponse = { invite: { token: string } };

export default function MembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { post } = useApiClient();

  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );

  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post<InviteResponse>(`/api/v1/groups/${groupId}/invites`, {});
      if (!result.ok) {
        setError(t(result.code));
        return;
      }

      // Ham kod sunucudan YALNIZCA BIR KEZ donuyor; veritabaninda yalnizca
      // sifrelenmis ozeti duruyor. Ekranda tutup paylasima veriyoruz.
      const url = `${apiBaseUrl()}/join/${result.data.invite.token}`;
      setLink(url);
      await Share.share({ message: url });
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.paper}>
          {members.state.kind === "loading" ? (
            <ActivityIndicator style={s.loading} />
          ) : members.state.kind === "error" ? (
            <Text style={s.error}>{members.state.text}</Text>
          ) : (
            <View style={s.list}>
              {members.state.data.members.map((member) => (
                <View key={member.userId} style={s.row}>
                  <Text style={s.name}>{member.displayName}</Text>
                  <Text style={s.role}>
                    {member.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Pressable style={s.invite} onPress={() => void createInvite()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Cap tone="onBrand">{t("ui.create_invite")}</Cap>
            )}
          </Pressable>

          {link ? (
            <View style={s.linkBlock}>
              <Cap>{t("ui.invite_ready")}</Cap>
              {/* Link EKRANDA da duruyor: paylasim sayfasi kapatilirsa kod
                  kaybolmasin. Bir daha uretilemez. */}
              <Text selectable style={s.link}>
                {link}
              </Text>
              <Text style={s.warning}>{t("ui.invite_once_warning")}</Text>
              {/* Ayri bir anahtar: bu dugme YENI davet uretmiyor, mevcut
                  baglantiyi tekrar paylasiyor. Ustteki dugmeyle ayni adi
                  tasimasi iki farkli isi ayni isimle cagirmak olurdu. */}
              <Pressable onPress={() => void Share.share({ message: link })}>
                <Text style={s.shareAgain}>{t("ui.share_link")}</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.surface },
    scroll: { padding: 16, paddingBottom: 32 },
    paper: {
      backgroundColor: theme.paper,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 14,
    },
    loading: { paddingVertical: 16 },
    list: { gap: 2 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    name: { fontSize: 15, color: theme.foreground },
    role: { fontSize: 12, color: theme.muted },
    invite: {
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingVertical: 11,
      alignItems: "center",
    },
    linkBlock: {
      gap: 8,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 14,
    },
    link: { fontSize: 12, color: theme.foreground, fontFamily: "Menlo" },
    warning: { fontSize: 11, color: theme.muted, lineHeight: 16 },
    shareAgain: { fontSize: 13, color: theme.brand, paddingTop: 4 },
    error: { fontSize: 13, color: theme.debt },
    back: { color: theme.muted, fontSize: 14 },
  });
}
