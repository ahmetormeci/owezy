import { fonts } from "../../../../lib/fonts";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SPLIT_TYPE_SHORT_CODES,
} from "@/lib/expense-labels";
import { guessCategory } from "@/lib/expense-category-guess";
import { guessReceiptAmount } from "@/lib/receipt-amount";
import { groupIntoLines, type TextBlock } from "@/lib/receipt-blocks";
import { readReceiptItems, sumItems, type ReceiptItemGuess } from "@/lib/receipt-items";
import { splitEqually } from "@/lib/split";
import { Field, FieldInput, SelectField } from "../../../../components/field";
import { formatMoney, formatMoneyForInput, parseMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../../lib/use-api";
import { useTheme, type Theme } from "../../../../lib/theme";
import { Cap } from "../../../../components/receipt";
import { apiBaseUrl } from "../../../../lib/api";
import { useSession } from "../../../../lib/auth";
import { pickReceipt, receiptEndpoint, uploadReceipt } from "../../../../lib/receipt-file";

/**
 * OCR MODULU TEMBEL VE KORUMALI YUKLENIYOR - sebebi olculdu, tahmin degil.
 *
 * modules/receipt-ocr NATIVE bir modul ve requireNativeModule MODUL GOVDESI
 * CALISIRKEN firliyor, cagrildiginda degil. Statik bir import yazildiginda
 * Expo Go'da BUTUN UYGULAMA aciliyordu:
 * expo-router rota agacini kurarken bu dosyayi da yukluyor, yukleme
 * firlatiyor ve ekranda "Cannot find native module" kaliyor. Dusen sey OCR degil, HARCAMA EKLEMENIN KENDISIYDI - ve onunla
 * birlikte uygulamanin tamami.
 *
 * isSupported BUNU YAKALAYAMAZ ve asagidaki "if (!ocrSupported) return"
 * satiri bu yuzden olu bir korumaydi: isSupported "cihaz metin okuyabiliyor
 * mu" sorusunun cevabi. "Modul bagli mi" BASKA bir soru ve cevabi ancak
 * yuklemeyi DENEYEREK aliniyor.
 *
 * URETIM BUILD'INI ETKILEMIYORDU - orada modul bagli. Bu yuzden testler
 * (modulu taklit ediyorlar) ve EAS build'i sorunu goremedi; yalnizca
 * simulatorde Expo Go ile acinca cikti.
 */
type ReceiptOcr = {
  isSupported: boolean;
  readBlocks: (uri: string) => Promise<TextBlock[]>;
};

let ocrResolved = false;
let ocr: ReceiptOcr | null = null;

function receiptOcr(): ReceiptOcr | null {
  if (!ocrResolved) {
    ocrResolved = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ocr = require("../../../../modules/receipt-ocr").default as ReceiptOcr;
    } catch {
      ocr = null;
    }
  }
  return ocr;
}

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
 *
 * IKI ADIM, VE SIRASI KEYFI DEGIL: bolusme ekrani TUTARA BAGIMLI. "Tam
 * tutar" kipinde kalan hesabi tutar girilmeden hicbir sey anlatmiyor
 * (hedef sifir olur, her sey fazla gorunur); yuzde kipinde de dagitilan
 * payin karsiligi gosterilemiyor. Yani "ne aldin, kac para" gercekten
 * "kim odedi, nasil bolusulecek"in oncesinde duruyor.
 *
 * ADIM 2'DE TUTAR BASLIKTA TEKRAR YAZIYOR: kullanici neyi bolusturdugunu
 * gormeden pay dagitamaz.
 */
type Member = { userId: string; displayName: string };
type MembersResponse = { members: Member[] };
type MeResponse = { user: { id: string } };
type GroupResponse = { group: { id: string; name: string; currency: string } };

type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "ITEMIZED";

/** Formdaki bir kalem satiri. Tutar METIN: kullanici yazarken ara hallerden gecer. */
type ItemDraft = { description: string; amountText: string; userIds: string[] };

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
  /**
   * ITEMIZED icin kalemler (ADR-052). BIR BOS satirla basliyor: sifir
   * satirli bir liste, kullaniciya once "ekle"ye basmayi ogretmek olurdu.
   */
  const [items, setItems] = useState<ItemDraft[]>([
    { description: "", amountText: "", userIds: [] },
  ]);
  /**
   * KATEGORI. Kullanici SECMEDIYSE null kaliyor ve gonderilmiyor - sunucu o
   * zaman aciklamadan kendisi tahmin ediyor (ADR-028: karari sunucu verir).
   * Tahmin ekranda GORUNUYOR ama secim olarak yazilmiyor: gorunen ile
   * kaydedilen ayrismasin diye ikisi ayni saf fonksiyondan geciyor, tipki
   * hizli ekleyicideki gibi.
   */
  const [category, setCategory] = useState<keyof typeof EXPENSE_CATEGORY_CODES | null>(null);
  /**
   * TEKRARLAMA (ADR-051). Web'deki ile ayni yerde duran ayni anahtar:
   * tekrarlayan bir harcama, bir harcamanin TA KENDISI arti bir donem -
   * ayri bir form ayni alanlari ikinci kez yazmak olurdu.
   *
   * BASLANGIC HEP BUGUN: bu formda tarih alani yok (hizli giris icin
   * bilerek), yani sablonun ilk donemi de bugun. Gecmise donuk bir sablon
   * kurmak web'de mumkun.
   */
  const [repeats, setRepeats] = useState(false);
  const [interval, setInterval] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const { getToken } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * SECILEN AMA HENUZ YUKLENMEMIS fis. Harcama kaydedilene kadar
   * baglanacagi bir kimlik yok, o yuzden cihazda bekliyor.
   */
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  /**
   * HARCAMA KAYDEDILDI AMA FIS YUKLENEMEDI durumu.
   *
   * Kimligi tutuyoruz cunku "Kaydet" dugmesine tekrar basmak IKINCI BIR
   * HARCAMA yaratmamali - kullanicinin gozunde islem tamamlanmadi ama
   * sunucuda harcama duruyor. Bu deger doluysa dugme yalnizca FISI tekrar
   * deniyor.
   */
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(null);

  /**
   * FISTEN OKUNAN TUTARIN NEREDEN GELDIGI (ADR-053). null ise okuma
   * yapilmadi ya da bir sey bulunamadi.
   */
  const [readFrom, setReadFrom] = useState<"labelled" | "largest" | null>(null);
  const [reading, setReading] = useState(false);

  /**
   * FISTEN CIKAN KALEMLER (ADR-055) ve hangilerinin SECILI oldugu.
   *
   * HICBIRI SECILI BASLAMIYOR. Bir fisten cikan liste her zaman biraz
   * gurultu tasir - kampanya satiri, kur bilgisi, kod. Hepsini isaretli
   * acmak, kullanicinin bakmadan kaydetmesine davet olurdu; oysa listenin
   * varlik sebebi tam da BAKIP SECMESI.
   */
  const [foundItems, setFoundItems] = useState<ReceiptItemGuess[] | null>(null);
  const [pickedItems, setPickedItems] = useState<Record<number, boolean>>({});
  /**
   * FISIN KENDI TOPLAMI. Secilenlerin toplamiyla KARSILASTIRMAK icin
   * duruyor: OCR bir satiri okuyamazsa fark buradan gorunur ve kullanici
   * eksigi fark eder. Yoksa sessizce eksik bir harcama kaydedilirdi.
   */
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);

  async function chooseReceipt(source: "camera" | "library") {
    const picked = await pickReceipt(source);
    if (picked.kind === "cancelled") return;
    if (picked.kind === "error") {
      setError(t(picked.code));
      return;
    }
    setError(null);
    setReceiptUri(picked.uri);
    void readAmountFromReceipt(picked.uri);
  }

  /**
   * Fisi CIHAZDA okur ve tutar alanini doldurur (ADR-053).
   *
   * FOTOGRAF HICBIR YERE GITMIYOR: modules/receipt-ocr iOS'ta Apple
   * Vision kullaniyor ve cihaz uzerinde calisiyor. Bu yuzden yeni bir veri
   * isleyici yok - gizlilik politikasi ve App Privacy beyani AYNI kaliyor.
   *
   * YAZILANI ASLA EZMIYOR. Kategori tahmininin (ADR-028) kuralinin
   * aynisi: tahmin ancak alan BOSKEN konusuyor. Kullanici tutari yazip
   * sonra fis eklerse yazdigi kalir - eziliyor olsaydi bu, sessizce
   * yanlis bir harcama demekti.
   *
   * HICBIR HATA YUKARI CIKMIYOR. OCR bir kolaylik; desteklenmiyorsa,
   * fotograf okunamiyorsa ya da modul patlarsa kullanici tutari elle
   * yazmaya devam ediyor. Bunun icin bir hata gostermek, olmayan bir
   * arizayi varmis gibi sunmak olurdu.
   */
  async function readAmountFromReceipt(uri: string) {
    const engine = receiptOcr();
    if (!engine?.isSupported) return;

    setReading(true);
    try {
      const blocks = await engine.readBlocks(uri);
      /**
       * PARCALAR ONCE GORSEL SATIRLARA TOPLANIYOR (ADR-055). Vision fisi
       * satir satir vermiyor; ad solda, tutar sagda ve ikisi ayri gozlem.
       * Gruplama olmadan "TOPLAM" etiketi ile tutari bile ayri kaliyor ve
       * toplam YANLIS okunuyordu.
       */
      const lines = groupIntoLines(blocks);

      // Okuma sirasinda kullanici yazmis olabilir - yazdigini EZMIYORUZ.
      if (amountTextRef.current.trim() === "") {
        const guess = guessReceiptAmount(lines.map((line) => line.text));
        if (guess) {
          setAmountText(formatMoneyForInput(guess.amount, locale));
          setReadFrom(guess.source);
          setReceiptTotal(guess.amount);
        }
      }

      /**
       * KALEMLER AYRI BIR TEKLIF. Tutardan farkli olarak alana YAZILMIYOR,
       * kullaniciya LISTE olarak sunuluyor: istedigini birakir, istemedigini
       * cikarir. Hicbiri secili baslamiyor - bir fisten cikan liste her
       * zaman biraz gurultu tasiyor ve sessizce hepsini isaretlemek,
       * kullanicinin bakmadan kaydetmesine davet olurdu.
       */
      const found = readReceiptItems(lines);
      if (found.length > 0) setFoundItems(found);
    } catch {
      // Yukaridaki gerekce.
    } finally {
      setReading(false);
    }
  }

  /** Secili kalemler, fisteki sirayla. */
  const chosenItems = (foundItems ?? []).filter((_, index) => pickedItems[index]);
  const chosenTotal = sumItems(chosenItems);

  /**
   * SECILEN KALEMLERI FORMA TASIR ve bolusumu KALEM KALEM'e cevirir.
   *
   * TUTAR KALEMLERDEN HESAPLANIYOR, fisin toplamindan DEGIL. Ikisi
   * neredeyse hic tutmaz - poset, indirim, yuvarlama, okunamayan satir.
   * Fisin toplamini birakip kalemleri de yazmak SUM(kalem) = tutar
   * degismezini kirardi ve o degismez veritabaninda bir trigger'la
   * zorunlu (ADR-052): kayit sunucuda reddedilirdi.
   *
   * KIMIN PAYLASTIGI BOS BIRAKILIYOR. Fis kimin ne yedigini bilmiyor; onu
   * doldurmak uydurmak olurdu. Kullanici her kalemde kendisi isaretliyor.
   */
  function useChosenItems() {
    if (chosenItems.length === 0) return;
    setItems(
      chosenItems.map((item) => ({
        description: item.description,
        amountText: formatMoneyForInput(item.amount, locale),
        userIds: [],
      })),
    );
    /**
     * TUTAR ALANI DA GUNCELLENIYOR ve bu sart, susleme degil.
     *
     * ITEMIZED'da kaydedilen tutar kalemlerden hesaplaniyor (itemsTotal),
     * ama ekranin ustundeki alan amountText'i gosteriyor. Guncellenmeseydi
     * ust tarafta fisin toplami (366,68) durur, kayit ise kalemlerin
     * toplamiyla (128,90) giderdi - ekranda bir sey gorunup baskasi
     * kaydedilirdi. Bir ekran testi tam bunu yakaladi.
     */
    setAmountText(formatMoneyForInput(chosenTotal, locale));
    setSplitType("ITEMIZED");
    setFoundItems(null);
    setPickedItems({});
  }

  /**
   * Fisi yukler. Basarisizsa harcamanin kimligini SAKLIYOR ki dugme ayni
   * harcamayi yeniden yaratmasin, yalnizca fisi tekrar denesin.
   */
  async function sendReceipt(expenseId: string): Promise<boolean> {
    if (!receiptUri) return true;
    setBusy(true);
    const upload = await uploadReceipt(
      receiptUri,
      receiptEndpoint(apiBaseUrl(), groupId, expenseId),
      await getToken(),
    );
    setBusy(false);

    if (!upload.ok) {
      setSavedExpenseId(expenseId);
      // Iki cumle birlikte: harcamanin KAYDEDILDIGINI soylemek sart, yoksa
      // kullanici hicbir seyin olmadigini sanip bastan girer.
      setError(`${t("ui.expense_saved_receipt_failed")} ${t(upload.code)}`);
      return false;
    }
    return true;
  }

  function askReceiptSource() {
    Alert.alert(t("ui.add_receipt"), undefined, [
      { text: t("ui.take_photo"), onPress: () => void chooseReceipt("camera") },
      { text: t("ui.choose_from_library"), onPress: () => void chooseReceipt("library") },
      { text: t("ui.cancel"), style: "cancel" },
    ]);
  }

  const memberList = members.state.kind === "ok" ? members.state.data.members : [];
  const currency = group.state.kind === "ok" ? group.state.data.group.currency : "TRY";
  const currentUserId = me.state.kind === "ok" ? me.state.data.user.id : null;

  // Odeyen varsayilani BEN, cunku en sik durum bu. Kullanici degistirebiliyor -
  // hizli ekleyicide degistiremiyordu ve bu ekranin varlik sebeplerinden biri o.
  const payer = paidById ?? currentUserId;
  const amount = parseMoney(amountText);

  /**
   * TUTAR ALANININ GUNCEL HALI, REF'TE. Fis okuma birkac saniye suruyor
   * ve o sirada kullanici tutari yazmis olabilir; kapanista okunan
   * amountText O ANIN degeri olurdu ve yazdigini ezerdik.
   */
  const amountTextRef = useRef(amountText);
  useEffect(() => {
    amountTextRef.current = amountText;
  });
  // Tahmin BURADA DA hesaplaniyor ama GONDERILMIYOR - yalnizca ipucu satiri
  // icin. Karari sunucu veriyor; ekranda gorunen ile kaydedilen ayrismasin
  // diye ikisi ayni saf fonksiyondan geciyor (hizli ekleyiciyle ayni desen).
  const guessed = guessCategory(description);

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

  /**
   * ESIT BOLUSUMDE HER SATIRIN PAYI. Onceden yalnizca onay kutusu vardi,
   * yani kullanici kimin ne odeyecegini KAYDETTIKTEN SONRA goruyordu.
   *
   * Hesap sunucununkiyle AYNI FONKSIYONDAN geciyor (src/lib/split.ts), yani
   * ekranda gorunen kurus ile kaydedilen kurus ayrisamaz - kusuratin kime
   * yazildigi dahil. Ayni dosyayi iki istemci de kullaniyor.
   */
  const equalShares = useMemo(() => {
    if (splitType !== "EQUAL" || amount === null || amount <= 0) return null;
    if (participants.length === 0) return null;
    const rows = splitEqually({
      amount,
      participantUserIds: participants.map((member) => member.userId),
    });
    return Object.fromEntries(rows.map((row) => [row.userId, row.amount]));
  }, [splitType, amount, participants]);

  /** Kalem toplami - hepsi gecerliyse. Bir tanesi bile bos ise null. */
  const itemsTotal =
    splitType === "ITEMIZED"
      ? items.reduce<number | null>((total, item) => {
          if (total === null) return null;
          const value = parseMoney(item.amountText);
          return value === null ? null : total + value;
        }, 0)
      : null;

  function updateItem(index: number, changes: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, at) => (at === index ? { ...item, ...changes } : item)),
    );
  }

  function toggleItemMember(index: number, userId: string) {
    setItems((current) =>
      current.map((item, at) =>
        at === index
          ? {
              ...item,
              userIds: item.userIds.includes(userId)
                ? item.userIds.filter((candidate) => candidate !== userId)
                : [...item.userIds, userId],
            }
          : item,
      ),
    );
  }

  /** Kusuratin kime yazildigi GORUNUR olmali - tasarimin kendi ifadesi. */
  const roundingGoesTo = equalShares
    ? (participants.find((m) => equalShares[m.userId] === Math.max(...Object.values(equalShares)))
        ?.userId ?? null)
    : null;

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
      // Buraya ancak /api/v1/me yuklenmediyse dusulur. Onceden burada
      // "Beklenmeyen bir hata" yaziyordu ve kullaniciya HICBIR SEY
      // anlatmiyordu - kullanici bu hatayi 29 Agustos'ta gordu, sebebi de
      // sunucunun kapali olmasiydi.
      setError(t("server.offline"));
      return;
    }

    let body: Record<string, unknown>;
    if (splitType === "ITEMIZED") {
      const parsed = items.map((item) => ({
        description: item.description.trim(),
        amount: parseMoney(item.amountText),
        userIds: item.userIds,
      }));
      if (parsed.some((item) => item.description === "")) {
        setError(t("ui.each_item_description_required"));
        return;
      }
      if (parsed.some((item) => item.amount === null || item.amount <= 0)) {
        setError(t("ui.each_item_amount_required"));
        return;
      }
      if (parsed.some((item) => item.userIds.length === 0)) {
        setError(t("split.item_no_participants"));
        return;
      }
      // KATILIMCI LISTESI GONDERILMIYOR: sunucu onu kalem atamalarindan
      // turetiyor (ADR-052).
      body = { items: parsed };
    } else if (splitType === "EQUAL") {
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

    // Harcama zaten kaydedildi, yalnizca fis kalmisti: tekrar YARATMIYORUZ.
    if (savedExpenseId) {
      if (await sendReceipt(savedExpenseId)) router.back();
      return;
    }

    /**
     * TEKRARLAYAN OLARAK KAYDEDILIYORSA BASKA BIR UCA GIDIYOR ve donen sey
     * bir harcama degil bir SABLON - yani baglanacak bir fis kimligi de yok.
     * Fis satiri bu dalda zaten cizilmiyor.
     */
    if (repeats) {
      setBusy(true);
      const created = await post(`/api/v1/groups/${groupId}/recurring-expenses`, {
        description: description.trim(),
        amount,
        paidById: payer,
        splitType,
        ...(category ? { category } : {}),
        ...body,
        interval,
        // Bugun. toISOString'in ilk on karakteri "YYYY-MM-DD" ve sunucu
        // bunu UTC gece yarisi olarak okuyor - tarih kolonlarinin her
        // yerdeki kurali (expenses.ts monthKeyToRange).
        startsOn: new Date().toISOString().slice(0, 10),
      });
      setBusy(false);

      if (!created.ok) {
        setError(t(created.code, created.params));
        return;
      }
      router.back();
      return;
    }

    setBusy(true);
    const result = await post<{ expense: { id: string } }>(`/api/v1/groups/${groupId}/expenses`, {
      description: description.trim(),
      amount,
      paidById: payer,
      splitType,
      // Secilmediyse HIC gonderilmiyor; sunucu tahmin ediyor.
      ...(category ? { category } : {}),
      ...body,
    });
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }

    /**
     * FIS HARCAMADAN SONRA YUKLENIYOR ve baska turlusu mumkun degil:
     * fotograf bir harcamaya baglaniyor ve harcama bu satira kadar YOKTU -
     * baglanacak kimlik yeni dogdu.
     *
     * KISMI BASARISIZLIK MUMKUN ve kullanicidan SAKLANMIYOR: harcama
     * kaydedildi ama fis yuklenemedi olabilir. O durumda ekranda kaliyoruz
     * ve ne olduğunu soyluyoruz - "kaydedildi" deyip geri donmek, kullaniciyi
     * fisin de gittigi sanisiyla birakirdi. Veri kaybi yok: harcamayi acip
     * fisi tekrar ekleyebiliyor.
     */
    if (receiptUri && !(await sendReceipt(result.data.expense.id))) {
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

  /**
   * YUKLEME BASARISIZSA FORM GOSTERILMIYOR.
   *
   * Onceden yalnizca "loading" ele aliniyordu; "error" durumunda ekran BOS
   * BIR FORM ciziyor, kullanici dolduruyor ve kaydederken anlamsiz bir hata
   * aliyordu. Uye listesi bos oldugu icin odeyen de secilemiyordu ama bu
   * hicbir yerde yazmiyordu.
   */
  if (members.state.kind === "error" || group.state.kind === "error") {
    const text = members.state.kind === "error" ? members.state.text : "";
    return (
      <SafeAreaView style={s.centered} edges={["bottom", "left", "right"]}>
        <Text style={s.error}>{text || t("server.offline")}</Text>
      </SafeAreaView>
    );
  }

  return (
    // edges'te "bottom" YOK: alt payi fis satiri kendi tasiyor.
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
      {/*
        KENDI BASLIK CUBUGUMUZ. Yerlesik baslik kapali cunku tasarim uc sey
        istiyor: solda "Vazgec", ortada serif baslik, sagda "Kaydet".
        Yerlesik cubuk kaydetmeyi sagda tasiyamiyor ve basligi serif
        yapamiyor.

        KAYDET BURADA, SAYFANIN DIBINDE DEGIL: form uzun ve kaydetmek icin
        sonuna kadar kaydirmak gerekiyordu. Ustte duruyor, hep gorunur.
      */}
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} disabled={busy}>
          <Text style={s.headerCancel}>{t("ui.cancel")}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("ui.add_expense")}</Text>
        <Pressable testID="save" onPress={() => void submit()} hitSlop={10} disabled={busy}>
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
          {/*
            TUTAR EN USTTE VE EN BUYUK - ve bu sira KEYFI DEGIL.

            Ekran bir zamanlar IKI ADIMDI ve gerekcesi soyleydi: bolusme
            arayuzu TUTARA BAGIMLI, "tam tutar" kipinde kalan hesabi tutar
            girilmeden hicbir sey anlatmiyor. O bagimlilik hala gecerli -
            ama onu saglayan sey adim SINIRI degil SIRA. Tutar formun ilk
            alani oldugu surece, bolusme bolumune gelindiginde tutar zaten
            girilmis oluyor. Adim bu yuzden kaldirildi.
          */}
          <View style={s.amountBlock}>
            <Text style={s.fieldLabel}>{t("ui.amount").toLocaleUpperCase(locale)}</Text>
            <View style={s.amountRow}>
              <FieldInput
                testID="amount"
                style={s.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder={t("ui.amount_placeholder")}
                editable={!busy}
              />
              <Text style={s.amountCurrency}>{currency}</Text>
            </View>
            {/* Para birimi degistirilemez - degistirilemez kural (ADR-008).
                Ekranda yazmasi, olmayan bir denetimi aramayi onluyor. */}
            <Text style={s.amountNote}>{t("ui.currency_from_group")}</Text>
            {/* FISTEN OKUNDUYSA SOYLE (ADR-053). Sessizce doldurmak,
                kullaniciya kendi yazmadigi bir tutari kendi yazmis gibi
                gostermek olurdu - ve o tutar kontrol edilmeden kaydedilirdi.
                Etiketli okuma ile yedek yol AYRI cumleler: ikincisi daha
                zayif ve bunu saklamiyoruz. */}
            {reading ? (
              <Text style={s.amountNote}>{t("ui.reading_receipt")}</Text>
            ) : readFrom ? (
              <Text style={s.amountRead}>
                {t(readFrom === "labelled" ? "ui.amount_from_total" : "ui.amount_from_receipt")}
              </Text>
            ) : null}
          </View>

          <View style={s.fields}>
            <Field label={t("ui.description")}>
              <FieldInput
                testID="description"
                style={s.fieldInput}
                value={description}
                onChangeText={setDescription}
                placeholder={t("ui.description_placeholder")}
                editable={!busy}
              />
            </Field>

            {/* ODEYEN VE KATEGORI YAN YANA: ikisi de tek kelimelik kararlar,
                tam genislik hak etmiyorlar. */}
            <View style={s.fieldRow}>
              <SelectField
                label={t("ui.payer")}
                style={s.half}
                value={
                  memberList.find((member) => member.userId === payer)?.displayName ?? "—"
                }
                options={memberList.map((member) => ({
                  key: member.userId,
                  label: member.displayName,
                }))}
                onChange={setPaidById}
                disabled={busy}
              />
              {/*
                KATEGORI SECILMEZSE SUNUCU TAHMIN EDIYOR (ADR-028) ve etiketin
                yaninda "tahmin" yaziyor. Tahmin BIR SECIM DEGIL: alan bos
                kaliyor, gonderilmiyor, karari sunucu veriyor. Ekranda gorunen
                ile kaydedilen ayrismasin diye ikisi ayni saf fonksiyondan
                geciyor.
              */}
              <SelectField
                label={t("ui.category")}
                style={s.half}
                hint={category === null && guessed ? t("ui.guess_hint") : undefined}
                value={t(
                  EXPENSE_CATEGORY_CODES[category ?? guessed ?? "OTHER"],
                )}
                options={EXPENSE_CATEGORY_OPTIONS.map(([value, code]) => ({
                  key: value,
                  label: t(code),
                }))}
                onChange={setCategory}
                disabled={busy}
              />
            </View>
          </View>

          <View style={s.splitBlock}>
            <Text style={s.fieldLabel}>{t("ui.split_type").toLocaleUpperCase(locale)}</Text>
            {/* DORT ESIT SEGMENT, cip yigini degil: secenek sayisi sabit ve
                birbirini disliyorlar - segment tam olarak bunu anlatiyor.
                Ucken de oyleydi; kalem kalem (ADR-052) dorduncusu oldu ve
                kisa etiketler (EXPENSE_SPLIT_TYPE_SHORT_CODES) dar ekranda
                da sigiyor. */}
            <View style={s.segments}>
              {(["EQUAL", "EXACT", "PERCENTAGE", "ITEMIZED"] as const).map((type) => {
                const active = splitType === type;
                return (
                  <Pressable
                    key={type}
                    style={[s.segment, active && s.segmentOn]}
                    onPress={() => setSplitType(type)}
                    disabled={busy}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextOn]}>
                      {t(EXPENSE_SPLIT_TYPE_SHORT_CODES[type])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {splitType === "ITEMIZED" ? (
              /*
                KALEM EDITORU (ADR-052).
                UYE ONAY KUTULARI BURADA HIC YOK: katilimcilar kalem
                atamalarinin BIRLESIMI. Ikisi birden dursaydi
                celisebilirlerdi.
              */
              <View style={s.itemsBlock}>
                <Text style={s.itemsHint}>{t("ui.items_hint")}</Text>

                {items.map((item, index) => (
                  <View key={index} style={s.itemCard}>
                    <View style={s.itemTop}>
                      <FieldInput
                        testID={`item-name-${index}`}
                        style={s.itemName}
                        value={item.description}
                        onChangeText={(value) => updateItem(index, { description: value })}
                        placeholder={t("ui.item_description")}
                        editable={!busy}
                      />
                      <FieldInput
                        testID={`item-amount-${index}`}
                        style={s.itemAmount}
                        value={item.amountText}
                        onChangeText={(value) => updateItem(index, { amountText: value })}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        editable={!busy}
                      />
                      {/* TEK KALEM KALDIYSA CIKARMA YOK: bos bir liste,
                          kaydi imkansiz bir forma birakirdi. */}
                      {items.length > 1 ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() =>
                            setItems((current) => current.filter((_, at) => at !== index))
                          }
                          disabled={busy}
                        >
                          <Text style={s.itemRemove}>×</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={s.itemPeople}>
                      {memberList.map((member) => {
                        const on = item.userIds.includes(member.userId);
                        return (
                          <Pressable
                            key={member.userId}
                            style={[s.itemChip, on && s.itemChipOn]}
                            onPress={() => toggleItemMember(index, member.userId)}
                            disabled={busy}
                          >
                            <Text
                              style={[s.itemChipText, on && s.itemChipTextOn]}
                              numberOfLines={1}
                            >
                              {member.displayName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    setItems((current) => [
                      ...current,
                      { description: "", amountText: "", userIds: [] },
                    ])
                  }
                  disabled={busy || items.length >= 50}
                >
                  <Cap color={theme.brand}>{t("ui.add_item")}</Cap>
                </Pressable>

                {/* KALEM TOPLAMI VE FARK - kullanici bahsisi/indirimi
                    kaydetmeden ONCE gormeli. */}
                {itemsTotal !== null ? (
                  <View style={s.itemsSummary}>
                    <View style={s.itemsSummaryRow}>
                      <Text style={s.itemsSummaryLabel}>{t("ui.items_total")}</Text>
                      <Text style={s.itemsSummaryValue}>
                        {formatMoney(itemsTotal, currency, locale)}
                      </Text>
                    </View>
                    {amount !== null && amount !== itemsTotal ? (
                      <View style={s.itemsSummaryRow}>
                        <Text style={s.itemsSummaryLabel}>
                          {amount > itemsTotal ? t("ui.items_tip") : t("ui.items_discount")}
                        </Text>
                        <Text style={s.itemsSummaryValue}>
                          {formatMoney(Math.abs(amount - itemsTotal), currency, locale)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : splitType === "EQUAL" ? (
              <View>
                {memberList.map((member) => {
                  const on = touchedSelection ? !!selected[member.userId] : true;
                  const share = on ? equalShares?.[member.userId] : undefined;
                  return (
                    <Pressable
                      key={member.userId}
                      style={s.splitRow}
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
                      <Text
                        style={[s.splitName, !on && s.splitNameOff]}
                        numberOfLines={1}
                      >
                        {member.displayName}
                      </Text>
                      <View style={s.leader} />
                      {/* PAY SATIRDA GORUNUYOR. Onceden yalnizca kutu vardi:
                          kullanici kimin ne odeyecegini ancak kaydettikten
                          sonra ogreniyordu. */}
                      <Text style={[s.splitAmount, !on && s.splitNameOff]}>
                        {share === undefined
                          ? "—"
                          : formatMoney(share, currency, locale)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View>
                {memberList.map((member) => (
                  <View key={member.userId} style={s.splitRow}>
                    <Text style={s.splitName} numberOfLines={1}>
                      {member.displayName}
                    </Text>
                    <View style={s.leader} />
                    <FieldInput
                      style={s.shareInput}
                      value={shareText[member.userId] ?? ""}
                      onChangeText={(value) =>
                        setShareText((current) => ({ ...current, [member.userId]: value }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={splitType === "EXACT" ? "0,00" : "0"}
                      editable={!busy}
                    />
                  </View>
                ))}
                {/* KALAN, canli: kullanici tutari dagitirken ne kadarinin
                    acikta oldugunu gormeli, kaydete basip hatayla
                    karsilasmamali. */}
                <Text style={[s.remainder, remainder !== 0 && { color: theme.debt }]}>
                  {splitType === "EXACT"
                    ? formatMoney(remainder, currency, locale)
                    : `%${(remainder / 100).toLocaleString(locale)}`}
                </Text>
              </View>
            )}

            {/* CIFT CIZGI VE TOPLAM - fisin kapanisi. Kusuratin kime
                yazildigi burada YAZIYOR: "eşit" bolusumde kurus tam
                bolunmuyor ve kimin bir kurus fazla odedigi gorunmeli. */}
            {/* CIFT CIZGI IKI AYRI CIZGI olarak. React Native
                borderStyle: "double" DESTEKLEMIYOR: 3px'i tek kalin bir
                cizgi olarak ciziyor ve fisin kapanis isareti kayboluyor. */}
            <View style={s.doubleRule}>
              <View style={s.rule} />
              <View style={s.rule} />
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>
                {roundingGoesTo === currentUserId
                  ? t("ui.total_rounding_yours")
                  : t("ui.summary_total").toLocaleUpperCase(locale)}
              </Text>
              <Text style={s.totalAmount}>
                {formatMoney(amount ?? 0, currency, locale)}
              </Text>
            </View>
          </View>

          {/*
            TEKRARLAMA (ADR-051). Bolusumun ALTINDA: once "kim ne oder",
            sonra "her donem tekrarlansin mi". Fisin USTUNDE cunku fis bu
            dalda hic cizilmiyor.
          */}
          {/* ITEMIZED'DA HIC CIZILMIYOR: kalem kalem bir SABLON yok
              (ADR-052) - cizilseydi kullanici isaretler ve sunucudan
              dogrulama hatasi alirdi. */}
          {splitType === "ITEMIZED" ? null : (
          <View style={s.repeatBlock}>
            <Pressable
              style={s.repeatRow}
              onPress={() => setRepeats((current) => !current)}
              disabled={busy}
            >
              <View style={[s.box, repeats && s.boxOn]}>
                {repeats ? <Text style={s.tick}>✓</Text> : null}
              </View>
              <Text style={s.repeatLabel}>{t("ui.repeat_this")}</Text>
            </Pressable>

            {repeats ? (
              <>
                <Text style={s.repeatHint}>{t("ui.repeat_hint")}</Text>
                {/* IKI ESIT SEGMENT - bolusum turuyle ayni desen: secenek
                    sayisi sabit ve birbirini disliyorlar. */}
                <View style={s.segments}>
                  {(["WEEKLY", "MONTHLY"] as const).map((value) => {
                    const active = interval === value;
                    return (
                      <Pressable
                        key={value}
                        style={[s.segment, active && s.segmentOn]}
                        onPress={() => setInterval(value)}
                        disabled={busy}
                      >
                        <Text style={[s.segmentText, active && s.segmentTextOn]}>
                          {t(value === "WEEKLY" ? "ui.repeat_weekly" : "ui.repeat_monthly")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          {/*
            FIS EN ALTTA. Fotograf SIMDI YUKLENMIYOR, cihazda BEKLIYOR:
            baglanacagi harcama henuz yok. Kayit basarili olunca gonderiliyor.

            TEKRARLAYANDA HIC CIZILMIYOR: sablonun fotografi olmaz - bagli
            oldugu bir harcama yok, uretilenler ise her donem ayri kayitlar.
          */}
          {repeats ? null : receiptUri ? (
            <View style={s.receiptRow}>
              <Image source={{ uri: receiptUri }} style={s.receiptThumb} />
              <View style={s.receiptText}>
                <Text style={s.receiptLabel}>{t("ui.receipt")}</Text>
                <Text style={s.receiptHint}>{t("ui.receipt_will_be_attached")}</Text>
              </View>
              <Pressable hitSlop={10} onPress={askReceiptSource} disabled={busy}>
                <Cap>{t("ui.replace_receipt")}</Cap>
              </Pressable>
            </View>
          ) : (
            /* BOS DURUM BIR HEDEF, bir cumle degil - duz metin tiklanabilir
               gorunmuyor ve kullanici bunu bildirdi. Kesikli kare + bakir
               arti, tasarimin kendi ifadesi. */
            <Pressable style={s.receiptRow} onPress={askReceiptSource} disabled={busy}>
              <View style={s.receiptSlot}>
                <Text style={s.receiptPlus}>+</Text>
              </View>
              <Text style={s.receiptHint}>{t("ui.add_receipt")}</Text>
            </Pressable>
          )}

          {/*
            FISTEN CIKAN KALEMLER (ADR-055).

            FISIN ALTINDA cunku fisin bir SONUCU. Ustunde olsaydi,
            kullanici daha fotografi eklemeden bir liste gormeyi beklerdi.

            HICBIRI SECILI DEGIL: liste her zaman biraz gurultu tasiyor ve
            hepsini isaretli acmak bakmadan kaydetmeye davet olurdu.
          */}
          {foundItems && foundItems.length > 0 ? (
            <View style={s.itemsFound}>
              <Cap>{t("ui.items_found", { count: foundItems.length })}</Cap>

              {foundItems.map((item, index) => (
                <Pressable
                  key={`${item.description}-${index}`}
                  style={s.foundRow}
                  onPress={() =>
                    setPickedItems((current) => ({ ...current, [index]: !current[index] }))
                  }
                  disabled={busy}
                >
                  <View style={[s.foundBox, pickedItems[index] && s.foundBoxOn]}>
                    {pickedItems[index] ? <Text style={s.foundTick}>✓</Text> : null}
                  </View>
                  <Text style={s.foundName} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={s.foundAmount}>
                    {formatMoney(item.amount, currency, locale)}
                  </Text>
                </Pressable>
              ))}

              {/*
                FARK SATIRI. OCR bir satiri okuyamazsa secilenlerin toplami
                fisin toplamindan DUSUK cikar; bunu soylemek, sessizce eksik
                bir harcama kaydetmekten iyi. Yalnizca ikisi de biliniyorsa
                ve FARKLIYSA ciziliyor - esitken bir sey soylemeye gerek yok.
              */}
              {receiptTotal !== null && chosenItems.length > 0 && chosenTotal !== receiptTotal ? (
                <Text style={s.foundDiff}>
                  {t("ui.items_vs_receipt", {
                    chosen: formatMoney(chosenTotal, currency, locale),
                    receipt: formatMoney(receiptTotal, currency, locale),
                  })}
                </Text>
              ) : null}

              <View style={s.foundActions}>
                <Pressable onPress={useChosenItems} disabled={busy || chosenItems.length === 0}>
                  <Text style={[s.foundUse, chosenItems.length === 0 && s.foundUseOff]}>
                    {t("ui.use_items", { count: chosenItems.length })}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setFoundItems(null)} disabled={busy}>
                  <Text style={s.foundSkip}>{t("ui.dismiss_items")}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: theme.background },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
    },
    scroll: { paddingBottom: 40 },
    itemsBlock: { gap: 12, paddingTop: 4 },
    itemsHint: { fontFamily: fonts.body, fontSize: 12, color: theme.muted, lineHeight: 17 },
    itemCard: { gap: 8, borderTopWidth: 1, borderTopColor: theme.lineSoft, paddingTop: 10 },
    itemTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemName: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.foreground,
      borderBottomWidth: 1,
      borderBottomColor: theme.inputLine,
      paddingVertical: 4,
    },
    itemAmount: {
      width: 92,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      textAlign: "right",
      borderBottomWidth: 1,
      borderBottomColor: theme.inputLine,
      paddingVertical: 4,
      fontVariant: ["tabular-nums"],
    },
    itemRemove: { fontFamily: fonts.body, fontSize: 20, color: theme.muted, paddingHorizontal: 2 },
    itemPeople: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    /** Kalem katilimcilari CIP: sayilari degisken ve secim cok secimli -
        segment burada yanlis olurdu. */
    itemChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.inputLine,
    },
    itemChipOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    itemChipText: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    itemChipTextOn: { color: theme.onBrand },
    itemsSummary: { gap: 4, paddingTop: 6 },
    itemsSummaryRow: { flexDirection: "row", justifyContent: "space-between" },
    itemsSummaryLabel: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },
    itemsSummaryValue: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: theme.muted,
      fontVariant: ["tabular-nums"],
    },
    repeatBlock: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
    repeatRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    repeatLabel: { fontFamily: fonts.body, fontSize: 15, color: theme.foreground },
    repeatHint: { fontFamily: fonts.body, fontSize: 12, color: theme.muted, lineHeight: 17 },

    /**
     * BASLIK CUBUGU. Uc parca: vazgec / baslik / kaydet. Yerlesik cubuk
     * kapali (headerShown: false) cunku kaydetmeyi saga koyamiyor.
     * paddingTop 60: durum cubugu payi - SafeAreaView'in "top" kenari bu
     * ekranda kullanilmiyor, cunku cubuk kendi zeminini tasiyor.
     */
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

    /**
     * TUTAR BLOGU. Ekranin en buyuk seyi ve altinda BAKIR cizgi: bolum
     * basliyor demenin isareti (grup ekranindaki bakir cizgilerle ayni dil).
     */
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
    // 44 punto, negatif harf araligi: buyuk rakamlar aralıksiz dagiliyor.
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
    amountNote: { fontFamily: fonts.body, fontSize: 11.5, color: theme.muted },
    /** Bakir: sayfanin vurgu rengi, bir DURUM degil (ADR-021). */
    amountRead: { fontFamily: fonts.body, fontSize: 11.5, color: theme.brand },

    fields: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
    fieldInput: { fontFamily: fonts.body, fontSize: 16, color: theme.foreground, padding: 0 },
    fieldRow: { flexDirection: "row", gap: 16 },
    half: { flex: 1 },

    splitBlock: { paddingHorizontal: 20, paddingTop: 22, gap: 12 },
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

    splitRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    splitName: { fontFamily: fonts.body, fontSize: 14.5, color: theme.foreground, flexShrink: 1 },
    // Cikarilmis uye: ADI da payi da soluk. Kutu tek basina yeterince
    // yuksek sesle konusmuyor.
    splitNameOff: { color: theme.muted },
    // Noktali ayrac - fisin okuma yardimi, ayni sey grup ekraninda da var.
    leader: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dotted",
      borderColor: theme.inputLine,
      transform: [{ translateY: -4 }],
    },
    splitAmount: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    shareInput: {
      minWidth: 90,
      textAlign: "right",
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
      padding: 0,
    },
    box: {
      width: 20,
      height: 20,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.inputLine,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ translateY: 4 }],
    },
    boxOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    tick: { color: theme.onBrand, fontSize: 13, fontFamily: fonts.semibold },
    remainder: {
      textAlign: "right",
      fontFamily: fonts.body,
      fontSize: 12,
      color: theme.muted,
      paddingTop: 8,
      fontVariant: ["tabular-nums"],
    },

    /** Fisin kapanisi: cift cizgi. ADR-021'in fis dili. */
    doubleRule: { gap: 2, marginTop: 8 },
    /**
     * KAPANIS CIZGISI foreground DEGIL muted - ve bu tasarimdan bilincli
     * bir sapma. Tasarim "3px double #1f2420" diyor, yani kagit uzerinde
     * neredeyse siyah; acik temada dogru duruyor. Koyu temada ayni token
     * beyaza donuyor ve KONTRAST ORANI AYNI OLMASINA RAGMEN (her iki yonde
     * de ~14.8:1) parlak cizgi koyu zeminde yayiliyor: ekranin en gurultulu
     * seyi haline geliyor ve altindaki toplamdan daha cok dikkat cekiyor.
     * muted iki temada da saglam ama bagirmayan bir cizgi veriyor.
     */
    rule: { height: 1, backgroundColor: theme.muted },
    totalRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      paddingTop: 10,
    },
    totalLabel: {
      fontFamily: fonts.medium,
      fontSize: 10,
      letterSpacing: 2,
      color: theme.copperText,
      flexShrink: 1,
    },
    totalAmount: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },

    receiptRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    // Kesikli kare + bakir arti: bos durum bir HEDEF, bir cumle degil.
    itemsFound: { paddingHorizontal: 20, paddingBottom: 28, gap: 10 },
    foundRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    foundBox: {
      width: 22,
      height: 22,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.inputLine,
      alignItems: "center",
      justifyContent: "center",
    },
    foundBoxOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    foundTick: { color: theme.onBrand, fontSize: 13, fontFamily: fonts.semibold },
    foundName: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: theme.foreground },
    foundAmount: {
      fontFamily: fonts.mono,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    foundDiff: { fontFamily: fonts.body, fontSize: 13, color: theme.copperText },
    foundActions: { flexDirection: "row", gap: 20, paddingTop: 4 },
    foundUse: { fontFamily: fonts.medium, fontSize: 14, color: theme.brand },
    foundUseOff: { color: theme.muted },
    foundSkip: { fontFamily: fonts.body, fontSize: 14, color: theme.muted },

    receiptSlot: {
      width: 46,
      height: 46,
      borderRadius: 3,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.inputLine,
      alignItems: "center",
      justifyContent: "center",
    },
    receiptPlus: { fontFamily: fonts.body, fontSize: 18, color: theme.copperText },
    receiptThumb: { width: 46, height: 46, borderRadius: 3, backgroundColor: theme.surface },
    receiptText: { flex: 1, gap: 2 },
    receiptLabel: { fontFamily: fonts.medium, fontSize: 12, color: theme.foreground },
    receiptHint: { fontFamily: fonts.body, fontSize: 12.5, color: theme.muted },

    error: {
      color: theme.debt,
      fontFamily: fonts.body,
      fontSize: 14,
      paddingHorizontal: 20,
      paddingTop: 14,
    },
  });
}
