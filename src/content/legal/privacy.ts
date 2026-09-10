import type { LegalDocumentByLocale } from "./types";

/**
 * Gizlilik politikasi.
 *
 * BURADAKI HER CUMLE KODDAN DOGRULANDI.
 *
 * FAZ 25.7'DE BIR CUMLE YANLIS OLMUSTU ve bu, dosyanin basindaki uyarinin
 * neden yazildigini gosteriyor: "Parolan bize hic ulasmaz; girisi Clerk
 * yonetiyor." Kimlik dogrulama Clerk'ten Better Auth'a gecince parola
 * GERCEKTEN bizim sunucumuza gelmeye basladi - hash'lenip bizim
 * veritabanimiza yaziliyor. Kod degisti, metin gerideydi. Bir davranis
 * degistiginde BU DOSYA DA DEGISMELI; politikanin yanlis olmasi, hic
 * olmamasindan kotudur. Metni yazmadan once sema, Sentry
 * yapilandirmasi, cerezler, ucuncu taraf paketleri ve silme akisi tek tek
 * okundu. Bir davranis degisirse BU DOSYA DA DEGISMELI - politikanin yanlis
 * olmasi, hic olmamasindan kotudur.
 *
 * ABARTMIYORUZ, bilerek: "verileriniz sifrelenir" gibi bir cumle, alan bazinda
 * uygulama seviyesinde sifreleme yaptigimizi ima ederdi. Yapmiyoruz. Yazilan
 * sey olculebilir olan: aktarim TLS, diskte barindiricinin sifrelemesi.
 *
 * HUKUKI DANISMANLIK DEGIL. Bu metin uygulamanin ne yaptigini dogru anlatir;
 * KVKK/GDPR uyumunun son kontrolu ayri bir istir.
 */
export const PRIVACY_POLICY: LegalDocumentByLocale = {
  tr: {
    title: "Gizlilik Politikası",
    description:
      "Owezy hangi verileri işliyor, neden işliyor ve neleri hiç toplamıyor.",
    updated: "2026-08-26",
    intro:
      "Owezy, arkadaş ve ev arkadaşı gruplarının ortak harcamalarını kaydettiği " +
      "bir defter uygulamasıdır. Bu sayfa, uygulamanın hangi verileri işlediğini " +
      "sade bir dille anlatır. Kısa tutmaya çalıştık; anlamadığın bir yer olursa yaz.",
    sections: [
      {
        heading: "En kısa hâli",
        blocks: [
          {
            kind: "ul",
            items: [
              "Owezy para taşımaz. Kart, IBAN veya ödeme bilgisi hiç toplamıyoruz.",
              "Parolanı hiçbir zaman okunabilir hâlde saklamıyoruz; yalnızca geri " +
                "döndürülemez bir özeti tutulur. Parola belirlemek zorunda da değilsin — " +
                "e-postana gelen kodla girebilirsin.",
              "Reklam veya analiz izleyicisi kullanmıyoruz. Ziyaretlerini ölçmüyoruz.",
              "Hesabını sildiğinde adın ve e-postan silinir, ama grup arkadaşlarının " +
                "bakiyesi bozulmasın diye harcama kayıtları anonim olarak kalır.",
            ],
          },
        ],
      },
      {
        heading: "Veri sorumlusu",
        blocks: [
          {
            kind: "p",
            text:
              "Owezy'yi Ahmet Örmeci geliştiriyor ve işletiyor. Bu politika kapsamında " +
              "veri sorumlusu odur. Her türlü soru, talep ve başvuru için: destek@owezy.net",
          },
        ],
      },
      {
        heading: "Hangi verileri işliyoruz",
        blocks: [
          {
            kind: "p",
            text:
              "Hesabını oluştururken sen verirsin; hepsi bizim veritabanımızda durur:",
          },
          {
            kind: "ul",
            items: [
              "E-posta adresin",
              "Görünen adın",
              "Profil fotoğrafın (yüklediysen): fotoğrafın kendisi, adresi ve gerçekten bir fotoğraf yükleyip yüklemediğin. Fotoğrafını yalnızca seninle ortak bir grubu olanlar görebilir; herkese açık bir adresi yoktur.",
              "Arayüz dili tercihin",
              "Parola belirlediysen: parolanın geri döndürülemez özeti (hash). " +
                "Parolanın kendisi hiçbir yerde saklanmaz.",
              "Açık oturumların. Her oturumla birlikte bağlandığın IP adresi ve " +
                "tarayıcı/cihaz bilgisi (user agent) saklanır — oturumu yönetmek ve " +
                "hesabını korumak için. Reklam ya da ölçüm için kullanılmaz.",
              "Telefona bildirim gelmesini açtıysan: cihazının bildirim adresi. " +
                "Bu adres cihazında üretilir, kimliğini içermez ve yalnızca " +
                "bildirim göndermek için kullanılır. Çıkış yaptığında silinir.",
            ],
          },
          {
            kind: "p",
            text: "Uygulamayı kullanırken sen oluşturursun:",
          },
          {
            kind: "ul",
            items: [
              "Grup adları ve açıklamaları",
              "Harcamalar: açıklama, tutar, tarih, kategori, kimin ödediği, kimler arasında bölüşüldüğü",
              "Ödeşme kayıtları: kimin kime ne kadar ödediği ve varsa notu",
              "Bir harcamaya yazdığın yorumlar. Yorumu yalnızca o grubun üyeleri " +
                "görür; telefonlara giden bildirimde yorumun METNİ yer almaz.",
              "Davet linkleri ve üyelik kayıtları",
              "Sana gönderilen uygulama içi bildirimler",
              "Harcama düzenleme ve silme geçmişi (denetim kaydı)",
              "Bir harcamaya fiş fotoğrafı eklersen: fotoğrafın kendisi ve kimin " +
                "eklediği. Fotoğrafa yalnızca o grubun üyeleri ulaşabilir; herkese " +
                "açık bir adresi yoktur ve her görüntülemede üyeliğin kontrol edilir.",
            ],
          },
          {
            kind: "p",
            text:
              "Son maddeye dikkat: bir harcamayı düzenlediğinde ya da sildiğinde, " +
              "değişiklikten önceki hâli de kaydediliyor. Bunun sebebi ortak bir defterde " +
              "kimin neyi ne zaman değiştirdiğinin izlenebilir olması.",
          },
        ],
      },
      {
        heading: "Neleri toplamıyoruz",
        blocks: [
          {
            kind: "ul",
            items: [
              "Ödeme bilgisi: kart numarası, IBAN, banka hesabı — hiçbiri. Uygulama para transferi yapmaz; " +
                "ödeşme kaydı yalnızca senin girdiğin bir nottur.",
              "Konum bilgisi, rehberin, fotoğraf galerin.",
              "Reklam kimliği (IDFA) ya da cihazını uygulamalar arasında tanıyan " +
                "herhangi bir tanımlayıcı. Bildirimleri açtıysan sakladığımız " +
                "bildirim adresi bundan farklıdır: yalnızca bu uygulamaya aittir, " +
                "uygulamayı silip yeniden kurduğunda değişir ve başka hiçbir yerde " +
                "seni tanımaya yaramaz.",
              "Analitik ve reklam verisi. Uygulamada hiçbir analiz veya reklam aracı kurulu değil.",
            ],
          },
        ],
      },
      {
        heading: "Neden işliyoruz",
        blocks: [
          {
            kind: "ul",
            items: [
              "Sözleşmenin ifası: uygulama olmadan çalışamaz. Bakiyeni hesaplamak için " +
                "harcamaları, seni gruba bağlamak için kimliğini bilmek zorunda.",
              "Meşru menfaat: hataları görüp düzeltmek (hata takibi) ve kötüye kullanımı önlemek.",
              "Açık rıza: bir gün ek bir işlem için rızan gerekirse, o an açıkça sorulacak.",
            ],
          },
        ],
      },
      {
        heading: "Kimlerle paylaşıyoruz",
        blocks: [
          {
            kind: "p",
            text:
              "Verini satmıyoruz ve reklam amacıyla kimseyle paylaşmıyoruz. " +
              "Uygulamanın çalışması için şu hizmet sağlayıcıları kullanıyoruz:",
          },
          {
            kind: "ul",
            items: [
              "Neon — veritabanı",
              "Resend — giriş kodu e-postalarının gönderimi (e-posta adresin bu hizmete iletilir)",
              "Vercel — uygulamanın barındırılması",
              "Cloudflare — alan adı yönlendirmesi ve fotoğrafların saklandığı yer: fişler ve profil fotoğrafları (R2)",
              "Expo — telefona bildirim gönderimi. Bildirimin metni bu hizmetten " +
                "geçer: yalnızca grubun adı ve ne olduğu (\"bir harcama eklendi\" gibi). " +
                "Tutarlar ve kişi adları bildirime hiç konmaz.",
              "Sentry — hata takibi",
            ],
          },
          {
            kind: "p",
            text:
              "Bu sağlayıcıların tamamı yurt dışında yerleşiktir; dolayısıyla verilerin " +
              "Türkiye dışında işlenir. Uygulamayı kullanmak bu aktarımı gerektirir.",
          },
          {
            kind: "p",
            text:
              "Sentry'ye kişisel veri göndermiyoruz: IP adresi, çerezler, istek içeriği " +
              "ve kullanıcı bilgisi hata kayıtlarına dahil edilmiyor. Performans izleme " +
              "ve oturum kaydı (session replay) kapalı.",
          },
        ],
      },
      {
        heading: "Çerezler",
        blocks: [
          {
            kind: "p",
            text: "İki çerez kullanıyoruz, ikisi de zorunlu:",
          },
          {
            kind: "ul",
            items: [
              "Oturum çerezi — giriş yapmış kalman için gerekli.",
              "Dil tercihi çerezi — seçtiğin dilin bir sonraki ziyarette de geçerli olması için. Bir yıl saklanır.",
            ],
          },
          {
            kind: "p",
            text:
              "İzleme veya reklam çerezi yok. Yazı tipleri derleme sırasında indirilip " +
              "kendi alan adımızdan sunuluyor; siteyi açtığında yazı tipi için başka bir " +
              "sunucuya istek gitmiyor.",
          },
        ],
      },
      {
        heading: "Ne kadar saklıyoruz ve hesap silme",
        blocks: [
          {
            kind: "p",
            text:
              "Verilerin hesabın açık olduğu sürece saklanır. Hesabını web'de profil " +
              "menüsünden silebilirsin.",
          },
          {
            kind: "p",
            text:
              "Sildiğinde ne olduğunu açıkça yazmak istiyoruz, çünkü beklediğinden farklı " +
              "olabilir. Kişisel bilgilerin — e-posta adresin, adın, profil fotoğrafın — " +
              "silinir. YÜKLEDİĞİN FİŞ FOTOĞRAFLARI DA SİLİNİR, depodan da; " +
              "YAZDIĞIN YORUMLAR DA SİLİNİR. Ancak girdiğin harcama ve ödeşme " +
              "kayıtları silinmez; anonimleştirilmiş bir kullanıcıya bağlı " +
              "kalmaya devam eder.",
          },
          {
            kind: "p",
            text:
              "Sebebi şu: Owezy ortak bir defter. Bir kişinin kayıtlarını silmek, aynı " +
              "gruptaki diğer herkesin bakiyesini bozar — kimin kime ne kadar borçlu " +
              "olduğu yanlış hesaplanır. Bu yüzden finansal kayıtlar korunur, kimlik " +
              "bilgileri kaldırılır. Sana gelmiş uygulama içi bildirimler ise " +
              "silinir — onlar bir defter kaydı değil, sana yazılmış cümleler.",
          },
          {
            kind: "p",
            text:
              "Sahibi olduğun bir grup varsa, sahiplik gruptaki en eski üyeye geçer; " +
              "grupta başka kimse kalmamışsa grup arşivlenir.",
          },
        ],
      },
      {
        heading: "Güvenlik",
        blocks: [
          {
            kind: "ul",
            items: [
              "Uygulamayla aramızdaki tüm trafik HTTPS üzerinden şifrelenir.",
              "Veritabanı bağlantısı TLS zorunludur ve kanal bağlama (channel binding) kullanır.",
              "Veriler, barındırıcımızın altyapısında diskte şifreli olarak saklanır.",
              "Parolalar bizde tutulmaz.",
            ],
          },
          {
            kind: "p",
            text:
              "Bunun ötesinde bir söz vermiyoruz: alan bazında (örneğin tutarları tek tek) " +
              "şifreleme yapmıyoruz, çünkü şifrelenmiş bir tutarın toplamı alınamaz. " +
              "Hiçbir sistem tümüyle güvenli değildir; bir ihlal yaşanırsa mevzuatın " +
              "öngördüğü süre içinde bildirimde bulunuruz.",
          },
        ],
      },
      {
        heading: "Haklarınız",
        blocks: [
          {
            kind: "p",
            text:
              "KVKK'nın 11. maddesi kapsamında; kişisel verinin işlenip işlenmediğini " +
              "öğrenme, bilgi talep etme, işlenme amacını öğrenme, yurt içinde veya " +
              "yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış " +
              "işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, " +
              "bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, otomatik " +
              "sistemlerle analiz edilmesi sonucu aleyhine bir sonuç doğmasına itiraz " +
              "etme ve zarara uğraman hâlinde tazminat talep etme haklarına sahipsin.",
          },
          {
            kind: "p",
            text:
              "Başvurunu destek@owezy.net adresine gönderebilirsin. En geç otuz gün " +
              "içinde yanıtlanır.",
          },
        ],
      },
      {
        heading: "Değişiklikler",
        blocks: [
          {
            kind: "p",
            text:
              "Bu politika değişebilir. Değiştiğinde yukarıdaki güncelleme tarihi " +
              "yenilenir; önemli bir değişiklik olursa uygulama içinde ayrıca duyururuz.",
          },
        ],
      },
    ],
  },

  en: {
    title: "Privacy Policy",
    description: "What data Owezy processes, why, and what it never collects.",
    updated: "2026-08-26",
    intro:
      "Owezy is a shared ledger for friends and flatmates splitting expenses. " +
      "This page explains, in plain language, what the app does with your data. " +
      "We tried to keep it short; if something is unclear, write to us.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            kind: "ul",
            items: [
              "Owezy does not move money. We never collect card, bank account or payment details.",
              "We never store your password in readable form — only an irreversible " +
                "digest of it. You do not have to set one at all: you can sign in with " +
                "a code sent to your email.",
              "We use no advertising or analytics trackers. We do not measure your visits.",
              "When you delete your account your name and email are removed, but expense " +
                "records stay on anonymously so your group's balances are not corrupted.",
            ],
          },
        ],
      },
      {
        heading: "Who is responsible",
        blocks: [
          {
            kind: "p",
            text:
              "Owezy is built and operated by Ahmet Örmeci, who is the data controller " +
              "for the purposes of this policy. For any question or request: destek@owezy.net",
          },
        ],
      },
      {
        heading: "What we process",
        blocks: [
          {
            kind: "p",
            text:
              "You provide this when you create your account; all of it lives in our " +
              "own database:",
          },
          {
            kind: "ul",
            items: [
              "Your email address",
              "Your display name",
              "Your profile photo, if you uploaded one: the photo itself, its address, and whether you actually uploaded one. Only people who share a group with you can see it; it has no public address.",
              "Your interface language preference",
              "If you set a password: an irreversible digest (hash) of it. The password " +
                "itself is stored nowhere.",
              "Your open sessions. Each one stores the IP address you connected from " +
                "and your browser/device string (user agent) — to manage the session " +
                "and protect your account. Never for advertising or measurement.",
              "If you turned on notifications on your phone: your device's notification " +
                "address. It is generated on your device, does not identify you, and is " +
                "used only to send notifications. It is deleted when you sign out.",
            ],
          },
          { kind: "p", text: "You create the rest by using the app:" },
          {
            kind: "ul",
            items: [
              "Group names and descriptions",
              "Expenses: description, amount, date, category, who paid, and how it was split",
              "Settlements: who paid whom, how much, and an optional note",
              "Comments you write on an expense. Only members of that group can see " +
                "them; the TEXT of a comment is never included in the notification " +
                "sent to phones.",
              "Invite links and membership records",
              "In-app notifications sent to you",
              "A history of expense edits and deletions (audit log)",
              "If you attach a receipt photo to an expense: the photo itself and who " +
                "attached it. Only members of that group can reach it; it has no public " +
                "address, and membership is checked on every view.",
            ],
          },
          {
            kind: "p",
            text:
              "Note the last item: when you edit or delete an expense, its previous state " +
              "is recorded too. In a shared ledger it has to be traceable who changed what, " +
              "and when.",
          },
        ],
      },
      {
        heading: "What we do not collect",
        blocks: [
          {
            kind: "ul",
            items: [
              "Payment details: no card numbers, no bank accounts. The app transfers no money; " +
                "a settlement is only a note that you entered.",
              "Location, contacts, photo library.",
              "An advertising identifier (IDFA), or any identifier that recognises " +
                "your device across apps. If you turned notifications on, the " +
                "notification address we store is a different thing: it belongs to " +
                "this app only, changes when you reinstall, and cannot be used to " +
                "recognise you anywhere else.",
              "Analytics or advertising data. No such tool is installed in the app at all.",
            ],
          },
        ],
      },
      {
        heading: "Why we process it",
        blocks: [
          {
            kind: "ul",
            items: [
              "Performance of the service: the app cannot work otherwise. It has to know the " +
                "expenses to compute your balance, and who you are to place you in a group.",
              "Legitimate interest: finding and fixing errors, and preventing abuse.",
              "Consent: if some future feature ever needs it, we will ask you plainly at the time.",
            ],
          },
        ],
      },
      {
        heading: "Who we share it with",
        blocks: [
          {
            kind: "p",
            text:
              "We do not sell your data and share it with nobody for advertising. " +
              "These providers are used to run the service:",
          },
          {
            kind: "ul",
            items: [
              "Neon — database",
              "Resend — delivery of sign-in code emails (your email address is passed to this service)",
              "Vercel — hosting",
              "Cloudflare — domain routing, and where photos are stored: receipts and profile photos (R2)",
              "Expo — delivering notifications to your phone. The notification text " +
                "passes through it: only the group's name and what happened (\"an expense " +
                "was added\"). Amounts and names are never put in a notification.",
              "Sentry — error tracking",
            ],
          },
          {
            kind: "p",
            text:
              "All of these providers are established outside Türkiye, so your data is " +
              "processed abroad. Using the app requires that transfer.",
          },
          {
            kind: "p",
            text:
              "We send no personal data to Sentry: IP addresses, cookies, request bodies " +
              "and user information are excluded from error reports. Performance tracing " +
              "and session replay are switched off.",
          },
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          { kind: "p", text: "Two cookies, both strictly necessary:" },
          {
            kind: "ul",
            items: [
              "A session cookie — required to keep you signed in.",
              "A language preference cookie, so your chosen language survives your next visit. Kept for a year.",
            ],
          },
          {
            kind: "p",
            text:
              "No tracking or advertising cookies. Fonts are downloaded at build time and " +
              "served from our own domain, so opening the site sends no font request to " +
              "anyone else.",
          },
        ],
      },
      {
        heading: "Retention and deleting your account",
        blocks: [
          {
            kind: "p",
            text:
              "Your data is kept for as long as your account exists. You can delete your " +
              "account from the profile menu on the web.",
          },
          {
            kind: "p",
            text:
              "We want to be explicit about what deletion does, because it may not be what " +
              "you expect. Your personal details — email address, name, profile picture — " +
              "are removed. THE RECEIPT PHOTOS YOU UPLOADED ARE DELETED TOO, from storage " +
              "as well, AND SO ARE THE COMMENTS YOU WROTE. Your expenses and settlements " +
              "are not: they stay, attached to an anonymised user.",
          },
          {
            kind: "p",
            text:
              "The reason is that Owezy is a shared ledger. Deleting one person's records " +
              "corrupts everyone else's balance in the same group — who owes whom would be " +
              "computed wrongly. So financial records are preserved and identifying details " +
              "are stripped. The in-app notifications you received are deleted, though — " +
              "they are not ledger entries, they are sentences written to you.",
          },
          {
            kind: "p",
            text:
              "If you own a group, ownership passes to its longest-standing member; if " +
              "nobody else is left, the group is archived.",
          },
        ],
      },
      {
        heading: "Security",
        blocks: [
          {
            kind: "ul",
            items: [
              "All traffic between you and the app is encrypted over HTTPS.",
              "The database connection requires TLS and uses channel binding.",
              "Data is stored encrypted at rest on our hosting provider's infrastructure.",
              "Passwords are not held by us.",
            ],
          },
          {
            kind: "p",
            text:
              "We promise no more than that: we do not encrypt individual fields such as " +
              "amounts, because you cannot sum an encrypted number. No system is completely " +
              "secure; should a breach occur we will notify as the law requires.",
          },
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          {
            kind: "p",
            text:
              "You may ask whether your personal data is processed, request information " +
              "about it and about the purpose of processing, learn which third parties it " +
              "is transferred to at home or abroad, have inaccurate or incomplete data " +
              "corrected, request erasure, ask that such actions be communicated to those " +
              "third parties, object to conclusions drawn solely by automated analysis, and " +
              "claim compensation for damage caused by unlawful processing.",
          },
          {
            kind: "p",
            text:
              "Send your request to destek@owezy.net. It will be answered within thirty days " +
              "at the latest.",
          },
        ],
      },
      {
        heading: "Changes",
        blocks: [
          {
            kind: "p",
            text:
              "This policy may change. When it does, the update date above changes with it; " +
              "for anything significant we will also say so inside the app.",
          },
        ],
      },
    ],
  },
};
