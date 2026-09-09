import { fonts } from "../lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslate } from "../lib/i18n";

/**
 * Fisi TAM EKRAN gosterir.
 *
 * NEDEN GEREKLI: fis, satirlarini okumak icin var. Harcama ekranindaki 260
 * piksellik kutuda bir market fisinin yazilari okunmuyordu ve kullanici
 * bildirdi - gorsele dokundugu halde buyumuyordu.
 *
 * ZEMIN KOYU ve bu bir tercih degil, gereklilik: fis beyaz kagit; acik bir
 * zeminde nerede bittigi gorunmuyor. Koyu zemin ayni zamanda "bu bir katman,
 * sayfa degil" diyor.
 *
 * PINCH-ZOOM YOK. Yapmak react-native-gesture-handler eklemek, yani yeni bir
 * native bagimlilik ve yeni bir build demekti. Tam ekran, 260 pikselden ~3
 * kat buyuk bir goruntu veriyor; yeterli olmazsa yakinlastirma ayri bir is
 * olarak eklenir.
 */
export function ReceiptViewer({
  visible,
  uri,
  token,
  onClose,
}: {
  visible: boolean;
  uri: string;
  token: string | null;
  onClose: () => void;
}) {
  const t = useTranslate();

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      // iOS'ta asagi kaydirarak kapatma: tam ekran bir gorsel icin beklenen
      // hareket.
      presentationStyle="overFullScreen"
      transparent
    >
      <View style={s.backdrop}>
        <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
          <Pressable style={s.close} onPress={onClose} hitSlop={16}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          {token ? (
            <Image
              source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
              style={s.photo}
              // Fisin TAMAMI gorunmeli: kirpmak, tam da okunmak istenen
              // satiri kesebilir.
              resizeMode="contain"
              accessibilityLabel={t("ui.receipt")}
            />
          ) : (
            <ActivityIndicator color="#fff" />
          )}

          {/* Zeminin herhangi bir yerine dokunmak da kapatiyor - tek cikis
              yolu kucuk bir capraz olmasin. */}
          <Pressable style={s.dismissArea} onPress={onClose}>
            <Text style={s.hint}>{t("ui.close")}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Renkler TEMADAN GELMIYOR ve bilerek: bu katman her iki temada da koyu.
  // Fis beyaz kagit; acik bir zeminde kenarlari kayboluyor.
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)" },
  safe: { flex: 1 },
  close: { alignSelf: "flex-end", padding: 16 },
  photo: { flex: 1, width: "100%" },
  dismissArea: { paddingVertical: 18, alignItems: "center" },
  hint: { color: "#9a9da2", fontFamily: fonts.body, fontSize: 13 },
});
