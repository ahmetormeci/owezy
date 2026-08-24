import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../lib/i18n";
import { useApiGet } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";

/**
 * Uygulamanin girisi. YALNIZCA YONLENDIRME - burada gosterilecek bir sey yok.
 *
 * Web'de ADR-016 ile verilmis karari uyguluyor: tek grubu olan kullanici
 * listeyi hic gormuyor, dogrudan grubunun icine dusuyor. Cogu kisinin bir,
 * bilemedin iki grubu olacak; onlari once tek satirlik bir listeye dusurmek
 * bos bir ekrani varis noktasi yapmak olurdu.
 *
 * GIRIS ILE LISTE AYRI (Faz 18.7). Once ikisi de buradaydi ve bu bir HATA
 * uretiyordu: grup ekranindaki "Gruplarim" baglantisi "/" adresine gidiyor,
 * orasi da tek grupta gruba GERI yonlendiriyordu - yani baglanti hicbir sey
 * yapmiyordu ve tek gruplu kullanici listeye, dolayisiyla "grup olustur"a
 * hic ulasamiyordu. Liste artik kendi adresinde: /groups.
 */
type Group = { id: string };

export default function EntryScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  // Kancalar kosulsuz cagrilmali; "henuz istek atma" durumunu path=null tasiyor.
  const { state, reload } = useApiGet<{ groups: Group[] }>(
    isLoaded && isSignedIn ? "/api/v1/groups" : null,
  );

  if (!isLoaded || state.kind === "loading") {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={s.centered}>
        <Text style={s.error}>{state.text}</Text>
        <Pressable style={s.button} onPress={reload}>
          <Text style={s.buttonText}>{t("ui.try_again")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const groups = state.data.groups;

  // Tek grup: listeyi atla, dogrudan icine.
  if (groups.length === 1) {
    return <Redirect href={`/groups/${groups[0].id}`} />;
  }

  // Sifir ya da coklu: liste ekrani karsilasin. Ilk acilis hali de orada.
  return <Redirect href="/groups" />;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.paper,
    },
    error: { color: theme.debt, textAlign: "center", paddingHorizontal: 24 },
    button: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.brand, borderRadius: 8 },
    buttonText: { color: "#fff", fontSize: 15 },
  });
}
