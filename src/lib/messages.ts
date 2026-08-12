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

import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

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
  // Dil dugmesi. Kisa etiketler ("TR" / "EN") her dilde ayni yazilir ama yine
  // de sozlukte: kodda gomulu kullanici metni birakmama kurali istisnasiz.
  "ui.language_short_tr": "TR",
  "ui.language_short_en": "EN",
  // Tema dugmesinin aksine burada durumu BILIYORUZ - dil sunucuda okunuyor,
  // yani hangi dilde oldugumuz ilk render'da bellidir. O yuzden etiket
  // "dili degistir" degil, ne olacagini soyleyebiliyor.
  "ui.switch_to_tr": "Türkçeye geç",
  "ui.switch_to_en": "İngilizceye geç",

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
  // Fiil BASLIKTA, satirda degil. "{name} kisisine {amount} ode" gibi bir
  // sablon Turkcede ek istiyor ({name}'e / {name}'a / {name}'ye) ve ek ismin
  // son harfine gore degisiyor - yer tutucuyla dogru yazilamaz. Basliga
  // tasiyinca satir yalnizca isim + tutar oluyor ve iki dilde de dogru.
  "ui.you_should_pay": "Ödemen gerekenler",
  "ui.will_be_paid_to_you": "Sana ödenecekler",
  "ui.other_suggested_payments": "Grubun geri kalanı",
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
  "ui.invite_uses_count": "{used}/{max} kullanıldı",
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
  "ui.invite_ask_new_link": "Seni davet eden kişiden yeni bir link isteyebilirsin.",
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
  "ui.remove_member_question": "{name} gruptan çıkarılsın mı?",
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
  // "3 dakika once" gibi goreli zamanlar burada DEGIL: Intl.RelativeTimeFormat
  // uretiyor (notification-text.ts). Sebebi Ingilizce: "{count} minutes ago"
  // sablonu 1 icin "1 minutes ago" yazardi. Turkcede cogul eki olmadigi icin
  // sablon calisiyordu, Ingilizcede calismiyor. "az once" ise bir sayi
  // icermedigi icin Intl'in isi degil, burada kaliyor.
  "ui.just_now": "az önce",
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

// Ingilizce sozluk. Tipi BILEREK Partial degil: eksik birakilan bir kod
// derleme hatasi veriyor. Partial olsaydi unutulan kod sessizce Turkceye
// duserdi - Ingilizce ekranin ortasinda tek bir Turkce cumle, hicbir uyari
// yok. Bu, sozlugun en kolay bozulma bicimi.
//
// Ceviri notu: uygulama Turkcede "sen" diliyle konusuyor; Ingilizcede de
// ayni samimiyet korundu ("you"), resmi bir ton kullanilmadi.
export const MESSAGES_EN: Record<MessageCode, string> = {
  // --- Group ---
  "group.not_found": "Group not found",
  "group.not_member": "You are not a member of this group",
  "group.owner_only": "Only the group owner can change group details",
  "group.already_member": "You are already a member of this group",
  "group.owner_must_transfer":
    "The group owner must transfer ownership to another member before leaving",

  // --- Membership ---
  "member.not_found": "Member not found",
  "member.remove_owner_only": "Only the group owner can remove members",
  "member.transfer_target_not_active":
    "The person you are transferring ownership to is not an active member of the group",
  "member.owner_cannot_remove_self":
    "The group owner cannot remove themselves; use the leave-group action instead",
  // Ham kurus yaziyor - Turkcesindeki bilinen kusurun aynisi (bkz. CHANGELOG
  // 11.4a). Ceviri bunu duzeltmiyor; bicimleme ayri bir is.
  "member.has_credit": "This member is owed {amount} kurus; settle up first",
  "member.has_debt": "This member owes {amount} kurus; settle up first",

  // --- Invite ---
  "invite.not_found": "Invite not found",
  "invite.invalid": "This invite link is not valid",
  "invite.expired": "This invite link has expired",
  "invite.exhausted": "This invite link has reached its usage limit",
  "invite.already_revoked": "This invite has already been revoked",
  "invite.revoke_forbidden":
    "Only the person who created this invite or the group owner can revoke it",

  // --- Expense ---
  "expense.not_found": "Expense not found",
  "expense.not_deleted": "This expense has not been deleted",
  "expense.participants_not_active":
    "These users are not active members of the group: {userIds}",

  // --- Settlement ---
  "settlement.not_found": "Settlement not found",
  "settlement.already_cancelled": "This settlement has already been cancelled",
  "settlement.self_transfer": "A user cannot record a settlement with themselves",
  "settlement.party_only": "You can only record settlements you made or received",
  "settlement.users_not_member": "These users are not members of the group: {userIds}",

  // --- Record permissions ---
  "access.expense_creator_only": "Only the person who created this expense can change it",
  "access.settlement_creator_only":
    "Only the person who created this settlement can change it",
  "access.creator_left_owner_only":
    "The person who created this record has left the group; only the group owner can change it",

  // --- Split (split.ts) ---
  "split.amount_invalid": "amount must be a positive integer",
  "split.amount_too_large": "amount cannot exceed {max}",
  "split.duplicate_participant": "the same participant cannot be listed twice: {userId}",
  "split.no_participants": "at least one participant is required",
  "split.share_invalid": "the share for {userId} must be a non-negative integer",
  "split.sum_mismatch": "the shares ({total}) do not add up to amount ({amount})",
  "split.percentage_invalid":
    "the percentage for {userId} must be a non-negative integer (basis points)",
  "split.percentage_too_large": "the percentage for {userId} cannot exceed 100%",
  "split.percentage_sum_mismatch":
    "the percentages ({total}) must add up to exactly 100%",
  "split.failed": "The split could not be calculated",

  // --- Validation (Zod schemas carry these codes as messages) ---
  "validation.invalid": "Invalid request",
  "validation.group_name_required": "Group name cannot be empty",
  "validation.group_name_too_long": "Group name can be at most 100 characters",
  "validation.description_too_long": "Description can be at most 500 characters",
  "validation.currency_length": "Currency must be 3 letters",

  // --- General ---
  "auth.not_signed_in": "You need to sign in to do that",
  "server.unexpected": "Something went wrong",
  "server.bad_response": "The server sent an unexpected response",

  // ==========================================================
  // INTERFACE TEXT
  // ==========================================================

  // --- Shared actions ---
  "ui.cancel": "Cancel",
  "ui.save": "Save",
  "ui.saving": "Saving...",
  "ui.delete": "Delete",
  "ui.edit": "Edit",
  "ui.create": "Create",
  "ui.creating": "Creating...",
  "ui.loading": "Loading...",
  "ui.copy": "Copy",

  // --- Landing / identity ---
  "ui.app_name": "SplitApp",
  "ui.tagline": "Track group expenses and see who owes whom at a glance.",
  "ui.meta_description": "Share group expenses and see who owes whom.",
  "ui.sign_in": "Sign in",
  "ui.sign_up": "Sign up",
  "ui.sample_note": "Sample — not a real group",
  "ui.sample_title": "Breakfast",
  "ui.theme_toggle": "Switch theme",
  "ui.language_short_tr": "TR",
  "ui.language_short_en": "EN",
  "ui.switch_to_tr": "Switch to Turkish",
  "ui.switch_to_en": "Switch to English",

  // --- Groups ---
  "ui.my_groups": "My groups",
  "ui.back_to_groups": "← My groups",
  "ui.new_group": "New group",
  "ui.new_group_title": "Create a new group",
  "ui.new_group_hint": "Create a group to track shared expenses in.",
  "ui.group_name": "Group name",
  "ui.group_name_placeholder": "Roommates",
  "ui.group_description": "Description (optional)",
  "ui.group_description_placeholder": "Rent, bills, groceries",
  "ui.no_groups": "You don't have any groups yet. Create one to get started.",
  "ui.group_created": "Group created",
  "ui.edit_group": "Edit group",
  "ui.edit_group_hint":
    "You can change the group's name and description. The currency cannot be changed, so that it stays consistent with existing records.",
  "ui.group_updated": "Group updated",
  "ui.role_owner": "Owner",
  "ui.role_member": "Member",
  "ui.you": "You",
  "ui.member_left": "Left",

  // --- Balances ---
  "ui.your_status": "Where you stand",
  "ui.settled_up": "All settled",
  "ui.owed_to_you": "This much is owed to you",
  "ui.you_owe": "You owe this much",
  "ui.no_open_balance": "You have no open balance in this group",
  "ui.suggested_payments": "Suggested payments",
  "ui.you_should_pay": "You should pay",
  "ui.will_be_paid_to_you": "Owed to you",
  "ui.other_suggested_payments": "Rest of the group",
  "ui.everyone_settled": "Everyone is settled up, there is nothing to pay.",
  "ui.members_and_balances": "Members and balances",
  "ui.manage_members": "Manage members",

  // --- Expenses ---
  "ui.expenses": "Expenses",
  "ui.add_expense": "Add expense",
  "ui.edit_expense": "Edit expense",
  "ui.save_expense": "Save expense",
  "ui.save_changes": "Save changes",
  "ui.expense_added": "Expense added",
  "ui.expense_updated": "Expense updated",
  "ui.expense_deleted": "Expense deleted",
  "ui.expense_delete_failed": "The expense could not be deleted",
  "ui.expenses_load_failed": "Expenses could not be loaded",
  "ui.delete_expense_question": "Delete this expense?",
  "ui.no_expenses": "No expenses in this group yet. Add your first one to get started.",
  "ui.load_more": "Load more",
  "ui.description": "Description",
  "ui.description_placeholder": "Groceries",
  "ui.description_required": "Description cannot be empty",
  "ui.amount": "Amount",
  // Ondalik ayraci dile gore degisiyor: Turkce "120,50", Ingilizce "120.50".
  // parseMoney ikisini de okuyor, ama ornek gosterdigimiz sey o dilde
  // yazilanin ta kendisi olmali.
  "ui.amount_placeholder": "120.50",
  "ui.amount_example": "Example: 120.50",
  "ui.amount_unreadable": "I couldn't read that amount",
  "ui.amount_required": "Enter a valid amount greater than zero. Example: 120.50",
  "ui.who_paid": "Who paid?",
  "ui.category": "Category",
  "ui.date": "Date",
  "ui.how_to_split": "How should it be split?",
  "ui.split_equal": "Split equally",
  "ui.split_exact": "Enter amounts",
  "ui.split_percentage": "Enter percentages",
  "ui.split_preview": "Split preview",
  "ui.participants": "Participants",
  "ui.participant_required": "Select at least one participant",
  "ui.each_amount_required": "Enter a valid amount for each participant",
  "ui.each_percentage_required": "Enter a valid percentage for each participant",
  "ui.deleting": "Deleting...",
  "ui.unknown_user": "Unknown",

  // Kelime sirasi Turkcenin tersi - bu ikisinin butun cumle olarak
  // tutulmasinin sebebi tam olarak bu.
  "ui.paid_by": "paid by {name}",
  "ui.your_share_amount": "your share {amount}",
  "ui.participant_amount_label": "{name} amount",
  "ui.participant_percentage_label": "{name} percentage",
  "ui.delete_expense_hint":
    "“{description}” will be removed and deducted from the balances. The record is not erased; it can be restored if needed.",

  // --- Settlements ---
  "ui.settlements": "Recorded settlements",
  "ui.record_settlement": "Record a settlement",
  "ui.settlement_hint":
    "Records a payment that already happened. The app does not move money, it only updates balances.",
  "ui.settlement_direction": "Direction",
  "ui.i_paid": "I paid",
  "ui.paid_to_me": "I was paid",
  "ui.settlement_counterparty": "Who did you pay?",
  "ui.settlement_counterparty_required": "Select the other party",
  "ui.settlement_note": "Note (optional)",
  "ui.settlement_note_placeholder": "Paid by bank transfer",
  "ui.settlement_saved": "Settlement recorded",
  "ui.use_suggested_amount": "Use the suggested amount: {amount}",
  "ui.no_settlements":
    "No settlements recorded yet. Once you pay someone back, add it here.",
  "ui.cancel_settlement": "Cancel",
  "ui.cancelling": "Cancelling...",
  "ui.cancel_settlement_question": "Cancel this settlement?",
  "ui.cancel_settlement_hint":
    "If the record is cancelled, this payment will not count towards the balances and the debt comes back.",
  "ui.settlement_cancelled": "Settlement cancelled",
  "ui.settlement_cancel_failed": "The settlement could not be cancelled",

  // --- Invites ---
  "ui.invites": "Invite links",
  "ui.active_invites": "Active invites",
  "ui.create_invite": "Create an invite link",
  "ui.invite_uses": "How many people can use it?",
  "ui.invite_validity": "How long should it last?",
  "ui.no_active_invite": "No active invite links.",
  "ui.invite_ready": "Your invite link is ready",
  "ui.invite_once_warning":
    "This link is shown only now. If you refresh the page you won't see it again, because the server stores only a hashed digest of it, not the link itself.",
  "ui.invite_created": "Invite link created",
  "ui.invite_create_failed": "The invite link could not be created",
  "ui.invite_revoke": "Revoke",
  "ui.invite_revoked": "Invite revoked",
  "ui.invite_revoke_failed": "The invite could not be revoked",
  "ui.invite_exhausted": "Used up",
  "ui.invite_uses_count": "{used}/{max} used",
  "ui.invite_valid_until": "Valid until {date}",
  "ui.invite_created_by": "created by {name}",
  "ui.link_copied": "Link copied",
  "ui.link_copy_failed": "The link could not be copied, you can select and copy it manually",
  "ui.uses_1": "1 person",
  "ui.uses_5": "5 people",
  "ui.uses_25": "25 people",
  "ui.days_1": "1 day",
  "ui.days_7": "7 days",
  "ui.days_30": "30 days",

  // --- Join page ---
  "ui.join_group": "Join group",
  "ui.joining": "Joining...",
  "ui.joined_group": "You joined the group",
  "ui.join_failed": "Could not join the group",
  "ui.join_press_button": "Press the button below to join.",
  "ui.join_sign_in_first": "You need to sign in before joining.",
  "ui.invite_unusable": "This invite cannot be used",
  "ui.invited_to_group": "You've been invited to “{groupName}”",
  "ui.invite_ask_new_link": "You can ask whoever invited you for a new link.",
  "ui.invite_notice_revoked": "This invite has been revoked.",
  "ui.invite_notice_invalid": "This invite link is not valid.",
  "ui.invite_notice_exhausted": "This invite link has reached its usage limit.",
  "ui.invite_notice_expired": "This invite has expired.",
  "ui.back_home": "Back to home",

  // --- Membership ---
  "ui.members": "Members",
  "ui.members_and_invites": "Members and invites",
  "ui.remove_member": "Remove",
  "ui.removing": "Removing...",
  "ui.member_removed": "Member removed",
  "ui.member_removed_named": "{name} was removed from the group",
  "ui.remove_member_question": "Remove {name} from the group?",
  "ui.member_remove_failed": "The member could not be removed",
  "ui.remove_member_hint":
    "Their past expenses stay in the group. If they have an open balance, it must be settled first.",
  "ui.leave_group": "Leave group",
  "ui.leave": "Leave",
  "ui.leaving": "Leaving...",
  "ui.leave_group_question": "Leave this group?",
  "ui.leave_group_hint":
    "Your past expenses stay in the group. If you have an open balance, you need to settle up first.",
  "ui.left_group": "You left the group",
  "ui.leave_failed": "Could not leave the group",
  "ui.transfer_to_whom": "Who are you transferring ownership to?",

  // --- Notifications ---
  "ui.notifications": "Notifications",
  "ui.notifications_with_unread": "Notifications ({count} unread)",
  "ui.unread": "Unread",
  "ui.no_notifications": "No notifications yet.",
  "ui.mark_all_read": "Mark all as read",
  "ui.notifications_load_failed": "Notifications could not be loaded",
  "ui.notifications_mark_failed": "Notifications could not be marked",
  "ui.just_now": "just now",
  "ui.someone": "Someone",
  "ui.notif_expense_added": "{actor} added a new expense",
  "ui.notif_expense_updated": "{actor} updated an expense",
  "ui.notif_expense_deleted": "{actor} deleted an expense",
  "ui.notif_settlement_recorded": "{actor} recorded a settlement",
  "ui.notif_settlement_cancelled": "{actor} cancelled a settlement",
  "ui.notif_member_joined": "{actor} joined the group",

  // --- Expense categories ---
  "ui.category_food": "Food",
  "ui.category_transport": "Transport",
  "ui.category_accommodation": "Accommodation",
  "ui.category_entertainment": "Entertainment",
  "ui.category_shopping": "Shopping",
  "ui.category_bills": "Bills",
  "ui.category_other": "Other",
};

const DICTIONARIES: Record<Locale, Record<MessageCode, string>> = {
  tr: MESSAGES_TR,
  en: MESSAGES_EN,
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
  locale: Locale = DEFAULT_LOCALE,
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
