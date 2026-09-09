import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "@/lib/dates";
import { useLocale, useTranslate } from "../../../lib/i18n";
import { apiBaseUrl } from "../../../lib/api";
import { useApiClient, useApiGet } from "../../../lib/use-api";
import { useTheme, type Theme } from "../../../lib/theme";
import { Cap } from "../../../components/receipt";

/**
 * Uyeler ve davet.
 *
 * DAVETI KABUL ETMEK ARTIK MOBILDE VAR - gruplar ekraninda, baglantiyi
 * yapistirarak (components/invite-joiner.tsx). Buradaki eski gerekce
 * "onaylanmis Apple hesabi bekleniyor" diyordu; hesap onaylandi ama
 * universal link'in kendisi hala uc sey birden istiyor ve biri Expo Go'da
 * denenemiyor - ayrintisi lib/invite-link.ts'de. Baglanti uygulamada
 * ACILMIYOR, ama gonderilen kisi onu uygulamaya YAPISTIRABILIYOR.
 *
 * KAPSAM DISI (bilincli): SAHIPLIK DEVRI ayri bir islem olarak. Web'de de
 * yok ve bir ucu da yok - devir yalnizca AYRILIRKEN yapiliyor (asagida) ve o
 * kadari mobilde zaten var. Ayri bir "devret" eklemek uc + web + mobil
 * demekti, yani gorev verilmeden yapilmayacak bir sey.
 *
 * UYE CIKARMA VE DAVET IPTALI ARTIK BURADA. Ikisinin de ucu bastan beri
 * vardi ve yalnizca web kullaniyordu.
 */
type MembersResponse = {
  members: { userId: string; displayName: string; role: "OWNER" | "MEMBER" }[];
};
type InviteResponse = { invite: { token: string } };
/**
 * Listede TOKEN YOK ve olamaz: sunucu davetin sirrini hicbir cevapta
 * dondurmuyor (groups.ts, "tokenHash BILEREK select edilmiyor"), yalnizca
 * sifrelenmis ozetini sakliyor. Yani bu liste "baglantiyi tekrar al" degil,
 * "iptal et" listesi - ekrandaki "bir kez gosterilir" uyarisi bunu zaten
 * soyluyor.
 */
type InvitesResponse = {
  invites: {
    id: string;
    invitedById: string;
    expiresAt: string;
    maxUses: number;
    useCount: number;
  }[];
};

export default function MembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const t = useTranslate();
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { post, remove } = useApiClient();
  const locale = useLocale();
  const router = useRouter();
  // Kim oldugumuzu bilmeden "ayril" gosterilemez: sahip miyiz, arkamizda uye
  // var mi sorulari buna bagli.
  const me_ = useApiGet<{ user: { id: string } }>("/api/v1/me");
  const currentUserId = me_.state.kind === "ok" ? me_.state.data.user.id : null;

  const members = useApiGet<MembersResponse>(
    groupId ? `/api/v1/groups/${groupId}/members` : null,
  );
  const invites = useApiGet<InvitesResponse>(
    groupId ? `/api/v1/groups/${groupId}/invites` : null,
  );

  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post<InviteResponse>(`/api/v1/groups/${groupId}/invites`, {});
      if (!result.ok) {
        setError(t(result.code, result.params));
        return;
      }

      // Ham kod sunucudan YALNIZCA BIR KEZ donuyor; veritabaninda yalnizca
      // sifrelenmis ozeti duruyor. Ekranda tutup paylasima veriyoruz.
      const url = `${apiBaseUrl()}/join/${result.data.invite.token}`;
      setLink(url);
      // Yeni davet asagidaki listede de gorunmeli; yoksa kullanici az once
      // urettigi seyi iptal edemezdi.
      invites.reload();
      await Share.share({ message: url });
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  /**
   * GRUPTAN AYRILMA. MOBILDE YOKTU - uc (POST .../leave) ve web arayuzu
   * (member-actions.tsx) bastan beri vardi. Kullanici bildirdi: telefonda
   * gruba KATILMAK kolay (davet baglantisini yapistir) ama CIKMAK imkansizdi.
   *
   * SAHIP ARKASINDA UYE BIRAKIYORSA DEVRETMEK ZORUNDA - kural sunucuda
   * (groups.ts: owner_must_transfer) ve her grubun her zaman bir sahibi
   * olmali. O durumda once devralacak kisi seciliyor.
   */
  const [leaving, setLeaving] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);

  const loaded = members.state.kind === "ok" ? members.state.data.members : [];
  const me = loaded.find((member) => member.userId === currentUserId);
  const others = loaded.filter((member) => member.userId !== currentUserId);
  const mustTransfer = me?.role === "OWNER" && others.length > 0;

  async function leave() {
    if (leaving) return;
    if (mustTransfer && !successorId) {
      setError(t("group.owner_must_transfer"));
      return;
    }
    setLeaving(true);
    setError(null);
    const result = await post(`/api/v1/groups/${groupId}/leave`,
      mustTransfer ? { newOwnerId: successorId } : {});
    setLeaving(false);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }
    // Gruplar listesine DONULMUYOR, DEGISTIRILIYOR: artik uyesi olmadigimiz
    // bir grubun ekranina geri dugmesiyle donmek 403 verirdi.
    router.replace("/groups");
  }

  function confirmLeave() {
    Alert.alert(t("ui.leave_group_question"), t("ui.leave_group_hint"), [
      { text: t("ui.cancel"), style: "cancel" },
      { text: t("ui.leave_group"), style: "destructive", onPress: () => void leave() },
    ]);
  }

  /**
   * UYE CIKARMA. Uc bastan beri vardi (DELETE .../members/:userId) ve
   * yalnizca web kullaniyordu.
   *
   * DUGME YALNIZCA SAHIBE VE YALNIZCA BASKASININ SATIRINDA ciziliyor.
   * Sunucu ikisini de reddediyor (member.remove_owner_only,
   * member.owner_cannot_remove_self); burada da sormamak, olmayacak bir seyi
   * sunup ardindan hata gostermemek icin. Sahip kendi cikisini "Gruptan
   * ayril" ile yapiyor - orada sahiplik devri de var.
   *
   * BAKIYE ENGELINI SUNUCU KOYUYOR (assertBalanceIsSettled): acik bakiyesi
   * olan bir uye cikarilamiyor, cunku cikinca borcu kimin olacagi belirsiz
   * kalirdi. Cevap kodla birlikte TUTARI da tasiyor ve artik ekranda tutar
   * GORUNUYOR - o parametrelerin dusmesi 1.0.2'de bir kusurdu.
   */
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function removeMember(userId: string) {
    if (removingId) return;
    setRemovingId(userId);
    setError(null);
    const result = await remove(`/api/v1/groups/${groupId}/members/${userId}`);
    setRemovingId(null);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }
    members.reload();
  }

  function confirmRemove(userId: string, displayName: string) {
    Alert.alert(
      t("ui.remove_member_question", { name: displayName }),
      t("ui.remove_member_hint"),
      [
        { text: t("ui.cancel"), style: "cancel" },
        {
          text: t("ui.remove_member"),
          style: "destructive",
          onPress: () => void removeMember(userId),
        },
      ],
    );
  }

  /**
   * DAVET IPTALI. Sunucu kurali: daveti OLUSTURAN kisi ya da GRUP SAHIBI
   * (groups.ts, "sizan bir linkten herkes etkilenir"). Ayni kural burada da
   * aynalaniyor - listeyi her uye goruyor ama iptal dugmesi yalnizca
   * iptal edebilecek kiside ciziliyor.
   */
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const activeInvites = invites.state.kind === "ok" ? invites.state.data.invites : [];

  async function revokeInvite(inviteId: string) {
    if (revokingId) return;
    setRevokingId(inviteId);
    setError(null);
    const result = await post(
      `/api/v1/groups/${groupId}/invites/${inviteId}/revoke`,
      {},
    );
    setRevokingId(null);

    if (!result.ok) {
      setError(t(result.code, result.params));
      return;
    }
    invites.reload();
  }

  function confirmRevoke(inviteId: string) {
    Alert.alert(t("ui.invite_revoke"), t("ui.invite_revoke_hint"), [
      { text: t("ui.cancel"), style: "cancel" },
      {
        text: t("ui.invite_revoke"),
        style: "destructive",
        onPress: () => void revokeInvite(inviteId),
      },
    ]);
  }

  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.paper}>
          {members.state.kind === "loading" ? (
            <ActivityIndicator style={s.loading} />
          ) : members.state.kind === "error" ? (
            <Text style={s.error}>{members.state.text}</Text>
          ) : (
            <View style={s.list}>
              {members.state.data.members.map((member) => (
                <View key={member.userId} style={s.row}>
                  <Text style={s.name}>{member.displayName}</Text>
                  <View style={s.rowActions}>
                    <Text style={s.role}>
                      {member.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
                    </Text>
                    {me?.role === "OWNER" && member.userId !== currentUserId ? (
                      removingId === member.userId ? (
                        <ActivityIndicator size="small" color={theme.debt} />
                      ) : (
                        /* hitSlop GENIS: bu projede kucuk metin hedefleri
                           dokunma almiyor (simulatorde defalarca goruldu) ve
                           yikici bir eylemin yanlislikla degil, GUCLUKLE
                           tetiklenmesi zaten dogru olan. */
                        <Pressable
                          hitSlop={12}
                          onPress={() => confirmRemove(member.userId, member.displayName)}
                        >
                          <Text style={s.remove}>{t("ui.remove_member")}</Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable style={s.invite} onPress={() => void createInvite()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Cap tone="onBrand">{t("ui.create_invite")}</Cap>
            )}
          </Pressable>

          {link ? (
            <View style={s.linkBlock}>
              <Cap>{t("ui.invite_ready")}</Cap>
              {/* Link EKRANDA da duruyor: paylasim sayfasi kapatilirsa kod
                  kaybolmasin. Bir daha uretilemez. */}
              <Text selectable style={s.link}>
                {link}
              </Text>
              <Text style={s.warning}>{t("ui.invite_once_warning")}</Text>
              {/* Ayri bir anahtar: bu dugme YENI davet uretmiyor, mevcut
                  baglantiyi tekrar paylasiyor. Ustteki dugmeyle ayni adi
                  tasimasi iki farkli isi ayni isimle cagirmak olurdu. */}
              <Pressable onPress={() => void Share.share({ message: link })}>
                <Text style={s.shareAgain}>{t("ui.share_link")}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* AKTIF DAVETLER. Liste bossa bolum HIC cizilmiyor - bos bir
              baslik, olmayan bir sey icin yer kaplamak olurdu.
              Baglantinin kendisi burada YOK ve olamaz (bkz. InvitesResponse). */}
          {activeInvites.length > 0 ? (
            <View style={s.inviteList}>
              <Cap>{t("ui.active_invites")}</Cap>
              {activeInvites.map((invite) => (
                <View key={invite.id} style={s.inviteRow}>
                  <View style={s.inviteFacts}>
                    <Text style={s.inviteUses}>
                      {t("ui.invite_uses_count", {
                        used: invite.useCount,
                        max: invite.maxUses,
                      })}
                    </Text>
                    <Text style={s.inviteDate}>
                      {t("ui.invite_valid_until", {
                        date: formatDate(new Date(invite.expiresAt), locale),
                      })}
                    </Text>
                  </View>
                  {invite.invitedById === currentUserId || me?.role === "OWNER" ? (
                    revokingId === invite.id ? (
                      <ActivityIndicator size="small" color={theme.debt} />
                    ) : (
                      <Pressable hitSlop={12} onPress={() => confirmRevoke(invite.id)}>
                        <Text style={s.remove}>{t("ui.invite_revoke")}</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        {/* AYRILMA FISIN DISINDA. Web'de de eylemler kagidin uzerinde
            durmuyor: basili bir belgeye tiklanabilir bir sey eklemek gibi
            olurdu. Kirmizi cunku GERI ALINAMAZ - tekrar girmek icin yeni bir
            davet gerekiyor. (ADR-015'in "renk yalnizca bakiye" kurali
            bakiye SAYILARI icin; yikici eylem uyarisi ayri bir dil ve
            harcama silme dugmesi de ayni kirmizi.) */}
        {me ? (
          <View style={s.leaveBlock}>
            {mustTransfer ? (
              <View style={s.transferBlock}>
                {/* SAHIP CIKARKEN GRUBU SAHIPSIZ BIRAKAMAZ. Kural sunucuda;
                    burada sorulmasi, kullaniciyi reddedilecek bir istekle
                    karsilastirmamak icin. */}
                <Cap>{t("ui.transfer_to_whom")}</Cap>
                <View style={s.chips}>
                  {others.map((member) => (
                    <Pressable
                      key={member.userId}
                      style={[s.chip, successorId === member.userId && s.chipActive]}
                      onPress={() => setSuccessorId(member.userId)}
                    >
                      <Text
                        style={[
                          s.chipText,
                          successorId === member.userId && s.chipTextActive,
                        ]}
                      >
                        {member.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable onPress={confirmLeave} disabled={leaving} hitSlop={8}>
              {leaving ? (
                <ActivityIndicator color={theme.debt} size="small" />
              ) : (
                <Text style={s.leave}>{t("ui.leave_group")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    scroll: { padding: 16, paddingBottom: 32 },
    paper: {
      backgroundColor: theme.paper,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 14,
    },
    loading: { paddingVertical: 16 },
    list: { gap: 2 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.lineSoft,
    },
    name: { fontSize: 15, color: theme.foreground },
    role: { fontSize: 12, color: theme.muted },
    rowActions: { flexDirection: "row", alignItems: "center", gap: 14 },
    // Yikici eylemlerin rengi. ADR-015'in "renk yalnizca bakiye tasir"
    // kurali bakiye SAYILARI icin; uyari ayri bir dil ve harcama silme de
    // ayni kirmiziyi kullaniyor.
    remove: { fontSize: 12, color: theme.debt },
    inviteList: {
      gap: 10,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 14,
    },
    inviteRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    inviteFacts: { gap: 2, flexShrink: 1 },
    inviteUses: { fontSize: 13, color: theme.foreground },
    inviteDate: { fontSize: 11, color: theme.muted },
    leaveBlock: { marginTop: 20, gap: 12, alignItems: "center" },
    transferBlock: { gap: 8, alignItems: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
    chip: {
      borderWidth: 1,
      borderColor: theme.lineSoft,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { fontSize: 13, color: theme.foreground },
    chipTextActive: { color: "#fff" },
    leave: { color: theme.debt, fontSize: 15 },
    invite: {
      backgroundColor: theme.brand,
      borderRadius: 4,
      paddingVertical: 11,
      alignItems: "center",
    },
    linkBlock: {
      gap: 8,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      paddingTop: 14,
    },
    link: { fontSize: 12, color: theme.foreground, fontFamily: "Menlo" },
    warning: { fontSize: 11, color: theme.muted, lineHeight: 16 },
    shareAgain: { fontSize: 13, color: theme.brand, paddingTop: 4 },
    error: { fontSize: 13, color: theme.debt },
    back: { color: theme.muted, fontSize: 14 },
  });
}
