// Kullaniciya gorunen metinlerin sozlugu.
//
// NEDEN VAR: API artik hata METNI degil hata KODU donduruyor
// ({ ok: false, code: "group.not_found" }). Metni okuyan taraf uretiyor.
// Sebebi ADR-017: mobil istemci de ayni uclari cagiracak, ve sunucu istegin
// hangi dilde cevaplanacagini bilemez. Metin donduren bir API, ceviri
// sozlugunu sunucuya hapsederdi.
//
// TIP GUVENLIGI: MessageCode bu sozlukten TURETILIYOR. Yani sozlukte olmayan
// bir kodu firlatmak derleme hatasi - "cevirisi unutulmus kod" diye bir sey
// olamiyor. Yeni bir hata eklerken once buraya yazmak zorundasin.
//
// PARAMETRE: bazi mesajlar calisma zamani degeri tasiyor ("paylarin toplami
// (12000) ..."). Sablonda {ad} yaziyoruz, translate() yerine koyuyor. Kodun
// tek basina yeterli olmadigi yer burasi - ADR-017 bunu ongormemisti.

import type { Locale } from "@/lib/money";

export const MESSAGES_TR = {
  // --- Grup ---
  "group.not_found": "Grup bulunamadı",
  "group.not_member": "Bu grubun üyesi değilsiniz",
  "group.owner_only": "Grup bilgilerini yalnızca grup sahibi değiştirebilir",
  "group.already_member": "Zaten bu grubun üyesisiniz",
  "group.owner_must_transfer":
    "Grup sahibi ayrılmadan önce sahipliği başka bir üyeye devretmelidir",

  // --- Uyelik ---
  "member.not_found": "Üye bulunamadı",
  "member.remove_owner_only": "Üye çıkarma yetkisi yalnızca grup sahibindedir",
  "member.transfer_target_not_active":
    "Sahipliğin devredileceği kişi grubun aktif üyesi değil",
  "member.owner_cannot_remove_self":
    "Grup sahibi kendini çıkaramaz; ayrılmak için gruptan ayrılma işlemini kullanın",
  "member.has_credit": "Bu üyenin {amount} kuruşluk alacağı var; önce ödeşilmelidir",
  "member.has_debt": "Bu üyenin {amount} kuruşluk borcu var; önce ödeşilmelidir",

  // --- Davet ---
  "invite.not_found": "Davet bulunamadı",
  "invite.invalid": "Davet linki geçersiz",
  "invite.expired": "Davet linkinin süresi dolmuş",
  "invite.exhausted": "Davet linki kullanım limitine ulaşmış",
  "invite.already_revoked": "Bu davet zaten iptal edilmiş",
  "invite.revoke_forbidden":
    "Bu daveti yalnızca oluşturan kişi veya grup sahibi iptal edebilir",

  // --- Harcama ---
  "expense.not_found": "Harcama bulunamadı",
  "expense.not_deleted": "Harcama zaten silinmemiş",
  "expense.participants_not_active": "Şu kullanıcılar grubun aktif üyesi değil: {userIds}",

  // --- Odeme kaydi ---
  "settlement.not_found": "Ödeme kaydı bulunamadı",
  "settlement.already_cancelled": "Bu ödeme kaydı zaten iptal edilmiş",
  "settlement.self_transfer": "Bir kullanıcı kendine ödeme kaydı giremez",
  "settlement.party_only":
    "Yalnızca kendi yaptığınız veya size yapılan ödemeleri kaydedebilirsiniz",
  "settlement.users_not_member": "Şu kullanıcılar grubun üyesi değil: {userIds}",

  // --- Kayit uzerinde islem yetkisi ---
  // recordLabel eskiden Turkce metin olarak parametre geciyordu ("harcama").
  // Metin parametresi cevrilemez, o yuzden kayit turu basina ayri kod var.
  "access.expense_creator_only":
    "Bu harcama üzerinde yalnızca onu oluşturan kişi işlem yapabilir",
  "access.settlement_creator_only":
    "Bu ödeme kaydı üzerinde yalnızca onu oluşturan kişi işlem yapabilir",
  "access.creator_left_owner_only":
    "Kaydı oluşturan kişi gruptan ayrıldı; bu kayıt üzerinde yalnızca grup sahibi işlem yapabilir",

  // --- Bolusum (split.ts) ---
  "split.amount_invalid": "amount pozitif bir tam sayı olmalıdır",
  "split.amount_too_large": "amount {max} değerini aşamaz",
  "split.duplicate_participant": "aynı katılımcı birden fazla kez belirtilemez: {userId}",
  "split.no_participants": "en az bir katılımcı gerekli",
  "split.share_invalid": "{userId} için pay negatif olamaz ve tam sayı olmalıdır",
  "split.sum_mismatch": "payların toplamı ({total}) amount'a ({amount}) eşit değil",
  "split.percentage_invalid":
    "{userId} için yüzde negatif olamaz ve tam sayı (basis point) olmalıdır",
  "split.percentage_too_large": "{userId} için yüzde %100'ü aşamaz",
  "split.percentage_sum_mismatch": "yüzdelerin toplamı ({total}) tam olarak %100 olmalıdır",
  "split.failed": "Bölüşüm hesaplanamadı",

  // --- Dogrulama (Zod semalari bu kodlari mesaj olarak tasiyor) ---
  "validation.invalid": "Geçersiz istek",
  "validation.group_name_required": "Grup adı boş olamaz",
  "validation.group_name_too_long": "Grup adı en fazla 100 karakter olabilir",
  "validation.description_too_long": "Açıklama en fazla 500 karakter olabilir",
  "validation.currency_length": "Para birimi 3 harfli olmalıdır",

  // --- Genel ---
  // Bu normalde kullaniciya gorunmez: korumali sayfalar zaten giris ekranina
  // yonlendiriyor. Yine de bir yerde gorunurse anlamli bir cumle olsun.
  "auth.not_signed_in": "Bu işlem için giriş yapman gerekiyor",
  "server.unexpected": "Beklenmeyen bir hata oluştu",
  "server.bad_response": "Sunucudan beklenmeyen bir cevap alındı",

  // ==========================================================
  // ARAYUZ METINLERI
  // ==========================================================
  // Yukarisi HATA kodlari (sunucudan gelir), burasi EKRAN metni.
  // Ikisi ayni sozlukte ama ayri isim alaninda: "ui." onekiyle.
  //
  // Buradaki metinler koddan BIREBIR cikarildi, elle yazilmadi. Ilk denemede
  // tahminle yazilanlarin bir kismi gercekle tutmuyordu ("Daha fazla goster"
  // yerine "Daha fazla yukle", uc nokta karakteri yerine uc ayri nokta) ve
  // arayuzu sessizce degistirecekti.

  // --- Ortak eylemler ---
  "ui.cancel": "Vazgeç",
  "ui.save": "Kaydet",
  "ui.saving": "Kaydediliyor...",
  "ui.delete": "Sil",
  "ui.edit": "Düzenle",
  "ui.create": "Oluştur",
  "ui.creating": "Oluşturuluyor...",
  "ui.loading": "Yükleniyor...",
  "ui.copy": "Kopyala",

  // --- Karsilama / kimlik ---
  "ui.app_name": "SplitApp",
  "ui.tagline":
    "Grup harcamalarını kaydet, kimin kime ne kadar borçlu olduğunu tek bakışta gör.",
  "ui.meta_description":
    "Grup harcamalarını paylaş, kimin kime ne kadar borçlu olduğunu gör.",
  "ui.sign_in": "Giriş yap",
  "ui.sign_up": "Kayıt ol",
  "ui.sample_note": "Örnek — gerçek bir gruba ait değil",
  "ui.sample_title": "Kahvaltı",
  "ui.theme_toggle": "Temayı değiştir",

  // --- Gruplar ---
  "ui.my_groups": "Gruplarım",
  "ui.back_to_groups": "← Gruplarım",
  "ui.new_group": "Yeni grup",
  "ui.new_group_title": "Yeni grup oluştur",
  "ui.new_group_hint": "Ortak harcamaları takip edeceğin bir grup oluştur.",
  "ui.group_name": "Grup adı",
  "ui.group_name_placeholder": "Ev Arkadaşları",
  "ui.group_description": "Açıklama (isteğe bağlı)",
  "ui.group_description_placeholder": "Kira, faturalar, market",
  "ui.no_groups": "Henüz bir grubun yok. Yeni bir grup oluşturarak başlayabilirsin.",
  "ui.group_created": "Grup oluşturuldu",
  "ui.edit_group": "Grubu düzenle",
  "ui.edit_group_hint":
    "Grup adını ve açıklamasını değiştirebilirsin. Para birimi, mevcut kayıtlarla tutarlılık için değiştirilemez.",
  "ui.group_updated": "Grup güncellendi",
  "ui.role_owner": "Sahip",
  "ui.role_member": "Üye",
  "ui.you": "Sen",
  "ui.member_left": "Ayrıldı",

  // --- Bakiye ---
  "ui.your_status": "Senin durumun",
  "ui.settled_up": "Ödeştin",
  "ui.owed_to_you": "Bu tutar sana borçlu",
  "ui.you_owe": "Bu tutarı borçlusun",
  "ui.no_open_balance": "Bu grupta açık hesabın yok",
  "ui.suggested_payments": "Önerilen ödemeler",
  "ui.everyone_settled": "Herkes ödeşmiş durumda, yapılacak bir ödeme yok.",
  "ui.members_and_balances": "Üyeler ve bakiyeler",
  "ui.manage_members": "Üyeleri yönet",

  // --- Harcama ---
  "ui.expenses": "Harcamalar",
  "ui.add_expense": "Harcama ekle",
  "ui.edit_expense": "Harcamayı düzenle",
  "ui.save_expense": "Harcamayı kaydet",
  "ui.save_changes": "Değişiklikleri kaydet",
  "ui.expense_added": "Harcama eklendi",
  "ui.expense_updated": "Harcama güncellendi",
  "ui.expense_deleted": "Harcama silindi",
  "ui.expense_delete_failed": "Harcama silinemedi",
  "ui.expenses_load_failed": "Harcamalar yüklenemedi",
  "ui.delete_expense_question": "Harcama silinsin mi?",
  "ui.no_expenses": "Bu grupta henüz harcama yok. İlk harcamanı ekleyerek başlayabilirsin.",
  "ui.load_more": "Daha fazla yükle",
  "ui.description": "Açıklama",
  "ui.description_placeholder": "Market alışverişi",
  "ui.description_required": "Açıklama boş olamaz",
  "ui.amount": "Tutar",
  "ui.amount_placeholder": "120,50",
  "ui.amount_example": "Örnek: 120,50",
  "ui.amount_unreadable": "Tutarı anlayamadım",
  "ui.amount_required": "Geçerli ve sıfırdan büyük bir tutar gir. Örnek: 120,50",
  "ui.who_paid": "Kim ödedi?",
  "ui.category": "Kategori",
  "ui.date": "Tarih",
  "ui.how_to_split": "Nasıl bölünecek?",
  "ui.split_equal": "Eşit böl",
  "ui.split_exact": "Tutar gir",
  "ui.split_percentage": "Yüzde gir",
  "ui.split_preview": "Bölüşüm önizlemesi",
  "ui.participants": "Katılımcılar",
  "ui.participant_required": "En az bir katılımcı seçmelisin",
  "ui.each_amount_required": "Her katılımcı için geçerli bir tutar gir",
  "ui.each_percentage_required": "Her katılımcı için geçerli bir yüzde gir",
  "ui.deleting": "Siliniyor...",
  "ui.unknown_user": "Bilinmeyen",

  // Bu ikisi JSX icinde parca parca kuruluyordu ({isim} + " odedi"). Ingilizcede
  // kelime sirasi ters ("paid by X"), yani parca birlestirmek ceviriyi bozar.
  // Butun cumle olarak duruyorlar.
  "ui.paid_by": "{name} ödedi",
  "ui.your_share_amount": "senin payın {amount}",
  // E2E bu etiketleri secici olarak kullaniyor: input[aria-label$="tutarı"].
  "ui.participant_amount_label": "{name} tutarı",
  "ui.participant_percentage_label": "{name} yüzdesi",
  "ui.delete_expense_hint":
    "“{description}” kaydı silinecek ve bakiyelerden düşülecek. Kayıt tamamen yok olmaz; gerekirse geri yüklenebilir.",

  // --- Odeme kaydi ---
  "ui.settlements": "Kaydedilen ödemeler",
  "ui.record_settlement": "Ödeme kaydet",
  "ui.settlement_hint":
    "Gerçekleşen bir ödemeyi kaydeder. Uygulama para transferi yapmaz, yalnızca bakiyeleri günceller.",
  "ui.settlement_direction": "İşlem yönü",
  "ui.i_paid": "Ben ödedim",
  "ui.paid_to_me": "Bana ödendi",
  "ui.settlement_counterparty": "Kime ödedin?",
  "ui.settlement_counterparty_required": "Karşı tarafı seç",
  "ui.settlement_note": "Not (isteğe bağlı)",
  "ui.settlement_note_placeholder": "Havale ile ödendi",
  "ui.settlement_saved": "Ödeme kaydedildi",
  "ui.use_suggested_amount": "Önerilen tutarı kullan: {amount}",
  "ui.no_settlements":
    "Henüz kaydedilmiş bir ödeme yok. Borç kapatınca buraya ekleyebilirsin.",
  "ui.cancel_settlement": "İptal et",
  "ui.cancelling": "İptal ediliyor...",
  "ui.cancel_settlement_question": "Ödeme kaydı iptal edilsin mi?",
  "ui.cancel_settlement_hint":
    "Kayıt iptal edilirse bu ödeme bakiyelerden düşülmez ve borç geri döner.",
  "ui.settlement_cancelled": "Ödeme kaydı iptal edildi",
  "ui.settlement_cancel_failed": "Ödeme kaydı iptal edilemedi",

  // --- Davet ---
  "ui.invites": "Davet linkleri",
  "ui.active_invites": "Aktif davetler",
  "ui.create_invite": "Davet linki oluştur",
  "ui.invite_uses": "Kaç kişi kullanabilsin?",
  "ui.invite_validity": "Ne kadar geçerli olsun?",
  "ui.no_active_invite": "Aktif bir davet linki yok.",
  "ui.invite_ready": "Davet linkin hazır",
  "ui.invite_once_warning":
    "Bu link yalnızca şimdi gösteriliyor. Sayfayı yenilersen bir daha göremezsin, çünkü sunucuda linkin kendisi değil yalnızca şifrelenmiş bir özeti saklanıyor.",
  "ui.invite_created": "Davet linki oluşturuldu",
  "ui.invite_create_failed": "Davet linki oluşturulamadı",
  "ui.invite_revoke": "İptal et",
  "ui.invite_revoked": "Davet iptal edildi",
  "ui.invite_revoke_failed": "Davet iptal edilemedi",
  "ui.invite_exhausted": "Tükendi",
  // DIKKAT: "kullanildi" yazim hatasi BILEREK korundu ("kullanildi" ->
  // "kullanildi" olmali). Faz 11.4b ciktiyi degistirmiyor.
  "ui.invite_uses_count": "{used}/{max} kullanildi",
  "ui.invite_valid_until": "{date} tarihine kadar",
  "ui.invite_created_by": "{name} oluşturdu",
  "ui.link_copied": "Link kopyalandı",
  "ui.link_copy_failed": "Link kopyalanamadı, elle seçip kopyalayabilirsin",
  "ui.uses_1": "1 kişi",
  "ui.uses_5": "5 kişi",
  "ui.uses_25": "25 kişi",
  "ui.days_1": "1 gün",
  "ui.days_7": "7 gün",
  "ui.days_30": "30 gün",

  // --- Davete katilma sayfasi ---
  "ui.join_group": "Gruba katıl",
  "ui.joining": "Katılınıyor...",
  "ui.joined_group": "Gruba katıldın",
  "ui.join_failed": "Gruba katılınamadı",
  "ui.join_press_button": "Katılmak için aşağıdaki butona bas.",
  "ui.join_sign_in_first": "Davete katılmak için önce giriş yapmalısın.",
  "ui.invite_unusable": "Davet kullanılamıyor",
  "ui.invited_to_group": "“{groupName}” grubuna davet edildin",
  // DIKKAT: "kisiden" yazim hatasi BILEREK korundu. Faz 11.4b'nin kurali
  // ciktiyi bit bit ayni tutmakti; duzeltmek ayri bir is.
  "ui.invite_ask_new_link": "Seni davet eden kisiden yeni bir link isteyebilirsin.",
  "ui.invite_notice_revoked": "Bu davet iptal edilmiş.",
  "ui.invite_notice_invalid": "Bu davet linki geçerli değil.",
  "ui.invite_notice_exhausted": "Bu davet linki kullanım limitine ulaşmış.",
  "ui.invite_notice_expired": "Bu davetin süresi dolmuş.",
  "ui.back_home": "Ana sayfaya dön",

  // --- Uyelik ---
  "ui.members": "Üyeler",
  "ui.members_and_invites": "Üyeler ve davetler",
  "ui.remove_member": "Çıkar",
  "ui.removing": "Çıkarılıyor...",
  "ui.member_removed": "Üye çıkarıldı",
  "ui.member_removed_named": "{name} gruptan çıkarıldı",
  // DIKKAT: "cikarilsin" yazim hatasi BILEREK korundu - "cikarilsin mi" degil
  // "cikarilsin mi" olmali. Faz 11.4b ciktiyi degistirmiyor; ayri is.
  "ui.remove_member_question": "{name} gruptan cikarilsin mi?",
  "ui.member_remove_failed": "Üye çıkarılamadı",
  "ui.remove_member_hint":
    "Geçmiş harcamaları grupta kalır. Açık bir bakiyesi varsa önce ödeşilmesi gerekir.",
  "ui.leave_group": "Gruptan ayrıl",
  "ui.leave": "Ayrıl",
  "ui.leaving": "Ayrılınıyor...",
  "ui.leave_group_question": "Gruptan ayrılmak istiyor musun?",
  "ui.leave_group_hint":
    "Geçmiş harcamaların grupta kalır. Açık bir bakiyen varsa önce ödeşmen gerekir.",
  "ui.left_group": "Gruptan ayrıldın",
  "ui.leave_failed": "Gruptan ayrılınamadı",
  "ui.transfer_to_whom": "Sahipliği kime devrediyorsun?",

  // --- Bildirim ---
  "ui.notifications": "Bildirimler",
  "ui.notifications_with_unread": "Bildirimler ({count} okunmamış)",
  "ui.unread": "Okunmamış",
  "ui.no_notifications": "Henüz bildirimin yok.",
  "ui.mark_all_read": "Tümünü okundu işaretle",
  "ui.notifications_load_failed": "Bildirimler yüklenemedi",
  "ui.notifications_mark_failed": "Bildirimler işaretlenemedi",
  "ui.just_now": "az önce",
  "ui.minutes_ago": "{count} dakika önce",
  "ui.hours_ago": "{count} saat önce",
  "ui.days_ago": "{count} gün önce",
  "ui.someone": "Birisi",
  "ui.notif_expense_added": "{actor} yeni bir harcama ekledi",
  "ui.notif_expense_updated": "{actor} bir harcamayı güncelledi",
  "ui.notif_expense_deleted": "{actor} bir harcamayı sildi",
  "ui.notif_settlement_recorded": "{actor} bir ödeme kaydetti",
  "ui.notif_settlement_cancelled": "{actor} bir ödeme kaydını iptal etti",
  "ui.notif_member_joined": "{actor} gruba katıldı",

  // --- Harcama kategorileri ---
  "ui.category_food": "Yemek",
  "ui.category_transport": "Ulaşım",
  "ui.category_accommodation": "Konaklama",
  "ui.category_entertainment": "Eğlence",
  "ui.category_shopping": "Alışveriş",
  "ui.category_bills": "Faturalar",
  "ui.category_other": "Diğer",
} as const;


export type MessageCode = keyof typeof MESSAGES_TR;
export type MessageParams = Record<string, string | number>;

// Faz 11.4d'de "en" sozlugu buraya eklenecek. Su an tek dil var; yapinin
// dilden dile gecise hazir olmasi yeterli.
const DICTIONARIES: Record<Locale, Partial<Record<MessageCode, string>>> = {
  tr: MESSAGES_TR,
  en: MESSAGES_TR,
};

/**
 * Kodu okunabilir metne cevirir ve {ad} yer tutucularini doldurur.
 *
 * Bilinmeyen bir kod geldiginde PATLAMIYOR, kodun kendisini donduruyor.
 * Sebep: sunucu ile istemci farkli surumlerde olabilir (kullanicinin sekmesi
 * acikken deploy edildi diyelim). O anda kullaniciya "group.not_found" gostermek
 * cirkin ama bos ekran gostermekten iyidir.
 */
export function translate(
  code: string,
  params?: MessageParams,
  locale: Locale = "tr",
): string {
  const template = DICTIONARIES[locale][code as MessageCode] ?? MESSAGES_TR[code as MessageCode];
  if (template === undefined) {
    return code;
  }
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
