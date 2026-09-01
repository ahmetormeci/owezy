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
  // Hesap zaten silinmis ya da hic yok. Silme ucu bunu donduruyor.
  "user.not_found": "Böyle bir hesap bulunamadı.",
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
  "expense.version_conflict": "Bu harcama sen düzenlerken başkası tarafından değiştirildi",

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
  "validation.display_name_required": "Adın boş olamaz",
  "validation.display_name_too_long": "Ad en fazla 100 karakter olabilir",
  "validation.description_too_long": "Açıklama en fazla 500 karakter olabilir",
  "validation.currency_unsupported": "Desteklenmeyen para birimi",

  // --- Genel ---
  // Bu normalde kullaniciya gorunmez: korumali sayfalar zaten giris ekranina
  // yonlendiriyor. Yine de bir yerde gorunurse anlamli bir cumle olsun.
  "auth.not_signed_in": "Bu işlem için giriş yapman gerekiyor",
  "server.unexpected": "Beklenmeyen bir hata oluştu",
  // 429. Kullaniciya "sinir" ya da "kota" demiyoruz: yapmasi gereken sey
  // beklemek ve bunu anlatan cumle, mekanizmayi anlatan cumleden iyi.
  "server.too_many_requests": "Çok hızlı gidiyorsun. Biraz bekleyip tekrar dener misin?",
  "server.bad_response": "Sunucudan beklenmeyen bir cevap alındı",
  // Yalnizca MOBILDE olusuyor: istek hic gonderilemedigi zaman
  // (mobile/lib/api.ts fetch'i yakaliyor, status 0). Web'de karsiligi yok -
  // tarayici zaten kendi hatasini verir.
  "server.offline": "Bağlantı yok. İnternete bağlanıp tekrar dene.",

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
  "ui.app_name": "Owezy",
  "ui.tagline":
    "Grup harcamalarını kaydet, kimin kime ne kadar borçlu olduğunu tek bakışta gör.",
  "ui.meta_description":
    "Grup harcamalarını paylaş, kimin kime ne kadar borçlu olduğunu gör.",
  "ui.sign_in": "Giriş yap",
  "ui.sign_up": "Kayıt ol",
  "ui.sample_note": "Örnek — gerçek bir gruba ait değil",

  // --- Herkese acik alt baglantilar (gizlilik / destek) ---
  "ui.privacy": "Gizlilik",
  "ui.support": "Destek",

  // --- Mobil giris ekrani ---
  // Bu ekran mobildeki TEK sabit metinli ekrandi; metinler buraya tasindi.
  "ui.email": "E-posta",
  "ui.email_placeholder": "ornek@owezy.net",
  "ui.send_code": "Kod gönder",
  "ui.verification_code": "Doğrulama kodu",
  "ui.code_sent_to": "{email} adresine gönderildi.",
  "ui.code_placeholder": "000000",
  "ui.change_email": "E-postayı değiştir",
  "ui.password": "Parola",
  "ui.sign_in_with_password": "Parolayla gir",
  "ui.sign_in_with_code": "Kodla gir",
  // --- Kayit / giris sayfalari (Faz 25.4) ---
  "ui.display_name": "Adın",
  "ui.name_saved": "Adın güncellendi",
  // KURGUSAL BIR ISIM OLMALI. Bir sure burada uygulamanin sahibinin
  // GERCEK adi yaziyordu: kaydolan herkes ornek olarak onu goruyordu.
  // Ingilizcesi bastan beri "Alex Doe" - yani kurgusal oldugu belli.
  "ui.display_name_placeholder": "Ayşe Yılmaz",
  "ui.no_account_yet": "Hesabın yok mu?",
  "ui.already_have_account": "Zaten hesabın var mı?",
  // Better Auth'un hata KODLARI icin karsiliklar. Ham Ingilizce mesaji
  // basmak, ADR-017'nin "API kod doner, metni okuyan taraf uretir"
  // kuralini kimlik dogrulamada delmek olurdu.
  "auth.invalid_code": "Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsin.",
  "auth.invalid_credentials": "E-posta ya da parola hatalı.",
  "auth.two_factor_requires_password":
    "Bu hesap iki adımlı doğrulama kullanıyor. Parolanla giriş yap.",
  "auth.invalid_two_factor_code": "Kod doğrulanamadı. Tekrar dener misin?",
  "auth.two_factor_locked":
    "Çok fazla hatalı deneme oldu. Hesabın bir süreliğine kilitlendi; biraz sonra tekrar dene.",
  "auth.two_factor_expired": "Doğrulama süresi doldu. Baştan giriş yapman gerekiyor.",
  "auth.password_too_short": "Parola en az 8 karakter olmalı.",
  "auth.password_too_long": "Parola en fazla 128 karakter olabilir.",
  // BICIM hatasi - "boyle bir hesap yok" degil. O ayrimi korumak onemli:
  // hangi adreslerin kayitli oldugunu sinamaya izin vermiyoruz.
  "auth.invalid_email": "E-posta adresi geçerli görünmüyor.",
  // Yalnizca parola sorulan ekranlarda (guvenlik ayarlari): orada e-posta
  // diye bir alan yok, o yuzden "e-posta ya da parola hatali" demiyoruz.
  "auth.invalid_password": "Parola hatalı.",
  "auth.email_taken": "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene.",
  // Ikinci faktor adimi. Ucu de AYNI ekrani kullaniyor, yalnizca baslik ve
  // ipucu degisiyor - kullanicinin yaptigi is her durumda ayni: bir kod gir.
  "ui.two_factor_title": "İki adımlı doğrulama",
  "ui.totp_hint": "Kimlik doğrulayıcı uygulamandaki 6 haneli kodu gir.",
  // Cihaz guveni (needs_client_trust): parola dogruydu ama cihaz taninmiyor.
  // Bunu bir GUVENLIK olayi gibi degil, bir bilgi gibi soyluyoruz - kullanici
  // yanlis bir sey yapmadi.
  "ui.device_trust_hint": "Bu cihazı tanımıyoruz. {email} adresine bir kod gönderdik.",
  "ui.backup_code": "Yedek kod",
  "ui.backup_code_hint":
    "İki adımlı doğrulamayı kurarken sana verilen kodlardan birini gir. Her kod yalnızca bir kez kullanılır.",
  "ui.use_backup_code": "Yedek kod kullan",
  "ui.use_authenticator": "Uygulama kodunu kullan",
  "ui.use_emailed_code": "E-postaya gelen kodu kullan",
  "ui.resend_code": "Kodu yeniden gönder",
  "ui.code_resent": "Kod yeniden gönderildi.",
  // GERI DUSUS. Artik "ikinci faktor" demek DEGIL - onu yurutuyoruz. Geriye
  // yalnizca desteklemedigimiz yollar kaliyor (bugun: SMS ikinci faktoru,
  // ve parola yenileme gibi tamamlanmamis durumlar).
  "ui.sign_in_needs_web": "Bu giriş ek bir doğrulama istiyor. Şimdilik web üzerinden giriş yapman gerekiyor: owezy.net",
  "ui.sign_in_failed": "Bir şeyler ters gitti. Tekrar dener misin?",

  // --- Guvenlik ekrani ve parola belirleme (Faz 27.3) ---
  //
  // "IKI ADIMLI DOGRULAMA" deniyor, "2FA" degil. Kisaltma bize bir sey
  // anlatiyor, kullaniciya anlatmiyor.
  "ui.two_factor_is_on": "Açık",
  "ui.two_factor_is_off": "Kapalı",
  "ui.two_factor_off_hint":
    "Parolana ek olarak telefonundaki uygulamadan bir kod istenir. Parolan başkasının eline geçse bile hesabına girilemez.",
  "ui.two_factor_on_hint": "Girişte parolandan sonra ayrıca bir kod isteniyor.",
  "ui.two_factor_enable": "Aç",
  "ui.two_factor_disable": "Kapat",
  "ui.two_factor_enabled": "İki adımlı doğrulama açıldı",
  "ui.two_factor_disabled": "İki adımlı doğrulama kapatıldı",
  "ui.two_factor_password_hint": "Devam etmek için parolanı gir.",
  "ui.two_factor_scan": "Kimlik doğrulayıcı uygulamanla bu kodu okut.",
  "ui.two_factor_qr_label": "Kurulum için QR kodu",
  "ui.two_factor_secret": "Okutamıyorsan bu anahtarı elle gir:",
  "ui.two_factor_confirm_hint": "Kurulumu bitirmek için uygulamadaki 6 haneli kodu gir.",
  "ui.two_factor_verify": "Doğrula",
  // Kullanicinin 2FA'yi actiktan sonra parolasini unutursa girebilecegi TEK
  // yol bu kodlar degil - parola yenileme de var - ama telefonunu
  // kaybettiginde tek yol bu. O yuzden "sonra bakarim" denmeyecek kadar net
  // yaziliyor.
  "ui.backup_codes": "Yedek kodlar",
  "ui.backup_codes_hint":
    "Telefonuna erişemezsen bu kodlarla girebilirsin. Her kod yalnızca bir kez çalışır. Şimdi kaydet — bir daha gösterilmeyecek.",
  "ui.backup_codes_copied": "Yedek kodlar kopyalandı",
  "ui.backup_codes_copy_failed": "Kodlar kopyalanamadı, elle seçip kopyalayabilirsin",
  "ui.backup_codes_regenerate": "Yedek kodları yenile",
  "ui.backup_codes_regenerated": "Yeni yedek kodlar üretildi; eskiler artık çalışmıyor.",
  "ui.two_factor_needs_password":
    "İki adımlı doğrulama için hesabında bir parola olması gerekiyor. Şu anda yalnızca e-posta koduyla giriyorsun.",
  "ui.set_password": "Parola belirle",
  "ui.remember_this_device": "Bu cihazı 30 gün hatırla",
  "ui.forgot_password": "Parolamı unuttum",
  "ui.reset_password_title": "Parolanı belirle",
  "ui.reset_password_hint":
    "E-posta adresine bir kod gönderelim, sonra yeni parolanı yazarsın. Hesabında hiç parola yoksa bu adım parolanı ilk kez kurar.",
  "ui.new_password": "Yeni parola",
  "ui.password_updated": "Parolan kaydedildi. Şimdi giriş yapabilirsin.",

  // --- E-posta dogrulama (Faz 28) ---
  //
  // NEDEN VAR: dogrulanmamis bir hesapta e-posta koduyla giris yapmak
  // PAROLAYI SILIYOR (Better Auth'un revokeUnprovenAccountAccess'i). Metin
  // bunu "guvenlik" diye soyut birakmiyor, olacak seyi yaziyor - cunku
  // kullanicinin kaybedecegi sey somut.
  "ui.verify_email_title": "E-postanı doğrula",
  "ui.verify_email_hint": "{email} adresine 6 haneli bir kod gönderdik.",
  "ui.verify_email_why":
    "Doğrulanmamış bir hesapta e-posta koduyla giriş yaparsan parolan silinir. Doğrulamak bunu kalıcı olarak önler.",
  "ui.verify_email_action": "Doğrula",
  "ui.verify_email_later": "Şimdi değil",
  "ui.verify_email_done": "E-posta adresin doğrulandı",
  "ui.email_not_verified": "E-postan doğrulanmadı",
  "ui.send_verification_code": "Doğrulama kodu gönder",
  // --- E-posta (Faz 25.2) ---
  // Bunlar ARAYUZ metni degil, gonderilen postanin metni. Yine de sozlukte:
  // ADR-020'nin garantisi (eksik ceviri = derleme hatasi) burada da gecerli
  // olmali - kullanicinin gordugu en kritik metin bu, cunku giremezse
  // uygulamayi hic gormuyor.
  //
  // KOD KONUYA YAZILMIYOR. Cogu servis yaziyor cunku kilit ekrani
  // bildiriminde gorunuyor ve kolaylik sagliyor. Tam o yuzden yazmiyoruz:
  // telefona yandan bakan biri giris kodunu okuyabilir. Konu ne oldugunu
  // soyluyor, kod govdede.
  "email.otp_subject_sign_in": "Owezy giriş kodun",
  "email.otp_subject_email_verification": "E-posta adresini doğrula",
  "email.otp_subject_forget_password": "Parolanı sıfırla",
  "email.otp_subject_change_email": "Yeni e-posta adresini doğrula",
  "email.otp_heading": "Doğrulama kodun",
  "email.otp_body": "Bu kodu Owezy'de gir. {minutes} dakika geçerli.",
  "email.otp_ignore": "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabında hiçbir şey değişmedi.",
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

  // Mobil istemcinin ihtiyaci olarak eklendiler (Faz 18.3): web'de o zaman
  // karsiliklari Clerk'in kendi bileseninden geliyordu ve sozlukte yoklardi.
  // Faz 25.4'te web de bu sozluge bagsizlandi - ayni anahtarlari iki istemci
  // birden kullaniyor.
  "ui.sign_out": "Çıkış yap",

  /**
   * HESAP SILME. App Store Guideline 5.1.1(v) uygulama ici silmeyi zorunlu
   * kiliyor; metinler de o zorunlulugun bir parcasi - kullanici NE
   * KAYBEDECEGINI silmeden once bilmeli.
   */
  "ui.account": "Hesap",
  "ui.delete_account": "Hesabımı sil",
  "ui.delete_account_title": "Hesabını silmek üzeresin",
  // Kaybedilecek sey somut yaziliyor, "bu islem geri alinamaz" gibi bos bir
  // cumleyle degil.
  "ui.delete_account_warning":
    "Adın ve e-postan silinir, gruplarından çıkarılırsın ve bir daha bu hesapla giriş yapamazsın. Geçmiş harcamalar gruplarda kalır — silinseydi arkadaşlarının bakiyeleri yanlış görünürdü.",
  // Acik bakiyesi olan da silebilir (ADR-031) ama gormeden degil.
  "ui.delete_account_balance_warning":
    "Açık bir hesabın olabilir. Silmek borcunu ortadan kaldırmaz; arkadaşlarınla aranda kalır.",
  "ui.delete_account_confirm": "Evet, hesabımı sil",
  "ui.delete_account_done": "Hesabın silindi.",
  "ui.try_again": "Tekrar dene",
  "ui.you": "Sen",
  "ui.member_left": "Ayrıldı",

  // --- Bakiye ---
  "ui.your_status": "Senin durumun",
  "ui.settle_plan": "Hesap böyle kapanır",
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

  // --- Özet ---
  "ui.summary_total": "Toplam",
  "ui.summary_your_share": "Payın",
  "ui.summary_expense_count": "Harcama",
  "ui.summary_by_month": "Aylara göre",
  "ui.summary_by_category": "Nereye gitti",
  "ui.summary_how_balance": "Bakiyen nasıl oluştu",
  "ui.summary_you_paid": "Ödediğin",
  "ui.summary_settlements": "Ödemeler",
  "ui.summary_balance": "Bakiyen",
  // Türkçede çoğul eki yok, İngilizcede var: tek kayıt "1 expense", digerleri
  // "2 expenses". Sablonu tek tutsaydik Ingilizce "1 expenses" yazardi -
  // 11.4d-1'de goreli zamanlarda yasanan hatanin aynisi.
  "ui.month_expense_count_one": "{count} harcama",
  "ui.month_expense_count_other": "{count} harcama",
  "ui.search_expenses": "Harcama ara",
  "ui.all_categories": "Tüm kategoriler",
  // Mobilde süzgeç satırı kapalı duruyor ve bu etiketle açılıyor; web'de
  // denetimlerin hepsi zaten görünür olduğu için orada karşılığı yok.
  "ui.filter": "Filtre",
  "ui.clear_filters": "Temizle",
  "ui.only_mine": "Yalnızca beni ilgilendirenler",
  "ui.no_matching_expenses": "Aramanla eşleşen harcama yok.",
  "ui.match_count_one": "{count} sonuç",
  "ui.match_count_other": "{count} sonuç",
  "ui.export_csv": "Dışa aktar",
  "ui.csv_paid_by": "Ödeyen",
  "ui.csv_amount": "Tutar ({currency})",
  "ui.csv_your_share": "Payın ({currency})",

  // --- Harcama ---
  "ui.expenses": "Harcamalar",
  "ui.add_expense": "Harcama ekle",
  "ui.edit_expense": "Harcamayı düzenle",
  "ui.save_expense": "Harcamayı kaydet",
  // Iki adimli harcama formunun ilk adiminda: bolusme tutara bagli
  // oldugu icin once "ne aldin, kac para" soruluyor.
  "ui.next": "Devam",
  "ui.save_changes": "Değişiklikleri kaydet",
  "ui.expense_added": "Harcama eklendi",
  // Fisin son satiri: sayfadan cikmadan harcama ekleme (Faz 16.3).
  "ui.composer_placeholder": "Ne aldın?",
  "ui.composer_amount": "Ne kadar?",
  "ui.composer_hint": "Eşit bölünür · sen ödedin · bugün",
  "ui.composer_submit": "Ekle",
  "ui.expense_updated": "Harcama güncellendi",

  // Mobil (Faz 18.6): esit olmayan bolusum telefonda duzenlenmiyor.
  "ui.edit_amount_on_web": "Bu harcamanın payları tek tek girilmiş. Tutarı telefondan değiştirmek toplamı bozardı; tutarı değiştirmek için web'i kullan. Açıklamayı buradan düzenleyebilirsin.",
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
  // Kategori secilmediginde sunucunun ne tahmin edecegini onceden gosterir.
  "ui.category_guessed": "Tahmin: {category}",
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
    "“{description}” kaydı silinecek ve bakiyelerden düşülecek. Bu işlem geri alınamaz.",

  // --- Cakisma (ADR-032) ---
  // Cumle "uzerine yazacaksin" diyor, "yazabilirsin" degil: kaydetmek gercekten
  // uzerine yazar. Onlemedigimiz bir seyi onluyormus gibi anlatmiyoruz.
  "ui.conflict_heading": "Bu harcama sen düzenlerken değişti",
  "ui.conflict_overwrite_hint": "Tekrar kaydedersen bu değişikliklerin üzerine yazacaksın.",
  "ui.conflict_unknown": "Neyin değiştiğini gösteremiyoruz. Kaydetmeden önce kontrol et.",
  "ui.conflict_deleted": "Bu harcama silinmiş. Düzenlemen kaydedilemez.",
  "ui.conflict_change": "{field}: {before} → {after}",
  "ui.conflict_participants_added": "Eklenen: {names}",
  "ui.conflict_participants_removed": "Çıkarılan: {names}",
  "ui.conflict_shares_changed": "Paylar değişti",
  "ui.payer": "Ödeyen",
  "ui.split_type": "Bölüşüm",

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
  // Neyi iptal ettigini SOYLUYOR. Onay penceresinde "Vazgec" ile yan yana
  // duruyor; kisa hali Ingilizcede iki ayni "Cancel" dugmesi uretiyordu.
  "ui.cancel_settlement": "Ödemeyi iptal et",
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
    "Bu link yalnızca şimdi gösteriliyor. Bir daha göremezsin, çünkü sunucuda linkin kendisi değil yalnızca şifrelenmiş bir özeti saklanıyor.",
  "ui.invite_created": "Davet linki oluşturuldu",

  // Mobil (Faz 18.7): mevcut linki tekrar paylasma. "Davet linki olustur"
  // ile AYNI adi tasiyamaz - ikisi farkli is yapiyor.
  "ui.share_link": "Bağlantıyı paylaş",
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
  "ui.notifications_load_failed": "Bildirimler yüklenemedi",
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
  "user.not_found": "No such account was found.",
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
  "expense.version_conflict": "Someone else changed this expense while you were editing it",

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
  "validation.display_name_required": "Your name cannot be empty",
  "validation.display_name_too_long": "Name can be at most 100 characters",
  "validation.description_too_long": "Description can be at most 500 characters",
  "validation.currency_unsupported": "Unsupported currency",

  // --- General ---
  "auth.not_signed_in": "You need to sign in to do that",
  "server.unexpected": "Something went wrong",
  "server.too_many_requests": "That was a lot at once. Give it a moment and try again.",
  "server.bad_response": "The server sent an unexpected response",
  "server.offline": "No connection. Get back online and try again.",

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
  "ui.app_name": "Owezy",
  "ui.tagline": "Track group expenses and see who owes whom at a glance.",
  "ui.meta_description": "Share group expenses and see who owes whom.",
  "ui.sign_in": "Sign in",
  "ui.sign_up": "Sign up",
  "ui.sample_note": "Sample — not a real group",

  "ui.privacy": "Privacy",
  "ui.support": "Support",

  "ui.email": "Email",
  "ui.email_placeholder": "you@owezy.net",
  "ui.send_code": "Send code",
  "ui.verification_code": "Verification code",
  "ui.code_sent_to": "Sent to {email}.",
  "ui.code_placeholder": "000000",
  "ui.change_email": "Change email",
  "ui.password": "Password",
  "ui.sign_in_with_password": "Sign in with a password",
  "ui.sign_in_with_code": "Sign in with a code",
  "ui.display_name": "Your name",
  "ui.name_saved": "Your name has been updated",
  "ui.display_name_placeholder": "Alex Doe",
  "ui.no_account_yet": "Don't have an account?",
  "ui.already_have_account": "Already have an account?",
  "auth.invalid_code": "That code is wrong or has expired. You can ask for a new one.",
  "auth.invalid_credentials": "That email or password is wrong.",
  "auth.two_factor_requires_password":
    "This account uses two-step verification. Sign in with your password.",
  "auth.invalid_two_factor_code": "That code did not check out. Care to try again?",
  "auth.two_factor_locked":
    "Too many wrong attempts. Your account is locked for a while; try again shortly.",
  "auth.two_factor_expired": "The verification window closed. Please sign in again.",
  "auth.password_too_short": "Your password needs at least 8 characters.",
  "auth.password_too_long": "Your password can be at most 128 characters.",
  "auth.invalid_email": "That email address doesn't look right.",
  "auth.invalid_password": "That password is wrong.",
  "auth.email_taken": "That email address is already registered. Try signing in.",
  "ui.two_factor_title": "Two-step verification",
  "ui.totp_hint": "Enter the 6-digit code from your authenticator app.",
  "ui.device_trust_hint": "We don't recognise this device. We sent a code to {email}.",
  "ui.backup_code": "Backup code",
  "ui.backup_code_hint":
    "Enter one of the codes you were given when you set up two-step verification. Each code works once.",
  "ui.use_backup_code": "Use a backup code",
  "ui.use_authenticator": "Use your authenticator app",
  "ui.use_emailed_code": "Use the emailed code",
  "ui.resend_code": "Resend code",
  "ui.code_resent": "Code sent again.",
  "ui.sign_in_needs_web": "This sign-in needs another verification step. For now, please sign in on the web: owezy.net",
  "ui.sign_in_failed": "Something went wrong. Care to try again?",

  "ui.two_factor_is_on": "On",
  "ui.two_factor_is_off": "Off",
  "ui.two_factor_off_hint":
    "On top of your password, you'll be asked for a code from an app on your phone. Even someone who has your password can't get in.",
  "ui.two_factor_on_hint": "After your password, signing in asks for a code as well.",
  "ui.two_factor_enable": "Turn on",
  "ui.two_factor_disable": "Turn off",
  "ui.two_factor_enabled": "Two-step verification is on",
  "ui.two_factor_disabled": "Two-step verification is off",
  "ui.two_factor_password_hint": "Enter your password to continue.",
  "ui.two_factor_scan": "Scan this with your authenticator app.",
  "ui.two_factor_qr_label": "Setup QR code",
  "ui.two_factor_secret": "Can't scan it? Enter this key by hand:",
  "ui.two_factor_confirm_hint": "Enter the 6-digit code from the app to finish setting up.",
  "ui.two_factor_verify": "Verify",
  "ui.backup_codes": "Backup codes",
  "ui.backup_codes_hint":
    "Use one of these if you can't reach your phone. Each code works once. Save them now — they won't be shown again.",
  "ui.backup_codes_copied": "Backup codes copied",
  "ui.backup_codes_copy_failed": "The codes could not be copied, you can select and copy them manually",
  "ui.backup_codes_regenerate": "Generate new backup codes",
  "ui.backup_codes_regenerated": "New backup codes are ready; the old ones no longer work.",
  "ui.two_factor_needs_password":
    "Two-step verification needs a password on your account. Right now you only sign in with an emailed code.",
  "ui.set_password": "Set a password",
  "ui.remember_this_device": "Remember this device for 30 days",
  "ui.forgot_password": "I forgot my password",
  "ui.reset_password_title": "Set your password",
  "ui.reset_password_hint":
    "We'll email you a code, then you choose a new password. If your account has no password yet, this sets one for the first time.",
  "ui.new_password": "New password",
  "ui.password_updated": "Your password is saved. You can sign in now.",

  "ui.verify_email_title": "Verify your email",
  "ui.verify_email_hint": "We sent a 6-digit code to {email}.",
  "ui.verify_email_why":
    "On an unverified account, signing in with an emailed code deletes your password. Verifying prevents that for good.",
  "ui.verify_email_action": "Verify",
  "ui.verify_email_later": "Not now",
  "ui.verify_email_done": "Your email address is verified",
  "ui.email_not_verified": "Your email isn't verified",
  "ui.send_verification_code": "Send a verification code",
  "email.otp_subject_sign_in": "Your Owezy sign-in code",
  "email.otp_subject_email_verification": "Verify your email address",
  "email.otp_subject_forget_password": "Reset your password",
  "email.otp_subject_change_email": "Verify your new email address",
  "email.otp_heading": "Your verification code",
  "email.otp_body": "Enter this code in Owezy. It is valid for {minutes} minutes.",
  "email.otp_ignore": "If you didn't ask for this, you can ignore this email; nothing on your account has changed.",
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

  "ui.sign_out": "Sign out",

  "ui.account": "Account",
  "ui.delete_account": "Delete my account",
  "ui.delete_account_title": "You are about to delete your account",
  "ui.delete_account_warning":
    "Your name and email are removed, you leave your groups, and you can no longer sign in with this account. Past expenses stay in the groups — deleting them would make your friends' balances wrong.",
  "ui.delete_account_balance_warning":
    "You may have an open balance. Deleting your account does not clear a debt; it stays between you and your friends.",
  "ui.delete_account_confirm": "Yes, delete my account",
  "ui.delete_account_done": "Your account has been deleted.",
  "ui.try_again": "Try again",
  "ui.you": "You",
  "ui.member_left": "Left",

  // --- Balances ---
  "ui.your_status": "Where you stand",
  "ui.settle_plan": "How this settles",
  "ui.settled_up": "All settled",
  "ui.owed_to_you": "This much is owed to you",
  "ui.you_owe": "You owe this much",
  "ui.no_open_balance": "You have no open balance in this group",
  "ui.suggested_payments": "Suggested payments",
  "ui.you_should_pay": "You should pay",
  "ui.will_be_paid_to_you": "Owed to you",
  "ui.other_suggested_payments": "Rest of the group",
  "ui.everyone_settled": "Everyone is settled up, there is nothing to pay.",
  "ui.summary_total": "Total",
  "ui.summary_your_share": "Your share",
  "ui.summary_expense_count": "Expenses",
  "ui.summary_by_month": "By month",
  "ui.summary_by_category": "Where it went",
  "ui.summary_how_balance": "How your balance adds up",
  "ui.summary_you_paid": "You paid",
  "ui.summary_settlements": "Settlements",
  "ui.summary_balance": "Your balance",
  "ui.month_expense_count_one": "{count} expense",
  "ui.month_expense_count_other": "{count} expenses",
  "ui.search_expenses": "Search expenses",
  "ui.all_categories": "All categories",
  "ui.filter": "Filter",
  "ui.clear_filters": "Clear",
  "ui.only_mine": "Only ones involving me",
  "ui.no_matching_expenses": "No expenses match your search.",
  "ui.match_count_one": "{count} result",
  "ui.match_count_other": "{count} results",
  "ui.export_csv": "Export",
  "ui.csv_paid_by": "Paid by",
  "ui.csv_amount": "Amount ({currency})",
  "ui.csv_your_share": "Your share ({currency})",

  "ui.members_and_balances": "Members and balances",
  "ui.manage_members": "Manage members",

  // --- Expenses ---
  "ui.expenses": "Expenses",
  "ui.add_expense": "Add expense",
  "ui.edit_expense": "Edit expense",
  "ui.save_expense": "Save expense",
  "ui.next": "Next",
  "ui.save_changes": "Save changes",
  "ui.expense_added": "Expense added",
  "ui.composer_placeholder": "What did you buy?",
  "ui.composer_amount": "How much?",
  "ui.composer_hint": "Split equally · you paid · today",
  "ui.composer_submit": "Add",
  "ui.expense_updated": "Expense updated",

  "ui.edit_amount_on_web":
    "This expense has hand-entered shares. Changing the amount on the phone would break the total; use the web app to change it. You can still edit the description here.",
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
  "ui.category_guessed": "Guessed: {category}",
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
    "“{description}” will be removed and deducted from the balances. This cannot be undone.",

  // --- Conflict (ADR-032) ---
  "ui.conflict_heading": "This expense changed while you were editing it",
  "ui.conflict_overwrite_hint": "Saving again will overwrite these changes.",
  "ui.conflict_unknown": "We cannot show what changed. Check before you save.",
  "ui.conflict_deleted": "This expense was deleted. Your edit cannot be saved.",
  "ui.conflict_change": "{field}: {before} → {after}",
  "ui.conflict_participants_added": "Added: {names}",
  "ui.conflict_participants_removed": "Removed: {names}",
  "ui.conflict_shares_changed": "Shares changed",
  "ui.payer": "Paid by",
  "ui.split_type": "Split",

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
  "ui.cancel_settlement": "Cancel settlement",
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
    "This link is shown only now. You will not see it again, because the server keeps only a hashed digest of it, not the link itself.",
  "ui.invite_created": "Invite link created",

  "ui.share_link": "Share link",
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
  "ui.notifications_load_failed": "Notifications could not be loaded",
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
