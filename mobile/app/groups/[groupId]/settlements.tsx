import { fonts } from "../../../lib/fonts";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
import { SectionRule } from "../../../components/receipt";
import { Field, SelectField } from "../../../components/field";

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
        setError(t(result.code, result.params));
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
        setError(t(result.code, result.params));
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
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
      {/* Harcama ekleme ve harcama detayiyla AYNI cubuk. Ucu de "bir kayit
          yaz/duzenle" ekrani; farkli baslik duzenleri uc ayri urun gibi
          gosterirdi. Baslik FIIL ("Odes"), ekranin adi degil - buraya
          gelinen dugmede de ayni kelime yaziyor. */}
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} disabled={busy}>
          <Text style={s.headerCancel}>{t("ui.cancel")}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("ui.settle_action")}</Text>
        <Pressable onPress={() => void save()} hitSlop={10} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.brand} />
          ) : (
            <Text style={s.headerSave}>{t("ui.save")}</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* TUTAR EN USTTE - kaydedilen sey bu. Harcama ekleme ekraniyla
              ayni sira ve ayni olcu. */}
          <View style={s.amountBlock}>
            <Text style={s.fieldLabel}>{t("ui.amount").toLocaleUpperCase(locale)}</Text>
            <View style={s.amountRow}>
              <TextInput
                style={s.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={theme.inputLine}
                editable={!busy}
              />
              <Text style={s.amountCurrency}>{currency}</Text>
            </View>
            {/* Uygulama para TASIMIYOR - olmus bir odemeyi kaydediyor. Bunu
                yazmak, "gonder" bekleyen kullaniciyi bastan uyariyor. */}
            <Text style={s.amountNote}>{t("ui.settlement_hint")}</Text>
          </View>

          <View style={s.fields}>
            {/* IKI SECENEK, BIRBIRINI DISLIYOR -> segment. Bolusum turuyle
                ayni kalip; cip yigini "birden fazla secilebilir" izlenimi
                veriyordu. */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>
                {t("ui.settlement_direction").toLocaleUpperCase(locale)}
              </Text>
              <View style={s.segments}>
                {(["outgoing", "incoming"] as const).map((value) => {
                  const active = direction === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDirection(value)}
                      style={[s.segment, active && s.segmentOn]}
                      disabled={busy}
                    >
                      <Text style={[s.segmentText, active && s.segmentTextOn]}>
                        {value === "outgoing" ? t("ui.i_paid") : t("ui.paid_to_me")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/*
              ODESECEK KIMSE YOKSA SECIM GOSTERILMIYOR.

              Tek uyeli bir grupta counterparties BOS. Secim yine de
              cizilseydi calisir bir denetim gibi gorunur, dokununca bos bir
              liste acilirdi - eski cip satirinin en azindan bos oldugu
              belliydi, secim bunu GIZLIYOR. Bu ekranda tek dogru cumle
              "burada yapacak bir sey yok" demek.
            */}
            {counterparties.length === 0 ? (
              <View style={s.field}>
                <Text style={s.fieldLabel}>
                  {t("ui.settlement_counterparty").toLocaleUpperCase(locale)}
                </Text>
                <Text style={s.emptyField}>{t("ui.no_one_to_settle_with")}</Text>
              </View>
            ) : (
              <SelectField
                label={t("ui.settlement_counterparty")}
                value={
                  counterparties.find((member) => member.userId === counterpartyId)
                    ?.displayName ?? "—"
                }
                options={counterparties.map((member) => ({
                  key: member.userId,
                  label: member.displayName,
                }))}
                onChange={setCounterpartyId}
                disabled={busy}
              />
            )}

            <Field label={t("ui.settlement_note")}>
              <TextInput
                style={s.fieldInput}
                value={note}
                onChangeText={setNote}
                placeholder={t("ui.settlement_note_placeholder")}
                placeholderTextColor={theme.muted}
                maxLength={500}
                editable={!busy}
              />
            </Field>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* GECMIS. Bakir cizgili bolum basligi + noktali ayracli satirlar -
              grup ekranindaki defterle ayni dil. */}
          <View style={s.historyBlock}>
            <SectionRule label={t("ui.settlements")} />
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
                        {`${nameByUserId[settlement.fromUserId] ?? t("ui.unknown_user")} \u2192 ${
                          nameByUserId[settlement.toUserId] ?? t("ui.unknown_user")
                        }`}
                      </Text>
                      <Text style={s.rowMeta} numberOfLines={1}>
                        {formatDate(new Date(settlement.settledAt), locale)}
                        {settlement.note ? ` · ${settlement.note}` : ""}
                      </Text>
                    </View>
                    <View style={s.leader} />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    scroll: { paddingBottom: 40 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
    },

    /** Harcama ekleme ve harcama detayindaki cubugun aynisi. */
    headerBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 12,
      gap: 12,
    },
    headerCancel: { fontFamily: fonts.body, fontSize: 15, color: theme.muted },
    headerTitle: { fontFamily: fonts.heading, fontSize: 20, color: theme.foreground },
    headerSave: { fontFamily: fonts.semibold, fontSize: 15, color: theme.brand },

    amountBlock: {
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.copper,
      gap: 6,
    },
    fieldLabel: {
      fontFamily: fonts.medium,
      fontSize: 10,
      letterSpacing: 2,
      color: theme.copperText,
    },
    amountRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    amountInput: {
      flexShrink: 1,
      minWidth: 40,
      fontFamily: fonts.semibold,
      fontSize: 44,
      letterSpacing: -1.8,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
      padding: 0,
    },
    amountCurrency: { fontFamily: fonts.body, fontSize: 18, color: theme.copperText },
    amountNote: { fontFamily: fonts.body, fontSize: 11.5, color: theme.muted, lineHeight: 17 },

    fields: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
    field: { gap: 7 },
    fieldInput: { fontFamily: fonts.body, fontSize: 16, color: theme.foreground, padding: 0 },
    emptyField: { fontFamily: fonts.body, fontSize: 14, color: theme.muted, lineHeight: 20 },

    segments: { flexDirection: "row", gap: 8 },
    segment: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.inputLine,
    },
    segmentOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    segmentText: { fontFamily: fonts.body, fontSize: 13.5, color: theme.foreground },
    segmentTextOn: { fontFamily: fonts.semibold, color: theme.onBrand },

    historyBlock: { paddingHorizontal: 20, paddingTop: 28 },
    hint: { fontFamily: fonts.body, fontSize: 12.5, color: theme.muted, lineHeight: 18, paddingTop: 14 },
    loading: { paddingVertical: 16 },
    row: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    rowText: { flexShrink: 1 },
    rowNames: { fontFamily: fonts.body, fontSize: 14.5, color: theme.foreground },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 11.5, color: theme.muted },
    // Noktali ayrac - grup ekrani, form ve harcama detayiyla ayni.
    leader: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dotted",
      borderColor: theme.inputLine,
      marginHorizontal: 10,
      transform: [{ translateY: -4 }],
    },
    rowAmount: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    // Iptal edilmis kayit: ustu cizili ve soluk. RENK YOK - yesil/kiremit bu
    // uygulamada yalnizca BAKIYE anlami tasiyor (ADR-015) ve iptal bir
    // bakiye durumu degil. Silinmis harcama satiriyla ayni muamele.
    cancelled: { textDecorationLine: "line-through", color: theme.muted },
    loadMore: { color: theme.brand, fontFamily: fonts.body, fontSize: 13, paddingVertical: 10 },
    error: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.debt,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
  });
}
