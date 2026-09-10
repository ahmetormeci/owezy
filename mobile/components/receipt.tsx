import { fonts } from "../lib/fonts";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { apiBaseUrl } from "../lib/api";
import { useAuthToken } from "../lib/auth-token";
import { useLocale } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";

/**
 * Fisin gorsel unsurlari - React Native'de.
 *
 * Web'deki teknikler (src/components/receipt.tsx) BURADA CALISMIYOR ve
 * hangisinin calistigi tahmin edilmedi, tek kullanimlik bir deneme ekraninda
 * simulatorde OLCULDU (Faz 18.4):
 *
 *   noktali ayrac : borderStyle "dotted" UC AYRI YAZIMDA da olmadi - biri hic
 *                   cizilmedi, ikisi DUZ CIZGIYE dondu. Calisan: tekrarlanan
 *                   "·" karakteri + ellipsizeMode="clip".
 *   perfore       : borderStyle "dashed" CALISIYOR. ("dotted" calismazken
 *                   "dashed" calisiyor - ikisi ayni sekilde davranmiyor.)
 *   yirtik kenar  : border ucgen hilesi calisiyor, SVG paketi gerekmedi.
 *
 * KAGIT GRENI YOK. Web'de SVG feTurbulence filtresi; React Native'de CSS
 * filtresi yok ve karsiligi kucuk bir PNG dosemek olurdu. %5 opaklikta bir
 * doku telefon ekraninda zaten gorunmuyor - ikili bir dosya tasimaya degmez.
 * Kagit hissini tasiyan diger iki sey duruyor: yirtik kenar ve zeminden bir
 * ton acik olmasi.
 */

/**
 * Fisin mono, harf araligi acik, BUYUK HARF etiketi.
 *
 * Buyuk harfe cevirme JavaScript'te ve DILE DUYARLI yapiliyor; React
 * Native'in textTransform: "uppercase" ozelligi KULLANILMIYOR cunku o dil
 * bilmiyor ve Turkcede "i" harfini "I" yapiyor - "Senin durumun" -> "SENIN"
 * (dogrusu "SENİN"). Web'de bu sorun yok cunku CSS text-transform <html lang>
 * degerine bakiyor; mobilde o bilgi yok, biz vermek zorundayiz.
 */
export function Cap({
  children,
  tone = "muted",
  color,
}: {
  children: string;
  /** "onBrand": petrol dolgulu bir dugmenin uzerinde - gri metin orada
   *  okunmuyor. Rengi tema veriyor, sabit beyaz DEGIL. */
  tone?: "muted" | "onBrand";
  /**
   * Etiketin ANLAM TASIDIGI yerler icin. Bakiye muhrunde renk bilgi
   * tasiyor (ADR-015: yesil "sana borclular", kiremit "borclusun") ve
   * gri bir etiket o bilgiyi silerdi. Verilmezse tone karar veriyor.
   */
  color?: string;
}) {
  const locale = useLocale();
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Text style={[s.cap, tone === "onBrand" && s.capOnBrand, color ? { color } : null]}>
      {children.toLocaleUpperCase(locale)}
    </Text>
  );
}

/** Fisin bir satiri: solda metin, sagda tutar, arada noktali ayrac. */
export function ReceiptLine({
  label,
  amount,
  secondary,
  cap = false,
  onPress,
  deleted = false,
  action,
  mark,
}: {
  label: string;
  amount: string;
  secondary?: string;
  /** Toplam satirlari icin: etiket mono ve buyuk harf. */
  cap?: boolean;
  /**
   * Satira dokununca. HARCAMA SATIRLARININ HEPSI dokunulabilir, yalnizca
   * duzenlenebilir olanlar degil: bazi satirlarin dokunulabilir olmasi fisin
   * tekduzeligini bozardi ve hangisinin hangisi oldugu BAKINCA anlasilmazdi.
   * Detay ekrani baskasinin satirinda salt okunur aciliyor.
   */
  onPress?: () => void;
  /**
   * Silinmis kayit: soluk ve ustu cizili. RENK YOK - yesil/kirmizi bu
   * uygulamada yalnizca BAKIYE anlami tasiyor (ADR-015) ve silinmislik bir
   * bakiye durumu degil.
   */
  deleted?: boolean;
  /** Satirin sagina bir eylem (ornegin "geri al"). Ikincil satirda duruyor. */
  action?: React.ReactNode;
  /**
   * Etiketin HEMEN YANINDA kucuk bir isaret - bugun yalnizca "bu harcamanin
   * fisi var" icin kullaniliyor.
   *
   * NEDEN ETIKETIN YANI: satirin sonunda tutar var ve orasi fisin en cok
   * okunan yeri; araya bir simge sokmak sayiyi bulmayi zorlastirirdi.
   * Aciklamanin yani ise "bu harcama hakkinda ek bir sey var" demenin
   * dogal yeri.
   */
  mark?: React.ReactNode;
}) {
  const theme = useTheme();
  const s = styles(theme);

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper style={s.lineBlock} onPress={onPress}>
      <View style={s.line}>
        {cap ? (
          <Cap>{label}</Cap>
        ) : (
          <Text
            style={[s.label, deleted && s.deletedLabel]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {mark}
        <Leader />
        <Text style={[s.amount, deleted && s.deletedAmount]}>{amount}</Text>
      </View>
      {secondary || action ? (
        <View style={s.secondaryRow}>
          {secondary ? (
            <Text style={s.secondary} numberOfLines={1}>
              {secondary}
            </Text>
          ) : null}
          {action ? <View style={s.actionSlot}>{action}</View> : null}
        </View>
      ) : null}
    </Wrapper>
  );
}

/**
 * Noktali ayrac. Genisligi DEGISKEN: aciklama uzadikca kisaliyor, tutar hep
 * ayni sutunda kaliyor. Cok sayida nokta uretilip tasan kismi kirpiliyor -
 * ellipsizeMode="clip" SART, varsayilan "tail" sona "..." koyuyor ve ayracin
 * ucu kirli gorunuyor (deneme ekraninda tam olarak bu yasandi).
 */
function Leader() {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.leaderWrap}>
      <Text numberOfLines={1} ellipsizeMode="clip" style={s.leaderText}>
        {DOTS}
      </Text>
    </View>
  );
}

const DOTS = "·".repeat(200);

/** Ay sinirindaki perfore cizgi: ortada ay adi, iki yanda kesikli cizgi. */
export function ReceiptPerforation({ children }: { children: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.perfRow}>
      <View style={s.dashed} />
      <Cap>{children}</Cap>
      <View style={s.dashed} />
    </View>
  );
}

/** Fisin altindaki cift cizgi - toplamdan once. */
export function ReceiptDoubleRule() {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.doubleRule}>
      <View style={s.rule} />
      <View style={s.rule} />
    </View>
  );
}

/**
 * Yirtik kenar: kagidin bittigi yer.
 *
 * Dis sayisi ekran genisligine gore hesaplaniyor. Sabit bir sayi yazmak
 * mumkundu ama genis bir ekranda (iPad) kenar yarim kalirdi.
 */
export function TornEdge() {
  const theme = useTheme();
  const s = styles(theme);
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const teeth = Math.ceil(width / TOOTH) + 1;

  return (
    <View style={s.tornRow} onLayout={onLayout}>
      {Array.from({ length: teeth }).map((_, index) => (
        <View key={index} style={s.tooth} />
      ))}
    </View>
  );
}

const TOOTH = 14;

/** Kagidin kendisi: yuzeyden bir ton acik, altinda yirtik kenar. */
export function Receipt({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View>
      <View style={s.paper}>{children}</View>
      <TornEdge />
    </View>
  );
}

/**
 * Bolum basligi: solda bakir etiket, sagda bir deger, altinda BAKIR cizgi.
 *
 * Cizgi neden bakir ve neden yalnizca burada: tasarimda bakir "bolum
 * basliyor" demenin isareti. Liste satirlarini ayiran cizgi (--line-soft)
 * ondan cok daha soluk; ikisi ayni agirlikta olsaydi liste bir tabloya
 * donerdi (ADR-021'in "kutu yerine cizgi" kuralinin devami).
 */
export function SectionRule({ label, value }: { label: string; value?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.sectionRule}>
      <Cap>{label}</Cap>
      {value ? <Text style={s.sectionValue}>{value}</Text> : null}
    </View>
  );
}

/**
 * Uyenin bas harfleri.
 *
 * FOTOGRAF ARTIK VAR (ADR-054). Bu yorumda uzun sure "liste ucu fotograf
 * adresi dondurmuyor" yaziyordu; DOGRU DEGIL - uc avatarUrl ve hasImage'i
 * BASTAN BERI donduruyordu (lib/balances.ts, lib/groups.ts), yazan kimse
 * yoktu. Yazan gelince gerekce de dustu.
 *
 * BAS HARF KAYBOLMADI, YEDEK OLDU: fotografi olmayan, belirteci henuz
 * gelmemis ya da adresi bize ait olmayan her durumda yine bas harf
 * ciziliyor. hasImage'in avatarUrl'den ayri durmasinin sebebi de bu ayrim
 * (bkz. prisma/schema.prisma).
 *
 * KENDI SATIRIN BAKIR CERCEVELI: dort kisilik bir listede "hangisi benim"
 * sorusu her seferinde okumakla cevaplanmamali.
 */
export function MemberAvatar({
  name,
  me = false,
  size = 48,
  avatarUrl,
  hasImage,
}: {
  name: string;
  me?: boolean;
  size?: number;
  avatarUrl?: string | null;
  hasImage?: boolean | null;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const locale = useLocale();
  const token = useAuthToken();
  // toLocaleUpperCase(locale) SART: Turkce'de "i" -> "I" degil "İ".
  const initials = name.trim().slice(0, 2).toLocaleUpperCase(locale);

  /**
   * YALNIZCA KENDI ADRESIMIZ. avatarUrl bir gun disaridan gelen bir adres
   * tasirsa (Clerk devrinde tam bu oldu), onu cizmek istemiyoruz: baslikta
   * oturum belirtecimiz var ve o baslik yabanci bir sunucuya gitmemeli.
   * "//ornek.com/a.png" de "/" ile basliyor ama ayni koken DEGIL - web'deki
   * canRenderAvatar da tam bu tuzagi ayikliyor.
   */
  const ownUrl = Boolean(avatarUrl && avatarUrl.startsWith("/") && !avatarUrl.startsWith("//"));

  if (hasImage && avatarUrl && ownUrl && token) {
    return (
      <Image
        source={{
          uri: `${apiBaseUrl()}${avatarUrl}`,
          // Adres yetkisiz calismiyor: basliksiz istek 401 doner ve gorsel
          // hic cizilmez (api/v1/users/[userId]/avatar).
          headers: { Authorization: `Bearer ${token}` },
        }}
        style={[
          s.avatar,
          { width: size, height: size, borderRadius: size / 2 },
          me && s.avatarMe,
        ]}
        accessibilityIgnoresInvertColors
        // Testin fotograf dalini bas harf dalindan ayirabilmesi icin. Ekranda
        // hicbir karsiligi yok; goruntu zaten dekoratif (ad yaninda yaziyor).
        testID="avatar-image"
      />
    );
  }

  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        me && s.avatarMe,
      ]}
    >
      <Text style={[s.avatarText, me && s.avatarTextMe, { fontSize: size / 4 }]}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * Cerceveli, hafif egik muhur. Zemin YOK: murekkep izlenimi cerceveden.
 *
 * DONDURME KUCUK (-4 derece) ve bilerek: daha fazlasi "sticker" gibi durup
 * fisin sakinligini bozuyor.
 */
export function Stamp({ children, color }: { children: string; color?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={[s.stamp, color ? { borderColor: color } : null]}>
      <Cap color={color ?? theme.copper}>{children}</Cap>
    </View>
  );
}

/**
 * FISIN HARCAMA SATIRI - toplam satirlarindan (ReceiptLine) AYRI bir bilesen.
 *
 * NEDEN AYRI: ReceiptLine noktali ayracli tek satir; toplamlarda ve ay ara
 * toplamlarinda dogru olan bicim o. Harcama satiri iki sutunlu: solda
 * aciklama + kim odedi/nasil bolundu/kategori, sagda tutar + senin payin.
 * Ikisini tek bilesende toplamak, her cagriya "hangi bicim" diye bir bayrak
 * gecirmek olurdu.
 *
 * KATEGORI BIR CIP, duz metin degil - ve cip TEXT ICINDE DEGIL ayri bir View.
 * React Native ic ice <Text> icinde kenarlik guvenilir cizmiyor.
 */
export function ExpenseRow({
  label,
  amount,
  meta,
  category,
  share,
  shareTone,
  deleted = false,
  onPress,
  mark,
  action,
}: {
  label: string;
  amount: string;
  /** "Sen odedin · esit" - kategori HARIC, o cip olarak geliyor. */
  meta?: string;
  category?: string;
  /** "payin 213,34" - tutarin ALTINDA, rengi anlam tasiyor. */
  share?: string;
  shareTone?: string;
  deleted?: boolean;
  onPress?: () => void;
  mark?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper style={s.expenseRow} onPress={onPress}>
      <View style={s.expenseMain}>
        <View style={s.expenseTitleRow}>
          <Text
            style={[s.expenseLabel, deleted && s.deletedLabel]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {mark}
        </View>
        {meta || category || action ? (
          <View style={s.expenseMetaRow}>
            {meta ? (
              <Text style={s.expenseMeta} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
            {category ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{category}</Text>
              </View>
            ) : null}
            {action}
          </View>
        ) : null}
      </View>
      <View style={s.expenseNumbers}>
        <Text style={[s.expenseAmount, deleted && s.deletedAmount]}>{amount}</Text>
        {share && !deleted ? (
          <Text style={[s.expenseShare, shareTone ? { color: shareTone } : null]}>
            {share}
          </Text>
        ) : null}
      </View>
    </Wrapper>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    paper: {
      backgroundColor: theme.paper,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 20,
      paddingVertical: 24,
      gap: 20,
    },
    lineBlock: { gap: 2, paddingVertical: 4 },
    line: { flexDirection: "row", alignItems: "baseline" },
    label: { fontFamily: fonts.body, fontSize: 14, color: theme.foreground, flexShrink: 1 },
    amount: { fontFamily: fonts.body, fontSize: 14, color: theme.foreground, fontVariant: ["tabular-nums"] },
    leaderWrap: { flex: 1, overflow: "hidden", marginHorizontal: 8 },
    leaderText: { color: theme.border, fontFamily: fonts.body, fontSize: 12, letterSpacing: 2 },
    secondary: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },
    secondaryRow: { flexDirection: "row", alignItems: "baseline", gap: 12 },
    // Eylem satirin SAGINA yasli; ikincil metin uzasa bile yerinde kaliyor.
    actionSlot: { marginLeft: "auto" },
    deletedLabel: { color: theme.muted, textDecorationLine: "line-through" },
    deletedAmount: { color: theme.muted },

    perfRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    dashed: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: theme.border },
    // MONO DEGIL GROTESK + BAKIR. Web'deki .cap ile ayni degisiklik ve ayni
    // gerekce (globals.css): ayrimi artik yazi tipi degil aralik ve renk
    // tasiyor.
    cap: {
      fontFamily: fonts.medium,
      fontSize: 11,
      letterSpacing: 1.6,
      color: theme.copperText,
    },
    // BIRINCIL DUGMENIN uzerinde (petrol dolgu) - koyu bakiye kartinin
    // degil. Sabit "#fff" DEGIL: koyu temada petrol aciliyor ve beyaz metin
    // orada 3.89:1 kaliyor, AA'yi gecmiyor (ADR-048'de olculdu).
    capOnBrand: { color: theme.onBrand },

    sectionRule: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.copper,
      paddingBottom: 7,
    },
    sectionValue: { fontFamily: fonts.body, fontSize: 11.5, color: theme.muted },

    avatar: {
      borderWidth: 1,
      borderColor: theme.inputLine,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarMe: { borderColor: theme.copper, backgroundColor: theme.copperSoft },
    avatarText: { fontFamily: fonts.body, color: theme.muted },
    avatarTextMe: { color: theme.copperText },

    stamp: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.copper,
      borderRadius: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      transform: [{ rotate: "-4deg" }],
    },

    expenseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    expenseMain: { flex: 1, gap: 3, minWidth: 0 },
    expenseTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    expenseLabel: { fontFamily: fonts.medium, fontSize: 15, color: theme.foreground, flexShrink: 1 },
    expenseMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    expenseMeta: { fontFamily: fonts.body, fontSize: 11.5, color: theme.muted, flexShrink: 1 },
    // Cip: tam yuvarlak kenar, kagit tonunda kenarlik, bakir metin.
    chip: {
      borderWidth: 1,
      borderColor: theme.chipBorder,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    chipText: { fontFamily: fonts.body, fontSize: 11, color: theme.copperText },
    expenseNumbers: { alignItems: "flex-end", gap: 3 },
    expenseAmount: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    expenseShare: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: theme.muted,
      fontVariant: ["tabular-nums"],
    },

    doubleRule: { gap: 2 },
    rule: { height: 1, backgroundColor: theme.border },

    tornRow: { flexDirection: "row", overflow: "hidden" },
    tooth: {
      width: 0,
      height: 0,
      borderTopWidth: TOOTH / 2,
      borderLeftWidth: TOOTH / 2,
      borderRightWidth: TOOTH / 2,
      borderTopColor: theme.paper,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
    },
  });
}
