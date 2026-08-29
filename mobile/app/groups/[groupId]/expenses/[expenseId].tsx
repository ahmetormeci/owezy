import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { EXPENSE_CATEGORY_CODES, EXPENSE_SPLIT_TYPE_CODES } from "@/lib/expense-labels";
import { diffExpenses, type ExpenseChange } from "@/lib/expense-diff";
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
type Participant = { userId: string; shareAmount: number; basisPoints: number | null };
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
  /** Optimistic locking sayaci (ADR-032). */
  version: number;
};

type ExpenseResponse = { expense: Expense };

/** Cakisma durumu. Web'deki ExpenseForm ile ayni ayrim (ADR-032). */
type ConflictState =
  | { kind: "deleted" }
  | { kind: "changed"; changes: ExpenseChange[] };
type MembersResponse = { members: { userId: string; displayName: string }[] };
type MeResponse = { user: { id: string } };

export default function ExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { get, put, remove } = useApiClient();

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

  /**
   * Optimistic locking (ADR-032). `baseline` ekrana YUKLENEN hal: hem
   * gonderilecek surumu hem de cakismada karsilastirilacak "onceki" tarafi
   * tasiyor. Cakismadan sonra sunucudaki yenisiyle degistiriliyor.
   */
  const [baseline, setBaseline] = useState<Expense | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  // Form, kayit gelince BIR KEZ dolduruluyor. Her render'da doldurmak
  // kullanicinin yazdigini geri alirdi.
  //
  // filled bayragi cakisma icin sart: orada ekrandaki bilgileri tazelemek
  // uzere expense.reload() cagriliyor ve bayrak olmasaydi bu efekt yeniden
  // calisip kullanicinin yazdiklarini silerdi - yani cakismada girdiyi koruma
  // sozunu tam da onu vermeye calisirken bozardik.
  const filled = useRef(false);
  const loaded = expense.state.kind === "ok" ? expense.state.data.expense : null;
  useEffect(() => {
    if (!loaded || filled.current) return;
    filled.current = true;
    setDescription(loaded.description);
    setAmountText(formatMoneyForInput(loaded.amount, locale));
    setPaidById(loaded.paidById);
    setBaseline(loaded);
  }, [loaded, locale]);

  if (expense.state.kind === "error") {
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
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
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
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
  /**
   * NEYIN DUZENLENEBILECEGI BOLUSME TURUNE GORE DEGISIYOR - ve ayrim veri
   * modelinden cikiyor, keyfi degil:
   *
   *   EQUAL      paylar tutardan turetiliyor; ikisi de degistirilebilir.
   *   PERCENTAGE paylar YUZDE; tutar degisince sunucu payları yeniden
   *              hesapliyor, yani tutar da guvenle degistirilebilir.
   *   EXACT      paylar MUTLAK ve toplamlari tutara ESIT olmak zorunda
   *              (semadaki degismez kural). Tutar tek basina degistirilirse
   *              toplam tutmaz; o yuzden burada yalnizca aciklama.
   *
   * Onceden UCU DE kilitliydi: ekran "bolusumu duzenlemek icin web'i kullan"
   * diyordu ve yuzdeli bir harcamanin ADINDAKI yazim hatasi bile telefondan
   * duzeltilemiyordu.
   */
  const isExact = item.splitType === "EXACT";
  const canEdit = isMine;
  const canEditAmount = isMine && !isExact;

  // Harcama arada silinmisse kaydetmek ya da tekrar silmek anlamsiz; dugmeler
  // kapali ama ekran duruyor, cunku kullanici ne yazdigini gormeye devam etmeli.
  const gone = conflict?.kind === "deleted";

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

    if (!baseline) return;

    setBusy(true);
    setConflict(null);
    try {
      // expenseDate GONDERILMIYOR: sunucu gonderilmediginde mevcut tarihi
      // koruyor (expenses.ts). Gondermek, duzenlemede tarihi sessizce bugune
      // kaydirma riski demekti.
      /**
       * GOVDE BOLUSME TURUNE GORE KURULUYOR. Onceden sabit "EQUAL"
       * gonderiliyordu; o yuzden ekran yalnizca esit bolusumlerde
       * acilabiliyordu - baska turde gonderilse paylar sessizce esitlenirdi.
       *
       * Mevcut paylar OLDUGU GIBI geri gonderiliyor: bu ekran bolusumu
       * degistirmiyor, yalnizca aciklamayi (ve yuzdeli olanda tutari)
       * degistiriyor. Sunucu "tam degistirme" bekliyor, yani paylar da
       * govdede olmak zorunda.
       */
      const splitBody =
        item.splitType === "EQUAL"
          ? {
              splitType: "EQUAL" as const,
              participantUserIds: item.participants.map((p) => p.userId),
            }
          : item.splitType === "EXACT"
            ? {
                splitType: "EXACT" as const,
                shares: item.participants.map((p) => ({
                  userId: p.userId,
                  amount: p.shareAmount,
                })),
              }
            : {
                splitType: "PERCENTAGE" as const,
                // basisPoints yuzdeli kayitlarda dolu; ADR-022 eski satirlar
                // icin de geri hesaplayip yaziyor. Yine de null gelirse
                // gondermek semayi dusururdu - o yuzden eleniyor.
                shares: item.participants
                  .filter((p) => p.basisPoints !== null)
                  .map((p) => ({ userId: p.userId, basisPoints: p.basisPoints as number })),
              };

      const result = await put(`/api/v1/groups/${groupId}/expenses/${expenseId}`, {
        description: description.trim(),
        amount,
        paidById,
        ...splitBody,
        version: baseline.version,
      });

      if (!result.ok) {
        if (result.code === "expense.version_conflict") {
          await loadConflict();
          return;
        }
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

  /**
   * Cakismadan sonra sunucudaki hali cekip farki hesaplar.
   *
   * IKI istek atiyor ve bu bilerek: `get` farki hesaplamak icin veriyi ELE
   * veriyor, `reload` ise ekrandaki bilgileri (tarih, kategori, odeyen)
   * tazeliyor. Kanca kendi durumunu disaridan yazdirmiyor, o yuzden ikisi ayri.
   * Cakisma nadir bir yol; iki istek burada kabul edilebilir bir bedel.
   */
  async function loadConflict() {
    if (!baseline) return;

    const fresh = await get<ExpenseResponse>(
      `/api/v1/groups/${groupId}/expenses/${expenseId}`,
    );

    if (!fresh.ok) {
      // 404 = harcama arada silindi; kaydetmenin bir anlami kalmadi.
      setConflict(fresh.status === 404 ? { kind: "deleted" } : { kind: "changed", changes: [] });
      return;
    }

    setConflict({ kind: "changed", changes: diffExpenses(baseline, fresh.data.expense) });
    setBaseline(fresh.data.expense);
    expense.reload();
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
    setConflict(null);
    try {
      if (!baseline) return;

      // Surum query string'te: DELETE'in govdesi yok (ADR-032).
      const result = await remove(
        `/api/v1/groups/${groupId}/expenses/${expenseId}?version=${baseline.version}`,
      );
      if (!result.ok) {
        if (result.code === "expense.version_conflict") {
          await loadConflict();
          return;
        }
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

  /** Bir degisikligi okunur tek satira cevirir. Web'deki describeChange ile ayni is. */
  function describeChange(change: ExpenseChange): string {
    switch (change.field) {
      case "description":
        return t("ui.conflict_change", {
          field: t("ui.description"),
          before: change.before,
          after: change.after,
        });
      case "amount":
        return t("ui.conflict_change", {
          field: t("ui.amount"),
          before: formatMoney(change.before, item.currency, locale),
          after: formatMoney(change.after, item.currency, locale),
        });
      case "paidById":
        return t("ui.conflict_change", {
          field: t("ui.payer"),
          before: nameByUserId[change.before] ?? t("ui.unknown_user"),
          after: nameByUserId[change.after] ?? t("ui.unknown_user"),
        });
      case "category":
        return t("ui.conflict_change", {
          field: t("ui.category"),
          before: t(EXPENSE_CATEGORY_CODES[change.before as Expense["category"]]),
          after: t(EXPENSE_CATEGORY_CODES[change.after as Expense["category"]]),
        });
      case "splitType":
        return t("ui.conflict_change", {
          field: t("ui.split_type"),
          before: t(EXPENSE_SPLIT_TYPE_CODES[change.before]),
          after: t(EXPENSE_SPLIT_TYPE_CODES[change.after]),
        });
      case "expenseDate":
        return t("ui.conflict_change", {
          field: t("ui.date"),
          before: formatDate(new Date(change.before), locale),
          after: formatDate(new Date(change.after), locale),
        });
      case "participants": {
        const lines: string[] = [];
        if (change.addedUserIds.length > 0) {
          lines.push(t("ui.conflict_participants_added", { names: joinNames(change.addedUserIds) }));
        }
        if (change.removedUserIds.length > 0) {
          lines.push(
            t("ui.conflict_participants_removed", { names: joinNames(change.removedUserIds) }),
          );
        }
        if (change.sharesChanged) {
          lines.push(t("ui.conflict_shares_changed"));
        }
        return lines.join(" · ");
      }
    }
  }

  function joinNames(userIds: string[]): string {
    return userIds.map((id) => nameByUserId[id] ?? t("ui.unknown_user")).join(", ");
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
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
                {/* EXACT'te salt okunur: paylar mutlak ve toplamlari tutara
                    esit olmak zorunda, tek basina tutar degistirilemez.
                    Gorunur kalmasi onemli - alani gizlemek "burada tutar diye
                    bir sey yok" izlenimi verirdi. */}
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  editable={!busy && canEditAmount}
                  style={[s.input, !canEditAmount && s.inputLocked]}
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
            {/* Yalnizca EXACT'te ve yalnizca TUTAR icin. Yuzdeli bolusumde
                tutar da degistirilebiliyor - sunucu paylari yeniden
                hesapliyor. */}
            {isMine && isExact ? (
              <Text style={s.note}>{t("ui.edit_amount_on_web")}</Text>
            ) : null}
            {!isMine ? <Text style={s.note}>{t("access.expense_creator_only")}</Text> : null}

            {/* Cakisma uyarisi (ADR-032). Kesikli ayirici fisin geri kalaniyla
                ayni dile ait; anlami renk degil metin tasiyor (ADR-021). */}
            {conflict ? (
              <View style={s.conflict}>
                <Cap>{t("ui.conflict_heading")}</Cap>
                {conflict.kind === "deleted" ? (
                  <Text style={s.note}>{t("ui.conflict_deleted")}</Text>
                ) : conflict.changes.length === 0 ? (
                  <Text style={s.note}>{t("ui.conflict_unknown")}</Text>
                ) : (
                  <>
                    {conflict.changes.map((change) => (
                      <Text key={change.field} style={s.note}>
                        {describeChange(change)}
                      </Text>
                    ))}
                    <Text style={s.note}>{t("ui.conflict_overwrite_hint")}</Text>
                  </>
                )}
              </View>
            ) : null}

            {error ? <Text style={s.error}>{error}</Text> : null}

            {canEdit ? (
              <View style={s.actions}>
                <Pressable style={s.save} onPress={() => void save()} disabled={busy || gone}>
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Cap tone="onBrand">{t("ui.save")}</Cap>
                  )}
                </Pressable>
                <Pressable onPress={confirmDelete} disabled={busy || gone}>
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
    inputLocked: { opacity: 0.5 },
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
    // facts ile birebir ayni: kesikli ust cizgi + bosluk. Cerceve DEGIL -
    // RN'de borderStyle "dashed" ile borderRadius birlikte iOS'ta duz cizgi
    // olarak ciziliyor; fisin dilinde zaten yatay ayirici kullaniliyor.
    conflict: {
      gap: 6,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 14,
    },
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
