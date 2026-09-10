import { fonts } from "../../../../lib/fonts";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
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
import { SectionRule } from "../../../../components/receipt";
import { Field, SelectField } from "../../../../components/field";
import { ReceiptPhoto } from "../../../../components/receipt-photo";
import { ExpenseComments } from "../../../../components/expense-comments";

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
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "ITEMIZED";
  expenseDate: string;
  paidById: string;
  createdById: string;
  participants: Participant[];
  /**
   * Kalemler (ADR-052). Yalnizca ITEMIZED harcamalarda dolu - eski bir
   * sunucu cevabinda alan HIC olmayabilir, o yuzden opsiyonel.
   *
   * NEDEN BURADA: bu ekran tutari duzenleyebiliyor ve sunucu "tam
   * degistirme" bekliyor - yani kalemler de govdede olmak zorunda.
   * Gelmeseydi telefondan yapilan bir aciklama duzeltmesi MASAYI SILERDI.
   */
  items?: { description: string; amount: number; userIds: string[] }[];
  /** Optimistic locking sayaci (ADR-032). */
  version: number;
  /**
   * Fisin VARLIGI, baytlari degil. Baytlar ayri bir uctan geliyor ve orada
   * yetki yeniden sorgulaniyor; buraya konsaydi her harcama sorgusu bir
   * megabayt tasirdi.
   */
  receipt: { contentType: string; byteSize: number; createdAt: string } | null;
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
        item.splitType === "ITEMIZED"
          ? {
              splitType: "ITEMIZED" as const,
              /**
               * KALEMLER OLDUGU GIBI GERI GIDIYOR. Bu ekran bolusumu
               * degistirmiyor; tutar degisirse paylar kalemlerden YENIDEN
               * hesaplaniyor ve fark (bahsis/indirim) herkesin payina
               * oranla dagiliyor - yani telefondan bahsis eklemek dogal
               * olarak calisiyor.
               */
              items: item.items ?? [],
            }
          : item.splitType === "EQUAL"
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
    // edges'te "bottom" YOK: baslik cubugu kendi ust payini tasiyor, alt
    // bosluk da scroll'un paddingBottom'unda.
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
      {/*
        HARCAMA EKLEME EKRANIYLA AYNI CUBUK. Ikisi ayni ailenin iki hali -
        biri kaydi yaratiyor, digeri duzenliyor - ve kullanici ikisine de
        ayni yerden (fis satiri / eylem cubugu) ulasiyor. Farkli baslik
        duzenleri iki ayri ekran gibi gosterirdi.

        KAYDET YALNIZCA DUZENLEYEBILENDE. Baskasinin kaydinda cubuk yalnizca
        "Vazgec" ve basligi tasiyor; olmayan bir yetkiyi dugme olarak sunup
        ardindan hata gostermek olurdu (ADR-009).
      */}
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} disabled={busy}>
          <Text style={s.headerCancel}>{t("ui.cancel")}</Text>
        </Pressable>
        <Text style={s.headerTitle}>
          {canEdit ? t("ui.edit_expense") : t("ui.expense")}
        </Text>
        {canEdit ? (
          <Pressable
            testID="save"
            onPress={() => void save()}
            hitSlop={10}
            disabled={busy || gone}
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.brand} />
            ) : (
              <Text style={[s.headerSave, gone && s.headerSaveOff]}>{t("ui.save")}</Text>
            )}
          </Pressable>
        ) : (
          // Bos yer tutucu: baslik ortada kalsin. Cubuk space-between.
          <View style={s.headerSpacer} />
        )}
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* TUTAR EN USTTE - harcama ekleme ekranindaki sirayla ayni. */}
          <View style={s.amountBlock}>
            <Text style={s.fieldLabel}>{t("ui.amount").toLocaleUpperCase(locale)}</Text>
            <View style={s.amountRow}>
              {canEdit ? (
                <TextInput
                  testID="amount"
                  style={[s.amountInput, !canEditAmount && s.amountLocked]}
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="decimal-pad"
                  editable={!busy && canEditAmount}
                />
              ) : (
                <Text style={s.amountInput}>
                  {formatMoney(item.amount, item.currency, locale)}
                </Text>
              )}
              <Text style={s.amountCurrency}>{item.currency}</Text>
            </View>
            {/* EXACT'te tutar salt okunur: paylar mutlak ve toplamlari tutara
                esit olmak zorunda. Alani GIZLEMIYORUZ - gizlemek "burada
                tutar diye bir sey yok" izlenimi verirdi; kilidin sebebi
                asagida yaziyor. */}
          </View>

          <View style={s.fields}>
            {canEdit ? (
              <Field label={t("ui.description")}>
                <TextInput
                  testID="description"
                  style={s.fieldInput}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={200}
                  editable={!busy}
                />
              </Field>
            ) : (
              <Field label={t("ui.description")}>
                <Text style={s.fieldInput}>{item.description}</Text>
              </Field>
            )}

            {canEdit ? (
              <SelectField
                label={t("ui.who_paid")}
                value={nameByUserId[paidById ?? ""] ?? t("ui.unknown_user")}
                options={memberList.map((member) => ({
                  key: member.userId,
                  label: member.displayName,
                }))}
                onChange={setPaidById}
                disabled={busy}
              />
            ) : null}
          </View>

          {/* AYRINTILAR. Bakir bolum cizgisi + noktali ayracli satirlar -
              fisin okuma yardimi, grup ekranindakiyle ayni dil. Duzenlenebilir
              alanlar yukarida; burasi DEGISMEYENLER. */}
          <View style={s.factsBlock}>
            <SectionRule label={t("ui.details")} />
            <Fact
              styles={s}
              label={t("ui.date")}
              value={formatDate(new Date(item.expenseDate), locale)}
            />
            <Fact
              styles={s}
              label={t("ui.category")}
              value={t(EXPENSE_CATEGORY_CODES[item.category])}
            />
            {!canEdit ? (
              <Fact
                styles={s}
                label={t("ui.who_paid")}
                value={nameByUserId[item.paidById] ?? t("ui.unknown_user")}
              />
            ) : null}
            {myShare ? (
              <Fact
                styles={s}
                label={t("ui.summary_your_share")}
                value={formatMoney(myShare.shareAmount, item.currency, locale)}
              />
            ) : null}
          </View>

          {/* KALEMLER (ADR-052) - SALT OKUNUR.
              Duzenleme web'de: dar bir ekranda kalem adi + tutar + kisi
              cipleri bir SATIRA sigmiyor ve giris ekraninda o yuzden her
              kalem kendi blogunu aliyor. Burada amac masayi HATIRLATMAK,
              yeniden kurmak degil - "kim ne yedi" sorusunun cevabi.

              KISI BASINA TUTAR YAZILMIYOR: kalem ici bolusum esit ve
              kisinin TOPLAM payi zaten ustte duruyor; kalem basina ikinci
              bir rakam, ayni bilgiyi ucuncu kez soylemek olurdu. */}
          {item.items && item.items.length > 0 ? (
            <View style={s.itemsBlock}>
              <SectionRule label={t("ui.items")} />
              {item.items.map((line, index) => (
                <View key={index} style={s.itemRow}>
                  <View style={s.itemTexts}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {line.description}
                    </Text>
                    <Text style={s.itemPeople} numberOfLines={1}>
                      {line.userIds
                        .map((userId) => nameByUserId[userId] ?? t("ui.unknown_user"))
                        .join(" · ")}
                    </Text>
                  </View>
                  <Text style={s.itemAmount}>
                    {formatMoney(line.amount, item.currency, locale)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Neden duzenlenemedigini SOYLUYORUZ. Sessizce salt okunur bir
              ekran, kullaniciyi "neden dokunamiyorum" sorusuyla birakirdi. */}
          {isMine && isExact ? <Text style={s.note}>{t("ui.edit_amount_on_web")}</Text> : null}
          {!isMine ? <Text style={s.note}>{t("access.expense_creator_only")}</Text> : null}

          {/* Cakisma uyarisi (ADR-032). Bakir cizgili bolum basligi fisin
              geri kalaniyla ayni dile ait; anlami renk degil METIN tasiyor
              (ADR-021). */}
          {conflict ? (
            <View style={s.conflictBlock}>
              <SectionRule label={t("ui.conflict_heading")} />
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

          {/* FIS FOTOGRAFI. Ayrintilarin ALTINDA: harcamanin kendisi once
              okunur, fis onun kaniti. Eklemek/kaldirmak harcamayi DEGISTIRME
              yetkisiyle ayni (canEdit) - sunucu da oyle davraniyor. */}
          <View style={s.receiptBlock}>
            <ReceiptPhoto
              groupId={groupId}
              expenseId={expenseId}
              present={item.receipt !== null}
              canEdit={canEdit && !gone}
              onChanged={() => expense.reload()}
            />
          </View>

          {/* YORUMLAR. Fisin ALTINDA: once harcamanin kendisi, sonra kaniti
              (fis), sonra hakkinda soylenenler. Yazmak grubun her uyesine
              acik - fis ekleme gibi canEdit'e bagli DEGIL (ADR-049). */}
          <View style={s.commentsBlock}>
            <ExpenseComments
              groupId={groupId}
              expenseId={expenseId}
              currentUserId={currentUserId}
              isDeleted={gone}
            />
          </View>

          {/* SILME EN ALTTA VE SESSIZ. Kaydet basliga cikti; silme onun
              yanina konsaydi iki yikici olmayan/olan eylem yan yana dururdu.
              Rengi theme.destructive - theme.debt DEGIL: ADR-015'in
              yururlukteki yarisi silme ile "borclusun"un ayni renkte
              olmasini yasakliyor. */}
          {canEdit ? (
            <Pressable
              style={s.deleteRow}
              onPress={confirmDelete}
              disabled={busy || gone}
            >
              <Text style={s.delete}>{t("ui.delete")}</Text>
            </Pressable>
          ) : null}
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
      <View style={s.leader} />
      <Text style={s.factValue}>{value}</Text>
    </View>
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
      gap: 12,
      backgroundColor: theme.background,
    },

    /** Harcama ekleme ekranindaki cubugun aynisi. */
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
    headerSaveOff: { color: theme.muted },
    // Kaydet yokken basligin ORTADA kalmasi icin: cubuk space-between.
    headerSpacer: { width: 52 },

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
    // EXACT'te tutar kilitli. Alan GORUNUR kaliyor, yalnizca soluyor.
    amountLocked: { color: theme.muted },
    amountCurrency: { fontFamily: fonts.body, fontSize: 18, color: theme.copperText },

    fields: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
    fieldInput: { fontFamily: fonts.body, fontSize: 16, color: theme.foreground, padding: 0 },

    factsBlock: { paddingHorizontal: 20, paddingTop: 24 },
    factRow: {
      flexDirection: "row",
      alignItems: "baseline",
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    factLabel: { fontFamily: fonts.body, fontSize: 13.5, color: theme.muted },
    // Noktali ayrac - grup ekranindaki ve formdakiyle ayni.
    leader: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dotted",
      borderColor: theme.inputLine,
      marginHorizontal: 10,
      transform: [{ translateY: -4 }],
    },
    factValue: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },

    note: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: theme.muted,
      lineHeight: 18,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    /**
     * YATAY DOLGU BURADA. Bu ekranda ScrollView'da yatay dolgu YOK ve her
     * blok kendi paddingHorizontal'ini tasiyor - yorum bolumunde tam bu
     * unutulmustu (10 Eylul, simulatorde goruldu).
     */
    itemsBlock: { paddingHorizontal: 20, paddingTop: 24 },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    itemTexts: { flex: 1, minWidth: 0, gap: 2 },
    itemName: { fontFamily: fonts.body, fontSize: 14, color: theme.foreground },
    itemPeople: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },
    itemAmount: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    conflictBlock: { paddingHorizontal: 20, paddingTop: 24 },
    error: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.debt,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    receiptBlock: { paddingHorizontal: 20, paddingTop: 24 },
    commentsBlock: { paddingHorizontal: 20, paddingTop: 24 },

    deleteRow: { paddingHorizontal: 20, paddingTop: 28 },
    // theme.destructive, theme.debt DEGIL. ADR-015'in yururlukteki yarisi:
    // silme dugmesi ile "borclusun" ayni renkte olamaz. Bu ekranda bugune
    // kadar debt kullaniliyordu.
    delete: { color: theme.destructive, fontFamily: fonts.body, fontSize: 14 },
  });
}
