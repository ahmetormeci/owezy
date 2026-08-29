import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
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
  /** "onBrand": kobalt bir zeminin uzerinde - gri metin orada okunmuyor. */
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
          <Text style={s.label} numberOfLines={1}>
            {label}
          </Text>
        )}
        <Leader />
        <Text style={s.amount}>{amount}</Text>
      </View>
      {secondary ? (
        <Text style={s.secondary} numberOfLines={1}>
          {secondary}
        </Text>
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
    label: { fontSize: 14, color: theme.foreground, flexShrink: 1 },
    amount: { fontSize: 14, color: theme.foreground, fontVariant: ["tabular-nums"] },
    leaderWrap: { flex: 1, overflow: "hidden", marginHorizontal: 8 },
    leaderText: { color: theme.border, fontSize: 12, letterSpacing: 2 },
    secondary: { fontSize: 11, color: theme.muted },

    perfRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    dashed: { flex: 1, height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: theme.border },
    cap: { fontFamily: "Menlo", fontSize: 11, letterSpacing: 1.6, color: theme.muted },
    capOnBrand: { color: "#fff" },

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
