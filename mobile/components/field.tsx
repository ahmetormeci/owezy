import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme, type Theme } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { useLocale } from "../lib/i18n";

/**
 * KUTUSUZ FORM ALANI: bakir etiket + tek bir alt cizgi.
 *
 * NEDEN KUTU DEGIL: ADR-021'in "kutu yerine cizgi" kurali form denetimlerine
 * hic uygulanmamisti - ekranin geri kalani sac teli cizgilerle ayrilirken
 * girisler cerceveli kutulardi ve kagidin uzerinde yabanci duruyordu.
 *
 * ALT CIZGI --border DEGIL --input-line: bolum siniriyla ayni agirlikta bir
 * cizgi, alanin nerede bittigini soylemiyor.
 */
export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  /** Etiketin sagindaki kucuk not - bugun yalnizca "tahmin" icin. */
  hint?: string;
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useTheme();
  const locale = useLocale();
  const s = useMemo(() => styles(theme), [theme]);
  return (
    <View style={[s.field, style]}>
      <View style={s.labelRow}>
        {/* toLocaleUpperCase(locale) SART: Turkce'de "i" -> "İ". */}
        <Text style={s.label}>{label.toLocaleUpperCase(locale)}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <View style={s.underline}>{children}</View>
    </View>
  );
}

/**
 * Acilir secim: alanin kendisi bir deger ve bir ok gosteriyor, dokununca
 * secenekler alttan geliyor.
 *
 * NEDEN CIP DEGIL: kategori yedi secenek ve uye sayisi da artabiliyor.
 * Ciplerle hepsi ayni anda ekranda duruyordu, yani form "ne girecegim"
 * yerine "kac secenek var" gibi okunuyordu. Acilir liste bir anda tek bir
 * karar gosteriyor.
 *
 * MODAL, KUTUPHANE DEGIL: React Native'in kendi Modal'i yetiyor ve bu ekran
 * icin yeni bir bagimlilik almaya deger bir sey yok.
 */
export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled = false,
  style,
}: {
  label: string;
  hint?: string;
  /** Ekranda gorunen metin. */
  value: string;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
  disabled?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Field label={label} hint={hint} style={style}>
        <Pressable
          style={s.selectRow}
          onPress={() => setOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
        >
          <Text style={s.selectValue} numberOfLines={1}>
            {value}
          </Text>
          <Text style={s.caret}>{"▾"}</Text>
        </Pressable>
      </Field>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Zemine dokunmak KAPATIYOR: modal icinde bir "vazgec" dugmesi,
            listede sekizinci bir satir gibi okunurdu. */}
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <ScrollView bounces={false}>
              {options.map((option) => (
                <Pressable
                  key={option.key}
                  style={s.option}
                  onPress={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                >
                  <Text style={s.optionText} numberOfLines={1}>
                    {option.label}
                  </Text>
                  {option.label === value ? <Text style={s.check}>{"✓"}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    field: { gap: 7 },
    labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    label: {
      fontFamily: fonts.medium,
      fontSize: 10,
      letterSpacing: 2,
      color: theme.copperText,
    },
    hint: { fontFamily: fonts.body, fontSize: 10, color: theme.copperText },
    underline: { borderBottomWidth: 1, borderBottomColor: theme.inputLine, paddingBottom: 8 },

    selectRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    selectValue: { fontFamily: fonts.body, fontSize: 16, color: theme.foreground, flexShrink: 1 },
    caret: { fontFamily: fonts.body, fontSize: 12, color: theme.muted },

    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: theme.paper,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderTopWidth: 1,
      borderTopColor: theme.copper,
      maxHeight: "60%",
      paddingBottom: 34,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    optionText: { fontFamily: fonts.body, fontSize: 16, color: theme.foreground, flexShrink: 1 },
    check: { fontFamily: fonts.body, fontSize: 15, color: theme.brand },
  });
}
