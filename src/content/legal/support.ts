import type { LegalDocumentByLocale } from "./types";

/**
 * Destek sayfasi. App Store ve Play "Support URL" alanini zorunlu tutuyor ve
 * o adres calisir bir yardim yolu icermek zorunda.
 *
 * ICERIK KODUN GERCEK DURUMUNU ANLATIR. "Bilinen sinirlar" bolumu bilerek
 * durust: bir kullanicinin bulup da "bozuk mu?" diye yazacagi seyleri once
 * biz soyluyoruz. Bir sinir ortadan kalkarsa BURASI DA GUNCELLENMELI.
 */
export const SUPPORT_PAGE: LegalDocumentByLocale = {
  tr: {
    title: "Destek",
    description: "Owezy hakkında yardım, sık sorulanlar ve iletişim.",
    updated: "2026-08-25",
    intro:
      "Bir sorun mu var, bir şey mi anlaşılmıyor? Buradan yazabilirsin. " +
      "Aşağıda en sık karşılaşılan durumlar ve uygulamanın bugünkü sınırları var.",
    sections: [
      {
        heading: "İletişim",
        blocks: [
          {
            kind: "p",
            text:
              "destek@owezy.net — soru, hata bildirimi, öneri ve kişisel verilerine " +
              "ilişkin başvurular için tek adres burası.",
          },
          {
            kind: "p",
            text:
              "Bir hatayı bildiriyorsan şunları yazman çözümü hızlandırır: ne yapmaya " +
              "çalıştığın, ne olmasını beklediğin, bunun yerine ne olduğu, ve web'de mi " +
              "yoksa telefonda mı olduğu.",
          },
        ],
      },
      {
        heading: "Owezy ne yapar",
        blocks: [
          {
            kind: "p",
            text:
              "Bir grup kurarsın, ortak harcamaları girersin, Owezy kimin kime ne kadar " +
              "borçlu olduğunu hesaplar. Ödeştiğinizde bunu kaydedersin ve bakiyeler sıfırlanır.",
          },
          {
            kind: "p",
            text:
              "Owezy para taşımaz. Hiçbir ödeme yapılmaz, hiçbir hesaba erişilmez; " +
              "uygulama yalnızca bir defterdir. Ödeşme kaydı, gerçek hayatta zaten yapılmış " +
              "bir ödemenin not edilmesidir.",
          },
        ],
      },
      {
        heading: "Sık karşılaşılanlar",
        blocks: [
          {
            kind: "ul",
            items: [
              "Giriş kodu gelmedi: spam klasörüne bak. Birkaç dakika içinde gelmezse " +
                "adresi kontrol edip tekrar dene.",
              "Davet linki çalışmıyor: linkler süreli ve kullanım sayısı sınırlı. " +
                "Süresi dolmuş ya da tükenmişse grup sahibinden yeni bir link iste.",
              "Harcamayı düzenleyemiyorum: bir harcamayı yalnızca onu giren kişi " +
                "düzenleyebilir ya da silebilir. Kaydı giren kişi gruptan ayrılmışsa " +
                "grup sahibi müdahale edebilir.",
              "Sildiğim harcama geri gelmiyor: silme geri alınamaz. Kaydı yeniden girmen gerekir.",
              "Gruptan ayrılamıyorum: ayrılmadan önce bakiyenin sıfırlanmış olması gerekir; " +
                "borcun ya da alacağın varsa önce ödeşin.",
              "Tutarlar yanlış görünüyor: eşit bölüşümde kalan kuruş katılımcılara " +
                "dağıtılır, yani paylar bir kuruş farklı olabilir. Toplam her zaman tutar.",
            ],
          },
        ],
      },
      {
        heading: "Hesabını silmek",
        blocks: [
          {
            kind: "p",
            text:
              "Web'de sağ üstteki profil menüsünden hesabını silebilirsin. Ne olduğunu " +
              "gizlilik politikasında ayrıntısıyla yazdık: adın ve e-postan silinir, " +
              "harcama kayıtların ise grup arkadaşlarının bakiyesi bozulmasın diye " +
              "anonim olarak kalır.",
          },
        ],
      },
      {
        heading: "Bugünkü sınırlar",
        blocks: [
          {
            kind: "p",
            text:
              "Uygulama geliştirilmeye devam ediyor. Şu anda olmayan, sorulduğunda " +
              "\"bozuk mu?\" diye düşünebileceğin şeyler:",
          },
          {
            kind: "ul",
            items: [
              "Telefonda bildirim yok; bildirimler yalnızca web'de görünüyor.",
              "Payları tek tek girilmiş (tutar yazılmış) bir harcamanın " +
                "TUTARI telefondan değiştirilemiyor — toplamı bozardı. " +
                "Açıklaması düzenlenebiliyor; yüzdeli bölüşümlerde tutar da " +
                "değiştirilebiliyor.",
              "Davetler telefonda oluşturulup paylaşılabiliyor ama kabul etmek web'de yapılıyor.",
              "Ödeşme kaydı düzenlenemiyor; yalnızca iptal edilebiliyor.",
              "Grup adı ve açıklaması yalnızca web'de düzenlenebiliyor.",
              "Arayüz dili telefonda cihazın dilinden okunuyor, uygulama içinden değiştirilemiyor.",
              "Silinen bir harcamayı geri alma arayüzü yok.",
              "Süzülmüş listeyi CSV olarak indirmek yalnızca web'de var.",
            ],
          },
        ],
      },
      {
        heading: "Gizlilik",
        blocks: [
          {
            kind: "p",
            text:
              "Hangi verileri işlediğimizi ve neleri hiç toplamadığımızı gizlilik " +
              "politikasında bulabilirsin.",
          },
        ],
      },
    ],
  },

  en: {
    title: "Support",
    description: "Help with Owezy, common questions, and how to reach us.",
    updated: "2026-08-25",
    intro:
      "Something wrong, or something unclear? Write to us. Below are the situations " +
      "that come up most often, and what the app cannot do yet.",
    sections: [
      {
        heading: "Contact",
        blocks: [
          {
            kind: "p",
            text:
              "destek@owezy.net — one address for questions, bug reports, suggestions, " +
              "and requests about your personal data.",
          },
          {
            kind: "p",
            text:
              "If you are reporting a bug, these details speed things up: what you were " +
              "trying to do, what you expected, what happened instead, and whether it was " +
              "on the web or on your phone.",
          },
        ],
      },
      {
        heading: "What Owezy does",
        blocks: [
          {
            kind: "p",
            text:
              "You create a group, enter shared expenses, and Owezy works out who owes " +
              "whom how much. When you settle up you record it, and the balances go to zero.",
          },
          {
            kind: "p",
            text:
              "Owezy does not move money. No payment is made and no account is accessed; " +
              "the app is a ledger. Recording a settlement means noting a payment that " +
              "already happened in real life.",
          },
        ],
      },
      {
        heading: "Common questions",
        blocks: [
          {
            kind: "ul",
            items: [
              "The sign-in code did not arrive: check your spam folder. If nothing comes " +
                "within a few minutes, check the address and try again.",
              "An invite link does not work: links expire and have a limited number of uses. " +
                "If it has expired or run out, ask the group owner for a new one.",
              "I cannot edit an expense: only the person who entered it can edit or delete it. " +
                "If that person has left the group, the group owner can step in.",
              "A deleted expense will not come back: deletion cannot be undone. You need to enter it again.",
              "I cannot leave a group: your balance has to be zero first. If you owe or are " +
                "owed anything, settle up before leaving.",
              "The amounts look wrong: in an equal split the leftover kuruş is distributed " +
                "among participants, so shares can differ by one. The total always matches.",
            ],
          },
        ],
      },
      {
        heading: "Deleting your account",
        blocks: [
          {
            kind: "p",
            text:
              "On the web you can delete your account from the profile menu at the top right. " +
              "The privacy policy spells out what happens: your name and email are removed, " +
              "while your expense records stay on anonymously so your group's balances are " +
              "not corrupted.",
          },
        ],
      },
      {
        heading: "What it cannot do yet",
        blocks: [
          {
            kind: "p",
            text:
              "The app is still being built. These are missing today — worth knowing before " +
              "you wonder whether something is broken:",
          },
          {
            kind: "ul",
            items: [
              "No notifications on the phone; they appear on the web only.",
              "The AMOUNT of an expense whose shares were typed in one by one cannot be " +
                "changed on the phone — it would break the total. Its description can be " +
                "edited, and for percentage splits the amount can be changed too.",
              "Invites can be created and shared from the phone, but accepting one happens on the web.",
              "Settlements cannot be edited, only cancelled.",
              "A group's name and description can only be edited on the web.",
              "On the phone the interface language follows the device and cannot be changed in the app.",
              "There is no interface for restoring a deleted expense.",
              "Downloading the filtered list as CSV is web-only.",
            ],
          },
        ],
      },
      {
        heading: "Privacy",
        blocks: [
          {
            kind: "p",
            text:
              "The privacy policy covers what data we process and what we never collect.",
          },
        ],
      },
    ],
  },
};
