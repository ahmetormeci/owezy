# Mağaza metni

> **Bu dosya neden var — ve neden dokuzuncu bir doküman.** AGENTS.md
> gereksiz yere yeni doküman açılmamasını söylüyor ve haklı; sekiz dosya
> projenin hafızası. Ama bu dosya hafıza değil, **içerik**: App Store
> sayfasında yayımlanan metnin kendisi. Sekizin hiçbiri uymuyordu —
> PROJECT.md süreci anlatıyor, CURRENT_TASK.md her görevde baştan
> yazılıyor, CHANGELOG kronolojik. Uyan bir yer bulunursa taşınabilir.
>
> **Asıl sebebi somut:** 10 Eylül'de destek sayfasındaki *"telefona
> bildirim gönderilmiyor"* cümlesi, 1.0.3 yayına çıktığı an yanlış hale
> geldi. O cümle repodaydı, bu yüzden yakalandı. Mağaza metni yalnızca
> App Store Connect'te duruyordu — yani aynı tuzağa düşse kimse fark
> etmezdi. Artık burada.
>
> **KAYNAK OTORİTESİ APP STORE CONNECT'TİR.** Buradaki metin onun
> kopyası; çeliştiğinde ASC doğrudur ve bu dosya güncellenir.

---

## Nereden geldi

Aşağıdaki İngilizce metinler **canlı mağazadan çekildi** (10 Eylül),
elle yazılmadı:

```
curl -s "https://itunes.apple.com/lookup?bundleId=net.owezy.app&country=tr"
```

O uç `description` ve `releaseNotes` döndürüyor. **Döndürmedikleri** ve
bu yüzden aşağıda boş duranlar: altyazı (subtitle), anahtar kelimeler
(keywords), tanıtım metni (promotional text) ve **Türkçe yerelleştirme**.
Onları App Store Connect'ten yapıştırmak gerekiyor.

## Adı ve sınıflandırma (mağazadan ölçüldü, 10 Eylül)

| | |
|---|---|
| Ad | Owezy: Split Expenses |
| Kategori | Finance |
| Yaş | 4+ |
| Diller | EN, TR |
| En düşük iOS | 16.4 |
| Satıcı | AHMET ORMECI |

---

## Açıklama — İngilizce (yayında)

```
Owezy is a simple ledger for people who share costs. Flatmates, road
trips, one dinner or a long holiday — who paid what, and who owes whom,
visible at a glance.

HOW IT WORKS
• Create a group and invite people with a link.
• Add an expense: who paid, and who shares it.
• Balances update themselves.
• Debts are simplified, so three people settle up in the fewest
  payments instead of sending money in circles.
• Record the payment and the account closes.

SPLITS THAT MATCH REAL LIFE
• Equally — everyone pays the same share.
• By amount — write exactly what each person owes.
• By percentage — shares in proportion.
Fractions are never lost; leftover cents are handed out fairly.

ALSO
• Turkish and English.
• Light and dark themes.
• Two-step verification (authenticator app + backup codes).
• No ads, no in-app purchases, no tracking.

Owezy uses the data in your account only to run the app.
Privacy policy: https://owezy.net/privacy
```

## Açıklama — Türkçe

> **BOŞ.** Lookup ucu Türkçe yerelleştirmeyi döndürmüyor. App Store
> Connect → App Store → Turkish → Description'dan yapıştır.

```
(App Store Connect'ten yapıştırılacak)
```

## Altyazı · anahtar kelimeler · tanıtım metni

> **BOŞ.** Üçü de lookup ucunda yok; ASC'den yapıştırılacak.

| Alan | EN | TR |
|---|---|---|
| Subtitle | | |
| Keywords | | |
| Promotional text | | |

---

## Sürüm notları

### 1.0.2 — yayında (7 Eylül)

```
This update fixes issues reported since the first release and brings a few
things the web app already had to the phone.

• Signing in with two-factor authentication failed. Fixed.
• Notifications now live in a bell at the top of the screen, with an
  unread count.
• Export your expense list as CSV — the file follows whichever filters
  you have on screen.
• See deleted expenses and restore them.
• Leave a group — and, if you own it, hand ownership to another member
  before you go.
• Invite links now open straight in the app, so there is nothing to copy
  and paste.
• The app is in Turkish and English, and the store page now says so.
```

### 1.0.3 — incelemeden çıktı (10 Eylül)

> Notu ASC'den yapıştır. İçeriği: push bildirim, üye çıkarma + davet
> iptali, grup eylemleri fişin üstünde, başlıktaki hesap simgesi, tema
> seçimi, fiş fotoğrafı.

---

## BİR SONRAKİ GÖNDERİMDEN ÖNCE — açıklamada DEĞİŞMESİ GEREKEN yer

**"SPLITS THAT MATCH REAL LIFE" listesi ÜÇ madde sayıyor** (equally / by
amount / by percentage). Faz 45'te **dördüncüsü** geldi: kalem kalem
bölüşüm (ADR-052).

Bugün metin **doğru**, çünkü mağazadaki sürümde o özellik yok. **1.0.4
yayına çıktığı an eksik olacak** — destek sayfasındaki cümlenin başına
gelenin aynısı, sadece ters yönde: orada olmayan bir şey vaat ediliyordu,
burada olan bir şey saklanacak.

Aynı gönderimde açıklamaya girmesi gerekenler:

- kalem kalem bölüşüm (dördüncü madde)
- tekrarlayan harcama (kira, abonelik)
- harcamaya yorum
- fiş fotoğrafı — 1.0.3'te geldi, açıklamada **hiç geçmiyor**

**Açıklamada bildirimle ilgili yanlış bir cümle YOK** — ölçüldü, push
metinde hiç geçmiyor. Yani destek sayfasındaki tuzağın eşi burada
çıkmadı.

---

## App Privacy — beyan edilenler

App Store Connect → App Privacy. **Buraya yalnızca hesabın sahibi
girebiliyor**; aşağıdaki tablo neyin doğru olduğunu söylüyor, girmiyor.

| Satır | Ne zaman | Linked to You | Tracking | Amaç |
|---|---|---|---|---|
| Identifiers → **Device ID** | 8 Eylül, push ile | **Evet** | Hayır | App Functionality |
| User Content → **Photos or Videos** | 8 Eylül, fiş ile | Evet | Hayır | App Functionality |

**"Linked to You" neden EVET — ve neden yanlış işaretlemesi kolay:**
bildirim adresi cihazda üretiliyor ve kimlik içermiyor, bu yüzden
"kimliksiz" sanmak doğal. Ama biz onu `PushToken.userId` ile **hesaba
bağlı** saklıyoruz: çıkışta siliniyor, hesap silmede siliniyor. Bağlı
olduğu için beyanı da bağlı olmalı.

**"Tracking" neden HAYIR:** adres üçüncü taraf veriyle eşleştirilmiyor,
reklam yok, veri simsarı yok. Gizlilik politikası bunu açıkça yazıyor ve
IDFA'dan ayırıyor (`src/content/legal/privacy.ts`).

Kurulum tarafı (kayıt): APNs anahtarı Portal ID `47KL3BM87C`, App ID'de
Push Notifications yetkisi işaretli, push gerçek telefonda doğrulandı —
tutar ve isim bildirimde görünmüyor (ADR-047).
