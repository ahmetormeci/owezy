import { fonts } from "../../../../lib/fonts";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  EXPENSE_CATEGORY_CODES,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_SPLIT_TYPE_SHORT_CODES,
} from "@/lib/expense-labels";
import { guessCategory } from "@/lib/expense-category-guess";
import { splitEqually } from "@/lib/split";
import { Field, SelectField } from "../../../../components/field";
import { formatMoney, parseMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../../../../lib/i18n";
import { useApiClient, useApiGet } from "../../../../lib/use-api";
import { useTheme, type Theme } from "../../../../lib/theme";
import { Cap } from "../../../../components/receipt";
import { apiBaseUrl } from "../../../../lib/api";
import { useSession } from "../../../../lib/auth";
import { pickReceipt, receiptEndpoint, uploadReceipt } from "../../../../lib/receipt-file";

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
  /**
   * KATEGORI. Kullanici SECMEDIYSE null kaliyor ve gonderilmiyor - sunucu o
   * zaman aciklamadan kendisi tahmin ediyor (ADR-028: karari sunucu verir).
   * Tahmin ekranda GORUNUYOR ama secim olarak yazilmiyor: gorunen ile
   * kaydedilen ayrismasin diye ikisi ayni saf fonksiyondan geciyor, tipki
   * hizli ekleyicideki gibi.
   */
  const [category, setCategory] = useState<keyof typeof EXPENSE_CATEGORY_CODES | null>(null);
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

  async function chooseReceipt(source: "camera" | "library") {
    const picked = await pickReceipt(source);
    if (picked.kind === "cancelled") return;
    if (picked.kind === "error") {
      setError(t(picked.code));
      return;
    }
    setError(null);
    setReceiptUri(picked.uri);
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

    // Harcama zaten kaydedildi, yalnizca fis kalmisti: tekrar YARATMIYORUZ.
    if (savedExpenseId) {
      if (await sendReceipt(savedExpenseId)) router.back();
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
              <TextInput
                testID="amount"
                style={s.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder={t("ui.amount_placeholder")}
                placeholderTextColor={theme.inputLine}
                editable={!busy}
              />
              <Text style={s.amountCurrency}>{currency}</Text>
            </View>
            {/* Para birimi degistirilemez - degistirilemez kural (ADR-008).
                Ekranda yazmasi, olmayan bir denetimi aramayi onluyor. */}
            <Text style={s.amountNote}>{t("ui.currency_from_group")}</Text>
          </View>

          <View style={s.fields}>
            <Field label={t("ui.description")}>
              <TextInput
                testID="description"
                style={s.fieldInput}
                value={description}
                onChangeText={setDescription}
                placeholder={t("ui.description_placeholder")}
                placeholderTextColor={theme.muted}
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
            {/* UC ESIT SEGMENT, cip yigini degil: secenek sayisi sabit uc ve
                birbirini disliyorlar - segment tam olarak bunu anlatiyor. */}
            <View style={s.segments}>
              {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map((type) => {
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

            {splitType === "EQUAL" ? (
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
                    <TextInput
                      style={s.shareInput}
                      value={shareText[member.userId] ?? ""}
                      onChangeText={(value) =>
                        setShareText((current) => ({ ...current, [member.userId]: value }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={splitType === "EXACT" ? "0,00" : "0"}
                      placeholderTextColor={theme.inputLine}
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

          {error ? <Text style={s.error}>{error}</Text> : null}

          {/*
            FIS EN ALTTA. Fotograf SIMDI YUKLENMIYOR, cihazda BEKLIYOR:
            baglanacagi harcama henuz yok. Kayit basarili olunca gonderiliyor.
          */}
          {receiptUri ? (
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
