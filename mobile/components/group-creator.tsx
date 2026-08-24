import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslate } from "../lib/i18n";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Grup olusturma - SATIR ICI, ayri bir form ekrani degil.
 *
 * Harcama bestecisiyle ayni mantik: en yaygin durumu tek adimda yap. Ilk
 * acilis ekraninda da listede de AYNI bilesen duruyor; ilk defa uygulamayi
 * acan biri "grup olustur" yazisini okuyup dogrudan yazmaya baslayabiliyor.
 *
 * ACIKLAMA ALANI YOK. Web'de de istege bagli ve grup kurulurken nadiren
 * yaziliyor. Mobilde grup DUZENLEME de olmadigi icin bugun aciklama hic
 * girilemiyor - bilinen eksik olarak yazildi.
 */
export function GroupCreator({ onCreated }: { onCreated: () => void }) {
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);
  const router = useRouter();
  const { post } = useApiClient();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setError(null);

    if (!name.trim()) {
      setError(t("validation.group_name_required"));
      return;
    }

    setBusy(true);
    try {
      const result = await post<{ group: { id: string } }>("/api/v1/groups", {
        name: name.trim(),
      });

      if (!result.ok) {
        setError(t(result.code));
        return;
      }

      setName("");
      onCreated();
      // Yeni grubun ICINE giriyoruz: grubu kuran kisi siradaki adimda
      // harcama ekleyecek, listede birakmak bir tik fazla olurdu.
      router.push(`/groups/${result.data.group.id}`);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.block}>
      <View style={s.row}>
        <Text style={s.plus}>+</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("ui.group_name_placeholder")}
          placeholderTextColor={theme.muted}
          maxLength={100}
          editable={!busy}
          style={s.input}
        />
        {name.trim() ? (
          <Pressable style={s.button} onPress={() => void submit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Cap tone="onBrand">{t("ui.create")}</Cap>
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
    plus: { color: theme.muted, fontSize: 15 },
    input: { flex: 1, fontSize: 15, color: theme.foreground, padding: 0 },
    button: { backgroundColor: theme.brand, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 7 },
    error: { fontSize: 12, color: theme.debt },
  });
}
