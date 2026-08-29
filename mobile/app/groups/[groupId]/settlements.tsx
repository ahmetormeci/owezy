import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { formatDate } from "@/lib/dates";
import { formatMoney, formatMoneyForInput, parseMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { Cap } from "../../../components/receipt";

/**
 * Odeme kaydetme ve kaydedilmis odemeler.
 *
 * KAYDETME ILE GECMIS AYNI EKRANDA. Ayirmak daha kucuk bir adim olurdu ama o
 * zaman bir odeme kaydedip yanlis oldugunu fark eden kullanici onu goremez ve
 * iptal edemezdi - bu fazda iki kez duzeltilen tuzagin aynisi.
 *
 * YON SECIMI ARAYUZDE, ve bu yalnizca kolaylik degil: "odemeyi ancak
 * taraflardan biri kaydedebilir" kuralini arayuze tasiyor. Karsi taraf kim
 * olursa olsun taraflardan biri HEP SEN oluyorsun, yani gecersiz bir istek
 * olusturmak mumkun degil.
 *
 * TARIH BUGUNE SABIT. Tarih secici yeni bir bagimlilik demekti; harcama
 * bestecisiyle ayni gerekce. Bilinen eksik.
 *
 * DUZENLEME YOK - API'de de yok, yalnizca iptal var.
 */
type Member = { userId: string; displayName: string };
type Settlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note: string | null;
  settledAt: string;
  cancelledAt: string | null;
};

type MembersResponse = { members: Member[] };
type MeResponse = { user: { id: string } };
type BalancesResponse = { currency: string };
type SettlementsResponse = { settlements: Settlement[]; nextCursor: string | null };

export default function SettlementsScreen() {
  const { groupId, to, from, amount: prefillAmount } = useLocalSearchParams<{
    groupId: string;
    to?: string;
    from?: string;
    amount?: string;
  }>();
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { post, get } = useApiClient();

  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );
  const me = useApiGet<MeResponse>("/api/v1/me");
  const balances = useApiGet<BalancesResponse>(
    groupId ? `/api/v1/groups/${groupId}/balances` : null,
  );
  const history = useApiGet<SettlementsResponse>(
    groupId ? `/api/v1/groups/${groupId}/settlements` : null,
  );

  const currentUserId = me.state.kind === "ok" ? me.state.data.user.id : null;

  // Fisteki bir oneriye dokunularak gelindiyse yon, karsi taraf ve tutar
  // onceden dolu geliyor.
  //
  // YONU PARAMETRENIN ADI TASIYOR ("to" = ben odeyecegim, "from" = bana
  // odenecek), currentUserId ile KARSILASTIRMA YAPILMIYOR. Once oyle
  // yaziliydi ve yanlisti: useState'in baslangic ifadesi YALNIZCA ILK
  // RENDER'DA calisiyor, o sirada /api/v1/me henuz donmemis oluyor ve
  // currentUserId null. Sonuc: "sana odenecek" onerisine dokununca ekran
  // "ben odedim" diye aciliyor ve karsi taraf hic secilmemis geliyordu.
  const [direction, setDirection] = useState<"outgoing" | "incoming">(
    from ? "incoming" : "outgoing",
  );
  const [counterpartyId, setCounterpartyId] = useState<string>(to ?? from ?? "");
  const [amountText, setAmountText] = useState(
    prefillAmount ? formatMoneyForInput(Number(prefillAmount), locale) : "",
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<Settlement[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);

  const memberList = members.state.kind === "ok" ? members.state.data.members : [];
  const counterparties = memberList.filter((member) => member.userId !== currentUserId);
  const nameByUserId: Record<string, string> = {};
  for (const member of memberList) nameByUserId[member.userId] = member.displayName;

  const currency = balances.state.kind === "ok" ? balances.state.data.currency : "TRY";

  const loaded = history.state.kind === "ok" ? history.state.data : null;
  const settlements = [...(loaded?.settlements ?? []), ...extra];
  const nextCursor = cursor === undefined ? (loaded?.nextCursor ?? null) : cursor;

  const loadMore = useCallback(async () => {
    if (!nextCursor || busy) return;
    setBusy(true);
    try {
      const result = await get<SettlementsResponse>(
        `/api/v1/groups/${groupId}/settlements?cursor=${nextCursor}`,
      );
      if (result.ok) {
        setExtra((current) => [...current, ...result.data.settlements]);
        setCursor(result.data.nextCursor);
      }
    } finally {
      setBusy(false);
    }
  }, [nextCursor, busy, get, groupId]);

  async function save() {
    if (busy || !currentUserId) return;
    setError(null);

    if (!counterpartyId) {
      setError(t("ui.settlement_counterparty_required"));
      return;
    }
    const amount = parseMoney(amountText);
    if (amount === null || amount <= 0) {
      setError(t("ui.amount_required"));
      return;
    }

    setBusy(true);
    try {
      const result = await post(`/api/v1/groups/${groupId}/settlements`, {
        fromUserId: direction === "outgoing" ? currentUserId : counterpartyId,
        toUserId: direction === "outgoing" ? counterpartyId : currentUserId,
        amount,
        note: note.trim() || undefined,
        settledAt: new Date().toISOString().slice(0, 10),
      });
      if (!result.ok) {
        setError(t(result.code));
        return;
      }
      router.back();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel(settlement: Settlement) {
    Alert.alert(t("ui.cancel_settlement_question"), t("ui.cancel_settlement_hint"), [
      { text: t("ui.cancel"), style: "cancel" },
      {
        text: t("ui.cancel_settlement"),
        style: "destructive",
        onPress: () => void doCancel(settlement),
      },
    ]);
  }

  async function doCancel(settlement: Settlement) {
    setBusy(true);
    setError(null);
    try {
      const result = await post(
        `/api/v1/groups/${groupId}/settlements/${settlement.id}/cancel`,
        {},
      );
      if (!result.ok) {
        setError(t(result.code));
        return;
      }
      router.back();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (members.state.kind === "loading" || me.state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.paper}>
            <Cap>{t("ui.record_settlement")}</Cap>
            <Text style={s.hint}>{t("ui.settlement_hint")}</Text>

            <Cap>{t("ui.settlement_direction")}</Cap>
            <View style={s.chips}>
              {(["outgoing", "incoming"] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setDirection(value)}
                  style={[s.chip, direction === value && s.chipActive]}
                  disabled={busy}
                >
                  <Text style={[s.chipText, direction === value && s.chipTextActive]}>
                    {value === "outgoing" ? t("ui.i_paid") : t("ui.paid_to_me")}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Cap>{t("ui.settlement_counterparty")}</Cap>
            <View style={s.chips}>
              {counterparties.map((member) => (
                <Pressable
                  key={member.userId}
                  onPress={() => setCounterpartyId(member.userId)}
                  style={[s.chip, member.userId === counterpartyId && s.chipActive]}
                  disabled={busy}
                >
                  <Text
                    style={[
                      s.chipText,
                      member.userId === counterpartyId && s.chipTextActive,
                    ]}
                  >
                    {member.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Cap>{t("ui.amount")}</Cap>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.muted}
              editable={!busy}
              style={s.input}
            />

            <Cap>{t("ui.settlement_note")}</Cap>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t("ui.settlement_note_placeholder")}
              placeholderTextColor={theme.muted}
              maxLength={500}
              editable={!busy}
              style={s.input}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={s.save} onPress={() => void save()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Cap tone="onBrand">{t("ui.save")}</Cap>
              )}
            </Pressable>
          </View>

          <View style={s.paper}>
            {history.state.kind === "loading" ? (
              <ActivityIndicator style={s.loading} />
            ) : settlements.length === 0 ? (
              <Text style={s.hint}>{t("ui.no_settlements")}</Text>
            ) : (
              <>
                {settlements.map((settlement) => (
                  <Pressable
                    key={settlement.id}
                    style={s.row}
                    onPress={() => confirmCancel(settlement)}
                    disabled={busy || settlement.cancelledAt !== null}
                  >
                    <View style={s.rowText}>
                      <Text style={s.rowNames} numberOfLines={1}>
                        {`${nameByUserId[settlement.fromUserId] ?? t("ui.unknown_user")} → ${
                          nameByUserId[settlement.toUserId] ?? t("ui.unknown_user")
                        }`}
                      </Text>
                      <Text style={s.rowMeta} numberOfLines={1}>
                        {formatDate(new Date(settlement.settledAt), locale)}
                        {settlement.note ? ` · ${settlement.note}` : ""}
                      </Text>
                    </View>
                    <Text
                      style={[s.rowAmount, settlement.cancelledAt !== null && s.cancelled]}
                    >
                      {formatMoney(settlement.amount, currency, locale)}
                    </Text>
                  </Pressable>
                ))}

                {/* Sessizce kesmiyoruz: daha fazlasi varsa soyluyoruz. */}
                {nextCursor ? (
                  <Pressable onPress={() => void loadMore()} disabled={busy}>
                    <Text style={s.loadMore}>{t("ui.load_more")}</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <Pressable onPress={() => router.back()} style={s.backRow}>
            <Text style={s.back}>{t("ui.cancel")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.surface },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 32, gap: 16 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
    },
    paper: {
      backgroundColor: theme.paper,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 10,
    },
    hint: { fontSize: 12, color: theme.muted, lineHeight: 18 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brand },
    chipText: { fontSize: 14, color: theme.foreground },
    chipTextActive: { color: "#fff" },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.foreground,
    },
    save: {
      marginTop: 4,
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingVertical: 11,
      alignItems: "center",
    },
    loading: { paddingVertical: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    rowText: { flexShrink: 1 },
    rowNames: { fontSize: 14, color: theme.foreground },
    rowMeta: { marginTop: 2, fontSize: 11, color: theme.muted },
    rowAmount: { fontSize: 14, color: theme.foreground, fontVariant: ["tabular-nums"] },
    cancelled: { textDecorationLine: "line-through", color: theme.muted },
    loadMore: { color: theme.brand, fontSize: 13, paddingVertical: 8 },
    error: { fontSize: 13, color: theme.debt },
    backRow: { paddingVertical: 4 },
    back: { color: theme.muted, fontSize: 14 },
  });
}
