import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/lib/money";
import type { PayerDraft } from "../lib/payer-form";
import { useLocale, useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { FieldInput, SelectField } from "./field";
import { Cap } from "./receipt";

type Member = { userId: string; displayName: string };

/**
 * ODEYEN ALANI (ADR-067, yon C) - harcama ekleme ve harcama detayi ortak.
 *
 * IKI HAL:
 *   Tek odeyen  - eskisi gibi tek bir secici ve altinda kucuk "Baska odeyen
 *                 ekle". En sik durum degismiyor; yeni yetenek yalnizca
 *                 istendiginde yer kapliyor.
 *   Cok odeyen  - "ODEYENLER" bolumu. ILK SATIRIN TUTARI YAZILMIYOR,
 *                 "kalan" olarak hesaplaniyor: toplam tutmazligi boylece
 *                 neredeyse imkansiz. Canli gosterilen tek hata
 *                 "digerleri tutari dolduruyor".
 *
 * Durumu CAGIRAN tutuyor (ana odeyen + ek satirlar): kaydetme govdesi ve
 * dogrulama ekranin isi; bu bilesen yalnizca ciziyor ve degisiklik
 * bildiriyor. Kurallar lib/payer-form.ts'te.
 *
 * Bir kisi iki satirda olamiyor: her secici yalnizca BOSTA olanlari ve
 * kendi secilisini listeliyor (sunucu da ayni kisiyi iki kez reddediyor).
 */
export function PayerFields({
  members,
  label,
  primaryId,
  onPrimaryChange,
  extras,
  onExtrasChange,
  rest,
  exceeds,
  currency,
  disabled,
  style,
}: {
  members: Member[];
  /** Tek odeyen halinde secicinin etiketi ("Ödeyen" / "Kim ödedi?"). */
  label: string;
  primaryId: string | null;
  onPrimaryChange: (userId: string) => void;
  extras: PayerDraft[];
  onExtrasChange: (next: PayerDraft[]) => void;
  /** Ilk satirin kalani (payerFormState). */
  rest: number | null;
  exceeds: boolean;
  currency: string;
  disabled: boolean;
  /** Tek odeyen halinin kabi - yan yana duzende genislik icin. */
  style?: object;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const nameOf = (userId: string | null) =>
    members.find((member) => member.userId === userId)?.displayName ?? "—";

  const taken = new Set([primaryId, ...extras.map((payer) => payer.userId)]);
  const canAdd = members.some((member) => !taken.has(member.userId));

  /** Secicinin listesi: bostakiler ve satirin kendi secilisi. */
  const optionsFor = (current: string | null) =>
    members
      .filter((member) => member.userId === current || !taken.has(member.userId))
      .map((member) => ({ key: member.userId, label: member.displayName }));

  function add() {
    const next = members.find((member) => !taken.has(member.userId));
    if (!next) return;
    onExtrasChange([...extras, { userId: next.userId, amountText: "" }]);
  }

  function update(index: number, changes: Partial<PayerDraft>) {
    onExtrasChange(extras.map((payer, at) => (at === index ? { ...payer, ...changes } : payer)));
  }

  function remove(index: number) {
    onExtrasChange(extras.filter((_, at) => at !== index));
  }

  const addLink = canAdd ? (
    <Pressable testID="add-payer" hitSlop={8} onPress={add} disabled={disabled}>
      <Cap color={theme.brand}>{t("ui.add_payer")}</Cap>
    </Pressable>
  ) : null;

  if (extras.length === 0) {
    return (
      <View style={[s.single, style]}>
        <SelectField
          testID="payer-select-0"
          label={label}
          value={nameOf(primaryId)}
          options={optionsFor(primaryId)}
          onChange={onPrimaryChange}
          disabled={disabled}
        />
        {addLink}
      </View>
    );
  }

  return (
    <View style={s.block}>
      <Text style={s.label}>{t("ui.payers").toLocaleUpperCase(locale)}</Text>

      <View style={s.row}>
        <SelectField
          testID="payer-select-0"
          hideLabel
          label={t("ui.payer_person_label", { index: 1 })}
          style={s.name}
          value={nameOf(primaryId)}
          options={optionsFor(primaryId)}
          onChange={onPrimaryChange}
          disabled={disabled}
        />
        <Text style={s.rest}>
          {t("ui.payer_remainder")}{" "}
          <Text testID="payer-rest" style={s.restValue}>
            {rest === null ? "—" : formatMoney(rest, currency, locale)}
          </Text>
        </Text>
      </View>

      {extras.map((payer, index) => (
        <View key={index} style={s.row}>
          <SelectField
            testID={`payer-select-${index + 1}`}
            hideLabel
            label={t("ui.payer_person_label", { index: index + 2 })}
            style={s.name}
            value={nameOf(payer.userId)}
            options={optionsFor(payer.userId)}
            onChange={(userId) => update(index, { userId })}
            disabled={disabled}
          />
          <FieldInput
            testID={`payer-amount-${index}`}
            style={s.amount}
            value={payer.amountText}
            onChangeText={(amountText) => update(index, { amountText })}
            keyboardType="decimal-pad"
            placeholder="0,00"
            editable={!disabled}
            accessibilityLabel={t("ui.payer_amount_label", { name: nameOf(payer.userId) })}
          />
          <Pressable
            testID={`remove-payer-${index}`}
            hitSlop={8}
            onPress={() => remove(index)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t("ui.remove_payer")}
          >
            <Text style={s.remove}>×</Text>
          </Pressable>
        </View>
      ))}

      {exceeds ? <Text style={s.error}>{t("ui.payers_exceed")}</Text> : null}
      {addLink}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    single: { gap: 10 },
    block: { gap: 12 },
    label: {
      fontFamily: fonts.medium,
      fontSize: 10,
      letterSpacing: 2,
      color: theme.copperText,
    },
    // Alt hizali: secicinin alt cizgisi ile tutar alaninki ayni hizada dursun.
    row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    name: { flex: 1, minWidth: 0 },
    rest: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: theme.muted,
      paddingBottom: 9,
      fontVariant: ["tabular-nums"],
    },
    restValue: { fontFamily: fonts.medium, color: theme.foreground },
    // Kalem editorundeki tutar alaniyla ayni olcu ve cizgi.
    amount: {
      width: 92,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      textAlign: "right",
      borderBottomWidth: 1,
      borderBottomColor: theme.inputLine,
      paddingVertical: 4,
      marginBottom: 4,
      fontVariant: ["tabular-nums"],
    },
    remove: {
      fontFamily: fonts.body,
      fontSize: 20,
      color: theme.muted,
      paddingHorizontal: 2,
      paddingBottom: 6,
    },
    error: { fontFamily: fonts.body, fontSize: 13, color: theme.debt },
  });
}
