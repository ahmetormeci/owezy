import { useAuth } from "@clerk/clerk-expo";
import { Link, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate, useLocale } from "../../lib/i18n";
import { formatSignedMoney } from "@/lib/money";
import { useApiGet } from "../../lib/use-api";
import { useTheme, type Theme } from "../../lib/theme";

/**
 * Grup ekrani - ISKELET.
 *
 * Bugun yalnizca grubun adini ve KULLANICININ BAKIYESINI tasiyor. Fisin
 * kendisi (harcama satirlari, noktali ayrac, perfore, yirtik kenar) 18.4'un
 * isi ve orada React Native'de CSS olmamasi yuzunden ayri teknikler
 * gerekecek. Burada sayfanin YERI kuruluyor, gorunusu degil.
 *
 * Bakiye en ustte, cunku sayfa hiyerarsisi bakiyenin etrafinda kuruldu
 * (ADR-016): kullanici bu ekrani "ne kadar borcum var" diye aciyor.
 */
type GroupResponse = { group: { id: string; name: string; description: string | null } };
// Ozet ucu govdeyi UST SEVIYEDE yayiyor: { ok, currency, myBalance, ... }
// "summary" diye bir sarmalayici YOK.
type SummaryResponse = { currency: string; myBalance: number };

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { signOut } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const group = useApiGet<GroupResponse>(groupId ? `/api/v1/groups/${groupId}` : null);
  const summary = useApiGet<SummaryResponse>(
    groupId ? `/api/v1/groups/${groupId}/summary` : null,
  );

  if (group.state.kind === "loading" || summary.state.kind === "loading") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (group.state.kind === "error" || summary.state.kind === "error") {
    const text =
      group.state.kind === "error" ? group.state.text : (summary.state as { text: string }).text;
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>{text}</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            group.reload();
            summary.reload();
          }}
        >
          <Text style={styles.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { currency, myBalance } = summary.state.data;

  // Uc durum, uc ayri cumle. Renk BURADA anlam tasiyor (ADR-021): alacak
  // yesil, borc kiremit, odesmis notr.
  const settled = myBalance === 0;
  const owed = myBalance > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.groupName}>{group.state.data.group.name}</Text>

      <View style={styles.balanceBlock}>
        <Text style={styles.cap}>{t("ui.your_status")}</Text>
        {settled ? (
          <Text style={styles.settled}>{t("ui.settled_up")}</Text>
        ) : (
          <>
            {/* Web ile AYNI fonksiyon (formatSignedMoney): isaretli tutar,
                yani "+1.234,56" ya da "-1.234,56". Mutlak deger gostermek de
                anlasilirdi ama o zaman ayni bakiye iki istemcide farkli
                okunurdu - para uygulamasinda istemedigimiz bir ayrisma. */}
            <Text style={[styles.amount, { color: owed ? theme.credit : theme.debt }]}>
              {formatSignedMoney(myBalance, currency, locale)}
            </Text>
            <Text style={styles.amountLabel}>
              {owed ? t("ui.owed_to_you") : t("ui.you_owe")}
            </Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {/* Tek gruplu kullanici buraya YONLENDIRILEREK geliyor, yani listeyi
            hic gormuyor. Cikis yolunu bu ekranda da birakmak sart - yoksa
            oturumu kapatmanin hicbir yolu kalmiyor. */}
        <Link href="/" asChild>
          <Pressable style={styles.footerAction}>
            <Text style={styles.footerText}>{t("ui.my_groups")}</Text>
          </Pressable>
        </Link>
        <Pressable style={styles.footerAction} onPress={() => void signOut()}>
          <Text style={styles.footerText}>{t("ui.sign_out")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.paper, paddingHorizontal: 24 },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.paper,
    },
    groupName: { fontSize: 26, fontWeight: "600", color: theme.foreground, paddingTop: 12 },
    balanceBlock: { marginTop: 28, gap: 4 },
    cap: { fontSize: 11, letterSpacing: 2, color: theme.muted, textTransform: "uppercase" },
    amount: { fontSize: 40, fontWeight: "600", fontVariant: ["tabular-nums"] },
    amountLabel: { fontSize: 14, color: theme.muted },
    settled: { fontSize: 28, fontWeight: "500", color: theme.foreground },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
    footer: { marginTop: "auto", flexDirection: "row", gap: 24, paddingVertical: 16 },
    footerAction: {},
    footerText: { color: theme.muted, fontSize: 14 },
  });
}
