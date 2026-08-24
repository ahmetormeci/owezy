import { useAuth } from "@clerk/clerk-expo";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate, formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import type { Locale } from "@/lib/locale";
import { useLocale, useTranslate } from "../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { ExpenseComposer } from "../../../components/expense-composer";
import {
  Receipt,
  ReceiptDoubleRule,
  ReceiptLine,
  ReceiptPerforation,
  Cap,
} from "../../../components/receipt";

/**
 * Grup ekrani: sayfanin KENDISI bir fis (ADR-021).
 *
 * BAKIYE FISIN USTUNDE, ALTINDA DEGIL. Gercek bir fiste toplam en altta durur
 * ama 40 harcamali bir grupta bakiye ekranin cok altina duserdi ve ADR-016'nin
 * "sayfa bakiyeye gore kurulur" kurali fiilen bozulurdu - web'de de ayni
 * gerekceyle boyle yapildi. Fis dili korunuyor, sirasi degil.
 *
 * GECMIS AYLAR KATLI. Telefonda sonsuz kaydirma daha "yerli" olurdu ama ayni
 * gerekce burada daha da gecerli: acik birakilan gecmis, bakiyeyi ekranin
 * disina iter.
 */
type ExpenseItem = {
  id: string;
  description: string;
  amount: number;
  category: keyof typeof EXPENSE_CATEGORY_CODES;
  expenseDate: string;
  paidById: string;
};
type MonthSlice = { month: string; amount: number; count: number };
type GroupResponse = { group: { id: string; name: string } };
type SummaryResponse = {
  currency: string;
  myBalance: number;
  myShare: number;
  myPaid: number;
  totalAmount: number;
  expenseCount: number;
  byMonth: MonthSlice[];
};
type MembersResponse = { members: { userId: string; displayName: string }[] };
type MeResponse = { user: { id: string } };
type SuggestedTransfer = { fromUserId: string; toUserId: string; amount: number };
type BalancesResponse = { suggestedTransfers: SuggestedTransfer[] };
type ExpensesResponse = { expenses: ExpenseItem[]; nextCursor: string | null };

/**
 * Bir ayin yuklenmis durumu.
 *
 * ACIK AY VE KATLANMIS AYLAR AYNI YOLDAN GECIYOR. Once acik ay ayri bir
 * kanca ile cekiliyordu; o zaman sayfalama iki ayri yerde kurulmak zorunda
 * kalirdi ve biri unutulurdu. Tek yol, tek "daha fazla".
 */
type MonthState = {
  expenses: ExpenseItem[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
};

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { signOut } = useAuth();
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { get } = useApiClient();

  const group = useApiGet<GroupResponse>(groupId ? `/api/v1/groups/${groupId}` : null);
  const summary = useApiGet<SummaryResponse>(
    groupId ? `/api/v1/groups/${groupId}/summary` : null,
  );
  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );
  // Harcama eklerken paidById gerekiyor ve o BIZIM ic kimligimiz - Clerk'in
  // kimligi degil. 18.4'te bu uc gereksizdi, 18.5'te zorunlu oldu.
  const me = useApiGet<MeResponse>("/api/v1/me");
  const balances = useApiGet<BalancesResponse>(
    groupId ? `/api/v1/groups/${groupId}/balances` : null,
  );

  // Acik ay: ozetin ilk ayi. Harcamalar ANCAK ozet gelince istenebiliyor,
  // cunku hangi ayin acilacagini ozet soyluyor.
  const openMonth =
    summary.state.kind === "ok" ? (summary.state.data.byMonth[0]?.month ?? null) : null;

  const [months, setMonths] = useState<Record<string, MonthState>>({});

  /** Bir ayin bir SAYFASINI yukler. cursor verilirse mevcutun uzerine ekler. */
  const loadMonth = useCallback(
    async (month: string, cursor?: string) => {
      setMonths((current) => ({
        ...current,
        [month]: {
          expenses: cursor ? (current[month]?.expenses ?? []) : [],
          nextCursor: null,
          loading: true,
          error: false,
        },
      }));

      const query = `limit=20&month=${month}${cursor ? `&cursor=${cursor}` : ""}`;
      try {
        const result = await get<ExpensesResponse>(
          `/api/v1/groups/${groupId}/expenses?${query}`,
        );
        setMonths((current) => {
          const previous = cursor ? (current[month]?.expenses ?? []) : [];
          return {
            ...current,
            [month]: result.ok
              ? {
                  expenses: [...previous, ...result.data.expenses],
                  nextCursor: result.data.nextCursor,
                  loading: false,
                  error: false,
                }
              : { expenses: previous, nextCursor: null, loading: false, error: true },
          };
        });
      } catch {
        setMonths((current) => ({
          ...current,
          [month]: {
            expenses: current[month]?.expenses ?? [],
            nextCursor: null,
            loading: false,
            error: true,
          },
        }));
      }
    },
    [get, groupId],
  );

  // Acik ay kendiliginden aciliyor; digerlerini kullanici aciyor.
  useEffect(() => {
    if (openMonth && !months[openMonth]) {
      void loadMonth(openMonth);
    }
  }, [openMonth, months, loadMonth]);

  /**
   * Harcama eklendikten sonra.
   *
   * Ay onbellegi BOSALTILIYOR: acik ay bugunun ayi olmayabilir (fis en yeni
   * aya aciliyor) ve kullanici az once ekledigi satiri goremezdi. Ozet
   * yenilenince bugunun ayi en yeni ay olarak gelir ve kendiliginden acilir.
   * Web'de ayni sey "?month=bugun" adresine giderek yapiliyor (Faz 16.2).
   */
  const handleAdded = useCallback(() => {
    setMonths({});
    summary.reload();
  }, [summary]);

  /**
   * Ekrana GERI DONULDUGUNDE tazele.
   *
   * Harcama detayinda bir kayit duzenlenip ya da silinip geri gelindiginde fis
   * eski veriyi gosterirdi. Ilk odaklanma ATLANIYOR: mount aninda veri zaten
   * cekiliyor, ikinci bir istek bosuna olurdu.
   */
  const firstFocus = useRef(true);
  const reloadSummary = summary.reload;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setMonths({});
      reloadSummary();
    }, [reloadSummary]),
  );

  const toggleMonth = useCallback(
    (month: string) => {
      if (months[month]) {
        setMonths((current) => {
          const next = { ...current };
          delete next[month];
          return next;
        });
        return;
      }
      void loadMonth(month);
    },
    [months, loadMonth],
  );

  // SIRA ONEMLI: once hata, sonra yukleniyor, sonra basarili yol. Tek bir
  // boolean ("loading") uzerinden kontrol TypeScript'in daralmasini yapmiyor -
  // asagida state.data'ya erisebilmek icin kosullarin acik yazilmasi gerek.
  if (group.state.kind === "error" || summary.state.kind === "error") {
    const text = group.state.kind === "error" ? group.state.text : "…";
    return (
      <SafeAreaView style={s.centered}>
        <Text style={s.error}>{text}</Text>
        <Pressable
          style={s.button}
          onPress={() => {
            group.reload();
            summary.reload();
            members.reload();
          }}
        >
          <Text style={s.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Uyeler BLOKLAMIYOR ama beklemeye deger: gelmeden cizersek isimler once
  // "Bilinmeyen" gorunup sonra degisirdi. Hata verirse ekran yine aciliyor.
  if (
    group.state.kind !== "ok" ||
    summary.state.kind !== "ok" ||
    members.state.kind === "loading"
  ) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const { currency, myBalance, myShare, myPaid, totalAmount, byMonth } = summary.state.data;
  const isEmpty = summary.state.data.expenseCount === 0;

  const currentUserId = me.state.kind === "ok" ? me.state.data.user.id : null;
  const suggestions =
    balances.state.kind === "ok" ? balances.state.data.suggestedTransfers : [];
  const iPay = suggestions.filter((transfer) => transfer.fromUserId === currentUserId);
  const iReceive = suggestions.filter((transfer) => transfer.toUserId === currentUserId);
  const others = suggestions.filter(
    (transfer) =>
      transfer.fromUserId !== currentUserId && transfer.toUserId !== currentUserId,
  );

  const nameByUserId: Record<string, string> = {};
  if (members.state.kind === "ok") {
    for (const member of members.state.data.members) {
      nameByUserId[member.userId] = member.displayName;
    }
  }

  function line(expense: ExpenseItem) {
    return (
      <ReceiptLine
        key={expense.id}
        onPress={() => router.push(`/groups/${groupId}/expenses/${expense.id}`)}
        label={expense.description}
        amount={formatMoney(expense.amount, currency, locale)}
        secondary={[
          formatDate(new Date(expense.expenseDate), locale),
          t(EXPENSE_CATEGORY_CODES[expense.category]),
          t("ui.paid_by", { name: nameByUserId[expense.paidById] ?? t("ui.unknown_user") }),
        ].join(" · ")}
      />
    );
  }

  const settled = myBalance === 0;
  const owed = myBalance > 0;

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Receipt>
          <Text style={s.groupName}>{group.state.data.group.name}</Text>

          {!isEmpty ? (
            <View style={s.balanceBlock}>
              <View style={s.balanceRow}>
                <Cap>{t("ui.your_status")}</Cap>
                <Text
                  style={[
                    s.balanceAmount,
                    { color: settled ? theme.foreground : owed ? theme.credit : theme.debt },
                  ]}
                >
                  {formatSignedMoney(myBalance, currency, locale)}
                </Text>
              </View>
              <Text style={s.balanceLabel}>
                {settled ? t("ui.settled_up") : owed ? t("ui.owed_to_you") : t("ui.you_owe")}
              </Text>
            </View>
          ) : null}

          {/* Odesme plani. Bakiyenin hemen ardindan: ADR-016 sayfayi bakiyenin
              etrafinda kuruyor ve plan "bu bakiyeyle ne yapacagim" sorusunun
              cevabi. Fiil BASLIKTA, satirda degil - Turkcede "{isim}'e ode"
              yer tutucuyla dogru yazilamiyor (ek son harfe gore degisiyor). */}
          {!isEmpty && suggestions.length > 0 ? (
            <View style={s.planBlock}>
              <Cap>{t("ui.settle_plan")}</Cap>

              <SuggestionGroup
                styles={s}
                title={t("ui.you_should_pay")}
                transfers={iPay}
                nameOf={(transfer) => nameByUserId[transfer.toUserId] ?? t("ui.unknown_user")}
                currency={currency}
                locale={locale}
                onPress={(transfer) =>
                  router.push(
                    `/groups/${groupId}/settlements?to=${transfer.toUserId}&amount=${transfer.amount}`,
                  )
                }
              />
              <SuggestionGroup
                styles={s}
                title={t("ui.will_be_paid_to_you")}
                transfers={iReceive}
                nameOf={(transfer) => nameByUserId[transfer.fromUserId] ?? t("ui.unknown_user")}
                currency={currency}
                locale={locale}
                onPress={(transfer) =>
                  router.push(
                    `/groups/${groupId}/settlements?from=${transfer.fromUserId}&amount=${transfer.amount}`,
                  )
                }
              />

              {/* Beni ilgilendirmeyen transferler: ayni blokta ama en altta ve
                  soluk. Grubun takas plani dogru bir bilgi, ama benim isim
                  degil - o yuzden dokunulabilir de degil. */}
              {others.length > 0 ? (
                <View style={s.planGroup}>
                  <Text style={s.planTitle}>{t("ui.other_suggested_payments")}</Text>
                  {others.map((transfer) => (
                    <Text
                      key={`${transfer.fromUserId}-${transfer.toUserId}`}
                      style={s.otherRow}
                      numberOfLines={1}
                    >
                      {`${nameByUserId[transfer.fromUserId] ?? t("ui.unknown_user")} → ${
                        nameByUserId[transfer.toUserId] ?? t("ui.unknown_user")
                      }  ${formatMoney(transfer.amount, currency, locale)}`}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {isEmpty ? (
            // Bos fis BOS gorunuyor: uydurma ornek satir konmuyor, cunku
            // gercek kayitlarla karisirdi (web'de de ayni karar).
            <Text style={s.emptyText}>{t("ui.no_expenses")}</Text>
          ) : (
            <>
              {byMonth.map((slice: MonthSlice, index: number) => {
                const isOpen = index === 0;
                const state = months[slice.month];
                const shown = state?.expenses ?? [];

                return (
                  <View key={slice.month} style={s.monthBlock}>
                    {isOpen ? (
                      <ReceiptPerforation>{formatMonth(slice.month, locale)}</ReceiptPerforation>
                    ) : (
                      <Pressable onPress={() => toggleMonth(slice.month)}>
                        <ReceiptPerforation>
                          {`${formatMonth(slice.month, locale)}  ${state ? "▾" : "▸"}`}
                        </ReceiptPerforation>
                      </Pressable>
                    )}

                    {shown.map(line)}

                    {state?.loading ? <ActivityIndicator style={s.monthLoading} /> : null}
                    {state?.error ? (
                      <Pressable onPress={() => void loadMonth(slice.month)}>
                        <Text style={s.error}>{t("ui.try_again")}</Text>
                      </Pressable>
                    ) : null}

                    {/* AYIN TAMAMI GOSTERILMIYORSA SOYLENMESI SART. Bir fisin
                        satirlarini sessizce kesmek, toplamla celisen bir kagit
                        birakmak demek. */}
                    {state?.nextCursor && !state.loading ? (
                      <Pressable onPress={() => void loadMonth(slice.month, state.nextCursor!)}>
                        <Text style={s.loadMore}>{t("ui.load_more")}</Text>
                      </Pressable>
                    ) : null}

                    {/* Ay ara toplami. Fiste ara toplam satirlarin ARDINDAN
                        gelir, oncesinden degil - web'de de ayni kural. Yalniz
                        ay ACIKKEN yaziliyor: katli bir ayin altina toplam
                        koymak, gorunmeyen satirlarin toplamini gostermek
                        olurdu. */}
                    {state && !state.loading ? (
                      <ReceiptLine
                        cap
                        label={t(
                          slice.count === 1
                            ? "ui.month_expense_count_one"
                            : "ui.month_expense_count_other",
                          { count: slice.count },
                        )}
                        amount={formatMoney(slice.amount, currency, locale)}
                      />
                    ) : null}
                  </View>
                );
              })}

              {/* Fisin kapanisi. Ucu de ozetten geliyor, yeni sorgu yok. */}
              <View style={s.totals}>
                <ReceiptDoubleRule />
                <ReceiptLine
                  cap
                  label={t("ui.summary_total")}
                  amount={formatMoney(totalAmount, currency, locale)}
                />
                <ReceiptLine
                  cap
                  label={t("ui.summary_your_share")}
                  amount={formatMoney(myShare, currency, locale)}
                />
                <ReceiptLine
                  cap
                  label={t("ui.summary_you_paid")}
                  amount={formatMoney(myPaid, currency, locale)}
                />
              </View>
            </>
          )}
          {/* Fisin bir sonraki satiri. Toplamlardan SONRA duruyor: fis once
              olani anlatir, sonra yenisini bekler. Bos grupta da var - ilk
              harcamayi eklemenin yolu bu. */}
          {members.state.kind === "ok" && me.state.kind === "ok" ? (
            <ExpenseComposer
              groupId={groupId}
              memberIds={members.state.data.members.map((member) => member.userId)}
              currentUserId={me.state.data.user.id}
              onAdded={handleAdded}
            />
          ) : null}
        </Receipt>

        <View style={s.footer}>
          {/* "/" DEGIL "/groups". Onceki hali tek gruplu kullanicida hicbir
              sey yapmiyordu: "/" adresi tek grupta gruba GERI yonlendiriyor,
              yani baglanti ayni ekrana carpip donuyordu (Faz 18.7). */}
          <Link href="/groups" asChild>
            <Pressable>
              <Text style={s.footerText}>{t("ui.my_groups")}</Text>
            </Pressable>
          </Link>
          <Link href={`/groups/${groupId}/settlements`} asChild>
            <Pressable>
              <Text style={s.footerText}>{t("ui.settlements")}</Text>
            </Pressable>
          </Link>
          <Link href={`/groups/${groupId}/members`} asChild>
            <Pressable>
              <Text style={s.footerText}>{t("ui.manage_members")}</Text>
            </Pressable>
          </Link>
          <Pressable onPress={() => void signOut()}>
            <Text style={s.footerText}>{t("ui.sign_out")}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


/**
 * Odesme onerilerinin bir grubu.
 *
 * FIIL BASLIKTA, SATIRDA DEGIL. Turkcede "{isim}'e ode" yer tutucuyla dogru
 * yazilamiyor - ek ismin son harfine gore degisiyor (Ayse'ye / Ahmet'e).
 * Web'de de ayni kural gecerli.
 */
function SuggestionGroup({
  styles: s,
  title,
  transfers,
  nameOf,
  currency,
  locale,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  title: string;
  transfers: SuggestedTransfer[];
  nameOf: (transfer: SuggestedTransfer) => string;
  currency: string;
  locale: Locale;
  onPress: (transfer: SuggestedTransfer) => void;
}) {
  if (transfers.length === 0) {
    return null;
  }

  return (
    <View style={s.planGroup}>
      <Text style={s.planTitle}>{title}</Text>
      {transfers.map((transfer) => (
        <Pressable
          key={`${transfer.fromUserId}-${transfer.toUserId}`}
          style={s.planRow}
          onPress={() => onPress(transfer)}
        >
          <Text style={s.planName} numberOfLines={1}>
            {nameOf(transfer)}
          </Text>
          <Text style={s.planAmount}>{formatMoney(transfer.amount, currency, locale)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    // Zemin fisten bir ton KOYU: kagidin bir yuzeyin uzerinde durdugunu
    // soyleyen sey bu.
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
    groupName: { fontSize: 24, fontWeight: "600", color: theme.foreground },
    balanceBlock: { gap: 2, borderTopWidth: 1, borderStyle: "dashed", borderColor: theme.border, paddingTop: 16 },
    balanceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    balanceAmount: { fontSize: 26, fontWeight: "500", fontVariant: ["tabular-nums"] },
    balanceLabel: { fontSize: 12, color: theme.muted, textAlign: "right" },
    emptyText: { color: theme.muted, lineHeight: 22 },
    planBlock: {
      gap: 10,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 16,
    },
    planGroup: { gap: 4 },
    planTitle: { fontSize: 12, color: theme.muted },
    planRow: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 3 },
    planName: { flex: 1, fontSize: 14, color: theme.foreground },
    planAmount: { fontSize: 14, color: theme.foreground, fontVariant: ["tabular-nums"] },
    otherRow: { fontSize: 13, color: theme.muted, paddingVertical: 2 },
    monthBlock: { gap: 4 },
    monthLoading: { paddingVertical: 12 },
    loadMore: { color: theme.brand, fontSize: 13, paddingVertical: 8 },
    totals: { gap: 4 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
    // flexWrap SART: alt bilgide dort giris var ve tek satira sigmiyor.
    // Sarmadan once sonuncusu ("cikis yap") ekranin disinda kaliyordu.
    footer: { flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 24, paddingTop: 24 },
    footerText: { color: theme.muted, fontSize: 14 },
  });
}
