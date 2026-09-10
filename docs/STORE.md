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

## 1.0.4 GÖNDERİMİ — ASC'YE YAPIŞTIRILACAK METİNLER

Bu bölüm **hazır metin**, tartışma değil. Kaynağı aşağıdaki iki ölçüm:

**NEDEN AÇIKLAMA DEĞİŞMEK ZORUNDA.** Yayındaki açıklama iki dilde de
bölüşümü **üç** madde sayıyor (Eşit / Tutarla / Yüzdeyle). Faz 45'te
**dördüncüsü** geldi (kalem kalem, ADR-052). Ayrıca fiş fotoğrafı
1.0.3'te çıktı ve açıklamada **hiç geçmiyor**; tekrarlayan harcama,
yorum, hatırlatma ve fişten tutar okuma 1.0.4'le geliyor.

Bugüne kadar metin **doğruydu** — mağazadaki sürümde o özellikler yoktu.
1.0.4 yayına çıktığı an eksik olur. Destek sayfasındaki tuzağın tersi:
orada olmayan bir şey vaat edilmişti, burada olan bir şey saklanacak.

**Bildirimle ilgili yanlış bir cümle YOK** — ölçüldü, push açıklamada hiç
geçmiyor. Yani destek sayfasındaki hatanın eşi burada çıkmadı.

### Açıklama — İngilizce (1.0.4)

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
• Item by item — go down the receipt line by line and give each item
  to the people who actually had it.
Fractions are never lost; leftover cents are handed out fairly.

RECEIPTS
• Attach a photo of the receipt to an expense, from the camera or your
  library.
• Your phone reads the total off the photo and fills the amount in for
  you. The reading happens on the device — the photo is not sent
  anywhere for it — and an amount you typed yourself is never
  overwritten.
• Only the members of that group can see the photo.

THE ONES THAT COME BACK EVERY MONTH
• Rent, a subscription, the shared bill: set it up once and the expense
  appears on its own — weekly, monthly or yearly.
• Pause it or stop it whenever you like.

WHEN THE NUMBER IS NOT THE WHOLE STORY
• Leave a comment on any expense — what it covered, who is still
  missing, whatever the amount alone does not say.
• Send a reminder to someone who owes you. The reminder never carries
  the amount.

ALSO
• Turkish and English.
• Light and dark themes.
• Two-step verification (authenticator app + backup codes).
• No ads, no in-app purchases, no tracking.

Owezy uses the data in your account only to run the app.
Privacy policy: https://owezy.net/privacy
```

### Açıklama — Türkçe (1.0.4)

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
• Kalem kalem — fişi satır satır geç, her kalemi gerçekten onu alanlara
  yaz.
Küsuratlar kaybolmaz; kalan kuruşlar adilce dağıtılır.

FİŞLER
• Harcamaya fişin fotoğrafını ekle: kamerayla çek ya da galerinden seç.
• Telefonun fotoğraftaki toplamı okuyup tutarı senin yerine yazar. Okuma
  cihazın üzerinde olur — fotoğraf bunun için hiçbir yere gönderilmez —
  ve kendi yazdığın tutarın üstüne asla yazılmaz.
• Fotoğrafı yalnızca o grubun üyeleri görür.

HER AY GERİ GELENLER
• Kira, bir abonelik, ortak fatura: bir kez kur, harcama kendiliğinden
  düşsün — haftalık, aylık ya da yıllık.
• İstediğin zaman duraklat ya da bitir.

RAKAMIN ANLATMADIĞI YER
• Harcamaya yorum bırak — neyi kapsadığı, kimin eksik kaldığı, tutarın
  tek başına söylemediği ne varsa.
• Sana borcu olana hatırlatma gönder. Hatırlatmada tutar yazmaz.

AYRICA
• Türkçe ve İngilizce.
• Açık ve koyu tema.
• İki adımlı doğrulama (kimlik doğrulayıcı uygulama + yedek kodlar).
• Reklam yok, uygulama içi satın alma yok, takip yok.

Owezy hesabındaki verileri yalnızca uygulamayı çalıştırmak için kullanır.
Gizlilik politikası: https://owezy.net/privacy
```

### Sürüm notu — 1.0.4 İngilizce

```
• The app has a new look, from the first screen to the last. Lines
  instead of boxes, more room to read, and colour used only where it
  carries meaning.
• You can split an expense item by item. Go down the receipt line by
  line, give each item to the people who actually had it, and the
  shares are worked out for you.
• Your phone can read the total off a receipt photo and fill in the
  amount. The reading happens on the device, so the photo is not sent
  anywhere for it, and an amount you typed yourself is never
  overwritten.
• Expenses that come back — rent, a subscription, the shared bill — are
  set up once and appear on their own. Weekly, monthly or yearly, and
  you can pause or stop them whenever you like.
• You can say something about an expense. Every expense now has its own
  comments, and the list shows how many there are.
• You can send a reminder to someone who owes you. The reminder never
  carries the amount.
```

### Sürüm notu — 1.0.4 Türkçe

```
• Uygulamanın görünümü baştan sona yenilendi. Kutular yerine çizgiler,
  okumak için daha çok yer, ve renk yalnızca bir anlam taşıdığı yerde.
• Bir harcamayı kalem kalem bölüşebiliyorsun. Fişi satır satır geç, her
  kalemi gerçekten onu alanlara yaz; paylar senin yerine hesaplanır.
• Telefonun fişin fotoğrafındaki toplamı okuyup tutarı yazabiliyor.
  Okuma cihazın üzerinde olduğu için fotoğraf bunun için hiçbir yere
  gönderilmiyor, ve kendi yazdığın tutarın üstüne asla yazılmıyor.
• Geri gelen harcamalar — kira, abonelik, ortak fatura — bir kez
  kurulup kendiliğinden düşüyor. Haftalık, aylık ya da yıllık; istediğin
  zaman duraklatabilir ya da bitirebilirsin.
• Harcamaya bir şey söyleyebiliyorsun. Artık her harcamanın kendi
  yorumları var, listede kaç tane olduğu görünüyor.
• Sana borcu olana hatırlatma gönderebiliyorsun. Hatırlatmada tutar
  yazmaz.
```

### Uygulama adı — TÜRKÇEYİ DE İNGİLİZCE GİBİ YAPMA KARARI (10 Eylül)

**Mekanizma ölçüldü:** ad **bölgeye göre değil DİLE göre** seçiliyor. Aynı
Türkiye mağazasında:

| Sorgu | Dönen ad |
|---|---|
| `itunes.apple.com/lookup?id=6805650395&country=tr&lang=tr_tr` | `Owezy` |
| `...&country=tr&lang=en_us` | `Owezy: Split Expenses` |

Yani telefonun dili Türkçe olan **Owezy** görüyordu, İngilizce olan
**Owezy: Split Expenses**. Türkçe ad tek başına hiçbir arama karşılamıyordu.

| | Eski | Yeni | Uzunluk |
|---|---|---|---|
| Türkçe ad | `Owezy` | `Owezy: Masraf Paylaşımı` | 23/30 |
| İngilizce ad | `Owezy: Split Expenses` | *(değişmiyor)* | 21/30 |

**"DOKUNMA" NOTU BİLEREK AŞILDI.** `CURRENT_TASK.md` Türkçe ad alanı için
"bir daha dokunma" diyordu; gerekçesi bu hesabın bir kez **kalıcı olarak**
isim kaybetmesiydi. O olay isim *değiştirmekten* değil uygulamayı
*kaldırmaktan* çıkmıştı — Apple'ın cümlesi "If you remove an app, you'll
lose ownership of the app name". Kullanıcı 10 Eylül'de açıkça değiştirmeye
karar verdi. Ad değişikliği bir **sürümle birlikte** gidiyor ve incelemeden
geçiyor; reddedilirse eskiye dönülebilir.

### Anahtar kelimeler — 1.0.4

Ad değiştiği için hesap yeniden yapıldı. **Ad ve altyazıda TAM olarak
geçen** kelimeler çıkarıldı, yerlerine yenileri kondu:

**ÖLÇÜT: kelime, ad ya da altyazının içinde BIREBIR geçiyor mu.** Türkçe
çekim bunu her zaman bozmuyor — ve bozup bozmadığı kelimeye göre değişiyor:

| Alandaki metin | Kelime | İçinde geçiyor mu | Karar |
|---|---|---|---|
| Owezy: Masraf **Paylaşımı** | `masraf` | evet | **çıktı** |
| Owezy: Masraf **Paylaşımı** | `paylaşım` | **evet** — sonek eklenmiş, gövde bozulmamış | **çıktı** |
| **Grup** **hesabı**, kolay **ödeşme** | `grup`, `ödeşme` | evet | **çıktı** |
| Grup **hesabı** | `hesap` | **hayır** — ünsüz yumuşaması, p→b | **KALDI** |
| Owezy: **Split Expenses** | `expenses`, `split` | evet | **çıktı** |
| **Group bills**, settled fast | `bills`, `group` | evet | **çıktı** |

`hesap` tek istisna: "hesabı" içinde `hesap` diye bir dizge **yok**.
Apple'ın Türkçe için gövdeleme yapıp yapmadığı doğrulanamıyor, o yüzden
gövdesi gerçekten kopan tek kelime bırakıldı.

| | Metin | Uzunluk |
|---|---|---|
| EN | `share,roommate,debt,travel,settle,tab,budget,flatmate,receipt,recurring,itemized,rent,dinner,trip` | 97/100 |
| TR | `hesap,borç,ev arkadaşı,tatil,bölüşme,fatura,harcama,fiş,tekrarlayan,kira,abonelik,yemek,ortak,market` | 100/100 |

### Tanıtım metni (promotional text) — ARTIK BOŞ DEĞİL

Boş bırakılmıştı. **Değişti, çünkü bu alan sürüme bağlı değil:**
açıklamayı ve sürüm notunu değiştirmek yeni bir gönderim istiyor,
tanıtım metnini değiştirmek istemiyor. Boş bırakmak, elindeki tek
esnek alanı hiç kullanmamak demekti. Sınır 170 karakter.

**Türkçe — 150/170**

```
Ev arkadaşlarıyla, yol arkadaşlarıyla ya da tek bir akşam yemeğinde: kim ne ödedi, kim kime ne kadar borçlu. Fişi fotoğrafla, tutarı telefonun okusun.
```

**İngilizce — 146/170**

```
Flatmates, road trips, one dinner: who paid what and who owes whom. Photograph the receipt and let your phone read the total. No ads, no tracking.
```

### Ekran görüntüleri — ÜRETİLDİ, İKİ DİLDE (10 Eylül)

`~/Desktop/owezy-1.0.4-ekran-goruntuleri/` — **20 dosya**: iki dil × iki
ölçü × beş görsel. Simülatörde (iPhone 14 Pro Max, iOS 26.5), açık temada.

```
tr/6.9-inch_1290x2796/   tr/6.5-inch_1284x2778/
en/6.9-inch_1290x2796/   en/6.5-inch_1284x2778/
```

**EKRAN GÖRÜNTÜSÜ DE YERELLEŞTİRME BAŞINA YÜKLENİYOR** — tıpkı açıklama
gibi. Türkçe vitrine Türkçe set, İngilizce vitrine İngilizce set.

| Dosya | Ne gösteriyor |
|---|---|
| `01-grup` | bakiye kartı, üç üye, "Hatırlat" / "Remind", harcama listesi |
| `02-tekrarlayan-uyeler` | kategori dağılımı, **Kira / Rent (aylık)**, üye bakiyeleri |
| `03-kalem-kalem` | **kalemler**: Pizza / Makarna / Tatlı — Pizza / Pasta / Dessert |
| `04-kalem-fis-yorum` | kalemler + fiş + **yorum**, tek karede |
| `05-dort-bolusum` | **dört bölüşüm türü**, "Bunu tekrarla", "Fiş ekle" |

**ÖLÇÜ TUZAĞI:** iOS 26.5 runtime'ı iPhone 14 Pro Max'i **1290×2796**
çiziyor, o cihazın gerçek 1284×2778'ini değil. Apple'ın tablosunda
1284×2778 **6.5" yuvasına**, 1290×2796 **6.9" yuvasına** ait — farklı
yuvalar. Mağazadaki mevcut üç görsel 1284×2778 olduğu için o set
küçültülerek de üretildi.

**VERİ UYDURULMADI, KURULDU.** Geliştirme veritabanındaki hiçbir grup
fotoğraflanabilir değildi (ya tek üyeli, ya boş, ya "Aksa"/"I tell" gibi
deneme kalıntısı). İki grup kuruldu — her dil kendi içeriğiyle, çünkü
İngilizce vitrinde "Kadıköy evi" ve "Akşam yemeği" yabancı durur:

| Grup | Para birimi | İçerik |
|---|---|---|
| `Kadıköy evi` | TRY | Market · Elektrik faturası · İnternet · Akşam yemeği (Pizza/Makarna/Tatlı) · Kira |
| `Flat share` | USD | Groceries · Electricity bill · Internet · Dinner (Pizza/Pasta/Dessert) · Rent |

USD kullanıldı çünkü `SUPPORTED_CURRENCIES` ikisini de taşıyor
(`src/lib/money.ts`). Paylar en büyük kalan yöntemiyle yazıldı ve
veritabanının `SUM(shareAmount) = amount` kısıtı ikisini de kabul etti —
yani kuruşu kuruşuna doğru. `demo@owezy.net`'in görünen adı
`demo@owezy.net`'ten `Ahmet`'e çekildi; **yalnızca geliştirme
veritabanında**, üretime dokunulmadı.

## BİR SONRAKİ GÖNDERİM (1.0.5) — ŞİMDİDEN BİRİKEN

**Profil fotoğrafı** (Faz 47, ADR-054) 1.0.4 **gönderildikten sonra**
yazıldı, yani o sürümde yok. Bir sonraki build'e binecek ve o gönderimde:

- Açıklamaya girmesi gerekiyor mu? **Muhtemelen hayır** — profil fotoğrafı
  bir özellik değil, bir alışkanlık; açıklama zaten uzun. Karar
  gönderimde verilecek.
- **App Privacy ANKETİ KONTROL EDİLMELİ.** Fişler için "User Content →
  Photos" zaten beyan edilmişti; profil fotoğrafı **aynı kategoriye**
  düşüyor, yani beyan muhtemelen olduğu gibi doğru. Ama *muhtemelen*
  yetmez — panelde bakılacak.
- **Gizlilik politikası ZATEN GÜNCELLENDİ** (iki dilde): R2 artık iki tür
  fotoğraf taşıyor ve toplanan veri listesinde fotoğrafın *kendisi*
  yazıyor. Web'de yayında olduğu için gönderimi beklemiyor.

---

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
