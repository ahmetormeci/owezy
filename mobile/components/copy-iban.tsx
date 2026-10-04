import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, type StyleProp, type TextStyle } from "react-native";
import { formatIban } from "@/lib/iban";
import { useTranslate } from "../lib/i18n";

/**
 * ALACAKLININ IBAN'INI KOPYALA (ADR-059). Iki yerde: bakiye kartinda
 * borclu oldugun satir ve odeme ekraninda alicinin IBAN'i. Web'deki
 * CopyIbanButton'in karsiligi.
 *
 * PANOYA BOSLUKSUZ KAYIT gidiyor: bankanin alanina oldugu gibi yapisir.
 *
 * "YAKINDA DEGISTI" UYARISI KOPYALAMA ANINDA ve bir Alert ile: hesabi ele
 * gecirilen birinin IBAN'i degistirilirse parayi gonderecek kisi bunu
 * fark edebilecek son kisi. Web'de ayni uyari kopyalama bildiriminde.
 *
 * Etiket kisa bir sure "IBAN kopyalandi" oluyor - dokunusun bir ise
 * yaradigini gostermenin en sessiz yolu.
 */
export function CopyIbanAction({
  iban,
  recentlyChanged,
  style,
}: {
  iban: string;
  recentlyChanged: boolean;
  style: StyleProp<TextStyle>;
}) {
  const t = useTranslate();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ekrandan cikilirsa bekleyen zamanlayici kapanmis bir bilesene yazmasin.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await Clipboard.setStringAsync(iban);
    } catch {
      // Pano yazilamazsa IBAN ekranda: kullanici elle yazabilsin.
      Alert.alert(t("ui.iban_copy_failed", { iban: formatIban(iban) }));
      return;
    }
    if (recentlyChanged) {
      Alert.alert(t("ui.iban_copied"), t("ui.iban_recently_changed"));
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Pressable onPress={() => void copy()} hitSlop={10}>
      <Text style={style}>{copied ? t("ui.iban_copied") : t("ui.copy_iban")}</Text>
    </Pressable>
  );
}
