import { fonts } from "../lib/fonts";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";

/**
 * "GUNCELLENEMEDI" UYARISI. Bir tazeleme basarisiz oldu ama eldeki veri
 * ekranda KALDI (useApiGet'in refresh yolu, lib/use-api.ts).
 *
 * NEDEN SESSIZ KALINMIYOR: veri eski olabilir ve kullanici bunu bilmeden
 * ona gore karar verebilir - "borcum yok" diye bakip odemeyi atlamak gibi.
 * Kullanici karari: eski veri kalsin, ama eski olabilecegi soylensin.
 *
 * NEDEN KUCUK BIR SATIR, TAM HATA EKRANI DEGIL: tam ekran, gosterecek bir
 * sey olmadiginda dogru. Burada gosterilecek sey var; onu kapatmak
 * kullanicinin elinden bilgiyi almak olurdu.
 *
 * RENK SOLUK, kiremit DEGIL: kiremit bu uygulamada "borc" anlami tasiyor
 * (ADR-015) ve bu bir borc degil, bir durum notu. Dokununca yeniden deniyor;
 * asagi cekmek de ayni isi yapiyor.
 *
 * text null ise hicbir sey cizilmiyor - cagiran taraf kosul yazmasin diye.
 */
export function RefreshNotice({
  text,
  onRetry,
}: {
  /** Basarisizligin sebebi (ornegin "Baglanti yok..."). null: uyari yok. */
  text: string | null;
  onRetry: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);

  if (!text) return null;

  return (
    <Pressable
      style={s.box}
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={`${t("ui.refresh_failed")} ${text} ${t("ui.try_again")}`}
    >
      <Text style={s.title}>{t("ui.refresh_failed")}</Text>
      <Text style={s.reason}>{text}</Text>
      <Text style={s.retry}>{t("ui.try_again")}</Text>
    </Pressable>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    box: {
      // Ortalanmis bir sutunda da (bos gruplar ekrani) tam genislik kaplasin.
      alignSelf: "stretch",
      paddingVertical: 10,
      marginBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.lineSoft,
    },
    title: { fontFamily: fonts.body, fontSize: 14, color: theme.foreground },
    reason: { fontFamily: fonts.body, fontSize: 13, color: theme.muted, marginTop: 2 },
    retry: { fontFamily: fonts.body, fontSize: 13, color: theme.brand, marginTop: 6 },
  });
}
