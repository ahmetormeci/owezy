import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslate } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { useUnread } from "../lib/unread";

/**
 * Baslik cubugundaki bildirim zili - web'deki zilin karsiligi.
 *
 * NEDEN BASLIKTA: onceden grup ekraninin EN ALTINDA bir kart vardi. Isleyisi
 * dogruydu ama cok harcamali bir grupta uzun bir kaydirmanin arkasinda
 * kaliyordu; yani bildirim VARDI, gorunmuyordu. Baslik her ekranda ayni
 * yerde duruyor ve kaydirmadan etkilenmiyor.
 *
 * NEDEN ACILIR PENCERE DEGIL: web'de zil bir popover aciyor. Mobilde
 * bildirimler EKRANI zaten var (app/notifications.tsx) ve dar bir ekranda
 * acilir pencere, listeyi iki kez cizmek demek olurdu.
 *
 * BU UYGULAMANIN ILK IKONU. Gorsel dil bugune kadar tamamen tipografikti
 * (Cap, →, ·, ▸). Zilin girmesi bilincli bir tercih: "bildirim" icin
 * evrensel olarak taninan isaret o, ve basliktaki yer bir kelimeyi tasimaya
 * yetmiyor. Renk KOBALT - ADR-015'e gore eylem rengi; yesil/kirmizi
 * yalnizca bakiye anlami tasir, burada kullanilmaz.
 */
export function NotificationBell() {
  const { unreadCount } = useUnread();
  const theme = useTheme();
  const t = useTranslate();
  const s = styles(theme);

  return (
    <Link href="/notifications" asChild>
      <Pressable
        style={s.button}
        accessibilityRole="button"
        accessibilityLabel={t("ui.notifications")}
        // Okunmamis sayisi ekran okuyucuya AYRICA soyleniyor: rozet gorsel
        // bir isaret ve tek basina okunmuyor.
        accessibilityValue={unreadCount > 0 ? { text: String(unreadCount) } : undefined}
        // Zil kucuk; dokunma alani gorsel alandan genis tutuluyor.
        hitSlop={10}
      >
        <Ionicons name="notifications-outline" size={22} color={theme.brand} />

        {/* Rozet YALNIZCA okunmamis varken. Sifir yazmak, olmayan bir isi
            varmis gibi gostermek olurdu. */}
        {unreadCount > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    button: { paddingHorizontal: 4, paddingVertical: 2 },
    /**
     * Rozet zilin SAG USTUNE biniyor. position: absolute olmasaydi zili
     * yana iter ve baslik her sayi degisiminde oynardi.
     */
    badge: {
      position: "absolute",
      top: -2,
      right: -4,
      minWidth: 16,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  });
}
