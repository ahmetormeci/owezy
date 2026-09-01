import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateGroupSchema } from "@/lib/group-schemas";
import { useTranslate } from "../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { Cap } from "../../../components/receipt";

/**
 * Grup adi ve aciklamasini duzenleme. MOBILDE YOKTU - web'de fisin USTUNDE
 * duran "Grubu duzenle" penceresinin karsiligi.
 *
 * AYRI EKRAN, satir ici degil: iki alan var (ad ve aciklama) ve aciklama cok
 * satirli. Grup olusturmadaki tek satirlik bicim burada yetmiyordu.
 *
 * FISIN DISINDA. Web'de bu kural acikca yazili: "Eylemler fisin DISINDA;
 * kagidin uzerine buton koymak, basili bir belgeye tiklanabilir bir sey
 * eklemek gibi durur." Mobilde de giris kapisi fisin altindaki kartlarda.
 *
 * SEMA PAYLASILIYOR (@/lib/group-schemas). Dogrulama kurali sunucuyla AYNI
 * yerden geliyor ve mesaj alanlarinda metin degil KOD var - sunucu dil
 * bilmiyor, ceviriyi gosteren taraf yapiyor.
 */
type GroupResponse = {
  group: { id: string; name: string; description: string | null; role: "OWNER" | "MEMBER" };
};

export default function EditGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { patch } = useApiClient();

  const group = useApiGet<GroupResponse>(groupId ? `/api/v1/groups/${groupId}` : null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Alanlar veri gelince dolduruluyor - EFEKT ICINDE DEGIL, CIZIM SIRASINDA.
   *
   * React'in "prop degisince state'i ayarla" deseni bu ve projede zaten
   * kullaniliyor (web'de expense-list.tsx, serverExpenses karsilastirmasi).
   * Efektle yapmak lint'in set-state-in-effect kuralina takiliyordu ve kural
   * hakli: efekt once bos formu cizer, sonra ikinci bir cizimle doldururdu.
   *
   * KARSILASTIRMA KIMLIGE gore: yalnizca sunucudan YENI bir cevap geldiginde
   * doluyor. Kullanici yazarken her cizimde ezilmesi bu yuzden olmuyor.
   */
  const loadedGroup = group.state.kind === "ok" ? group.state.data.group : null;
  const [source, setSource] = useState(loadedGroup);
  if (loadedGroup && loadedGroup !== source) {
    setSource(loadedGroup);
    setName(loadedGroup.name);
    setDescription(loadedGroup.description ?? "");
  }

  async function submit() {
    if (busy) return;
    setError(null);

    // Aciklama BOSSA gonderilmiyor: sema onu optional tutuyor ve bos dize
    // gondermek "aciklamayi bos dizeye ayarla" demek olurdu.
    const parsed = updateGroupSchema.safeParse({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "validation.invalid"));
      return;
    }

    setBusy(true);
    const result = await patch(`/api/v1/groups/${groupId}`, parsed.data);
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code));
      return;
    }

    // Geri donuyoruz; grup ekrani odaklanınca kendini tazeliyor ve yeni ad
    // hem baslikta hem fisin ustunde gorunuyor.
    router.back();
  }

  if (group.state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <ActivityIndicator color={theme.brand} />
      </SafeAreaView>
    );
  }

  if (group.state.kind === "error") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <Text style={s.error}>{group.state.text}</Text>
        <Pressable style={s.button} onPress={group.reload}>
          <Text style={s.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /**
   * YALNIZCA SAHIP DUZENLEYEBILIR ve kontrol SUNUCUDA (groups.ts, owner_only).
   * Buradaki kontrol ekranin bos yere acilmasini onluyor: kullaniciya
   * yapamayacagi bir formu doldurtup sonunda reddetmek, en bastan
   * soylememekten kotu.
   */
  if (group.state.data.group.role !== "OWNER") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <Text style={s.error}>{t("group.owner_only")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.hint}>{t("ui.edit_group_hint")}</Text>

          <View style={s.field}>
            <Cap>{t("ui.group_name")}</Cap>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder={t("ui.group_name_placeholder")}
              placeholderTextColor={theme.muted}
              maxLength={100}
              editable={!busy}
            />
          </View>

          <View style={s.field}>
            <Cap>{t("ui.group_description")}</Cap>
            <TextInput
              style={[s.input, s.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("ui.group_description_placeholder")}
              placeholderTextColor={theme.muted}
              maxLength={500}
              editable={!busy}
              multiline
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={s.button} onPress={() => void submit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>{t("ui.save")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.paper },
    flex: { flex: 1 },
    content: { padding: 20, gap: 20 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
      backgroundColor: theme.paper,
    },
    hint: { fontSize: 13, lineHeight: 19, color: theme.muted },
    field: { gap: 6 },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: theme.foreground,
      fontSize: 16,
      color: theme.foreground,
      paddingVertical: 8,
    },
    multiline: { minHeight: 72, textAlignVertical: "top" },
    error: { color: theme.debt, fontSize: 14, textAlign: "center" },
    button: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
