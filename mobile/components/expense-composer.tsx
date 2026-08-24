import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { guessCategory } from "@/lib/expense-category-guess";
import { EXPENSE_CATEGORY_CODES } from "@/lib/expense-labels";
import { parseMoney } from "@/lib/money";
import { useTranslate } from "../lib/i18n";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";
import { Cap } from "./receipt";

/**
 * Fisin bir sonraki satiri: harcamayi ekrandan cikmadan ekler.
 *
 * NEDEN VAR: bu uygulamanin en sik yapilan isi harcama KAYDETMEK. Kahve
 * parasi girmek icin ayri bir forma gitmek, kaydin hic girilmemesine yol
 * aciyor.
 *
 * NEDEN FORMUN YERINI ALMIYOR: burada YALNIZCA en yaygin durum var - esit
 * bolusum, odeyen sensin, tarih bugun. Varsayimlari GIZLEMIYORUZ: bir sey
 * yazmaya baslayinca altta ne olacagi cikiyor.
 *
 * TOAST YOK. Web'de sonner var; React Native'de karsiligi ya modal bir
 * Alert ya da ek bir paket. Hatalar satirin ALTINDA, hatanin oldugu yere
 * yakin duruyor. Basaride ayrica bildirim yok - eklenen satirin fiste
 * belirmesi teyidin kendisi.
 */
export function ExpenseComposer({
  groupId,
  memberIds,
  currentUserId,
  onAdded,
}: {
  groupId: string;
  /** Grubun AKTIF uyeleri. Ayrilmis uye yeni bolusume giremez. */
  memberIds: string[];
  currentUserId: string;
  onAdded: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const s = styles(theme);
  const { post } = useApiClient();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseMoney(amountText);
  const isDirty = description.trim() !== "" || amountText.trim() !== "";

  // Tahmin BURADA DA hesaplaniyor ama GONDERILMIYOR - yalnizca ipucu
  // satirinda gostermek icin. Karari sunucu veriyor (ADR-002/028); ekranda
  // gorunen ile kaydedilen ayrismasin diye ikisi AYNI saf fonksiyondan
  // geciyor.
  const guessed = guessCategory(description);

  async function submit() {
    if (busy) return;
    setError(null);

    // Dogrulama tam formdakiyle AYNI mesajlari kullaniyor: ayni hatanin iki
    // istemcide iki farkli his vermesi istenmiyor.
    if (!description.trim()) {
      setError(t("ui.description_required"));
      return;
    }
    if (amountText.trim() !== "" && amount === null) {
      setError(t("ui.amount_unreadable"));
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t("ui.amount_required"));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    setBusy(true);
    try {
      const result = await post(`/api/v1/groups/${groupId}/expenses`, {
        description: description.trim(),
        amount,
        paidById: currentUserId,
        // Kategori BILEREK gonderilmiyor: sunucu aciklamadan tahmin ediyor.
        // Buradan "OTHER" gondermek, tahmini daha dogmadan ezmek olurdu.
        expenseDate: today,
        splitType: "EQUAL",
        participantUserIds: memberIds,
      });

      if (!result.ok) {
        setError(t(result.code));
        return;
      }

      setDescription("");
      setAmountText("");
      onAdded();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.block}>
      {/* Kagidin bir sonraki satiri: ayni noktali ayrac, ayni hizalama.
          Kenarliksiz girdiler bilerek - kutu cizmek, satirin fisin parcasi
          degil uzerine konmus bir arayuz oldugunu soylerdi. */}
      <View style={s.row}>
        <Text style={s.plus}>+</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t("ui.composer_placeholder")}
          placeholderTextColor={theme.muted}
          maxLength={200}
          editable={!busy}
          style={s.description}
        />
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0,00"
          placeholderTextColor={theme.muted}
          keyboardType="decimal-pad"
          editable={!busy}
          style={s.amount}
        />
      </View>

      {/* Varsayimlar ve dugme yalnizca yazmaya baslayinca cikiyor: bos fis
          tek temiz satir olarak duruyor. */}
      {isDirty ? (
        <View style={s.hintRow}>
          <Text style={s.hint} numberOfLines={2}>
            {guessed ? `${t(EXPENSE_CATEGORY_CODES[guessed])} · ` : ""}
            {t("ui.composer_hint")}
          </Text>
          <Pressable style={s.button} onPress={() => void submit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Cap tone="onBrand">{t("ui.composer_submit")}</Cap>
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    block: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.foreground,
      paddingBottom: 6,
    },
    plus: { color: theme.muted, fontSize: 15, marginRight: 8 },
    description: { flex: 1, fontSize: 14, color: theme.foreground, padding: 0 },
    amount: {
      width: 96,
      fontSize: 14,
      color: theme.foreground,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
      padding: 0,
    },
    hintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    hint: { flex: 1, fontSize: 11, color: theme.muted },
    button: {
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    error: { fontSize: 12, color: theme.debt },
  });
}
