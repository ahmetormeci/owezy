import { fonts } from "../lib/fonts";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../lib/auth";
import { useTranslate } from "../lib/i18n";
import { enablePush, pushState, type PushState } from "../lib/push";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Bildirim izni istemi.
 *
 * NEDEN BILDIRIMLER EKRANINDA, ACILISTA DEGIL: iOS izin istemini uygulama
 * omrunde BIR KEZ veriyor. Reddedilirse bir daha sorulamiyor - kullanici
 * Ayarlar'a gitmek zorunda kaliyor. Uygulamayi yeni acmis, daha ne
 * yaptigini gormemis birine sormak "reddet"i garantiler. Burada ise kisi
 * zaten bildirimlere bakiyor; ne istedigi belli.
 *
 * NE GONDERILDIGI EKRANDA YAZIYOR (ui.push_hint). Bu bir para uygulamasi ve
 * kullanicinin, kilit ekraninda tutar cikip cikmayacagini izin vermeden
 * ONCE bilmeye hakki var.
 *
 * SIMULATORDE HIC CIZILMIYOR: gercek bir push adresi yalnizca fiziksel
 * cihazda uretilebiliyor, yani orada dugme sunmak calismayacak bir sey
 * sunmak olurdu.
 */
export function PushOptIn() {
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);
  const { getToken } = useSession();

  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = await pushState();
      if (!cancelled) setState(current);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const next = await enablePush(await getToken());
    setBusy(false);
    setState(next);
  }, [busy, getToken]);

  // Durum okunana kadar HICBIR SEY cizilmiyor. "Kapali" varsayip sonra
  // "acik"a donmek, ekranin acilisinda goze carpan bir zipllama olurdu.
  if (state === null || state === "unsupported") return null;

  if (state === "granted") {
    return (
      <View style={s.block}>
        <Cap>{t("ui.push_enabled")}</Cap>
      </View>
    );
  }

  if (state === "denied") {
    // DUGME YOK ve olmamali: iOS bir daha sormuyor, basilsa hicbir sey
    // olmazdi. Yapilacak tek sey Ayarlar'a gitmek ve cumle onu soyluyor.
    return (
      <View style={s.block}>
        <Text style={s.hint}>{t("ui.push_denied")}</Text>
      </View>
    );
  }

  return (
    <View style={s.block}>
      <Text style={s.hint}>{t("ui.push_hint")}</Text>
      <Pressable style={s.button} onPress={() => void ask()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Cap tone="onBrand">{t("ui.push_enable")}</Cap>
        )}
      </Pressable>
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    block: {
      gap: 10,
      padding: 16,
      backgroundColor: theme.paper,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    hint: { fontFamily: fonts.body, fontSize: 13, color: theme.muted, lineHeight: 19 },
    button: {
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingVertical: 11,
      alignItems: "center",
    },
  });
}
