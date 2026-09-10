import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts } from "../lib/fonts";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { useLocale, useTranslate } from "../lib/i18n";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";
import { SectionRule } from "./receipt";

/**
 * Grubun tekrarlayan harcamalari (ADR-051).
 *
 * FISIN DISINDA, kagidin altinda - web'le ayni yerde. Fis OLMUS islerin
 * kaydi; tekrarlayan harcama OLACAK bir sey. Fisin icine koysaydik henuz
 * gerceklesmemis bir satir gerceklesmisler arasinda dururdu ve bakiyeye
 * girdigi sanilirdi (girmiyor).
 *
 * DURAKLATILMISLAR DA LISTEDE: kullanicinin onlari geri acabilmesi icin
 * gorunmeleri sart.
 */

type RecurringRow = {
  id: string;
  description: string;
  amount: number;
  interval: "WEEKLY" | "MONTHLY";
  nextRunOn: string;
  pausedAt: string | null;
  createdById: string;
};

export function RecurringList({
  groupId,
  currency,
  currentUserId,
}: {
  groupId: string;
  currency: string;
  /**
   * null olabiliyor: "ben kimim" sorgusu henuz donmemis olabilir. Sonucu
   * yalnizca dugmelerin gorunurlugu - sunucu yetkiyi her halukarda kendisi
   * dogruluyor.
   */
  currentUserId: string | null;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = styles(theme);
  const { get, patch, remove } = useApiClient();

  const [rows, setRows] = useState<RecurringRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cevirici REF'te, bagimlilik listesinde DEGIL - use-api.ts'in ogrettigi
  // dersin aynisi: dil degisimi listeyi yeniden CEKMEMELI.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const load = useCallback(async () => {
    const result = await get<{ recurring: RecurringRow[] }>(
      `/api/v1/groups/${groupId}/recurring-expenses`,
    );
    if (result.ok) {
      /**
       * ?? [] BIR TEDBIR DEGIL, OLCULMUS BIR KIRILGANLIK: beklenmedik bir
       * govde geldiginde (eski bir sunucu, bir vekil) rows undefined kaliyor
       * ve asagidaki rows.length BUTUN GRUP EKRANINI cokertiyordu. Bu satir
       * bir testin uydurma cevabiyla ortaya cikti; kusur uydurma degil.
       */
      setRows(result.data.recurring ?? []);
      setError(null);
    } else {
      setRows([]);
      setError(tRef.current(result.code, result.params));
    }
  }, [get, groupId]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  async function togglePause(row: RecurringRow) {
    if (busyId) return;
    setBusyId(row.id);
    const result = await patch(`/api/v1/groups/${groupId}/recurring-expenses/${row.id}`, {
      paused: row.pausedAt === null,
    });
    setBusyId(null);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }
    setError(null);
    setRows((current) =>
      (current ?? []).map((candidate) =>
        candidate.id === row.id
          ? {
              ...candidate,
              pausedAt: candidate.pausedAt === null ? new Date().toISOString() : null,
            }
          : candidate,
      ),
    );
  }

  function confirmDelete(row: RecurringRow) {
    // SILME YIKICI ve geri alinamaz - onay penceresi, yorum silmedeki gibi.
    Alert.alert(t("ui.recurring_delete_question"), t("ui.recurring_delete_hint"), [
      { text: t("ui.cancel"), style: "cancel" },
      {
        text: t("ui.delete"),
        style: "destructive",
        onPress: () => void doDelete(row.id),
      },
    ]);
  }

  async function doDelete(id: string) {
    setBusyId(id);
    const result = await remove(`/api/v1/groups/${groupId}/recurring-expenses/${id}`);
    setBusyId(null);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }
    setError(null);
    setRows((current) => (current ?? []).filter((candidate) => candidate.id !== id));
  }

  // Yuklenirken HIC CIZILMIYOR: bos bir baslik, olmayan bir bolumu varmis
  // gibi gosterirdi ve bu ekran zaten bes ayri istek bekliyor.
  if (rows === null) return null;

  return (
    <View style={s.block}>
      <SectionRule label={t("ui.recurring")} />
      {rows.length === 0 ? (
        <Text style={s.empty}>{t("ui.no_recurring")}</Text>
      ) : (
        rows.map((row) => {
          const canManage = row.createdById === currentUserId;
          const paused = row.pausedAt !== null;
          return (
            <View key={row.id} style={s.row}>
              <View style={s.texts}>
                <Text style={s.name} numberOfLines={1}>
                  {row.description}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {[
                    t(row.interval === "WEEKLY" ? "ui.repeat_weekly" : "ui.repeat_monthly"),
                    paused
                      ? t("ui.repeat_paused")
                      : `${t("ui.repeat_next")}: ${formatDate(new Date(row.nextRunOn), locale)}`,
                  ].join(" · ")}
                </Text>
              </View>
              <Text style={s.amount}>{formatMoney(row.amount, currency, locale)}</Text>
              {canManage ? (
                <View style={s.actions}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => void togglePause(row)}
                    disabled={busyId !== null}
                  >
                    <Text style={s.action}>{paused ? t("ui.resume") : t("ui.pause")}</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => confirmDelete(row)}
                    disabled={busyId !== null}
                  >
                    <Text style={s.destructive}>{t("ui.delete")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
      {/* Hata, olayin OLDUGU yerin altinda - bu ekranin kurali. */}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    /**
     * YATAY DOLGU YOK - VE BU OLCULEREK DUZELTILDI.
     *
     * Ilk yazilisinda paddingHorizontal: 20 vardi. Gerekce dogruydu ama
     * YANLIS EKRANDAN tasinmisti: harcama detayi ve harcama ekleme
     * ekranlarinda ScrollView'da yatay dolgu YOK ve her blok kendi
     * dolgusunu tasiyor (yorum bolumunde tam bu unutulmustu). GRUP EKRANI
     * BOYLE DEGIL - onun ScrollView'unda zaten padding: 16 var.
     *
     * Sonucu simulatorde goruldu: "Tekrarlayan harcamalar" basligi, hemen
     * altindaki "Uyeler ve bakiyeler" basligindan 20 punto ICERIDE
     * duruyordu - ayni sayfada iki farkli sol kenar.
     *
     * marginTop: 24 membersBlock ile AYNI: iki bolum kardes.
     */
    block: { marginTop: 24 },
    empty: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.muted,
      paddingTop: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    texts: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontFamily: fonts.medium, fontSize: 14, color: theme.foreground },
    meta: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },
    amount: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: theme.foreground,
      fontVariant: ["tabular-nums"],
    },
    actions: { flexDirection: "row", gap: 12 },
    action: { fontFamily: fonts.body, fontSize: 12, color: theme.brand },
    /** Silme YIKICI: rengi bir DURUM tasiyor (ADR-021). */
    destructive: { fontFamily: fonts.body, fontSize: 12, color: theme.debt },
    error: { fontFamily: fonts.body, fontSize: 12, color: theme.debt, paddingTop: 10 },
  });
}
