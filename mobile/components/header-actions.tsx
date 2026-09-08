import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { NotificationBell } from "./notification-bell";

/**
 * Baslik cubugunun sag tarafi: zil ve hesap.
 *
 * HESAP NEDEN BURAYA TASINDI: onceden "Hesap" iki ayri ekranin EN ALTINDA
 * bir karttI (gruplar listesi ve grup ekrani). Grup ekraninda kirk harcamali
 * bir listenin arkasindaydi - yani ayarlarina ulasmak icin butun fisi
 * kaydirmak gerekiyordu. Zil de tam olarak ayni sebeple buraya tasinmisti.
 *
 * Web'de de hesap baslikta, avatarin arkasinda (user-menu.tsx).
 *
 * GENEL KISI SIMGESI, BAS HARFLER DEGIL: bas harfleri gostermek her ekranda
 * kullanicinin adina - yani global bir /api/v1/me saglayicisina - ihtiyac
 * duyardi. Simge hicbir veri istemiyor ve kimligini zaten actigin ekranda
 * goruyorsun. Zil de bir simge; ikisi ayni dili konusuyor.
 */
export function AccountAvatar() {
  const theme = useTheme();
  const t = useTranslate();
  const s = styles(theme);

  return (
    <Link href="/account" asChild>
      <Pressable
        style={s.button}
        accessibilityRole="button"
        accessibilityLabel={t("ui.account")}
        // Simge kucuk; dokunma alani gorsel alandan genis tutuluyor.
        hitSlop={10}
      >
        <Ionicons name="person-circle-outline" size={24} color={theme.brand} />
      </Pressable>
    </Link>
  );
}

/** Zil + hesap. Baslikta ikisi yan yana duruyor. */
export function HeaderActions() {
  const s = styles(useTheme());
  return (
    <View style={s.row}>
      <NotificationBell />
      <AccountAvatar />
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 14 },
    button: { paddingHorizontal: 4, paddingVertical: 2 },
  });
}
