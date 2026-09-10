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

## Açıklama — Türkçe (yayında)

> Kullanıcı App Store Connect'ten yapıştırdı (10 Eylül). Lookup ucu
> Türkçe yerelleştirmeyi döndürmüyor, yani bu metnin tek kaynağı ASC.

```
Owezy, ortak masrafları paylaşan insanlar için basit bir hesap defteri.
Ev arkadaşları, yol arkadaşları, bir akşam yemeği ya da uzun bir tatil —
kim ne ödedi, kim kime ne kadar borçlu, tek bakışta görünür.

NASIL ÇALIŞIR
• Bir grup oluştur, arkadaşlarını bir bağlantıyla davet et.
• Harcamayı gir: kim ödedi, kimler paylaşacak.
• Bakiyeler kendiliğinden hesaplanır.
• Borçlar sadeleştirilir: üç kişi birbirine para göndermek yerine
  en az sayıda ödemeyle ödeşir.
• Ödemeyi kaydet, hesap kapansın.

BÖLÜŞÜM, GERÇEK HAYATA UYAR
• Eşit — herkes aynı payı öder.
• Tutarla — kimin ne kadar ödeyeceğini tek tek yaz.
• Yüzdeyle — paylar oranlı olsun.
Küsuratlar kaybolmaz; kalan kuruşlar adilce dağıtılır.

AYRICA
• Türkçe ve İngilizce.
• Açık ve koyu tema.
• İki adımlı doğrulama (kimlik doğrulayıcı uygulama + yedek kodlar).
• Reklam yok, uygulama içi satın alma yok, takip yok.

Owezy hesabındaki verileri yalnızca uygulamayı çalıştırmak için kullanır.
Gizlilik politikası: https://owezy.net/privacy
```

## Altyazı · anahtar kelimeler · tanıtım metni

Üçü de lookup ucunda yok; kullanıcı ASC'den yapıştırdı (10 Eylül).

| Alan | EN | TR |
|---|---|---|
| Subtitle | `Group bills, settled fast` | `Grup hesabı, kolay ödeşme` |
| Keywords | `expenses,split,share,bills,roommate,debt,travel,group,settle,tab,budget,flatmate` | `masraf,paylaşım,hesap,borç,ev arkadaşı,tatil,bölüşme,ödeşme,grup,fatura,harcama` |
| Promotional text | *(bilerek boş)* | *(bilerek boş)* |

**ÖLÇÜLDÜ — alan sınırları rahat:**

| | EN | TR | Sınır |
|---|---|---|---|
| Altyazı | 25 | 25 | 30 |
| Anahtar kelime | 80 | 79 | 100 |

**Ölçümün gösterdiği ikinci şey — bir SORUN DEĞİL, bir fırsat.** Anahtar
kelimelerin bir kısmı uygulamanın **adında ya da altyazısında** zaten
geçiyor:

| | Tekrar edenler | Yer |
|---|---|---|
| EN | `expenses`, `split` | ad: *Owezy: Split Expenses* |
| EN | `bills`, `group` | altyazı: *Group bills, settled fast* |
| TR | `ödeşme`, `grup` | altyazı: *Grup hesabı, kolay ödeşme* |

Ad, altyazı ve anahtar kelimeler ASC'de **ayrı alanlar**. Yaygın kanı,
Apple'ın üçünü de arama için okuduğu ve aynı kelimeyi ikinci kez yazmanın
100 karakterden yer harcadığı yönünde — EN'de ~27, TR'de ~12 karakter. Bu
**doğrulayamadığım bir varsayım**: Apple algoritmasını yayımlamıyor ve
ölçebildiğim tek şey karakter sayısı. Yine de boşta ~20 karakter var ve
tekrarları çıkarmak yerine yeni kelime koymak denenebilir (örn. EN'de
`receipt`, `recurring`, `itemized`; TR'de `fiş`, `tekrarlayan`).

**Bu bir sonraki gönderimin işi**, çünkü bu alanlar sürümle birlikte
değişiyor.

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

```
• You can attach a receipt photo to an expense. Take it with the camera or
  pick it from your library. Expenses with a receipt are marked in the list,
  and tapping the mark opens the photo full screen. Only the members of that
  group can see it, and it has no public address. Deleting your account
  deletes the receipts you uploaded.
• Your phone can receive notifications. You hear about activity in your
  groups even when the app is closed. Amounts and names are never in the
  notification — only the group's name and what happened.
• A group's owner can remove a member and cancel an invite link.
• Adding an expense, settling up and editing the group are now at the top of
  the group page. They used to sit below the list, so in a long group a
  single action meant scrolling to the very bottom.
• Your account is now reachable from every screen, from the icon at the top.
• You can choose the appearance: System, Light or Dark.
• Fixed an error message that left out the amount when removing a member who
  still has an open balance.
```

Türkçesi:

```
• Harcamaya fiş fotoğrafı ekleyebiliyorsun. Telefonun kamerasıyla çek ya da
  galerinden seç. Listede fişi olan harcamaların yanında küçük bir işaret
  çıkıyor; dokununca fotoğraf tam ekran açılıyor. Fotoğrafı yalnızca o
  grubun üyeleri görüyor, herkese açık bir adresi yok. Hesabını silersen
  yüklediğin fişler de silinir.
• Telefonuna bildirim gelebiliyor. Grubunda bir hareket olduğunda uygulama
  kapalıyken de haberin oluyor. Bildirimde tutar ve kişi adı yazmaz;
  yalnızca grubun adı ve ne olduğu görünür.
• Grup sahibi bir üyeyi gruptan çıkarabiliyor, oluşturulmuş bir davet
  bağlantısını iptal edebiliyor.
• Harcama ekleme, ödeşme ve grup düzenleme artık grup sayfasının en üstünde.
  Önceden listenin altındaydı; uzun bir grupta tek bir işlem için sayfayı
  sonuna kadar kaydırmak gerekiyordu.
• Hesabına artık her ekranda, üstteki simgeden ulaşıyorsun.
• Görünüm seçilebiliyor: Sistem, Açık ya da Koyu.
• Bakiyesi olan bir üyeyi çıkarırken tutarın görünmediği hata düzeltildi.
```

> **İKİSİ KARŞILAŞTIRILDI (10 Eylül):** yedi madde, yedi madde — aynı
> sıra, aynı içerik. Türkçesi İngilizcenin kısaltılmışı değil, tam
> karşılığı. Bir ara "Türkçesi eksik olabilir" diye not düşülmüştü;
> **öyle değilmiş**, ASC'de ikisi de var.
>
> Maddelerin uygulamada karşılığı da kontrol edildi: hesap silmede fişler
> gerçekten gidiyor (ADR-046), bildirimde tutar ve isim gerçekten yok
> (ADR-047), tema seçimi ve üye çıkarma yerinde. Sürüm notu vaat ettiği
> şeyleri anlatıyor.

**1.0.2'nin notu yalnızca İngilizce elde** — Türkçesi lookup ucundan
gelmiyor ve ASC'den alınmadı. Yayında olan sürüm o olduğu için bir gün
gerekirse oradan bakılmalı.

---

## BİR SONRAKİ GÖNDERİMDEN ÖNCE — açıklamada DEĞİŞMESİ GEREKEN yer

**"SPLITS THAT MATCH REAL LIFE" listesi ÜÇ madde sayıyor** (equally / by
amount / by percentage). Faz 45'te **dördüncüsü** geldi: kalem kalem
bölüşüm (ADR-052).

Bugün metin **doğru**, çünkü mağazadaki sürümde o özellik yok. **1.0.4
yayına çıktığı an eksik olacak** — destek sayfasındaki cümlenin başına
gelenin aynısı, sadece ters yönde: orada olmayan bir şey vaat ediliyordu,
burada olan bir şey saklanacak.

**Türkçe açıklama AYNI İKİ BOŞLUĞU taşıyor:** "BÖLÜŞÜM, GERÇEK HAYATA
UYAR" da üç madde sayıyor (Eşit / Tutarla / Yüzdeyle) ve fiş fotoğrafı
orada da geçmiyor. İki dilde birden düzeltilecek.

Aynı gönderimde açıklamaya girmesi gerekenler:

- kalem kalem bölüşüm (dördüncü madde)
- tekrarlayan harcama (kira, abonelik)
- harcamaya yorum
- fiş fotoğrafı — 1.0.3'te geldi, açıklamada **hiç geçmiyor**
- fişten tutar okuma (cihazda; fotoğraf hiçbir yere gitmiyor)

**Açıklamada bildirimle ilgili yanlış bir cümle YOK** — ölçüldü, push
metinde hiç geçmiyor. Yani destek sayfasındaki tuzağın eşi burada
çıkmadı.

---

## App Privacy — beyan edilenler

**ÖLÇÜLDÜ (10 Eylül), App Store Connect'e bakılarak değil.** Apple bu
beyanı herkese açık ürün sayfasında gösteriyor, yani dışarıdan
doğrulanabiliyor:

```
curl -s https://apps.apple.com/tr/app/owezy-split-expenses/id6805650395 \
  | grep -o 'aria-label="Data [^"]*"'
```

O anda dönen:

| Kart | İçindekiler |
|---|---|
| **Data Linked to You** | Financial Info · User Content · **Identifiers** |
| Data Not Linked to You | Diagnostics |

Üçü de doğru:

- **Identifiers → Linked.** Bildirim adresi (`PushToken`) hesaba bağlı
  saklanıyor: çıkışta siliniyor, hesap silmede siliniyor. Adres cihazda
  üretiliyor ve kimlik içermiyor — bu yüzden "bağlı değil" demek doğal
  gelir, ama bağlı. Beyan doğru tarafta.
- **User Content → Linked.** Fiş fotoğrafı ve yorumlar.
- **Diagnostics → Not Linked.** Sentry; PII kapalı, IP saklanmıyor.
  Gizlilik politikası da bunu yazıyor.

**"LINKED TO YOU" DİYE BİR KUTU YOK — bu başlık türetilmiş.** 10 Eylül'de
kullanıcıya "o kutuyu işaretle" denildi ve kullanıcı haklı olarak
bulamadı. App Store Connect'te veri türünü eklerken kimliğe bağlı olup
olmadığı **soruluyor**; Apple cevaplardan bu iki kartı üretiyor ve o adlar
yalnızca ürün sayfasında görünüyor. Bir daha kontrol gerekirse **ASC'de
arama, yukarıdaki komutu çalıştır** — hem daha hızlı hem de yayında olanı
gösteriyor.

Kurulum tarafı (kayıt): APNs anahtarı Portal ID `47KL3BM87C`, App ID'de
Push Notifications yetkisi işaretli, push gerçek telefonda doğrulandı —
tutar ve isim bildirimde görünmüyor (ADR-047).
