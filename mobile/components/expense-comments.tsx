import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fonts } from "../lib/fonts";
import { useTranslate, useLocale } from "../lib/i18n";
import { useApiClient } from "../lib/use-api";
import { useTheme, type Theme } from "../lib/theme";
// Metin uretimi PAYLASILIYOR (saf, React'siz): iki istemci ayni cumleyi
// kuruyor. Bildirimler ekrani da ayni modulu cagiriyor.
import { formatRelativeTime } from "@/lib/notification-text";
import { MemberAvatar, SectionRule } from "./receipt";

/**
 * Harcamanin yorumlari (ADR-049).
 *
 * WEB'DE KARSILIGI BIR DIYALOG, burada bir BOLUM - ve fark tesadufi degil:
 * web'de harcamanin detay sayfasi yok, harcama bir liste satiri. Telefonda
 * zaten tam bir detay ekrani var ve yorum onun altina, fisin altina
 * dusuyor: once harcama, sonra kaniti, sonra hakkinda soylenenler.
 *
 * YORUM YAZMAK GRUBUN HER UYESINE ACIK - harcamayi degistirmek gibi yalnizca
 * girene degil. Silme yalnizca YAZANA ait.
 */

const MAX_COMMENT_LENGTH = 500;

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    hasImage: boolean;
  };
};

type State =
  | { kind: "loading" }
  | { kind: "error"; text: string }
  | { kind: "ready"; comments: Comment[]; truncated: boolean };

export function ExpenseComments({
  groupId,
  expenseId,
  currentUserId,
  /** Silinmis harcamanin yorumlari OKUNUR ama yenisi yazilamaz. */
  isDeleted,
}: {
  groupId: string;
  expenseId: string;
  /**
   * null olabiliyor: "ben kimim" sorgusu (/me) henuz donmemis olabilir.
   * Sonucu yalnizca "Sil" dugmesinin gorunurlugu - sunucu her halukarda
   * yazani kendisi dogruluyor.
   */
  currentUserId: string | null;
  isDeleted: boolean;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const theme = useTheme();
  const s = styles(theme);
  const { get, post, remove } = useApiClient();

  const [state, setState] = useState<State>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const base = `/api/v1/groups/${groupId}/expenses/${expenseId}/comments`;

  /**
   * CEVIRICI REF'TE, bagimlilik listesinde DEGIL - use-api.ts'in ogrettigi
   * dersin aynisi. t yalnizca dil degistiginde yenileniyor; bagimlilik
   * listesine konsaydi dil degisimi yorumlari yeniden CEKERDI. Burada
   * ceviri yalnizca hata dalinda kullaniliyor, yani cekmenin bir faydasi
   * da olmazdi.
   */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const load = useCallback(async () => {
    const result = await get<{ comments: Comment[]; truncated: boolean }>(base);
    if (result.ok) {
      setState({ kind: "ready", comments: result.data.comments, truncated: result.data.truncated });
    } else {
      setState({ kind: "error", text: tRef.current(result.code, result.params) });
    }
  }, [base, get]);

  /**
   * ILK CIZIMDE BIR KEZ. Bagimlilik listesine load'u koymak yeterli degil -
   * ref'li bir bayrak da var, cunku bu ekran duzenleme yaparken sik
   * yeniden ciziliyor ve her cizimde yeniden istek atmak istemiyoruz.
   * Ayni desen use-api.ts'te de var.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;

    setBusy(true);
    const result = await post<{ comment: Comment }>(base, { body });
    setBusy(false);

    if (!result.ok) {
      Alert.alert(t(result.code, result.params));
      return;
    }
    setDraft("");
    setState((current) =>
      current.kind === "ready"
        ? { ...current, comments: [...current.comments, result.data.comment] }
        : current,
    );
  }

  function confirmDelete(comment: Comment) {
    Alert.alert(t("ui.delete_comment_question"), comment.body, [
      { text: t("ui.cancel"), style: "cancel" },
      {
        text: t("ui.delete"),
        style: "destructive",
        onPress: () => void doDelete(comment.id),
      },
    ]);
  }

  async function doDelete(commentId: string) {
    const result = await remove(`${base}/${commentId}`);
    if (!result.ok) {
      Alert.alert(t(result.code, result.params));
      return;
    }
    setState((current) =>
      current.kind === "ready"
        ? { ...current, comments: current.comments.filter((c) => c.id !== commentId) }
        : current,
    );
  }

  const count = state.kind === "ready" ? state.comments.length : 0;

  return (
    <View style={s.block}>
      <SectionRule
        label={t("ui.comments")}
        value={count > 0 ? String(count) : undefined}
      />

      {state.kind === "loading" ? (
        <ActivityIndicator style={s.spinner} />
      ) : state.kind === "error" ? (
        <Text style={s.error}>{state.text}</Text>
      ) : (
        <>
          {state.truncated ? <Text style={s.note}>{t("ui.comments_truncated")}</Text> : null}

          {state.comments.length === 0 ? (
            <Text style={s.note}>{t("ui.no_comments")}</Text>
          ) : (
            state.comments.map((comment) => (
              <View key={comment.id} style={s.row}>
                <MemberAvatar
                  name={comment.author.displayName}
                  me={comment.author.userId === currentUserId}
                  size={28}
                  avatarUrl={comment.author.avatarUrl}
                  hasImage={comment.author.hasImage}
                />
                <View style={s.rowBody}>
                  <View style={s.rowHead}>
                    <Text style={s.author} numberOfLines={1}>
                      {comment.author.displayName}
                    </Text>
                    <Text style={s.when}>
                      {formatRelativeTime(new Date(comment.createdAt), new Date(), t, locale)}
                    </Text>
                    {comment.author.userId === currentUserId ? (
                      <Pressable
                        style={s.deleteHit}
                        onPress={() => confirmDelete(comment)}
                        hitSlop={8}
                      >
                        <Text style={s.delete}>{t("ui.delete_comment")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={s.body}>{comment.body}</Text>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {isDeleted ? (
        <Text style={s.note}>{t("ui.comments_closed_deleted")}</Text>
      ) : (
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("ui.comment_placeholder")}
            placeholderTextColor={theme.muted}
            multiline
            maxLength={MAX_COMMENT_LENGTH}
            editable={!busy}
          />
          <Pressable
            style={[s.send, (!draft.trim() || busy) && s.sendOff]}
            onPress={() => void send()}
            disabled={!draft.trim() || busy}
          >
            <Text style={s.sendText}>
              {busy ? t("ui.sending_comment") : t("ui.send_comment")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function styles(theme: Theme) {
  return StyleSheet.create({
    /**
     * YATAY DOLGU YOK VE OLMAYACAK. Bu ekranda her blok kendi
     * paddingHorizontal'ini tasiyor (factsBlock, receiptBlock,
     * conflictBlock...) ve ScrollView'da yatay dolgu YOK. Sarmalayici
     * ekranda: ReceiptPhoto da tam olarak boyle davraniyor.
     *
     * ILK HALINDE BURAYA KONMAMISTI ve bolum ekranin soluna YAPISTI -
     * yazma alani ve "Gonder" dugmesi kenardan tasti. Testler gormedi,
     * simulator gosterdi.
     */
    block: {},
    spinner: { paddingTop: 16 },
    note: { paddingTop: 12, fontFamily: fonts.body, fontSize: 13, color: theme.muted },
    error: { paddingTop: 12, fontFamily: fonts.body, fontSize: 13, color: theme.debt },
    row: { flexDirection: "row", gap: 10, paddingTop: 16 },
    rowBody: { flex: 1 },
    rowHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    author: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: theme.foreground },
    when: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },
    /**
     * SAGA YASLAYAN sey PRESSABLE, icindeki Text degil. Ilk halinde
     * marginLeft:"auto" Text'teydi ve hicbir sey yapmiyordu - Text zaten
     * Pressable'i dolduruyor, hizalanacak kardesi yok. Silme, zaman
     * damgasinin yanina yapisip kazara dokunulacak bir yerde duruyordu.
     * Simulator gosterdi; testler gormezdi.
     */
    deleteHit: { marginLeft: "auto" },
    delete: { fontFamily: fonts.body, fontSize: 11, color: theme.muted },
    body: {
      paddingTop: 2,
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: theme.foreground,
    },
    composer: { paddingTop: 18, gap: 12 },
    // Kutu degil ALT CIZGI - web'deki alanlarla ayni dil (ADR-048).
    input: {
      minHeight: 40,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.inputLine,
      fontFamily: fonts.body,
      fontSize: 15,
      color: theme.foreground,
    },
    send: {
      alignSelf: "flex-end",
      paddingVertical: 10,
      paddingHorizontal: 18,
      backgroundColor: theme.brand,
      borderRadius: 3,
    },
    sendOff: { opacity: 0.5 },
    sendText: { fontFamily: fonts.body, fontSize: 14, color: theme.onBrand },
  });
}
