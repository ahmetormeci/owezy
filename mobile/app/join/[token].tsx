import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../lib/auth";
import { useTranslate } from "../../lib/i18n";
import { rememberInvite } from "../../lib/pending-invite";
import { useTheme, type Theme } from "../../lib/theme";
import { useApiClient } from "../../lib/use-api";
import { Cap } from "../../components/receipt";

/**
 * Davet baglantisinin UYGULAMADA acildigi ekran (universal link).
 *
 * BUGUNE KADAR YOKTU: owezy.net/join/<kod> adresi telefonda SAFARI'de
 * aciliyordu, uygulama yuklu olsa bile. Kullanici baglantiyi kopyalayip
 * "Gruba katil" alanina yapistirmak zorundaydi. Artik iOS bu adresi
 * uygulamaya yonlendiriyor (bkz. .well-known/apple-app-site-association).
 *
 * WEB SAYFASININ KARSILIGI, ama davranisi ayni degil ve olmamali: web'de
 * once davetin durumu gosterilip "Katil" dugmesi bekleniyor. Burada
 * KULLANICI ZATEN NIYETINI BELIRTTI - baglantiya dokundu - ve araya bir
 * onay ekrani koymak ayni islemi iki kez yaptirmak olurdu. Girisliyse
 * dogrudan kabul ediliyor.
 *
 * GIRIS YAPILMAMISSA EKRAN KENDINI GOSTERIYOR ve AuthGuard bu rotayi
 * bilerek disarida birakiyor (_layout.tsx). Yoksa kullanici giris ekranina
 * atilir ve elindeki DAVET KAYBOLURDU - davet edilen kisinin cogu zaman
 * hesabi yok, uygulamayi kurmasinin sebebi zaten o baglanti.
 */
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useSession();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { post } = useApiClient();

  const [error, setError] = useState<string | null>(null);

  /**
   * KABUL BIR KEZ DENENIYOR. Efekt bagimliliklari degistiginde (ornegin
   * cizim sirasinda yeni bir post fonksiyonu uretildiginde) ikinci bir
   * istek gitseydi, ikincisi "zaten uyesin" hatasi doner ve BASARILI bir
   * katilim hata gibi gorunurdu.
   */
  const tried = useRef(false);

  useEffect(() => {
    if (status === "signed-out" && token) {
      // Giristen sonra buraya geri donebilmek icin kodu birakiyoruz;
      // app/index.tsx onu alip bu ekrana geri getiriyor.
      void rememberInvite(token);
      return;
    }
    if (status !== "signed-in" || tried.current || !token) return;
    tried.current = true;

    /**
     * IS ASENKRON BIR IIFE ICINDE ve bu bilincli: setState'i efektin
     * govdesinde SENKRON cagirmak lint'in set-state-in-effect kuralina
     * takiliyor ve kural hakli - oyle bir cagri zincirleme cizim tetikler.
     * Burada setError ancak sunucu cevabindan SONRA calisiyor.
     *
     * IPTAL BAYRAGI: ekran cevap gelmeden kapanabilir. Onsuz, artik
     * gorunmeyen bir ekranin durumu guncellenmeye calisilirdi.
     */
    let cancelled = false;
    void (async () => {
      const result = await post<{ membership: { groupId: string } }>(
        "/api/v1/invites/accept",
        { token },
      );
      if (cancelled) return;

      if (!result.ok) {
        // Sunucunun kodu dogrudan cevriliyor: "katilinamadi" demek, sebebi
        // bilinirken sebebi saklamak olurdu (suresi dolmus / iptal edilmis /
        // kullanim hakki bitmis / zaten uye).
        setError(t(result.code));
        return;
      }

      // replace, push DEGIL: geri dugmesi bu ekrana donerse kabul bir daha
      // denenir ve kullanici "zaten uyesin" hatasiyla karsilasir.
      router.replace(`/groups/${result.data.membership.groupId}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, token, post, t, router]);

  const heading = <Stack.Screen options={{ title: t("ui.join_group") }} />;

  if (status === "loading" || (status === "signed-in" && !error)) {
    return (
      <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
        {heading}
        <ActivityIndicator color={theme.brand} />
      </SafeAreaView>
    );
  }

  if (status === "signed-out") {
    return (
      <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
        {heading}
        <Text style={s.hint}>{t("ui.invite_needs_account")}</Text>
        <Pressable style={s.button} onPress={() => router.replace("/sign-in")}>
          <Cap tone="onBrand">{t("ui.sign_in")}</Cap>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      {heading}
      <Text style={s.error}>{error}</Text>
      {/* Hata sonrasi CIKIS YOLU. Olmasaydi kullanici bu ekranda kalirdi -
          universal link ile gelindiginde arkada bir yigin yok, yani geri
          dugmesi de yok. */}
      <Pressable style={s.button} onPress={() => router.replace("/")}>
        <Cap tone="onBrand">{t("ui.my_groups")}</Cap>
      </Pressable>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 24,
      backgroundColor: theme.paper,
    },
    hint: { color: theme.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
    error: { color: theme.debt, fontSize: 15, textAlign: "center" },
    button: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
  });
}
