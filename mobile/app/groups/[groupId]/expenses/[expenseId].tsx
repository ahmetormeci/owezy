import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { formatMoney, formatMoneyForInput, parseMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../../lib/use-api";
import { useTheme, type Theme } from "../../../../lib/theme";
import { Cap } from "../../../../components/receipt";

/**
 * Tek harcama: detay ve - izin varsa - duzenleme.
 *
 * FISTEKI HER SATIR BURAYA ACILIYOR, yalnizca duzenlenebilir olanlar degil.
 * Sebep: bazi satirlarin dokunulabilir olmasi fisin tekduzeligini bozardi ve
 * hangisinin hangisi oldugu bakinca anlasilmazdi. Baskasinin satirinda ekran
 * salt okunur - ve o haliyle de ise yariyor, cunku "bu harcamada benim payim
 * ne" sorusunu burasi cevapliyor.
 *
 * YALNIZCA ESIT BOLUSUM DUZENLENEBILIYOR. EXACT/PERCENTAGE bir harcamanin
 * tutarini degistirmek kisi basi paylarin toplamiyla celisirdi; onu EQUAL
 * olarak gondermek ise kullanicinin kurdugu bolusumu SESSIZCE yok etmek
 * olurdu. Ikisi de yapilmiyor.
 */
type Participant = { userId: string; shareAmount: number };
type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: keyof typeof EXPENSE_CATEGORY_CODES;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE";
  expenseDate: string;
  paidById: string;
  createdById: string;
  participants: Participant[];
};

type ExpenseResponse = { expense: Expense };
type MembersResponse = { members: { userId: string; displayName: string }[] };
type MeResponse = { user: { id: string } };

export default function ExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { put, remove } = useApiClient();

  const expense = useApiGet<ExpenseResponse>(
    groupId && expenseId ? `/api/v1/groups/${groupId}/expenses/${expenseId}` : null,
  );
  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );
  const me = useApiGet<MeResponse>("/api/v1/me");

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidById, setPaidById] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form, kayit gelince BIR KEZ dolduruluyor. Her render'da doldurmak
  // kullanicinin yazdigini geri alirdi.
  const loaded = expense.state.kind === "ok" ? expense.state.data.expense : null;
  useEffect(() => {
    if (!loaded) return;
    setDescription(loaded.description);
    setAmountText(formatMoneyForInput(loaded.amount, locale));
    setPaidById(loaded.paidById);
  }, [loaded, locale]);

  if (expense.state.kind === "error") {
    return (
      <SafeAreaView style={s.centered}>
        <Text style={s.error}>{expense.state.text}</Text>
      </SafeAreaView>
    );
  }

  if (
    expense.state.kind !== "ok" ||
    members.state.kind === "loading" ||
    me.state.kind === "loading"
  ) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const item = expense.state.data.expense;
  const currentUserId = me.state.kind === "ok" ? me.state.data.user.id : null;
  const memberList = members.state.kind === "ok" ? members.state.data.members : [];
  const nameByUserId: Record<string, string> = {};
  for (const member of memberList) nameByUserId[member.userId] = member.displayName;

  // Arayuz web'in yaptigi basitlestirmeyi izliyor: kendi kaydinsa dugmeler
  // gorunur. ASIL KONTROL HER ZAMAN SUNUCUDA - grup sahibinin, kaydi olusturan
  // kisi grubu terk etmisse mudahale edebildigi bir istisna da var.
  const isMine = currentUserId !== null && item.createdById === currentUserId;
  const isEqual = item.splitType === "EQUAL";
  const canEdit = isMine && isEqual;

  const myShare = currentUserId
    ? item.participants.find((participant) => participant.userId === currentUserId)
    : undefined;

  async function save() {
    if (busy) return;
    setError(null);

    const amount = parseMoney(amountText);
    if (!description.trim()) {
      setError(t("ui.description_required"));
      return;
    }
    if (amountText.trim() !== "" && amount === null) {
      setError(t("ui.amount_unreadable"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t("ui.amount_required"));
      return;
    }

    setBusy(true);
    try {
      // expenseDate GONDERILMIYOR: sunucu gonderilmediginde mevcut tarihi
      // koruyor (expenses.ts). Gondermek, duzenlemede tarihi sessizce bugune
      // kaydirma riski demekti.
      const result = await put(`/api/v1/groups/${groupId}/expenses/${expenseId}`, {
        splitType: "EQUAL",
        description: description.trim(),
        amount,
        paidById,
        participantUserIds: item.participants.map((participant) => participant.userId),
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

  function confirmDelete() {
    // MODAL BURADA DOGRU ARAC. 18.5'te dogrulama hatalari icin modal'dan
    // kacinilmisti; geri alinamaz gorunen bir islemde kesinti ISTENEN seydir.
    Alert.alert(t("ui.delete_expense_question"), t("ui.delete_expense_hint", {
      description: item.description,
    }), [
      { text: t("ui.cancel"), style: "cancel" },
      { text: t("ui.delete"), style: "destructive", onPress: () => void doDelete() },
    ]);
  }

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const result = await remove(`/api/v1/groups/${groupId}/expenses/${expenseId}`);
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

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.paper}>
            {canEdit ? (
              <>
                <Cap>{t("ui.description")}</Cap>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  maxLength={200}
                  editable={!busy}
                  style={s.input}
                />

                <Cap>{t("ui.amount")}</Cap>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  editable={!busy}
                  style={s.input}
                />

                <Cap>{t("ui.who_paid")}</Cap>
                <View style={s.payers}>
                  {memberList.map((member) => (
                    <Pressable
                      key={member.userId}
                      onPress={() => setPaidById(member.userId)}
                      style={[s.payer, member.userId === paidById && s.payerActive]}
                      disabled={busy}
                    >
                      <Text
                        style={[
                          s.payerText,
                          member.userId === paidById && s.payerTextActive,
                        ]}
                      >
                        {member.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={s.title}>{item.description}</Text>
                <Text style={s.bigAmount}>
                  {formatMoney(item.amount, item.currency, locale)}
                </Text>
              </>
            )}

            <View style={s.facts}>
              <Fact styles={s} label={t("ui.date")} value={formatDate(new Date(item.expenseDate), locale)} />
              <Fact styles={s} label={t("ui.category")} value={t(EXPENSE_CATEGORY_CODES[item.category])} />
              <Fact
                styles={s}
                label={t("ui.who_paid")}
                value={nameByUserId[item.paidById] ?? t("ui.unknown_user")}
              />
              {myShare ? (
                <Fact
                  styles={s}
                  label={t("ui.summary_your_share")}
                  value={formatMoney(myShare.shareAmount, item.currency, locale)}
                />
              ) : null}
            </View>

            {/* Neden duzenlenemedigini SOYLUYORUZ. Sessizce salt okunur bir
                ekran, kullaniciyi "neden dokunamiyorum" sorusuyla birakirdi. */}
            {isMine && !isEqual ? (
              <Text style={s.note}>{t("ui.edit_split_on_web")}</Text>
            ) : null}
            {!isMine ? <Text style={s.note}>{t("access.expense_creator_only")}</Text> : null}

            {error ? <Text style={s.error}>{error}</Text> : null}

            {canEdit ? (
              <View style={s.actions}>
                <Pressable style={s.save} onPress={() => void save()} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Cap tone="onBrand">{t("ui.save")}</Cap>
                  )}
                </Pressable>
                <Pressable onPress={confirmDelete} disabled={busy}>
                  <Text style={s.delete}>{t("ui.delete")}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Pressable onPress={() => router.back()} style={s.backRow}>
            <Text style={s.back}>{t("ui.cancel")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Fact({
  styles: s,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={s.factRow}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.surface },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 32 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
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
    title: { fontSize: 20, fontWeight: "600", color: theme.foreground },
    bigAmount: { fontSize: 28, color: theme.foreground, fontVariant: ["tabular-nums"] },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.foreground,
    },
    payers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    payer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    payerActive: { borderColor: theme.brand, backgroundColor: theme.brand },
    payerText: { fontSize: 14, color: theme.foreground },
    payerTextActive: { color: "#fff" },
    facts: { gap: 6, borderTopWidth: 1, borderStyle: "dashed", borderColor: theme.border, paddingTop: 14 },
    factRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
    factLabel: { fontSize: 13, color: theme.muted },
    factValue: { fontSize: 13, color: theme.foreground },
    note: { fontSize: 12, color: theme.muted, lineHeight: 18 },
    error: { fontSize: 13, color: theme.debt },
    actions: { flexDirection: "row", alignItems: "center", gap: 20, paddingTop: 6 },
    save: {
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    delete: { color: theme.debt, fontSize: 14 },
    backRow: { paddingVertical: 16 },
    back: { color: theme.muted, fontSize: 14 },
  });
}
