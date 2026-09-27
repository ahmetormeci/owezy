import { fonts } from "../../lib/fonts";
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
 * TEK ISTISNA: MISAFIRE OZEL DAVET (ADR-057, Faz 50b). Orada linke dokunan
 * kisi misafirin BORCUNU DA ustleniyor; "linke dokundu" o kadar agir bir
 * seyin onayi degil. Sunucu bu davette onaysiz istegi "invite.guest_confirm"
 * ile reddediyor ve cevap grup ile misafir adini tasiyor - ekran onu
 * gosterip "X olarak katil"i bekliyor. Onay istemciye degil SUNUCUYA bagli:
 * eski bir surum bile sormadan sahiplenemez.
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
  const [guestConfirm, setGuestConfirm] = useState<{
    guestId: string;
    guestName: string;
    groupName: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

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
        // Misafire ozel davet: hata DEGIL, onay istegi. Ekran grubu ve
        // misafiri gosterip kullanicinin karar vermesini bekliyor.
        if (result.code === "invite.guest_confirm" && result.params) {
          setGuestConfirm({
            guestId: String(result.params.guestId),
            guestName: String(result.params.guestName),
            groupName: String(result.params.groupName),
          });
          return;
        }
        // Sunucunun kodu dogrudan cevriliyor: "katilinamadi" demek, sebebi
        // bilinirken sebebi saklamak olurdu (suresi dolmus / iptal edilmis /
        // kullanim hakki bitmis / zaten uye).
        setError(t(result.code, result.params));
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

  async function confirmGuest() {
    if (!guestConfirm || confirming) return;
    setConfirming(true);
    const result = await post<{ membership: { groupId: string } }>("/api/v1/invites/accept", {
      token,
      confirmGuestId: guestConfirm.guestId,
    });
    setConfirming(false);
    if (!result.ok) {
      setGuestConfirm(null);
      setError(t(result.code, result.params));
      return;
    }
    router.replace(`/groups/${result.data.membership.groupId}`);
  }

  if (guestConfirm) {
    return (
      <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
        {heading}
        <Text style={s.title}>
          {t("ui.invited_as_guest", {
            groupName: guestConfirm.groupName,
            guestName: guestConfirm.guestName,
          })}
        </Text>
        <Text style={s.hint}>
          {t("ui.guest_claim_explain", { guestName: guestConfirm.guestName })}
        </Text>
        <Pressable
          style={s.button}
          onPress={() => void confirmGuest()}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <Cap tone="onBrand">
              {t("ui.join_as_guest", { guestName: guestConfirm.guestName })}
            </Cap>
          )}
        </Pressable>
        {/* Vazgecmek de bir cevap: kullanici baskasinin kaydini ustlenmek
            istemeyebilir. Gruplarina donuyor, hicbir sey degismiyor. */}
        <Pressable onPress={() => router.replace("/")} hitSlop={10}>
          <Text style={s.hint}>{t("ui.cancel")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

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
      backgroundColor: theme.background,
    },
    hint: { color: theme.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: "center" },
    title: {
      color: theme.foreground,
      fontFamily: fonts.heading,
      fontSize: 24,
      lineHeight: 30,
      textAlign: "center",
    },
    error: { color: theme.debt, fontFamily: fonts.body, fontSize: 15, textAlign: "center" },
    button: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
  });
}
