import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslate } from "../lib/i18n";
import { inviteTokenFrom } from "../lib/invite-link";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Davetle gruba katilma - SATIR ICI, GroupCreator'in tam esi.
 *
 * NEDEN AYNI SEKIL: gruplar ekraninda kullanicinin onunde iki yol var - kendi
 * grubunu kurmak ya da birinin grubuna katilmak. Ikisi ayni agirlikta oldugu
 * icin ayni bicimde duruyorlar; biri satir ici bir alan, oteki ayri bir ekran
 * olsaydi bu esitlik bozulurdu.
 *
 * BILESEN IKI YERDE de kullaniliyor ve ASIL OLANI ILK ACILIS EKRANI: davet
 * edilen kisinin girdikten sonra gordugu ilk sey "hic grubun yok" ekrani.
 * Katilma yolu orada YOKSA, uygulamayi kurmasinin sebebi olan isi yapamiyor
 * demektir.
 *
 * BAGLANTIYI ACMAK DEGIL, YAPISTIRMAK. Universal link (owezy.net/join/<kod>
 * adresinin uygulamada acilmasi) uc sey birden istiyor ve biri Expo Go'da
 * denenemiyor - gerekce lib/invite-link.ts'de. O geldiginde burasi degismez;
 * derin baglanti yalnizca alani onceden doldurur.
 */
export function InviteJoiner({ onJoined }: { onJoined: () => void }) {
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);
  const router = useRouter();
  const { post } = useApiClient();

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setError(null);

    const token = inviteTokenFrom(value);
    if (!token) {
      setError(t("ui.invite_unusable"));
      return;
    }

    setBusy(true);
    try {
      const result = await post<{ membership: { groupId: string } }>(
        "/api/v1/invites/accept",
        { token },
      );

      if (!result.ok) {
        // Sunucunun kodu ("invite.expired", "group.already_member", ...)
        // dogrudan cevrilip gosteriliyor: "katilinamadi" demek, SEBEBI
        // bilinirken sebebi saklamak olurdu.
        setError(t(result.code));
        return;
      }

      setValue("");
      onJoined();
      // Katilinan grubun ICINE giriliyor - GroupCreator da kurulan gruba
      // giriyor. Listede birakmak, kullanicidan bir dokunus daha isterdi.
      router.push(`/groups/${result.data.membership.groupId}`);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.block}>
      <View style={s.row}>
        <Text style={s.glyph}>→</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={t("ui.invite_link_placeholder")}
          placeholderTextColor={theme.muted}
          editable={!busy}
          // Adres yapistiriliyor: bas harfi buyutmek ve otomatik duzeltme
          // KODU BOZAR. Klavye de adres duzenine geciyor.
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={s.input}
        />
        {value.trim() ? (
          <Pressable style={s.button} onPress={() => void submit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Cap tone="onBrand">{t("ui.join_group")}</Cap>
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    block: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.foreground,
      paddingBottom: 6,
    },
    glyph: { color: theme.muted, fontSize: 15 },
    input: { flex: 1, fontSize: 15, color: theme.foreground, padding: 0 },
    button: { backgroundColor: theme.brand, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 7 },
    error: { fontSize: 12, color: theme.debt },
  });
}
