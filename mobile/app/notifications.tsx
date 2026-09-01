import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { describeNotification, formatRelativeTime } from "@/lib/notification-text";
import type { NotificationType } from "@prisma/client";
import { useLocale, useTranslate } from "../lib/i18n";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";

/**
 * Bildirimler. MOBILDE HIC YOKTU; web'de basliktaki zil bu listeyi acıyor.
 *
 * BU UYGULAMA ICI BIR LISTE, PUSH DEGIL. Telefon kilitliyken gelen bildirim
 * bambaska bir is: APNs, expo-notifications, izin istemi, yeni build ve App
 * Privacy anketinde degisiklik. Ucler (GET /notifications, .../read,
 * read-all) web'deki zili besleyen uclarin aynisi ve zaten hazirdi.
 *
 * METIN URETIMI PAYLASILIYOR: describeNotification ve formatRelativeTime
 * src/lib/notification-text.ts'de, saf ve React'siz. Yani "hangi olay nasil
 * yaziliyor" ve "3 dakika once" kurallari web ile MOBILDE AYNI yerden
 * geliyor - ADR-042'nin "saf moduller siniri gecer" kurali tam olarak bunun
 * icin.
 */
type NotificationItem = {
  id: string;
  type: NotificationType;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};
type ListResponse = {
  notifications: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export default function NotificationsScreen() {
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { get, post } = useApiClient();

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * "Simdi" BIR KEZ SABITLENIYOR.
   *
   * formatRelativeTime her cizimde new Date() ile cagrilsaydi, ekran her
   * yeniden cizildiginde satirlarin zamani oynardi - "az once" bir anda
   * "1 dakika once" olurdu, kullanici hicbir sey yapmamisken. Ekranin
   * acildigi an referans; liste tazelenince yeniden aliniyor.
   */
  const [now, setNow] = useState(() => new Date());

  /**
   * BU ZIYARETTE YENI OLANLAR.
   *
   * Nokta artik kaydin readAt'ine DEGIL buna bakiyor ve sebebi olculdu:
   * ekran acilinca read-all calisiyor, odaklanmada da liste yeniden
   * cekiliyor - ikinci cekimde butun kayitlar okunmus donuyor ve noktalar
   * kaybolyordu. Yani "hangileri yeniydi" bilgisi, onu gostermeye
   * calistigimiz anda siliniyordu.
   *
   * Web'de bu cakisma YOK cunku acilir pencere her acilista bir kez cekiyor.
   * Mobilde odaklanmada tazeleme SART (bkz. useFocusEffect), o yuzden bilgi
   * ayrica tutuluyor.
   *
   * REF DEGIL STATE: bu deger CIZIMI etkiliyor. Ref'ten okumak once
   * denendi ve lint hakli olarak reddetti - ref degistiginde React yeniden
   * cizmez, yani noktalar guncellenmeyebilirdi.
   *
   * Ekran ORNEGINE bagli: gruba gidip geri gelince noktalar duruyor, ekran
   * kapanip yeniden acilinca ziyaret bastan basliyor. Dogrusu da bu.
   */
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());

  const load = useCallback(
    async (cursor: string | null) => {
      setBusy(true);
      setError(null);

      const result = await get<ListResponse>(
        `/api/v1/notifications?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      );

      if (!result.ok) {
        setError(t(result.code));
        setBusy(false);
        return;
      }

      setNewIds((current) => {
        const next = new Set(current);
        for (const item of result.data.notifications) {
          if (!item.readAt) next.add(item.id);
        }
        return next;
      });

      setItems((current) =>
        cursor ? [...(current ?? []), ...result.data.notifications] : result.data.notifications,
      );
      setNextCursor(result.data.nextCursor);
      setBusy(false);

      /**
       * EKRAN ACILINCA HEPSI OKUNDU SAYILIYOR - web'in zili de acilinca ayni
       * seyi yapiyor.
       *
       * AMA NOKTALAR EKRANDA KALIYOR ve bu bir kaza degil: liste read-all'dan
       * ONCE cekildigi icin elimizdeki kayitlarin readAt'i hala bos. Yani
       * kullanici hangilerinin yeni oldugunu gormeye devam ediyor, sayac ise
       * sifirlaniyor. Web'de de ayni sira kullaniliyor.
       *
       * Cevabi BEKLEMIYORUZ ve hatasini gostermiyoruz: bu kullanicinin
       * istedigi is degil, yan etki. Basarisiz olursa sayac bir sonraki
       * aciliste yine dogru gorunur.
       */
      if (!cursor && result.data.unreadCount > 0) {
        void post("/api/v1/notifications/read-all", {});
      }
    },
    [get, post, t],
  );

  /**
   * HER ODAKLANMADA tazeleniyor - yalnizca ilk baglanmada degil.
   *
   * Once "ilk kez" korumasi vardi (diger ekranlardaki desen) ve YANLISTI.
   * Orada koruma dogru cunku veri mount aninda ayrica cekiliyor ve ikinci bir
   * istek bosuna olurdu; BURADA yukleyen tek sey bu, yani koruma "bir daha
   * hic yukleme" demek oluyordu. Simulatorde goruldu: yeni bildirimler
   * eklendikten sonra ekrana geri donuldugunde liste hala "Henuz bildirimin
   * yok" diyordu.
   *
   * "Simdi" de burada tazeleniyor: ekran acikken donmus bir referansa gore
   * "az once" yazmaya devam etmesin.
   */
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void load(null);
    }, [load]),
  );

  /**
   * Bir satira dokunulunca.
   *
   * href, describeNotification'dan geliyor ve "/groups/<id>" - bu ADRES
   * MOBILDE DE GECERLI bir rota. Tesadüf degil: iki istemci ayni rota
   * adlarini kullaniyor.
   *
   * TEK KAYDI DA OKUNDU ISARETLIYORUZ. read-all zaten calisti ama o BEKLENMEDI
   * ve basarisiz olabilir; ustelik "daha fazla" ile sonradan gelen sayfalar
   * read-all'dan sonra yuklendigi icin onlari kapsamiyor. Web'de de iki
   * mekanizma birlikte duruyor.
   */
  function open(item: NotificationItem, href: string | null) {
    if (!item.readAt) {
      void post(`/api/v1/notifications/${item.id}/read`, {});
    }

    if (href) {
      router.push(href as "/groups/[groupId]");
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
        {error ? (
          <Pressable onPress={() => void load(null)}>
            <Text style={s.error}>{error}</Text>
            <Text style={s.link}>{t("ui.try_again")}</Text>
          </Pressable>
        ) : items === null ? (
          <ActivityIndicator color={theme.brand} />
        ) : items.length === 0 ? (
          <Text style={s.empty}>{t("ui.no_notifications")}</Text>
        ) : (
          <>
            {items.map((item) => {
              const view = describeNotification(item.type, item.payload, t, locale);
              return (
                <Pressable
                  key={item.id}
                  style={s.row}
                  onPress={() => open(item, view.href)}
                >
                  <View style={s.rowHead}>
                    {/* Okunmamis isareti: kucuk kobalt nokta. Okunmuslarda yeri
                        BOS BIRAKILIYOR (gorunmez nokta degil, ayni genislikte
                        bosluk) ki basliklar ayni sutunda hizali kalsin. */}
                    <View style={[s.dot, newIds.has(item.id) ? null : s.dotRead]} />
                    <Text style={s.title} numberOfLines={2}>
                      {view.title}
                    </Text>
                  </View>
                  {view.detail ? <Text style={s.detail}>{view.detail}</Text> : null}
                  <Text style={s.meta}>
                    {[
                      view.groupName,
                      formatRelativeTime(new Date(item.createdAt), now, t, locale),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
              );
            })}

            {busy ? <ActivityIndicator color={theme.brand} /> : null}

            {nextCursor && !busy ? (
              <Pressable onPress={() => void load(nextCursor)}>
                <Text style={s.link}>{t("ui.load_more")}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.paper },
    content: { padding: 20, gap: 4 },
    row: {
      gap: 3,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.brand },
    dotRead: { backgroundColor: "transparent" },
    title: { flex: 1, fontSize: 15, color: theme.foreground },
    // Ayrintı ve ust bilgi noktanin GENISLIGI KADAR iceriden basliyor,
    // boylece satirin butun metni tek sutunda hizali duruyor.
    detail: { fontSize: 13, color: theme.muted, marginLeft: 15 },
    meta: { fontSize: 11, color: theme.muted, marginLeft: 15 },
    empty: { color: theme.muted, lineHeight: 22 },
    error: { color: theme.debt, fontSize: 14 },
    link: { color: theme.brand, fontSize: 14, paddingVertical: 12 },
  });
}
