import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
import { formatMoney, parseMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../../lib/use-api";
import { useTheme, type Theme } from "../../../../lib/theme";
import { Cap } from "../../../../components/receipt";

/**
 * Harcama ekleme ekrani. MOBILDE BOYLE BIR EKRAN YOKTU.
 *
 * Bugune kadar mobilde harcama yalnizca fisin altindaki tek satirlik hizli
 * ekleyiciyle giriliyordu ve o satir UC VARSAYIM yapiyor: esit bolusum,
 * odeyen sensin, tarih bugun. Varsayimlar dogru oldugunda mukemmel; ama
 * baskasi odediginde ya da pay esit olmadiginda mobilde YAPILACAK BIR SEY
 * YOKTU - kullanici web'e gitmek zorundaydi.
 *
 * HIZLI EKLEYICI KALIYOR. Bu ekran onun yerine gecmiyor: en sik yapilan is
 * hala tek satirda bitiyor, bu ekran o satirin yetmedigi durum icin. Web'de
 * de ayni ayrim var.
 *
 * SUNUCU SOZLESMESI (src/lib/expense-schemas.ts) UC AYRI GOVDE bekliyor ve
 * ayrim splitType'ta:
 *     EQUAL      -> participantUserIds: string[]
 *     EXACT      -> shares: { userId, amount }[]
 *     PERCENTAGE -> shares: { userId, basisPoints }[]
 * Yani "katilimcilar" ile "paylar" ayni sey degil; EQUAL'da kimlik listesi,
 * digerlerinde deger tasiyan satirlar gonderiliyor.
 *
 * currency GONDERILMIYOR - degistirilemez kural. Sunucu her zaman grubun
 * para birimini kullaniyor.
 */
type Member = { userId: string; displayName: string };
type MembersResponse = { members: Member[] };
type MeResponse = { user: { id: string } };
type GroupResponse = { group: { id: string; name: string; currency: string } };

type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";

export default function NewExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { post } = useApiClient();

  const group = useApiGet<GroupResponse>(groupId ? `/api/v1/groups/${groupId}` : null);
  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );
  const me = useApiGet<MeResponse>("/api/v1/me");

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidById, setPaidById] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  /** EQUAL icin: kimler paylasiyor. */
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  /** EXACT ve PERCENTAGE icin: kisi basina girilen ham metin. */
  const [shareText, setShareText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberList = members.state.kind === "ok" ? members.state.data.members : [];
  const currency = group.state.kind === "ok" ? group.state.data.group.currency : "TRY";
  const currentUserId = me.state.kind === "ok" ? me.state.data.user.id : null;

  // Odeyen varsayilani BEN, cunku en sik durum bu. Kullanici degistirebiliyor -
  // hizli ekleyicide degistiremiyordu ve bu ekranin varlik sebeplerinden biri o.
  const payer = paidById ?? currentUserId;
  const amount = parseMoney(amountText);

  // Hicbir kutu isaretlenmemisken HERKES paylasiyor sayiliyor: bos bir liste
  // gondermek yerine en yaygin niyeti varsayiyoruz. Kullanici birini
  // cikardigi anda secim onun olur.
  const touchedSelection = Object.values(selected).some((value) => value);
  const participants = touchedSelection
    ? memberList.filter((member) => selected[member.userId])
    : memberList;

  /** EXACT/PERCENTAGE'da girilenlerin toplami - kullanici ne kadari dagitti. */
  const shareTotal = memberList.reduce((sum, member) => {
    const raw = shareText[member.userId] ?? "";
    if (raw.trim() === "") return sum;
    if (splitType === "EXACT") return sum + (parseMoney(raw) ?? 0);
    // Yuzde: "25,5" -> 2550 basis point. Tam sayi aritmetigi, float degil.
    const points = parseMoney(raw);
    return sum + (points ?? 0);
  }, 0);

  const target = splitType === "EXACT" ? (amount ?? 0) : 10_000;
  const remainder = target - shareTotal;

  async function submit() {
    if (busy) return;
    setError(null);

    if (description.trim() === "") {
      setError(t("ui.description_required"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t(amountText.trim() === "" ? "ui.amount_required" : "ui.amount_unreadable"));
      return;
    }
    if (!payer) {
      setError(t("server.unexpected"));
      return;
    }

    let body: Record<string, unknown>;
    if (splitType === "EQUAL") {
      if (participants.length === 0) {
        setError(t("ui.participant_required"));
        return;
      }
      body = { participantUserIds: participants.map((member) => member.userId) };
    } else {
      // Yalnizca DOLU satirlar gonderiliyor: bos birakilan biri bolusume
      // katilmiyor demektir, sifir yazmasi gerekmesin.
      const shares = memberList
        .map((member) => ({ member, raw: (shareText[member.userId] ?? "").trim() }))
        .filter((row) => row.raw !== "")
        .map((row) => ({ userId: row.member.userId, value: parseMoney(row.raw) }));

      if (shares.length === 0 || shares.some((row) => row.value === null)) {
        setError(
          t(splitType === "EXACT" ? "ui.each_amount_required" : "ui.each_percentage_required"),
        );
        return;
      }
      body =
        splitType === "EXACT"
          ? { shares: shares.map((row) => ({ userId: row.userId, amount: row.value })) }
          : { shares: shares.map((row) => ({ userId: row.userId, basisPoints: row.value })) };
    }

    setBusy(true);
    const result = await post(`/api/v1/groups/${groupId}/expenses`, {
      description: description.trim(),
      amount,
      paidById: payer,
      splitType,
      ...body,
    });
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code));
      return;
    }
    // Geri donuldugunde fis kendini tazeliyor (useFocusEffect, grup ekrani).
    router.back();
  }

  if (members.state.kind === "loading" || group.state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <ActivityIndicator color={theme.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: t("ui.add_expense") }} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Cap>{t("ui.description")}</Cap>
            <TextInput
              testID="description"
              style={s.input}
              value={description}
              onChangeText={setDescription}
              placeholder={t("ui.description_placeholder")}
              placeholderTextColor={theme.muted}
              editable={!busy}
            />

            <Cap>{t("ui.amount")}</Cap>
            <TextInput
              testID="amount"
              style={s.input}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder={t("ui.amount_placeholder")}
              placeholderTextColor={theme.muted}
              editable={!busy}
            />
          </View>

          {/* ODEYEN. Hizli ekleyicide degistirilemiyordu; baskasinin odedigi
              her harcama mobilde girilemez demekti. */}
          <View style={s.card}>
            <Cap>{t("ui.payer")}</Cap>
            <View style={s.chips}>
              {memberList.map((member) => {
                const active = member.userId === payer;
                return (
                  <Pressable
                    key={member.userId}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setPaidById(member.userId)}
                    disabled={busy}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                      {member.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.card}>
            <Cap>{t("ui.how_to_split")}</Cap>
            <View style={s.chips}>
              {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((type) => {
                const active = splitType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setSplitType(type)}
                    disabled={busy}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {t(
                        type === "EQUAL"
                          ? "ui.split_equal"
                          : type === "EXACT"
                            ? "ui.split_exact"
                            : "ui.split_percentage",
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {splitType === "EQUAL" ? (
              <View style={s.rows}>
                <Cap>{t("ui.participants")}</Cap>
                {memberList.map((member) => {
                  const on = touchedSelection ? !!selected[member.userId] : true;
                  return (
                    <Pressable
                      key={member.userId}
                      style={s.checkRow}
                      onPress={() =>
                        setSelected((current) => {
                          // Ilk dokunusta "herkes" varsayimindan gercek bir
                          // secime geciyoruz; yoksa tek kisiyi kapatmak
                          // listeyi bosaltirdi.
                          const base = touchedSelection
                            ? current
                            : Object.fromEntries(memberList.map((m) => [m.userId, true]));
                          return { ...base, [member.userId]: !base[member.userId] };
                        })
                      }
                      disabled={busy}
                    >
                      <View style={[s.box, on && s.boxOn]}>
                        {on ? <Text style={s.tick}>✓</Text> : null}
                      </View>
                      <Text style={s.rowName} numberOfLines={1}>
                        {member.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={s.rows}>
                {memberList.map((member) => (
                  <View key={member.userId} style={s.shareRow}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {member.displayName}
                    </Text>
                    <TextInput
                      style={s.shareInput}
                      value={shareText[member.userId] ?? ""}
                      onChangeText={(value) =>
                        setShareText((current) => ({ ...current, [member.userId]: value }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={splitType === "EXACT" ? "0,00" : "0"}
                      placeholderTextColor={theme.muted}
                      editable={!busy}
                    />
                  </View>
                ))}
                {/* KALAN, canli. Web'de de var: kullanici tutari dagitirken
                    ne kadarinin acikta oldugunu gormeli, kaydete basip
                    hatayla karsilasmamali. */}
                <Text style={[s.remainder, remainder !== 0 && { color: theme.debt }]}>
                  {splitType === "EXACT"
                    ? formatMoney(remainder, currency, locale)
                    : `%${(remainder / 100).toLocaleString(locale)}`}
                </Text>
              </View>
            )}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            testID="save"
            style={s.primary}
            onPress={() => void submit()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryText}>{t("ui.save_expense")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: theme.surface },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface },
    scroll: { padding: 16, gap: 12, paddingBottom: 40 },
    card: { backgroundColor: theme.paper, borderRadius: 10, padding: 16, gap: 10 },
    input: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      color: theme.foreground,
      fontSize: 16,
      paddingVertical: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      maxWidth: "100%",
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.foreground, fontSize: 14 },
    chipTextActive: { color: "#fff", fontWeight: "600" },
    rows: { gap: 10, marginTop: 4 },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    boxOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    tick: { color: "#fff", fontSize: 14, fontWeight: "700" },
    rowName: { flex: 1, color: theme.foreground, fontSize: 15 },
    shareRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    shareInput: {
      width: 110,
      textAlign: "right",
      borderBottomWidth: 1,
      borderColor: theme.border,
      color: theme.foreground,
      fontSize: 16,
      paddingVertical: 6,
    },
    remainder: { textAlign: "right", color: theme.muted, fontSize: 13, marginTop: 2 },
    primary: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 4,
    },
    primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    error: { color: theme.debt, fontSize: 14 },
  });
}
