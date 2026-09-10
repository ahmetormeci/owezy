import { fonts } from "../../../lib/fonts";
import { Ionicons } from "@expo/vector-icons";
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
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SPLIT_TYPE_SHORT_CODES,
} from "@/lib/expense-labels";
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
import { apiBaseUrl } from "../../../lib/api";
import { useSession } from "../../../lib/auth";
import { CsvExport } from "../../../components/csv-export";
import { ReceiptViewer } from "../../../components/receipt-viewer";
import { ExpenseComposer } from "../../../components/expense-composer";
import {
  Receipt,
  ReceiptDoubleRule,
  ReceiptLine,
  ReceiptPerforation,
  Cap,
  SectionRule,
  MemberAvatar,
  Stamp,
  ExpenseRow,
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
  /**
   * ZATEN GELIYORDU, tip istemiyordu - participants ve receipt gibi. Liste
   * ucu include kullaniyor (expenses.ts), yani butun skalar alanlar yanitta.
   * Satirin alt satiri "Sen odedin · esit · yiyecek" diye okunuyor ve
   * ortadaki parca bu.
   */
  splitType: keyof typeof EXPENSE_SPLIT_TYPE_SHORT_CODES;
  expenseDate: string;
  paidById: string;
  /**
   * PAYLAR ZATEN GELIYORDU, mobil yalnizca ISTEMIYORDU: liste ucu her satirla
   * birlikte participants'i donduruyor (expenses.ts, include). Web fis
   * satirinda "senin payin"i bundan yaziyordu; mobilde tip dar oldugu icin
   * veri gelip atiliyordu - byCategory ve balances'ta oldugu gibi.
   */
  participants: { userId: string; shareAmount: number }[];
  /**
   * Silinmis kayitlar listeye YALNIZCA "silinenler" cipi acikken geliyor
   * (?includeDeleted=true). Uc bu alani bastan beri donduruyordu.
   */
  deletedAt?: string | null;
  /**
   * FISIN VARLIGI. Uc yalnizca bir kimlik donduruyor (expenses.ts) - liste
   * "fis var mi" sorusunu cevaplamak icin baytlara ihtiyac duymuyor ve
   * duymamali: kirk harcamalik bir listede kirk fotograf indirmek olurdu.
   */
  receipt?: { id: string } | null;
  /**
   * Silinmemis yorum sayisi. Yalnizca bir SAYI: yorumlarin kendisi harcama
   * detayinda cekiliyor (ADR-049). Opsiyonel - eski bir cevapta yoksa
   * "yorum yok" gibi davraniyor.
   */
  commentCount?: number;
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
/**
 * Cagiranin bu grupta SOGUMA PENCERESI ICINDE gonderdigi hatirlatmalar
 * (ADR-050). Balances ucundan geliyor cunku odesme planiyla ayni satirda
 * cizilyor; ayri bir istek, her grup acilisinda fazladan bir gidis-donus
 * olurdu. Opsiyonel: eski bir sunucu cevabinda alan hic olmayabilir.
 */
type SentReminder = { toUserId: string; amount: number; sentAt: string };
type BalancesResponse = {
  suggestedTransfers: SuggestedTransfer[];
  balances: MemberBalance[];
  reminders?: SentReminder[];
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
  const { get, post } = useApiClient();

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

  /**
   * Silinenler de gorunsun mu. Silinen harcama fiziksel olarak silinmiyor
   * (soft delete + audit log); ayri bir "cop kutusu" ekrani yerine listeye
   * katiliyorlar - bir kayit en cok kendi tarih sirasinda anlam tasiyor.
   */
  const { getToken } = useSession();
  const [showDeleted, setShowDeleted] = useState(false);

  /**
   * FIS ISARETINE dokunulan harcamanin kimligi - null ise katman kapali.
   * Fotografin kendisi listede TASINMIYOR, yalnizca acildiginda cekiliyor.
   */
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  /**
   * Belirteci bir kez aliyoruz; goruntuleyici onu Authorization basliginda
   * tasiyacak - fis adresi yetkisiz calismiyor.
   */
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const value = await getToken();
      if (!cancelled) setAuthToken(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);
  const [restoring, setRestoring] = useState<string | null>(null);

  /**
   * ODEME HATIRLATMASI (ADR-050).
   *
   * IKI DURUM AYRI TUTULUYOR: "su an gonderiliyor" (reminding) ve
   * "gonderildi" (remindedLocally). Sunucudan gelen liste baslangic degeri,
   * tek kaynak degil - gonderdikten sonra butun ekrani yeniden cekmek
   * (balances.reload) tek bir satirin durumu icin fazla olurdu.
   */
  const [reminding, setReminding] = useState<string | null>(null);
  const [remindedLocally, setRemindedLocally] = useState<string[]>([]);
  /**
   * Hata KARTIN ICINDE, Alert DEGIL - bu ekranin kurali (expense-composer.tsx
   * ve disa aktarma hatasi da boyle). Hatirlatma satirinin hemen altinda
   * duruyor, yani kullanici hangi satir icin okudugunu biliyor.
   */
  const [remindError, setRemindError] = useState<string | null>(null);

  // showDeleted de bir FILTRE: gosterilen kumeyi degistiriyor, yani ay
  // katlamasi kalkmali ve sonuc sayisi yazilmali.
  const isFiltered =
    query.trim() !== "" || category !== null || mine || showDeleted;

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
    // Disa aktarma da bu kumeyi izliyor: ekranda silinenler dururken inen
    // dosyada olmamalari, yan yana konularak soylenen bir yalan olurdu.
    showDeleted ? "includeDeleted=true" : null,
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
        setSearchError(t(result.code, result.params));
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
      setSearchError(t(result.code, result.params));
    }
    setSearching(false);
  }, [found, searching, get, groupId, filterSuffix, t]);

  /**
   * Silinmis bir harcamayi geri alir.
   *
   * ONAY YOK - silmenin aksine YIKICI DEGIL: yanlislikla basilirsa kayit geri
   * gelir ve yine silinebilir. Her eyleme onay koymak onayin kendisini
   * anlamsizlastirir. (Silme ekraninda onay VAR ve orada dogru.)
   *
   * SURUM GONDERILMIYOR: uc geri almada surum beklemiyor - yarisabilecek tek
   * rakip islem yine geri alma ve onu "zaten silinmemis" kontrolu eliyor.
   *
   * Basarinin ardindan HEM ozet HEM suzgec sonuclari tazeleniyor: kayit geri
   * gelince bakiyeler ve ay toplamlari da degisiyor.
   */
  async function restore(expenseId: string) {
    if (restoring) return;
    setRestoring(expenseId);
    const result = await post(
      `/api/v1/groups/${groupId}/expenses/${expenseId}/restore`,
      {},
    );
    setRestoring(null);

    if (!result.ok) {
      setSearchError(t(result.code, result.params));
      return;
    }

    setMonths({});
    summary.reload();
    balances.reload();
    setRetry((n) => n + 1);
  }

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory(null);
    setMine(false);
    setShowDeleted(false);
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
  /**
   * BOS FIS. "!showDeleted" SART VE SEBEBI OLCULDU: ozet yalnizca SILINMEMIS
   * harcamalari sayiyor, yani tek harcamasini silen kullanicida sayac 0
   * oluyor ve asagidaki bos dal ciziliyor. O dalda suzgec satiri YOK -
   * dolayisiyla "silinenleri goster" cipine de ulasilamiyor ve kullanici
   * sildigi kaydi GERI ALAMIYOR. Cikissiz bir durum; simulatorde goruldu.
   */
  const isEmpty = summary.state.data.expenseCount === 0 && !showDeleted;

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
  /**
   * BENI ILGILENDIREN transferler tek listede. Onceden ikiye ayriliyordu
   * ("odeyeceklerim" / "bana odenecekler"), her birinin kendi basligiyla.
   * Bakiye kartinin icinde iki baslik fazla: kartin ustundeki ISARETLI
   * rakam zaten yonu soyluyor.
   */
  const myTransfers = [...iPay, ...iReceive];

  /**
   * KIME HATIRLATILDI. Sunucudan gelenle bu oturumda gonderilenlerin
   * birlesimi: sunucu listesi sayfa acilisindaki dogruyu, yerel liste az
   * once yapilani tasiyor.
   */
  const remindedUserIds = new Set([
    ...(balances.state.kind === "ok"
      ? (balances.state.data.reminders ?? []).map((reminder) => reminder.toUserId)
      : []),
    ...remindedLocally,
  ]);

  /**
   * Hatirlatmayi gonderir (ADR-050).
   *
   * 409 DA "GONDERILDI" SAYILIYOR: sunucu "cok erken" diyorsa gonderilmis
   * bir hatirlatma VAR demektir - baska bir cihazdan ya da web'den. Satiri
   * acik birakmak kullaniciyi ayni duvara tekrar surerdi. Web'deki dugme de
   * ayni sekilde davraniyor.
   */
  async function sendReminder(toUserId: string) {
    if (reminding) return;
    setReminding(toUserId);
    setRemindError(null);
    const result = await post(`/api/v1/groups/${groupId}/reminders`, { toUserId });
    setReminding(null);

    if (!result.ok) {
      if (result.status === 409) {
        setRemindedLocally((current) => [...current, toUserId]);
      }
      setRemindError(t(result.code, result.params));
      return;
    }
    setRemindedLocally((current) => [...current, toUserId]);
  }

  /**
   * BASLIKTAKI AVATARLAR. Dorde kadar cizilip gerisi bir cipte toplaniyor:
   * dar bir ekranda (SE, 320pt) grup adi + para birimi + avatarlar tek
   * satira sigmali.
   */
  const allMembers = members.state.kind === "ok" ? members.state.data.members : [];
  const shownMembers = allMembers.slice(0, 4);
  const overflowCount = allMembers.length - shownMembers.length;

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
    const fields = secondaryFieldsOf(expense);
    /**
     * KATEGORI PARCALARDAN AYRILIYOR cunku artik metin degil CIP.
     *
     * visibleSecondaryFields kategoriyi HER ZAMAN ekliyor (tarih ve odeyen
     * tekrar ederse eleniyor, kategori elenmiyor - expense-list-view.ts).
     * Yani kimlikle filtrelemek kesin. Yardimciyi kopyalamak yerine
     * ciktisini ayirmak, iki istemcinin ayni eleme kuralini paylasmaya
     * devam etmesi demek.
     */
    const parts = visibleSecondaryFields(
      fields,
      previous ? secondaryFieldsOf(previous) : null,
    ).filter((part) => part !== fields.category);

    /**
     * BOLUSUM TURU YENI. Tasarimda alt satir "Sen odedin · esit · yiyecek"
     * diye okunuyor; ortadaki parca bugune kadar hicbir istemcide yoktu.
     * Kisa bicim kullaniliyor ("esit"), form etiketi degil ("Esit bol").
     */
    parts.push(t(EXPENSE_SPLIT_TYPE_SHORT_CODES[expense.splitType]));

    const myShare = expense.participants.find(
      (participant) => participant.userId === currentUserId,
    );
    const isDeleted = Boolean(expense.deletedAt);

    /**
     * PAYIN RENGI ODEYENE BAKIYOR, paya degil: ben odediysem bu satir bana
     * ALACAK yaziyor, baskasi odediyse BORC. Tutar iki durumda da ayni sayi;
     * anlami degistiren kim odedigi.
     */
    const iPaid = expense.paidById === currentUserId;
    const share = shouldShowShare(myShare?.shareAmount, expense.amount)
      ? t("ui.your_share_amount", {
          amount: formatMoney(myShare!.shareAmount, currency, locale),
        })
      : undefined;

    return (
      <ExpenseRow
        key={expense.id}
        // SILINMIS SATIR DETAYA GITMIYOR: o ekran duzenleme ekrani ve
        // silinmis bir kayit duzenlenemiyor - sunucu da reddediyor.
        onPress={
          isDeleted
            ? undefined
            : () => router.push(`/groups/${groupId}/expenses/${expense.id}`)
        }
        label={expense.description}
        amount={formatMoney(expense.amount, currency, locale)}
        // Silinmis satirda alt satir tek sey soyluyor: neden soluk oldugu.
        meta={isDeleted ? t("ui.deleted_badge") : parts.join(" · ")}
        category={isDeleted ? undefined : t(EXPENSE_CATEGORY_CODES[expense.category])}
        share={share}
        shareTone={iPaid ? theme.credit : theme.debt}
        deleted={isDeleted}
        /**
         * FIS ISARETI. Kucuk bir ataç: "bu harcamaya bir sey ekli". KENDISI
         * DOKUNULABILIR ve satirdan AYRI is yapiyor - satir harcamayi aciyor,
         * isaret fotografi TAM EKRAN aciyor. Gercek kucuk resim degil simge:
         * her satira fotograf koymak listeyi acarken kirk indirme demekti.
         */
        mark={
          expense.receipt || (expense.commentCount ?? 0) > 0 ? (
            <View style={s.marks}>
              {expense.receipt ? (
                <Pressable
                  hitSlop={12}
                  onPress={() => setViewingReceipt(expense.id)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t("ui.receipt")}
                >
                  <Ionicons name="attach-outline" size={15} color={theme.copper} />
                </Pressable>
              ) : null}
              {/* YORUM ISARETI DOKUNULABILIR DEGIL - ve bu fis atacindan
                  bilincli olarak farkli. Ataç ayri bir is yapiyor (fotografi
                  tam ekran acmak); yorumlarin gidecegi yer zaten satirin
                  kendisinin actigi ekran. Ikinci bir hedef koymak, ayni yere
                  giden iki dokunus olurdu. */}
              {(expense.commentCount ?? 0) > 0 ? (
                <View
                  style={s.commentMark}
                  accessibilityLabel={t(
                    expense.commentCount === 1 ? "ui.comment_count_one" : "ui.comment_count_other",
                    { count: expense.commentCount ?? 0 },
                  )}
                >
                  <Ionicons name="chatbubble-outline" size={13} color={theme.copper} />
                  <Text style={s.commentCount}>{expense.commentCount}</Text>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
        action={
          isDeleted ? (
            <Pressable
              onPress={() => void restore(expense.id)}
              disabled={restoring === expense.id}
              hitSlop={8}
            >
              <Cap color={theme.brand}>
                {restoring === expense.id ? t("ui.saving") : t("ui.restore")}
              </Cap>
            </Pressable>
          ) : undefined
        }
      />
    );
  }

  const settled = myBalance === 0;
  const owed = myBalance > 0;

  // edges'te "bottom" YOK: alt payi eylem cubugu kendi tasiyor
  // (paddingBottom 34). Ikisi birden olunca cubuk yukari kaciyordu.
  return (
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
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
        {/*
          BASLIK BLOGU. Grup adi serif, yanindaki para birimi bakir bir
          etiket, sagda uyelerin bas harfleri bindirmeli.

          BASLIK CUBUGUNDA DA GRUP ADI YAZIYOR ve tekrar bilerek: orasi
          KAYDIRINCA yerinde kalan referans, burasi sayfanin kendi basligi.
          Ayni ikilik onceden de vardi (fisin "magaza adi" satiri).

          ZIL VE HESAP SIMGESI BURADA YOK - baslik cubugunda, screenOptions
          uzerinden her ekranda (header-actions.tsx).
        */}
        <View style={s.headerBlock}>
          <View style={s.headerTitleRow}>
            <Text style={s.headerName} numberOfLines={1}>
              {group.state.data.group.name}
            </Text>
            <Text style={s.headerCurrency}>{currency}</Text>
          </View>
          <View style={s.avatarStack}>
            {shownMembers.map((member, index) => (
              <View key={member.userId} style={index === 0 ? undefined : s.avatarOverlap}>
                <MemberAvatar
                  name={member.displayName}
                  me={member.userId === currentUserId}
                  size={30}
                />
              </View>
            ))}
            {overflowCount > 0 ? (
              <View style={s.avatarOverlap}>
                <View style={s.avatarMore}>
                  <Text style={s.avatarMoreText}>{`+${overflowCount}`}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/*
          BAKIYE KARTI. Ekranin tek koyu yuzeyi ve tek buyuk rakami.

          ODESME PLANI BU KARTIN ICINE GIRDI. Onceden iki ayri blokti: bakiye
          bir satir, plan fisin icinde ayri bir bolum. Ikisi ayni soruyu
          cevapliyor - "bu bakiyeyle ne yapacagim" - ve arayi acmak cevabi
          soruyu goren yerden uzaklastiriyordu (ADR-016).

          KART IKI TEMADA DA KOYU; ustundeki bakir tonlar bu yuzden temaya
          gore degismiyor (theme.copperOnCard / copperFigure).
        */}
        {!isEmpty ? (
          <View style={s.balanceCard}>
            {suggestions.length > 0 ? (
              <View style={s.stampSlot}>
                <Stamp color={theme.copperOnCard}>
                  {t(
                    suggestions.length === 1
                      ? "ui.settle_count_one"
                      : "ui.settle_count_other",
                    { count: suggestions.length },
                  )}
                </Stamp>
              </View>
            ) : null}

            {/*
              ETIKET YONU SOYLUYOR, "Bakiyen" demiyor - ve bu tasarimdan bir
              sapma degil, ONDA KAYBOLAN BIR BILGININ yerine konmasi.

              Eski ekranda yonu MUHUR tasiyordu ("sana borclular" /
              "borclusun" / "odestin"). Tasarimda muhur artik kac odemeyle
              kapandigini yaziyor, yani yon yalnizca rakamin isaretinde
              kalirdi. ADR-015'in yururlukteki yarisi bunu yasakliyor: anlam
              tek bir tasiyiciya yuklenmez. Etiket slotu zaten bostu.
            */}
            <Text style={s.balanceCap}>
              {settled
                ? t("ui.settled_up")
                : owed
                  ? t("ui.owed_to_you")
                  : t("ui.you_owe")}
            </Text>
            <Text style={s.balanceFigure}>
              {formatSignedMoney(myBalance, currency, locale)}
            </Text>

            {/* Beni ilgilendiren transferler. Her satir odesme ekranini o
                kisi ve o tutarla aciyor. */}
            {myTransfers.length > 0 ? (
              <>
                <View style={s.balanceDivider} />
                <View style={s.balanceRows}>
                  {myTransfers.map((transfer) => {
                    const iOwe = transfer.fromUserId === currentUserId;
                    const otherId = iOwe ? transfer.toUserId : transfer.fromUserId;
                    const reminded = remindedUserIds.has(otherId);
                    return (
                      <Pressable
                        key={`${transfer.fromUserId}-${transfer.toUserId}`}
                        style={s.balanceRow}
                        onPress={() =>
                          router.push(
                            iOwe
                              ? `/groups/${groupId}/settlements?to=${otherId}&amount=${transfer.amount}`
                              : `/groups/${groupId}/settlements?from=${otherId}&amount=${transfer.amount}`,
                          )
                        }
                      >
                        <Text style={s.balanceRowName} numberOfLines={1}>
                          {nameByUserId[otherId] ?? t("ui.unknown_user")}
                        </Text>
                        <View style={s.balanceLeader} />
                        <Text style={s.balanceRowAmount}>
                          {formatMoney(transfer.amount, currency, locale)}
                        </Text>
                        {/*
                          HATIRLATMA YALNIZCA BANA ODENECEK SATIRLARDA
                          (ADR-050): yon sabit, alacakli borcluya dokunuyor.
                          Kendi odemem gereken satirda karsiligi yok.

                          IC ICE PRESSABLE: disttaki satir odesme ekranini
                          aciyor, icteki dokunusu kendi ustune aliyor. Ayri
                          bir satira koysaydik ayni kisi kartta iki kez
                          gorunurdu.
                        */}
                        {!iOwe ? (
                          reminded ? (
                            <Text style={s.remindDone}>{t("ui.reminded")}</Text>
                          ) : (
                            <Pressable
                              onPress={() => void sendReminder(otherId)}
                              disabled={reminding !== null}
                              hitSlop={10}
                            >
                              <Text style={s.remindAction}>
                                {reminding === otherId
                                  ? t("ui.reminding")
                                  : t("ui.remind")}
                              </Text>
                            </Pressable>
                          )
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                {remindError ? (
                  <Text style={s.remindError}>{remindError}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {/* Beni ilgilendirmeyen transferler: kartin DISINDA ve soluk. Grubun
            takas plani dogru bir bilgi ama benim isim degil - o yuzden
            dokunulabilir de degil. */}
        {!isEmpty && others.length > 0 ? (
          <View style={s.othersBlock}>
            <Text style={s.planTitle}>{t("ui.other_suggested_payments")}</Text>
            {others.map((transfer) => (
              <Text
                key={`${transfer.fromUserId}-${transfer.toUserId}`}
                style={s.otherRow}
                numberOfLines={1}
              >
                {`${nameByUserId[transfer.fromUserId] ?? t("ui.unknown_user")} \u2192 ${
                  nameByUserId[transfer.toUserId] ?? t("ui.unknown_user")
                }  ${formatMoney(transfer.amount, currency, locale)}`}
              </Text>
            ))}
          </View>
        ) : null}

        <Receipt>
          {isEmpty ? (
            // Bos fis BOS gorunuyor: uydurma ornek satir konmuyor, cunku
            // gercek kayitlarla karisirdi (web'de de ayni karar).
            <>
              <Text style={s.emptyText}>{t("ui.no_expenses")}</Text>
              {/* SILINENLERE ACILAN TEK KAPI. Suzgec satiri bu dalda
                  cizilmiyor, o yuzden cip buraya ayrica konuyor - yoksa son
                  harcamasini silen kullanicinin geri donus yolu kalmiyor. */}
              <Pressable
                style={s.emptyDeletedLink}
                onPress={() => setShowDeleted(true)}
                hitSlop={8}
              >
                <Cap color={theme.brand}>{t("ui.show_deleted")}</Cap>
              </Pressable>
            </>
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
                      {/* Silinenler de bir CIP - web'de onay kutusu, burada
                          cipler zaten acik/kapali anlamini tasiyor. */}
                      <Pressable
                        style={[s.chip, showDeleted && s.chipActive]}
                        onPress={() => setShowDeleted((value) => !value)}
                      >
                        <Text style={[s.chipText, showDeleted && s.chipTextActive]}>
                          {t("ui.show_deleted")}
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
                    {/* AY BASLIGI ARTIK BAKIR CIZGILI BOLUM BASLIGI, perfore
                        satir degil - ve ayin toplami basligin SAGINDA. Onceden
                        toplam yalnizca ayin ALTINDA vardi, yani KAPALI bir ayda
                        hic gorunmuyordu. */}
                    {isOpen ? (
                      <SectionRule
                        label={formatMonth(slice.month, locale)}
                        value={formatMoney(slice.amount, currency, locale)}
                      />
                    ) : (
                      <Pressable onPress={() => toggleMonth(slice.month)}>
                        <SectionRule
                          label={`${formatMonth(slice.month, locale)}  ${state ? "▾" : "▸"}`}
                          value={formatMoney(slice.amount, currency, locale)}
                        />
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

        {/* NEREYE GITTI. Web'de fisin altinda duran kategori kirilimi;
            mobilde HIC YOKTU - oysa veri bastan beri /summary ile geliyordu.
            Web'deki iki kural aynen gecerli: hic harcama yoksa ve TEK
            kategori varsa blok cizilmiyor. Tek cubuk her zaman tam boy olur
            ve "%100" yazar - hicbir sey anlatmaz. */}
        {byCategory.length > 1 ? (
          <View style={s.categoryBlock}>
            <SectionRule label={t("ui.summary_by_category")} />
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
          <View style={s.membersBlock}>
            <SectionRule
              label={t("ui.members_and_balances")}
              value={t(
                memberBalances.length === 1
                  ? "ui.member_count_one"
                  : "ui.member_count_other",
                { count: memberBalances.length },
              )}
            />
            {memberBalances.map((member) => (
              <View key={member.userId} style={s.memberRow}>
                {/* Bas harfler, fotograf DEGIL: liste ucu adres dondurmuyor
                    ve her satira bir indirme koymak, ataç yerine kucuk resim
                    koymayi reddettigimiz gerekcenin aynisi. */}
                <MemberAvatar
                  name={member.displayName}
                  me={member.userId === currentUserId}
                />
                <View style={s.memberNames}>
                  <Text style={s.memberName} numberOfLines={1}>
                    {member.displayName}
                  </Text>
                  {/* AYRILMIS UYENIN BAKIYESI LISTEDE KALIYOR: borcu
                      ayrilmakla silinmiyor. Durum adin ALTINDA yaziyor. */}
                  {member.hasLeft ? (
                    <Text style={s.memberLeft}>{t("ui.member_left")}</Text>
                  ) : null}
                </View>
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

            {/* YONETIM BAGLANTILARI. Alt cubukta yalnizca iki dugme var
                ("Harcama ekle", "Odes"); uyeler ve grup ayarlari gunluk eylem
                degil, o yuzden listenin dibinde duz baglanti. Duzenleme
                YALNIZCA SAHIBE: uc de oyle davraniyor, olmayacak bir dugme
                sunup ardindan hata gostermek olurdu. */}
            <View style={s.memberLinks}>
              <Link href={`/groups/${groupId}/members`} asChild>
                <Pressable hitSlop={8}>
                  <Text style={s.cardLink}>{t("ui.manage_members")}</Text>
                </Pressable>
              </Link>
              {group.state.data.group.role === "OWNER" ? (
                <Link href={`/groups/${groupId}/edit`} asChild>
                  <Pressable hitSlop={8}>
                    <Text style={s.cardLink}>{t("ui.edit_group")}</Text>
                  </Pressable>
                </Link>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* KAYDEDILEN ODEMELER - web'de ayri bir bolum, mobilde yalnizca
            alttaki duz baglanti yiginindaydi.

            "Gruplarim" ve "Cikis yap" BURADAN KALKTI: birincisini baslik
            cubugundaki geri dugmesi karsiliyor, ikincisi Hesap ekraninda.
            Dordu yan yana duran duz metin, gezinme gibi gorunmuyordu. */}

        {/* HESAP BAGLANTISI ARTIK BURADA DEGIL - baslik cubugundaki kisi
            simgesine tasindi (components/header-actions.tsx).

            BURAYA KONMA SEBEBI OLCULMUS BIR KUSURDU ve o kusur HALA GECERLI:
            tek grubu olan kullanici uygulamayi acinca index.tsx onu Redirect
            ile dogrudan buraya dusuruyor; Redirect yigini DEGISTIRDIGI icin
            geri dugmesi hic dogmuyor. O kullanici hesabina ulasamazsa
            cikamiyor, silemiyor (App Store 5.1.1(v) zorunlu tutuyor) ve
            gruplar listesine gidemiyor.

            KALDIRMAK GUVENLI CUNKU simge screenOptions'ta: BU ekranda da,
            her ekranda da duruyor - yani eski cozumden fazlasini veriyor.
            Kaldirmadan once bu kontrol edildi; simgeyi basliktan alan,
            burayi geri koymak zorunda. */}
      </ScrollView>

      {/*
        SABIT EYLEM CUBUGU. ScrollView'in DISINDA: icinde olsaydi listeyle
        birlikte kayar ve kirk harcamali bir grupta yine dibe duserdi -
        yukari tasinmalarinin sebebi tam olarak buydu.

        BU BIR YON DEGISIKLIGI. Eylemler 6 Eylul'de fisin USTUNE alinmisti
        (ayni sorun, baska cozum); tasarim onlari alta SABITLIYOR. Ikisi de
        mesafe sorununu cozuyor, ama sabit cubuk listeyi kisaltmiyor.

        TASARIM BURADA GRADYAN MASKE ISTIYOR, BIZ DUZ ZEMIN + SAC TELI CIZGI
        KOYDUK. Gerekce bagimlilik: gradyan native bir modul (expo-linear-
        gradient) demek ve uygulamada bugun hic gradyan yok. Bu proje bir kez
        Expo surum kaymasi yuzunden CI'i kaybetti; SDK ile senkron tutulacak
        bir modulu SUSLEME icin eklemek kotu bir takas. Islevi - icerigin sert
        bir kenarla kesilmemesi - opak bir cubuk zaten karsiliyor.

        Gradyan gerekirse: expo-linear-gradient eklenip dev build yeniden
        alinmali, cunku mevcut build'de o modul yok.
      */}
      <View style={s.actionBar}>
        <Link href={`/groups/${groupId}/expenses/new`} asChild>
          <Pressable style={s.actionPrimary}>
            <Text style={s.actionPrimaryText}>{t("ui.add_expense")}</Text>
          </Pressable>
        </Link>
        <Link href={`/groups/${groupId}/settlements`} asChild>
          <Pressable style={s.actionSecondary}>
            <Text style={s.actionSecondaryText}>{t("ui.settle_action")}</Text>
          </Pressable>
        </Link>
      </View>
      </KeyboardAvoidingView>

      {/* FIS KATMANI. Ekranin en disinda: ScrollView'in icinde olsaydi
          kaydirmayla birlikte hareket ederdi. */}
      <ReceiptViewer
        visible={viewingReceipt !== null}
        uri={
          viewingReceipt
            ? `${apiBaseUrl()}/api/v1/groups/${groupId}/expenses/${viewingReceipt}/receipt`
            : ""
        }
        token={authToken}
        onClose={() => setViewingReceipt(null)}
      />
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

function createStyles(theme: Theme) {
  return StyleSheet.create({
    // Zemin fisten bir ton KOYU: kagidin bir yuzeyin uzerinde durdugunu
    // soyleyen sey bu.
    screen: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    /** Satir basligindaki isaretler: fis ataci ve yorum sayisi. */
    marks: { flexDirection: "row", alignItems: "center", gap: 8 },
    commentMark: { flexDirection: "row", alignItems: "center", gap: 3 },
    commentCount: { fontFamily: fonts.body, fontSize: 11, color: theme.copperText },
    // paddingBottom sabit eylem cubugunun yuksekligini karsiliyor: son
    // satir cubugun altinda kalmamali.
    scroll: { padding: 16, paddingBottom: 130 },
    /** BASLIK BLOGU. */
    headerBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 8,
      paddingBottom: 14,
    },
    headerTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 },
    // Serif ve 24 punto: ekranin tek serif basligi.
    headerName: { fontFamily: fonts.heading, fontSize: 24, color: theme.foreground, flexShrink: 1 },
    headerCurrency: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      letterSpacing: 1.5,
      color: theme.copperText,
    },
    avatarStack: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
    // Her avatar oncekinin uzerine 8 birim biniyor.
    avatarOverlap: { marginLeft: -8 },
    avatarMore: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.inputLine,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarMoreText: { fontFamily: fonts.body, fontSize: 10, color: theme.muted },

    /**
     * BAKIYE KARTI - ekranin tek koyu yuzeyi.
     * overflow: hidden SART: muhur donduruldugu icin kosesi karttan tasiyor.
     */
    balanceCard: {
      backgroundColor: theme.balanceCard,
      borderRadius: 4,
      padding: 20,
      overflow: "hidden",
      marginBottom: 20,
    },
    stampSlot: { position: "absolute", top: 14, right: 14 },
    balanceCap: {
      fontFamily: fonts.medium,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: theme.copperOnCard,
    },
    // 46 punto: uygulamadaki en buyuk sey. Negatif harf araligi olmadan
    // buyuk rakamlar dagilmis gorunuyor.
    balanceFigure: {
      fontFamily: fonts.semibold,
      fontSize: 46,
      lineHeight: 50,
      letterSpacing: -1.8,
      color: theme.copperFigure,
      fontVariant: ["tabular-nums"],
      paddingTop: 8,
    },
    /**
     * KARTIN KENDI IC CIZGILERI SABIT RENKTE ve bu bilincli: kart iki temada
     * da koyu petrol, yani uzerindeki cizgiler temayla degismemeli.
     * theme.border burada gorunmez olurdu.
     */
    balanceDivider: { height: 1, backgroundColor: "#2f5a4e", marginTop: 16, marginBottom: 12 },
    balanceRows: { gap: 7 },
    balanceRow: { flexDirection: "row", alignItems: "baseline" },
    balanceRowName: { fontFamily: fonts.body, fontSize: 13.5, color: "#e6efe9", flexShrink: 1 },
    balanceLeader: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dotted",
      borderColor: "#3f6a5d",
      marginHorizontal: 8,
      transform: [{ translateY: -4 }],
    },
    balanceRowAmount: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: "#ffffff",
      fontVariant: ["tabular-nums"],
    },
    /**
     * HATIRLATMA SATIR ICINDE, tutardan sonra. Renkler kartin kendi
     * paletinden: kart iki temada da koyu petrol, o yuzden temaya bagli
     * tokenlar burada okunmazdi (balanceDivider ile ayni gerekce).
     * Eylem bakir, sonucu ise solmus - ADR-021'e gore renk DURUM tasiyor
     * ve "hatirlatildi" artik bir eylem degil.
     */
    remindAction: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: theme.copperOnCard,
      marginLeft: 12,
    },
    remindDone: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: "#8fae9f",
      marginLeft: 12,
    },
    remindError: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: "#f0b7a8",
      marginTop: 8,
    },
    othersBlock: { gap: 4, marginBottom: 20 },

    membersBlock: { marginTop: 24 },
    memberLinks: { flexDirection: "row", gap: 20, paddingTop: 14 },
    memberNames: { flex: 1, gap: 1 },
    memberLeft: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },

    /**
     * EYLEM CUBUGU. position: absolute - ScrollView'in UZERINDE duruyor.
     * paddingBottom 34: home gostergesi payi (SafeAreaView'in alt kenari
     * bu ekranda kapali, yoksa iki pay ust uste binerdi).
     */
    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.lineSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 34,
    },
    actionPrimary: {
      flex: 1,
      height: 50,
      borderRadius: 3,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPrimaryText: { fontFamily: fonts.semibold, fontSize: 15.5, color: theme.onBrand },
    // Ikincil eylem CERCEVELI: iki dolgulu dugme hicbirini one cikarmazdi.
    actionSecondary: {
      height: 50,
      paddingHorizontal: 18,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.foreground,
      alignItems: "center",
      justifyContent: "center",
    },
    actionSecondaryText: { fontFamily: fonts.semibold, fontSize: 15.5, color: theme.foreground },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.background,
    },
    // KART DEGIL BOLUM. Bu ekrandaki son kutuydu; ADR-021 "kutu yerine
    // cizgi" diyor ve bolum artik bakir bir cizgiyle basliyor.
    categoryBlock: { marginTop: 24 },
    emptyDeletedLink: { marginTop: 10 },
    cardBody: { gap: 12, paddingTop: 14 },
    cardLink: { color: theme.brand, fontSize: 13, fontFamily: fonts.medium },
    catRow: { gap: 5 },
    catHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
    catName: { flex: 1, color: theme.foreground, fontFamily: fonts.body, fontSize: 14 },
    catAmount: { color: theme.muted, fontFamily: fonts.body, fontSize: 12 },
    catTrack: { height: 5, borderRadius: 3, backgroundColor: theme.surface, overflow: "hidden" },
    catFill: { height: "100%", borderRadius: 3, backgroundColor: theme.brand },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    memberName: { color: theme.foreground, fontFamily: fonts.body, fontSize: 14.5 },
    memberAmount: { fontSize: 14, fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] },
    stamp: {
      alignSelf: "flex-end",
      borderWidth: 1.5,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginTop: 6,
    },
    emptyText: { color: theme.muted, lineHeight: 22 },
    planTitle: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    otherRow: { fontFamily: fonts.body, fontSize: 13, color: theme.muted, paddingVertical: 2 },
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
    filterInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: theme.foreground, padding: 0 },
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
    chipText: { color: theme.foreground, fontFamily: fonts.body, fontSize: 14 },
    chipTextActive: { color: theme.onBrand, fontFamily: fonts.semibold },
    clearButton: { paddingHorizontal: 6, paddingVertical: 7 },
    foundBlock: { gap: 12 },
    matchLine: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    monthLoading: { paddingVertical: 12 },
    loadMore: { color: theme.brand, fontFamily: fonts.body, fontSize: 13, paddingVertical: 8 },
    totals: { gap: 4 },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: theme.onBrand, fontFamily: fonts.body, fontSize: 15 },
  });
}
