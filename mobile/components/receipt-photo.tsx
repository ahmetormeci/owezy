import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { apiBaseUrl } from "../lib/api";
import { pickReceipt, receiptEndpoint, uploadReceipt } from "../lib/receipt-file";
import { useSession } from "../lib/auth";
import { useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Harcamaya ekli fis fotografi.
 *
 * GORSEL KENDI UCUMUZDAN GELIYOR, depodan degil. Adres yetkisiz calismiyor;
 * her istekte grup uyeligi yeniden sorgulaniyor (api/.../receipt). Bu yuzden
 * <Image> cagrisinda Authorization basligi var - basliksiz bir istek 401
 * doner ve gorsel hic cizilmez.
 *
 * FOTOGRAF CIHAZDA KUCULTULUYOR ve bu bir suslemeden ibaret degil: Vercel'in
 * istek govdesi siniri 4.5MB, telefon fotografi 3-8MB. Kucultmeseydik
 * yukleme, bizim anlasilir hata cumlemize bile ulasamadan platform
 * tarafindan kesilirdi.
 */

export function ReceiptPhoto({
  groupId,
  expenseId,
  present,
  canEdit,
  onChanged,
}: {
  groupId: string;
  expenseId: string;
  present: boolean;
  /** Fisi yalnizca harcamayi degistirebilen kisi ekleyip kaldirabiliyor. */
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { getToken } = useSession();
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);

  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Yukleme sonrasi ONBELLEGI KIRMAK icin. <Image> gorseli adrese gore
   * onbellekliyor; adres degismezse yeni fotograf yerine eskisi cizilirdi
   * ve kullanici "yuklenmedi" sanirdi.
   */
  const [version, setVersion] = useState(0);

  const endpoint = receiptEndpoint(apiBaseUrl(), groupId, expenseId);
  // ?v: <Image> adrese gore onbellekliyor; adres degismezse yeni fotograf
  // yerine eskisi cizilir ve kullanici "yuklenmedi" sanir.
  const uri = `${endpoint}?v=${version}`;

  /**
   * Belirteci bir kez aliyoruz; <Image> onu baslikta tasiyacak. Gorsel
   * adresi yetkisiz calismiyor - basliksiz bir istek 401 doner ve fotograf
   * hic cizilmez.
   *
   * IPTAL BAYRAGI: ekran cevap gelmeden kapanabilir; onsuz artik gorunmeyen
   * bir bilesenin durumu guncellenmeye calisilirdi.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const value = await getToken();
      if (!cancelled) setToken(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const send = useCallback(
    async (localUri: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await uploadReceipt(localUri, endpoint, await getToken());
        if (!result.ok) {
          setError(t(result.code));
          return;
        }
        setVersion((current) => current + 1);
        onChanged();
      } catch (caught) {
        /**
         * HER HATAYI "internet yok" SAYMIYORUZ. Onceden oyleydi ve bir
         * kusuru tam olarak gizledi: govdeye yanlislikla bir Promise giden
         * cagri patliyordu ve ekranda "internet yok" yaziyordu - yani sebep,
         * gosterilenin tam tersiydi. RN'de ag hatasi TypeError olarak
         * geliyor; gerisi bizim hatamiz ve oyle soylenmeli.
         */
        console.error("Fiş yüklenemedi", caught);
        setError(t(caught instanceof TypeError ? "server.offline" : "server.unexpected"));
      } finally {
        setBusy(false);
      }
    },
    [endpoint, getToken, onChanged, t],
  );

  const pick = useCallback(
    async (source: "camera" | "library") => {
      const picked = await pickReceipt(source);
      if (picked.kind === "cancelled") return;
      if (picked.kind === "error") {
        setError(t(picked.code));
        return;
      }
      await send(picked.uri);
    },
    [send, t],
  );

  function choose() {
    Alert.alert(t("ui.add_receipt"), undefined, [
      { text: t("ui.take_photo"), onPress: () => void pick("camera") },
      { text: t("ui.choose_from_library"), onPress: () => void pick("library") },
      { text: t("ui.cancel"), style: "cancel" },
    ]);
  }

  /**
   * DUZ FONKSIYON, useCallback DEGIL: hicbir memoize edilmis cocuga
   * gecmiyor, yani sarmalamak bir sey kazandirmiyordu. Ustelik
   * confirmRemove'un USTUNDE durmasi gerekiyor - altinda kaldiginda React
   * Compiler memoizasyonu koruyamadigini soyleyip derlemeyi atliyordu.
   */
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const authToken = await getToken();
      const response = await fetch(uri, {
        method: "DELETE",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!response.ok) {
        setError(t("server.unexpected"));
        return;
      }
      onChanged();
    } catch {
      setError(t("server.offline"));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    Alert.alert(t("ui.remove_receipt_question"), undefined, [
      { text: t("ui.cancel"), style: "cancel" },
      {
        text: t("ui.remove_receipt"),
        style: "destructive",
        onPress: () => void remove(),
      },
    ]);
  }


  return (
    <View style={s.block}>
      <View style={s.head}>
        <Cap>{t("ui.receipt")}</Cap>
        {busy ? (
          <ActivityIndicator size="small" color={theme.brand} />
        ) : canEdit ? (
          <View style={s.actions}>
            <Pressable hitSlop={10} onPress={choose}>
              <Cap>{present ? t("ui.replace_receipt") : t("ui.add_receipt")}</Cap>
            </Pressable>
            {present ? (
              <Pressable hitSlop={10} onPress={confirmRemove}>
                <Text style={s.remove}>{t("ui.remove_receipt")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {present && token ? (
        <Image
          source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
          style={s.photo}
          // Fisin TAMAMI gorunmeli: kirpmak, tam da okunmak istenen satiri
          // kesebilirdi.
          resizeMode="contain"
          accessibilityLabel={t("ui.receipt")}
        />
      ) : !present ? (
        <Text style={s.empty}>{t("ui.no_receipt")}</Text>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    block: {
      gap: 10,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 14,
    },
    head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    actions: { flexDirection: "row", alignItems: "center", gap: 14 },
    remove: { fontSize: 12, color: theme.debt },
    // Sabit yukseklik: fis dikey ya da yatay olabiliyor, ikisinde de satir
    // ziplamasin.
    photo: { width: "100%", height: 260, backgroundColor: theme.surface, borderRadius: 3 },
    empty: { fontSize: 13, color: theme.muted },
    error: { fontSize: 13, color: theme.debt },
  });
}
