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
