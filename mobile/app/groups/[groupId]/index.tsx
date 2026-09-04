import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { formatDate, formatMonth } from "@/lib/dates";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-labels";
import {
  displayNameForLine,
  groupByMonth,
  shouldShowShare,
  visibleSecondaryFields,
  type SecondaryFields,
} from "@/lib/expense-list-view";
import { formatBasisPoints, formatMoney, formatSignedMoney } from "@/lib/money";
import type { Locale } from "@/lib/locale";
import { useLocale, useTranslate, type Translator } from "../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { CsvExport } from "../../../components/csv-export";
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
  /**
   * PAYLAR ZATEN GELIYORDU, mobil yalnizca ISTEMIYORDU: liste ucu her satirla
   * birlikte participants'i donduruyor (expenses.ts, include). Web fis
   * satirinda "senin payin"i bundan yaziyordu; mobilde tip dar oldugu icin
   * veri gelip atiliyordu - byCategory ve balances'ta oldugu gibi.
   */
  participants: { userId: string; shareAmount: number }[];
};
type MonthSlice = { month: string; amount: number; count: number };
/**
 * ROL DE GELIYORDU, mobil yalnizca ISTEMIYORDU: getGroupForUser her zaman
 * "role" donduruyor (groups.ts). byCategory, balances ve participants'ta
 * oldugu gibi veri gelip atiliyordu.
 */
type GroupResponse = {
  group: { id: string; name: string; role: "OWNER" | "MEMBER" };
};
type CategorySlice = {
  category: keyof typeof EXPENSE_CATEGORY_CODES;
  amount: number;
  /** Grubun toplamindaki payi. 10000 = %100. */
  basisPoints: number;
};
type SummaryResponse = {
  currency: string;
  byCategory: CategorySlice[];
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
/**
 * UYE BAKIYELERI ZATEN GELIYORDU, mobil yalnizca ISTEMIYORDU: /balances ucu
 * bastan beri "balances" dizisini de donduruyor (src/lib/balances.ts) ve web
 * onu "Uyeler ve bakiyeler" blogunda kullaniyor. Tip burada dar oldugu icin
 * veri gelip atiliyordu.
 */
type MemberBalance = {
  userId: string;
  amount: number;
  displayName: string;
  hasLeft: boolean;
};
type BalancesResponse = {
  suggestedTransfers: SuggestedTransfer[];
  balances: MemberBalance[];
};
type ExpensesResponse = {
  expenses: ExpenseItem[];
  nextCursor: string | null;
  /**
   * YALNIZCA filtre varken dolu (expenses.ts: isFiltered). Ayni where ile
   * hesaplandigi icin sayilan kume listelenen kumeden ayrisamaz.
   */
  matches: { count: number; total: number } | null;
};

/** Suzgec acikken gosterilen liste. Ay bazli "months" ile AYRI tutuluyor. */
type FoundState = {
  expenses: ExpenseItem[];
  nextCursor: string | null;
  matches: { count: number; total: number } | null;
};

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
      /**
       * KURAL BILEREK SUSTURULUYOR (react-hooks/set-state-in-effect).
       *
       * Kural haklı bir seyden korkuyor: efekt icinde setState cagirmak
       * ardarda render uretebiliyor. Ama React'in kendi belgesi DIS VERI
       * CEKMEYI efektin mesru kullanimi sayiyor ve burada yapilan tam olarak
       * o - acilan ayin harcamalari sunucudan geliyor.
       *
       * DONGU RISKI KAPALI: efekt "months" bagimliligini tasiyor ve
       * loadMonth "months"u guncelliyor, yani onlemsiz birakilsa kendini
       * tetiklerdi. Onlem ustteki kosul: !months[openMonth]. Bir ay bir kez
       * yukleniyor, sonra girdi dolu oldugu icin cagri yapilmiyor.
       *
       * BURAYI DEGISTIREN KISI o kosulu da kontrol etsin; kaldirilirsa
       * sonsuz istek dongusu olur ve belirtisi "sayfa surekli yukleniyor".
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  /**
   * BES SORGUNUN HEPSI tazeleniyor, yalnizca ozet degil.
   *
   * Once ozet ve bildirim sayaci tazeleniyordu ve EKSIKTI - simulatorde
   * goruldu: grup adi "Tatil2026" olarak kaydedildi, ekrana donuldu, baslik
   * hala "Tatil" diyordu. Ayni acik uyeler ve bakiyeler icin de vardi: uye
   * cikarilip geri gelindiginde liste eskisini gosterirdi.
   *
   * Bu ekrandan gidilen HER yer buradaki verilerden birini degistirebiliyor
   * (harcama, odesme, uye, davet, grup adi, bildirim). "Hangisi degisti"
   * sorusunu ekranin bilmesinin yolu yok; web'de karsiligi router.refresh()
   * ve o da hepsini yeniden cekiyor.
   *
   * MALIYET GORUNMUYOR: useApiGet ayni adres tazelenirken ELDEKI VERIYI
   * koruyor, yani spinner'a dusen bir ekran olmuyor.
   *
   * Bagimliliklar nesneler degil UZERLERINDEKI KARARLI fonksiyonlar: nesneler
   * her cizimde yeniden uretiliyor ve efekt bosuna yeniden kurulurdu.
   */
  const reloadSummary = summary.reload;
  const reloadGroup = group.reload;
  const reloadMembers = members.reload;
  const reloadBalances = balances.reload;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setMonths({});
      reloadSummary();
      reloadGroup();
      reloadMembers();
      reloadBalances();
    }, [reloadSummary, reloadGroup, reloadMembers, reloadBalances]),
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

  /**
   * ARAMA VE SUZME.
   *
   * Web'de bu bir TEK SATIR: arama kutusu, kategori secici, "yalnizca beni
   * ilgilendirenler" ve disa aktarma yan yana, kesikli iki cizgi arasinda.
   * Telefonda dordu bir satira sigmiyor - ama satirin KENDISI fisin dilinin
   * parcasi, o yuzden satir korunuyor ve icindekiler bolunuyor: en sik
   * yapilan is (yazip aramak) sifir dokunusta, nadir olanlar bir dokunus
   * arkada.
   *
   * SUNUCUDA IS YOK: /expenses ucu q, category ve mine parametrelerini ve
   * "matches" alanini bastan beri kabul edip donduruyor.
   */
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<keyof typeof EXPENSE_CATEGORY_CODES | null>(
    null,
  );
  const [mine, setMine] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [found, setFound] = useState<FoundState | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** "Tekrar dene" bunu artiriyor; efektin bagimliligi oldugu icin istek yenileniyor. */
  const [retry, setRetry] = useState(0);

  const isFiltered = query.trim() !== "" || category !== null || mine;

  /**
   * Suzgeclerin sorgu metni. URLSearchParams KULLANILMIYOR: React Native'de
   * o sinif eksik bir doldurma uzerinden geliyor ve davranisi tarayicidakiyle
   * birebir ayni degil. Uc parametre icin elle kurmak hem kesin hem de
   * bagimlilik olarak DUZ BIR METIN veriyor - efektin deps dizisinde her
   * render'da degisen bir nesne durmuyor.
   */
  // Disa aktarma hatasi. Bilesenin kendisi tasiyamiyor: hata satirin
  // ALTINDA gorunmeli, dugme ise satirin ICINDE.
  const [exportError, setExportError] = useState<string | null>(null);

  const filterSuffix = [
    query.trim() ? `q=${encodeURIComponent(query.trim())}` : null,
    category ? `category=${category}` : null,
    mine ? "mine=true" : null,
  ]
    .filter((part): part is string => part !== null)
    .join("&");

  useEffect(() => {
    // Suzgec yokken hicbir sey yapilmiyor: gosterilecek liste zaten ay bazli
    // olan. Burada state sifirlamak efekt icinde senkron setState olurdu.
    if (!isFiltered) {
      return;
    }

    let cancelled = false;

    /**
     * Yazarken HER TUSA istek atmamak icin bekleme. Temizleme fonksiyonu iki
     * is birden yapiyor: zamanlayiciyi iptal ediyor VE gec donen bir cevabin
     * yeni sonucun uzerine yazmasini engelliyor.
     *
     * setSearching zamanlayicinin ICINDE aciliyor, efekt govdesinde degil -
     * govdede senkron setState fazladan bir render uretir (web'de de ayni
     * gerekce).
     */
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await get<ExpensesResponse>(
        `/api/v1/groups/${groupId}/expenses?limit=20${filterSuffix ? `&${filterSuffix}` : ""}`,
      );
      if (cancelled) return;

      if (result.ok) {
        setFound({
          expenses: result.data.expenses,
          nextCursor: result.data.nextCursor,
          matches: result.data.matches,
        });
        setSearchError(null);
      } else {
        setSearchError(t(result.code));
      }
      setSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFiltered, filterSuffix, groupId, get, t, retry]);

  /** Suzulmus listenin devami. Ay penceresi YOK: arama butun gecmiste calisiyor. */
  const loadMoreFound = useCallback(async () => {
    if (!found?.nextCursor || searching) return;

    setSearching(true);
    const result = await get<ExpensesResponse>(
      `/api/v1/groups/${groupId}/expenses?limit=20&cursor=${found.nextCursor}${
        filterSuffix ? `&${filterSuffix}` : ""
      }`,
    );

    if (result.ok) {
      setFound((current) => ({
        expenses: [...(current?.expenses ?? []), ...result.data.expenses],
        nextCursor: result.data.nextCursor,
        matches: result.data.matches,
      }));
      setSearchError(null);
    } else {
      setSearchError(t(result.code));
    }
    setSearching(false);
  }, [found, searching, get, groupId, filterSuffix, t]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory(null);
    setMine(false);
    setSearchError(null);
    // found BILEREK birakilmiyor: suzgec kalkinca ekranda ay bazli liste
    // cikiyor, bayat sonuclar hicbir yerde gorunmuyor - ama tekrar
    // suzuldugunde eski sonuclarin bir an gorunmemesi icin siliniyor.
    setFound(null);
  }, []);

  // SIRA ONEMLI: once hata, sonra yukleniyor, sonra basarili yol. Tek bir
  // boolean ("loading") uzerinden kontrol TypeScript'in daralmasini yapmiyor -
  // asagida state.data'ya erisebilmek icin kosullarin acik yazilmasi gerek.
  if (group.state.kind === "error" || summary.state.kind === "error") {
    const text = group.state.kind === "error" ? group.state.text : "…";
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
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
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const { currency, myBalance, myShare, myPaid, totalAmount, byMonth, byCategory } =
    summary.state.data;
  const isEmpty = summary.state.data.expenseCount === 0;

  // Cubuk genisligi EN BUYUK kategoriye gore olceklenıyor (web'le ayni).
  // Bolen sifir olamaz: liste bosken blok zaten cizilmiyor ama ifade
  // yine de guvenli kalsin.
  const largestCategory = byCategory[0]?.amount ?? 1;
  // Bakiyesi SIFIR OLMAYANLAR ustte kalsin diye sunucu zaten siralamis
  // (balances.ts, tutara gore azalan). Burada yeniden siralamiyoruz.
  const memberBalances = balances.state.kind === "ok" ? balances.state.data.balances : [];

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

  /**
   * Bir satirin ikincil alanlari. Ucu de BURADA bicimleniyor cunku elenip
   * elenmeyecegine yazilacak METNE bakilarak karar veriliyor
   * (bkz. src/lib/expense-line.ts).
   */
  function secondaryFieldsOf(expense: ExpenseItem): SecondaryFields {
    return {
      date: formatDate(new Date(expense.expenseDate), locale),
      category: t(EXPENSE_CATEGORY_CODES[expense.category]),
      payer: t("ui.paid_by", {
        name: displayNameForLine(nameByUserId[expense.paidById] ?? t("ui.unknown_user")),
      }),
    };
  }

  /**
   * previous, EKRANDA BIR USTTE DURAN satir - veri sirasindaki degil. Ay
   * sinirinda undefined geciliyor ki her bolumun ilk satiri kendi tarihini
   * yazsin.
   *
   * "SENIN PAYIN" EN SONDA. Web'de de orada; ustelik tekrar eleme sayesinde
   * satir uzamiyor - cikan iki alanin yerine bir alan giriyor.
   */
  function line(expense: ExpenseItem, previous?: ExpenseItem) {
    const parts = visibleSecondaryFields(
      secondaryFieldsOf(expense),
      previous ? secondaryFieldsOf(previous) : null,
    );
    const myShare = expense.participants.find(
      (participant) => participant.userId === currentUserId,
    );
    if (shouldShowShare(myShare?.shareAmount, expense.amount)) {
      parts.push(
        t("ui.your_share_amount", {
          amount: formatMoney(myShare!.shareAmount, currency, locale),
        }),
      );
    }

    return (
      <ReceiptLine
        key={expense.id}
        onPress={() => router.push(`/groups/${groupId}/expenses/${expense.id}`)}
        label={expense.description}
        amount={formatMoney(expense.amount, currency, locale)}
        secondary={parts.join(" · ")}
      />
    );
  }

  const settled = myBalance === 0;
  const owed = myBalance > 0;

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      {/* Baslik VERIYLE geliyor, o yuzden _layout'ta bos birakilip burada
          kuruluyor. Grup adi fisin ustunde de yaziyor ama baslik cubugu
          KAYDIRINCA da yerinde kaliyor - uzun bir listede "hangi gruptayim"
          sorusunun cevabi kaybolmasin. */}
      <Stack.Screen options={{ title: group.state.data.group.name }} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Receipt>
          {/* Fisin "magaza adi" satiri: ortalanmis, tek arali, harf araligi
              acik - web'deki fisle ayni. Onceden sola yasli kalin bir yaziydi
              ve fisin dilinden kopuyordu. Baslik cubugunda da yaziyor ama
              orasi kaydirinca gorunen bir referans; burasi fisin parcasi. */}
          <Text style={s.receiptTitle}>{group.state.data.group.name}</Text>

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
              {/* DAMGA, duz yazi degil. Web'de bakiyenin yanindaki cerceveli
                  muhur ekranin tek karakterli ani; mobilde gri bir satira
                  dusmustu. Renk ADR-015'e uyuyor: yesil "sana borclular",
                  kiremit "borclusun", odesmis halde notr. */}
              <View
                style={[
                  s.stamp,
                  { borderColor: settled ? theme.muted : owed ? theme.credit : theme.debt },
                ]}
              >
                <Cap color={settled ? theme.muted : owed ? theme.credit : theme.debt}>
                  {settled ? t("ui.settled_up") : owed ? t("ui.owed_to_you") : t("ui.you_owe")}
                </Cap>
              </View>
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
              {/* SUZGEC SATIRI. Kesikli iki cizgi arasinda, cercevesiz -
                  web'dekiyle ayni muamele: kutulu bir form denetimi kagidin
                  uzerinde yabanci duruyordu.

                  BOS GRUPTA HIC CIZILMIYOR (ustteki isEmpty dali): suzulecek
                  bir sey yokken arama kutusu gostermek, olmayan bir isi
                  varmis gibi gostermek olurdu. */}
              <View>
                <View style={s.filterBar}>
                  <TextInput
                    style={s.filterInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("ui.search_expenses")}
                    placeholderTextColor={theme.muted}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {/* DISA AKTAR, FILTRE'nin solunda ve HER ZAMAN gorunur -
                      web'de de satirin sonunda duruyor. Panelin icine
                      konsaydi, filtre acmayan kullanici bulamazdi. */}
                  <CsvExport
                    groupId={groupId}
                    filterSuffix={filterSuffix}
                    onError={setExportError}
                  />
                  <Pressable
                    onPress={() => setFilterOpen((open) => !open)}
                    hitSlop={10}
                  >
                    {/* Etiket, ACIK ya da bir suzgec SECILI oldugunda kobalt:
                        panel kapaliyken bile "burada bir sey var" demeli. */}
                    <Cap
                      color={
                        filterOpen || category !== null || mine ? theme.brand : theme.muted
                      }
                    >
                      {`${t("ui.filter")} ${filterOpen ? "▾" : "▸"}`}
                    </Cap>
                  </Pressable>
                </View>

                {/* Hata, olayin OLDUGU yerin altinda - Alert degil. Kural
                    expense-composer.tsx'te yazili. */}
                {exportError ? <Text style={s.error}>{exportError}</Text> : null}

                {filterOpen ? (
                  <View style={s.filterPanel}>
                    <View style={s.chips}>
                      <Pressable
                        style={[s.chip, category === null && s.chipActive]}
                        onPress={() => setCategory(null)}
                      >
                        <Text
                          style={[s.chipText, category === null && s.chipTextActive]}
                        >
                          {t("ui.all_categories")}
                        </Text>
                      </Pressable>
                      {EXPENSE_CATEGORY_OPTIONS.map(([value, code]) => {
                        const active = category === value;
                        return (
                          <Pressable
                            key={value}
                            style={[s.chip, active && s.chipActive]}
                            onPress={() => setCategory(active ? null : value)}
                          >
                            <Text style={[s.chipText, active && s.chipTextActive]}>
                              {t(code)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* "Yalnizca beni ilgilendirenler" de bir CIP. Web'de onay
                        kutusu ama React Native'de yerlesik bir onay kutusu yok
                        ve bu ekranda cipler zaten acik/kapali anlamini
                        tasiyor (harcama ekleme ekraninda da oyle). */}
                    <View style={s.chips}>
                      <Pressable
                        style={[s.chip, mine && s.chipActive]}
                        onPress={() => setMine((value) => !value)}
                      >
                        <Text style={[s.chipText, mine && s.chipTextActive]}>
                          {t("ui.only_mine")}
                        </Text>
                      </Pressable>
                      {isFiltered ? (
                        <Pressable style={s.clearButton} onPress={clearFilters}>
                          <Cap>{t("ui.clear_filters")}</Cap>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>

              {isFiltered ? (
                <FilteredResults
                  styles={s}
                  found={found}
                  searching={searching}
                  error={searchError}
                  onRetry={() => setRetry((n) => n + 1)}
                  onLoadMore={() => void loadMoreFound()}
                  renderLine={line}
                  currency={currency}
                  locale={locale}
                  t={t}
                />
              ) : (
                byMonth.map((slice: MonthSlice, index: number) => {
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

                    {shown.map((expense, index) => line(expense, shown[index - 1]))}

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
                })
              )}

              {/* Fisin kapanisi. Ucu de ozetten geliyor, yeni sorgu yok.
                  SUZGEC ACIKKEN DE DURUYOR: bu sayilar GRUBUN tamamini
                  anlatiyor ve etiketleri de oyle diyor; web'de de fisin
                  altinda, suzgecten bagimsiz duruyorlar. Ekrandaki kumenin
                  toplami suzgec satirinin hemen altinda ayrica yaziyor. */}
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

        {/* HIZLI EKLEYICI YETMEDIGINDE. Ucu birden - odeyen, katilimcilar,
            bolusme turu - yalnizca ayri bir ekranda secilebiliyor; fisin
            altindaki tek satir bilerek dar. */}
        <Link href={`/groups/${groupId}/expenses/new`} asChild>
          <Pressable style={s.card}>
            <View style={s.cardHead}>
              <Cap>{t("ui.add_expense")}</Cap>
              <Text style={s.cardLink}>→</Text>
            </View>
          </Pressable>
        </Link>

        {/* NEREYE GITTI. Web'de fisin altinda duran kategori kirilimi;
            mobilde HIC YOKTU - oysa veri bastan beri /summary ile geliyordu.
            Web'deki iki kural aynen gecerli: hic harcama yoksa ve TEK
            kategori varsa blok cizilmiyor. Tek cubuk her zaman tam boy olur
            ve "%100" yazar - hicbir sey anlatmaz. */}
        {byCategory.length > 1 ? (
          <View style={s.card}>
            <Cap>{t("ui.summary_by_category")}</Cap>
            <View style={s.cardBody}>
              {byCategory.map((slice) => (
                <View key={slice.category} style={s.catRow}>
                  <View style={s.catHead}>
                    <Text style={s.catName} numberOfLines={1}>
                      {t(EXPENSE_CATEGORY_CODES[slice.category])}
                    </Text>
                    <Text style={s.catAmount}>
                      {formatMoney(slice.amount, currency, locale)} ·{" "}
                      {formatBasisPoints(slice.basisPoints, locale)}
                    </Text>
                  </View>
                  {/* Genislik EN BUYUK kategoriye gore, toplama gore degil -
                      web'de de oyle. Toplama gore olsaydi kucuk kategoriler
                      gorunmez birer cizgiye inerdi. */}
                  <View style={s.catTrack}>
                    <View
                      style={[
                        s.catFill,
                        { width: `${(slice.amount / largestCategory) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* UYELER VE BAKIYELER. Bu da web'de fisin altinda duruyordu ve
            mobilde yoktu; veri /balances ile zaten geliyordu. Ayri bir
            ekrana gitmeden "kim ne durumda" gorunmeli - grubun asil sorusu
            bu. */}
        {memberBalances.length > 0 ? (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Cap>{t("ui.members_and_balances")}</Cap>
              <Link href={`/groups/${groupId}/members`} asChild>
                <Pressable>
                  <Text style={s.cardLink}>{t("ui.manage_members")}</Text>
                </Pressable>
              </Link>
            </View>
            <View style={s.cardBody}>
              {memberBalances.map((member) => (
                <View key={member.userId} style={s.memberRow}>
                  <Text style={s.memberName} numberOfLines={1}>
                    {member.displayName}
                    {member.hasLeft ? ` · ${t("ui.member_left")}` : ""}
                  </Text>
                  <Text
                    style={[
                      s.memberAmount,
                      {
                        color:
                          member.amount === 0
                            ? theme.muted
                            : member.amount > 0
                              ? theme.credit
                              : theme.debt,
                      },
                    ]}
                  >
                    {formatSignedMoney(member.amount, currency, locale)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* KAYDEDILEN ODEMELER - web'de ayri bir bolum, mobilde yalnizca
            alttaki duz baglanti yiginindaydi.

            "Gruplarim" ve "Cikis yap" BURADAN KALKTI: birincisini baslik
            cubugundaki geri dugmesi karsiliyor, ikincisi Hesap ekraninda.
            Dordu yan yana duran duz metin, gezinme gibi gorunmuyordu. */}
        {/* GRUBU DUZENLE. Yalnizca SAHIBE gorunuyor - yetki kontrolu sunucuda
            (groups.ts, owner_only) ama yapilamayacak bir kapiyi gostermek,
            kullaniciya formu doldurtup sonunda reddetmek demekti.

            FISIN DISINDA, kartlarin arasinda: web'de de ayni kural yazili -
            "kagidin uzerine buton koymak, basili bir belgeye tiklanabilir
            bir sey eklemek gibi durur". */}
        {group.state.data.group.role === "OWNER" ? (
          <Link href={`/groups/${groupId}/edit`} asChild>
            <Pressable style={s.card}>
              <View style={s.cardHead}>
                <Cap>{t("ui.edit_group")}</Cap>
                <Text style={s.cardLink}>→</Text>
              </View>
            </Pressable>
          </Link>
        ) : null}

        <Link href={`/groups/${groupId}/settlements`} asChild>
          <Pressable style={s.card}>
            <View style={s.cardHead}>
              <Cap>{t("ui.settlements")}</Cap>
              <Text style={s.cardLink}>→</Text>
            </View>
          </Pressable>
        </Link>

        {/* HESAP. GRUBA AIT DEGIL, hesaba ait - ama buraya konmasi zorunlu
            oldu ve sebebi olculdu: tek grubu olan kullanici uygulamayi acinca
            index.tsx onu Redirect ile dogrudan buraya dusuruyor. Redirect
            yigini DEGISTIRDIGI icin geri dugmesi hic dogmuyor; bu ekranda da
            hesaba giden bir yol yoktu. Yani tek gruplu kullanici HESABINI
            SILEMIYORDU (App Store 5.1.1(v) bunu zorunlu kiliyor), cikis
            yapamiyor ve gruplar listesine - dolayisiyla davet kabul etmeye -
            ulasamiyordu.

            BILDIRIMLER ARTIK BURADA DEGIL: zil baslik cubuguna tasindi
            (components/notification-bell.tsx). Isleyisi dogruydu ama cok
            harcamali bir grupta uzun bir kaydirmanin arkasinda kaliyordu.
            HESAP TASINMADI - tasinsaydi bu ekranda hesaba giden yol yine
            kaybolurdu ve yukaridaki kusur geri gelirdi.

            Grup kartlarindan sonra, en altta duruyor: kapsami farkli oldugu
            icin grubun bloklariyla karismasin. */}
        <View style={s.accountBlock}>
          <Link href="/account" asChild>
            <Pressable style={s.card}>
              <View style={s.cardHead}>
                <Cap>{t("ui.account")}</Cap>
                <Text style={s.cardLink}>→</Text>
              </View>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


/**
 * Suzgec acikken gosterilen liste.
 *
 * AY KATLAMA YOK. Katli kalsaydi aranan kayit eski bir ayin icinde durur ve
 * ekran "sonuc yok" derdi. Sonuclar yine de aya bolunuyor - perfore satirlar
 * ayirici olarak duruyor, cunku 40 satirlik duz bir listede satirlarin hangi
 * doneme ait oldugu kaybolur.
 *
 * AY ARA TOPLAMLARI YAZILMIYOR. Ayin TAMAMININ toplamini suzulmus bir
 * listenin altina koymak, yan yana konularak soylenen bir yalan olurdu.
 * Yerine ustte kac sonuc bulundugu yaziyor ve o sayi listenin kendisiyle
 * AYNI kosuldan geliyor (sunucu ayni where ile hesapliyor).
 */
function FilteredResults({
  styles: s,
  found,
  searching,
  error,
  onRetry,
  onLoadMore,
  renderLine,
  currency,
  locale,
  t,
}: {
  styles: ReturnType<typeof createStyles>;
  found: FoundState | null;
  searching: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
  renderLine: (expense: ExpenseItem, previous?: ExpenseItem) => React.ReactElement;
  currency: string;
  locale: Locale;
  t: Translator;
}) {
  // Hata SONUCLARIN YERINE cikiyor: mobilde bildirim seridi yok, hata
  // gorunmezse kullanici bos bir liste gorur ve "hic sonuc yok" saniyordu.
  if (error) {
    return (
      <Pressable onPress={onRetry}>
        <Text style={s.error}>{error}</Text>
        <Text style={s.loadMore}>{t("ui.try_again")}</Text>
      </Pressable>
    );
  }

  if (!found) {
    return <ActivityIndicator style={s.monthLoading} />;
  }

  if (found.expenses.length === 0) {
    return <Text style={s.emptyText}>{t("ui.no_matching_expenses")}</Text>;
  }

  const matches = found.matches;

  return (
    <View style={s.foundBlock}>
      {matches ? (
        <Text style={s.matchLine}>
          {t(matches.count === 1 ? "ui.match_count_one" : "ui.match_count_other", {
            count: matches.count,
          })}
          {matches.count > 0 ? ` · ${formatMoney(matches.total, currency, locale)}` : ""}
        </Text>
      ) : null}

      {groupByMonth(found.expenses).map((group) => (
        <View key={group.month} style={s.monthBlock}>
          <ReceiptPerforation>{formatMonth(group.month, locale)}</ReceiptPerforation>
          {group.expenses.map((expense, index) =>
            renderLine(expense, group.expenses[index - 1]),
          )}
        </View>
      ))}

      {searching ? <ActivityIndicator style={s.monthLoading} /> : null}

      {found.nextCursor && !searching ? (
        <Pressable onPress={onLoadMore}>
          <Text style={s.loadMore}>{t("ui.load_more")}</Text>
        </Pressable>
      ) : null}
    </View>
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
    // Fisin "magaza adi": ortalanmis, harf araligi acik, tek arali.
    receiptTitle: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
      letterSpacing: 2,
      textAlign: "center",
      color: theme.foreground,
      marginBottom: 4,
    },
    // Cerceveli damga. Zemin YOK: mureklep izlenimi cerceveden geliyor.
    card: {
      backgroundColor: theme.paper,
      borderRadius: 10,
      padding: 16,
      marginTop: 12,
      gap: 10,
    },
    cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    // Hesap kapilari grubun bloklarindan bir nefes ayri: kapsamlari farkli.
    accountBlock: { marginTop: 16 },
    cardBody: { gap: 12 },
    cardLink: { color: theme.brand, fontSize: 13, fontWeight: "500" },
    catRow: { gap: 5 },
    catHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
    catName: { flex: 1, color: theme.foreground, fontSize: 14 },
    catAmount: { color: theme.muted, fontSize: 12 },
    catTrack: { height: 5, borderRadius: 3, backgroundColor: theme.surface, overflow: "hidden" },
    catFill: { height: "100%", borderRadius: 3, backgroundColor: theme.brand },
    memberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
    memberName: { flex: 1, color: theme.foreground, fontSize: 15 },
    memberAmount: { fontSize: 15, fontWeight: "500" },
    stamp: {
      alignSelf: "flex-end",
      borderWidth: 1.5,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginTop: 6,
    },
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
    // Suzgec satiri: kutusuz, kesikli iki cizgi arasinda - fisin uzerine
    // yazilmis gibi. Kenarliklar kalkinca denetim kagida ait gorunuyor.
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingVertical: 8,
    },
    // padding: 0 SART - iOS'ta TextInput'un kendi ic dolgusu satiri
    // kalinlastirip kesikli cizgilerden koparıyor.
    filterInput: { flex: 1, fontSize: 15, color: theme.foreground, padding: 0 },
    filterPanel: { gap: 10, paddingTop: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
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
    clearButton: { paddingHorizontal: 6, paddingVertical: 7 },
    foundBlock: { gap: 12 },
    matchLine: { fontSize: 12, color: theme.muted },
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
