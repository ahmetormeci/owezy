import { fonts } from "../lib/fonts";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/locale";
import { useSession } from "../lib/auth";
import { disablePush } from "../lib/push";
import { useLocale, useSetLocale, useTranslate } from "../lib/i18n";
import { apiBaseUrl } from "../lib/api";
import { pickReceipt, uploadReceipt } from "../lib/receipt-file";
import { useApiClient, useApiGet } from "../lib/use-api";
import { useTheme, useThemeChoice, type Theme } from "../lib/theme";
import { SectionRule, MemberAvatar } from "../components/receipt";

/**
 * Hesap ekrani. MOBILDE BOYLE BIR EKRAN YOKTU.
 *
 * NEDEN EKLENDI: App Store Guideline 5.1.1(v), hesap acilabilen uygulamalarda
 * UYGULAMA ICI hesap silmeyi zorunlu kiliyor. Owezy hesap aciyor (e-posta
 * koduyla giren biri kayitli degilse yaratiliyor). Karar ADR-031'de 24
 * Agustos'ta alinmisti ama uygulanmamisti; eksiklik Apple'in 2.1 reddi
 * sirasinda ortaya cikti - inceleyici kayitta "account deletion flow"
 * gormek istiyor ve gosterecek bir sey yoktu.
 *
 * CIKIS YAPMA HALA GRUPLAR EKRANINDA DA DURUYOR. Buraya tasiyip oradan
 * kaldirmak, en sik kullanilan islemi bir dokunus derine gomerdi.
 */
type Me = {
  user: {
    displayName: string;
    email: string;
    // Profil fotografi (ADR-054).
    avatarUrl?: string | null;
    hasImage?: boolean | null;
  };
};

/**
 * Diller KENDI dillerinde yaziliyor, cevrilmiyor.
 *
 * "Turkce"yi Ingilizce arayuzde "Turkish" diye gostermek, o secenegi
 * arayan kisinin -- yani Turkce bilen ama ekrani Ingilizce acilmis kisinin --
 * onu tanimasini zorlastirirdi. Dil listeleri her yerde boyle yazilir.
 */
const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };

export default function AccountScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { signOut, getToken } = useSession();
  const { choice: themeChoice, setChoice: setThemeChoice } = useThemeChoice();
  const { remove } = useApiClient();

  const { state, reload } = useApiGet<Me>("/api/v1/me");
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { patch } = useApiClient();
  const [localeBusy, setLocaleBusy] = useState<Locale | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);

  /**
   * PROFIL FOTOGRAFI (ADR-054).
   *
   * FISIN SECICISI VE YUKLEYICISI AYNEN KULLANILIYOR. Adlari "receipt" ile
   * basliyor ama ikisi de bir fise ozel HICBIR SEY yapmiyor: biri izin
   * isteyip fotograf sectirip kucultuyor, oteki dosyayi verilen adrese
   * akitiyor. Yeniden adlandirmak alti dosyaya dokunurdu; ayni isi ikinci
   * kez yazmak ise kucultme ve HEIC->JPEG adimlarini ikiye bolerdi - ki o
   * adimlar suslemeden ibaret degil (bkz. lib/receipt-file.ts).
   */
  async function choosePhoto(source: "camera" | "library") {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const picked = await pickReceipt(source);
      if (picked.kind === "cancelled") return;
      if (picked.kind === "error") {
        setError(t(picked.code));
        return;
      }
      const result = await uploadReceipt(
        picked.uri,
        `${apiBaseUrl()}/api/v1/me/avatar`,
        await getToken(),
      );
      if (!result.ok) {
        setError(t(result.code));
        return;
      }
      reload();
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Kamera mi galeri mi - fisle ayni soru, ayni sirada. */
  function askPhotoSource() {
    if (photoBusy) return;
    Alert.alert(t("ui.add_photo"), undefined, [
      { text: t("ui.take_photo"), onPress: () => void choosePhoto("camera") },
      { text: t("ui.choose_from_library"), onPress: () => void choosePhoto("library") },
      { text: t("ui.cancel"), style: "cancel" },
    ]);
  }

  async function removePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const result = await remove("/api/v1/me/avatar");
      if (!result.ok) {
        setError(t(result.code));
        return;
      }
      reload();
    } finally {
      setPhotoBusy(false);
    }
  }

  /**
   * Dil secimi.
   *
   * EKRAN ONCE DEGISIYOR, sunucu sonra. Dil bir gorunum tercihi; kullaniciyi
   * ag turu boyunca eski dilde bekletmenin bir karsiligi yok.
   *
   * SUNUCUYA YAZMAK YINE DE GEREKLI: web ayni degeri okuyor (i18n-server.ts,
   * cerez yoksa User.locale), yani telefondan yapilan secim web'de de
   * geceriyor. Basarisiz olursa ekrandaki secim GERI ALINIYOR - yoksa
   * kullanici sectigini sanip bir sonraki aciliste eskisini bulurdu.
   */
  async function chooseLocale(next: Locale) {
    if (next === locale || localeBusy) return;

    const previous = locale;
    setLocale(next);
    setLocaleBusy(next);
    setError(null);

    const result = await patch("/api/v1/me", { locale: next });
    setLocaleBusy(null);

    if (!result.ok) {
      setLocale(previous);
      setError(t(result.code, result.params));
    }
  }
  /** Silme IKI ADIMLI: once uyari, sonra onay. */
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await remove("/api/v1/me");
    setBusy(false);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }

    /**
     * SUNUCU OTURUMU ZATEN SILDI (deleteAccount, Session satirlarini
     * temizliyor). Yine de signOut() cagriliyor: cihazdaki belirteci
     * temizlemek ve ekrani cikisli yapmak GEREKIYOR, yoksa uygulama
     * silinmis bir hesapla girisli gorunur ve her istegi 401 alirdi.
     *
     * signOut() sunucuya da bir istek atiyor ve o istek basarisiz olacak -
     * oturum artik yok. Sorun degil: lib/auth.tsx once yereli temizliyor,
     * sunucu cagrisi en iyi gayret (Faz 24'te bu sira bilerek boyle
     * kuruldu).
     */
    await signOut();
    router.replace("/sign-in");
  }

  /**
   * CIKIS - ama once CIHAZ ADRESI SILINIYOR.
   *
   * Adres sunucuda kalirsa telefon bu hesabin bildirimlerini almaya devam
   * eder; ayni telefona baska biri giris yapmis olsa bile. Yani bu bir
   * temizlik degil, bir sizinti kapatma.
   *
   * SIRA ONEMLI: silme istegi oturum belirteci gerektiriyor, o yuzden
   * signOut()'tan ONCE. Basarisiz olursa da cikis yine yapiliyor - kullanici
   * cikamamis olmaktansa adres kalsin (ve yeni kullanicinin kaydi zaten onu
   * devralir, bkz. lib/push.ts).
   */
  async function leave() {
    await disablePush(await getToken());
    await signOut();
  }

  return (
    // Yerlesik baslik cubugu: bu bir YONETIM ekrani, tek bir "kaydet"i yok.
    // Ozel cubuk yalnizca form ekranlarinda (bkz. members.tsx yorumu).
    <SafeAreaView style={s.screen} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
        {state.kind === "loading" ? (
          <ActivityIndicator color={theme.brand} />
        ) : state.kind === "error" ? (
          <Text style={s.error}>{state.text}</Text>
        ) : (
          // Grup ekranindaki baslik blogunun karsiligi: bas harfler solda,
          // kimlik saginda.
          <View style={s.identity}>
            <MemberAvatar
              name={state.data.user.displayName}
              me
              size={48}
              avatarUrl={state.data.user.avatarUrl}
              hasImage={state.data.user.hasImage}
            />
            <View style={s.identityText}>
              <Text style={s.name} numberOfLines={1}>
                {state.data.user.displayName}
              </Text>
              <Text style={s.muted} numberOfLines={1}>
                {state.data.user.email}
              </Text>
              {/* FOTOGRAF EYLEMLERI ADIN ALTINDA, ayri bir bolum degil:
                  ikisi de "sen kimsin" sorusunun parcasi ve araya bakir
                  bir bolum cizgisi koymak onlari ayri isler gibi
                  gosterirdi. */}
              <View style={s.photoActions}>
                <Pressable onPress={askPhotoSource} disabled={photoBusy}>
                  <Text style={s.photoAction}>
                    {photoBusy
                      ? t("ui.uploading_photo")
                      : state.data.user.hasImage
                        ? t("ui.change_photo")
                        : t("ui.add_photo")}
                  </Text>
                </Pressable>
                {state.data.user.hasImage ? (
                  <Pressable onPress={() => void removePhoto()} disabled={photoBusy}>
                    <Text style={s.photoAction}>{t("ui.remove_photo")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* GORUNUM. DILDEN FARKLI OLARAK SUNUCUYA GITMIYOR: kagidin rengi
            yalnizca bu cihazda anlamli. Ayni hesabin telefonu koyu,
            tarayicisi acik olabilir ve bu bir tutarsizlik degil.

            "Sistem" AYRI BIR SECENEK ve gerekli: telefonunu gun batiminda
            koyuya geciren biri uygulamanin da gecmesini bekler.

            SEGMENT, CIP DEGIL: uc secenek birbirini disliyor ve sayilari
            sabit - bolusum turu ve odesme yonuyle ayni kalip. Cip yigini
            "birden fazla secilebilir" izlenimi veriyordu.

            ANAHTARLAR TEK TEK YAZILI, dongude uretilmiyor: messages.test.ts
            kaynagi tarayarak calisiyor ve sablon dizgiyle yazilan bir anahtar
            kaynakta HIC gecmiyor - o kontrol onu goremez. Burada tam olarak
            oyle yazilmisti. */}
        <View style={s.block}>
          <SectionRule label={t("ui.appearance")} />
          <View style={s.segments}>
            {[
              { key: "system", label: t("ui.theme_system") },
              { key: "light", label: t("ui.theme_light") },
              { key: "dark", label: t("ui.theme_dark") },
            ].map((option) => {
              const active = themeChoice === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[s.segment, active && s.segmentOn]}
                  onPress={() => setThemeChoice(option.key as typeof themeChoice)}
                >
                  <Text style={[s.segmentText, active && s.segmentTextOn]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* DIL. Hesabin bir parcasi cunku kayit da hesapta duruyor
            (User.locale) ve cihazdan cihaza tasiniyor. */}
        <View style={s.block}>
          <SectionRule label={t("ui.language")} />
          <View style={s.segments}>
            {SUPPORTED_LOCALES.map((value) => {
              const active = locale === value;
              return (
                <Pressable
                  key={value}
                  style={[s.segment, active && s.segmentOn]}
                  onPress={() => void chooseLocale(value)}
                  disabled={localeBusy !== null}
                >
                  {localeBusy === value ? (
                    <ActivityIndicator
                      size="small"
                      color={active ? theme.onBrand : theme.brand}
                    />
                  ) : (
                    <Text style={[s.segmentText, active && s.segmentTextOn]}>
                      {LOCALE_LABELS[value]}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable style={s.secondary} onPress={() => void leave()} disabled={busy}>
          <Text style={s.secondaryText}>{t("ui.sign_out")}</Text>
        </Pressable>

        {/* TEHLIKE BLOGU CERCEVESINI KORUYOR - ve bu, "kutu yerine cizgi"
            kuralindan bilincli bir sapma. Sayfanin geri kalani cizgilerle
            ayriliyor; burasi ayrilmiyor, CEVRELENIYOR. Hesap silmek geri
            alinamaz ve cerceve "buradan sonrasi baska" diyen tek isaret. */}
        <View style={s.danger}>
          <Text style={s.dangerTitle}>{t("ui.delete_account_title")}</Text>
          {/* Kaybedilecek sey SOMUT yaziliyor; "geri alinamaz" demek yetmiyor. */}
          <Text style={s.dangerText}>{t("ui.delete_account_warning")}</Text>
          <Text style={s.dangerText}>{t("ui.delete_account_balance_warning")}</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {confirming ? (
            <>
              <Pressable
                style={s.destructive}
                onPress={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.destructiveText}>{t("ui.delete_account_confirm")}</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} disabled={busy}>
                <Text style={s.secondaryText}>{t("ui.cancel")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              testID="delete-account"
              style={s.destructiveOutline}
              onPress={() => setConfirming(true)}
              disabled={busy}
            >
              <Text style={s.destructiveOutlineText}>{t("ui.delete_account")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    // ZEMIN paper DEGIL background. Bu ekran tek basina paper kullaniyordu;
    // her yerde zemin sicak kagit, paper onun UZERINDEKI fis yapragi.
    screen: { flex: 1, backgroundColor: theme.background },
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },

    identity: { flexDirection: "row", alignItems: "center", gap: 12 },
    identityText: { flex: 1, gap: 2 },
    photoActions: { flexDirection: "row", gap: 16, marginTop: 4 },
    photoAction: {
      fontFamily: fonts.medium,
      fontSize: 13,
      color: theme.brand,
    },
    name: { fontSize: 17, fontFamily: fonts.medium, color: theme.foreground },
    muted: { fontFamily: fonts.body, fontSize: 13.5, color: theme.muted },

    block: { paddingTop: 28 },
    segments: { flexDirection: "row", gap: 8, paddingTop: 14 },
    segment: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 42,
      paddingVertical: 10,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.inputLine,
    },
    segmentOn: { backgroundColor: theme.brand, borderColor: theme.brand },
    segmentText: { fontFamily: fonts.body, fontSize: 13.5, color: theme.foreground },
    segmentTextOn: { fontFamily: fonts.semibold, color: theme.onBrand },

    secondary: { paddingVertical: 28 },
    secondaryText: {
      color: theme.muted,
      fontFamily: fonts.body,
      fontSize: 15,
      textAlign: "center",
    },

    /**
     * TEHLIKE BLOGU. Yaricap 3 (sayfanin geri kalaniyla ayni) ama CERCEVE
     * duruyor: ADR-021 kutu yerine cizgi diyor, burasi bilincli istisna.
     * Gerekcesi render'da yazili.
     */
    danger: {
      gap: 12,
      padding: 16,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.destructive,
      marginTop: 8,
    },
    dangerTitle: { fontSize: 16, fontFamily: fonts.semibold, color: theme.foreground },
    dangerText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: theme.muted },
    destructive: {
      backgroundColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 3,
      alignItems: "center",
    },
    // Zemin kirmizi ve iki temada da koyu - burada beyaz DOGRU, onBrand degil.
    destructiveText: { color: "#fff", fontSize: 15, fontFamily: fonts.semibold },
    destructiveOutline: {
      borderWidth: 1,
      borderColor: theme.destructive,
      paddingVertical: 14,
      borderRadius: 3,
      alignItems: "center",
    },
    destructiveOutlineText: {
      color: theme.destructive,
      fontSize: 15,
      fontFamily: fonts.semibold,
    },
    error: { color: theme.destructive, fontFamily: fonts.body, fontSize: 14 },
  });
}
