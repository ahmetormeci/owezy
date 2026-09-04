# Değişiklik Kaydı

Kronolojik, kısa. Faz durumu için [PROGRESS.md](PROGRESS.md), kararların
gerekçesi için [DECISIONS.md](DECISIONS.md).

> Tarihler commit geçmişinden doğrulanabilen yerlerde kesindir. İlk fazların
> tarihleri commit sırasından türetilmiştir; gün kesinliği yoktur.

---

## 2026-09-04 (5) — CSV dışa aktarma telefonda

Destek sayfasındaki "yalnızca web'de var" maddesi kapandı. Uç zaten hazırdı
ve filtreyi izliyordu; eksik olan telefon tarafıydı.

**Düğme filtre satırında ve her zaman görünür** — web'de de öyle
(`expense-list.tsx`). Yeri bilinçli: dışa aktarma ekrandaki filtreyi izliyor,
süzülmüş bir liste dururken bütün grubu indirmek şaşırtırdı. Filtre paneli
mobilde varsayılan olarak kapalı olduğu için düğme panelin **içine**
konmadı; konsaydı filtrelemek istemeyen kullanıcı hiç bulamazdı.

**Dosya adı sunucudan okunuyor** (`lib/content-disposition.ts`), istemcide
üretilmiyor: iki ayrı kural zamanla ayrışırdı. Başlık iki biçim taşıyor,
gerçek adı yalnızca RFC 5987 (yıldızlı) olan taşıyor.

Yazarken kendi hatam yakalandı: önce dosya adını "temizleyen" geniş bir kural
yazılmıştı ve boşluğu, tireyi, hatta `.csv`'deki noktayı `_` yapıyordu — tam
da kaçınılmak istenen ayrışmayı üretecekti (`Deneme_-_2026-09-04_csv`). Kural
yalnızca yol ayıracına daraltıldı. Testin yakaladığı şey buydu.

**Dil hatası simülatörde çıktı.** Sunucu dili çerezden, yoksa hesaptan
okuyor; mobil çerez göndermiyor (ADR-029) ve arayüz **cihazın** dilini
gösteriyor. Sonuç: uygulama İngilizceyken Türkçe başlıklı dosya iniyordu.
Mobil artık o tek istekte `Cookie: locale=<dil>` gönderiyor — **sunucuda
hiçbir şey değişmedi**. Ayıraç da düzeldi: uç dile göre `;` / `,` seçiyor.

Bu çözüm ikinci denemeydi ve gerekçesi kayda değer. Önce uca isteğe bağlı bir
`locale` parametresi eklendi; değişiklik masum görünüyordu, hatta `cookies()`
çağrısını ikiden bire indiriyordu. Ama o hâliyle **E2E collaboration testleri
düzenli olarak düştü** — beş koşuda düştü, değişikliksiz üç koşuda geçti.
Diff satır satır incelendi, modül grafiği kontrol edildi (`i18n-server` zaten
aynı modülleri içe aktarıyor), bir mekanizma **bulunamadı**. Açıklanamayan bir
riski üretime taşımak yerine sunucuya hiç dokunmayan yol seçildi: çerez yolu
zaten var ve web onu kullanıyor. Çerez oturum taşımıyor, yalnızca sunum
tercihi; ADR-029 delinmiyor.

Simülatörde uçtan uca doğrulandı: paylaşım sayfası, dosya adı
`Deneme - 2026-09-04.csv`, BOM yerinde, içerik doğru.

---

## 2026-09-04 (4) — Bildirim zili başlığa taşındı; 1.0.1 hazır

Bildirimler mobilde grup ekranının **en altındaki bir karttaydı**. İşleyişi
doğruydu ama çok harcamalı bir grupta uzun bir kaydırmanın arkasında
kalıyordu: bildirim vardı, görünmüyordu. Web'de zil uygulama düzeyindeki
başlıkta, yani her sayfada — mobil de artık öyle.

**Bu uygulamanın ilk ikonu.** Görsel dil bugüne kadar tamamen tipografikti
(`Cap`, `→`, `·`, `▸`); `@expo/vector-icons` ilk ikon bağımlılığı. Bilinçli
tercih: "bildirim" için evrensel olarak tanınan işaret o, ve başlıktaki yer
bir kelimeyi taşımaya yetmiyor. Renk kobalt — ADR-015'e göre eylem rengi.

**Sayaç için paylaşılan bir kaynak gerekti** (`lib/unread.tsx`). Zil bir ekran
değil, başlığın parçası; odaklanacak ekranı olmadığı için `useFocusEffect`
işe yaramıyor. Onun yerine **adres değişimi** dinleniyor: kullanıcı nereye
giderse gitsin sayı tazeleniyor, bildirimler ekranından çıkıldığında da
kendiliğinden sıfırlanıyor.

**Simülatörde bakarken bir hata çıktı:** gruplar ekranının altında da bir
"Bildirimler" bağlantısı vardı ve zil gelince aynı yere iki yol açılmıştı.
Kaldırıldı. Kod okuyarak fark edilmezdi.

**Hesap kartı taşınmadı.** Tek gruplu kullanıcının hesabına ulaşmasının tek
yolu o (App Store 5.1.1(v), Faz 33). Taşınsaydı o kusur geri gelirdi.

**Soğuk açılışta doğrulandı** — asıl önemli durum bu: tek gruplu kullanıcı
`Redirect` ile doğrudan gruba düşüyor, geri düğmesi doğmuyor, ve zil
başlıkta duruyor. Açık ve koyu temada ayrı ayrı bakıldı.

**1.0.1 ayrıca iki şey taşıyor:** 2FA çerezi düzeltmesi (bir önceki kayıt) ve
`CFBundleLocalizations: ["en", "tr"]` — mağaza sayfası artık uygulamayı
yalnızca İngilizce göstermeyecek.

---

## 2026-09-04 (3) — Köprünün ilk hâli 500 veriyordu

Bir önceki kayıttaki köprü **çalışmadı**. Mağazadaki uygulama artık "Doğrulama
süresi doldu" yerine "Bir şeyler ters gitti" diyordu — mesajın değişmesi
doğru okumaydı: ilk hata gitmiş, yerine yenisi gelmişti.

Üretime karşı ölçüldü:

| İstek | Sonuç |
|---|---|
| Çerezsiz (köprü devrede değil) | 401, normal |
| **Öneksiz çerez (köprüyü tetikler)** | **500, gövde boş** |
| Önekli çerez (web'in gönderdiği) | 401, normal |

Gövdesi boş bir 500'ü mobil eşleyemiyor ve genel cümleye düşüyor. Web hiç
etkilenmedi.

**Sebep:**

```
TypeError: Cannot read private member #state from an object whose class
did not declare it        →  new Request(request, { headers })
```

Next rotaya kendi `NextRequest`'ini veriyor; undici'nin `Request` yapıcısı
girdiyi gerçek bir `Request` sanıp özel alanını okumaya çalışıyor. İstek artık
**parçalarından** kuruluyor (`url`, `method`, `headers`, `body`).

**Bu, düzeltilmeye çalışılan hatanın aynı sınıfıydı:** o satır düz Node'da
ölçülmüştü ve orada sorunsuz çalışıyor. Doğru şey ölçüldü, yanlış ortamda —
tıpkı çerez testlerinin geliştirme sunucusundan ölçülmesi gibi. Kural ADR-045'te
genişletildi: sunucu kodu sunucuda denenir.

**Bu sefer uçtan uca doğrulandı.** E2E altyapısı zaten 2FA kullanıcısı ve TOTP
üretmeyi biliyor; mağazadaki 1.0'ın ayrıştırıcısını birebir taklit eden bir
test yazıldı — gerçek imzalı çerez, önek düşürülüyor, geçerli TOTP ile
**200 + `set-auth-token`**. Ve geçen bir test tek başına bir şey kanıtlamadığı
için **negatif kontrol** yapıldı: köprü kapatılınca aynı test **401** veriyor.

Test suitede duruyor ama `skip` — öneki `NODE_ENV` tetikliyor ve E2E
geliştirme modunda koşuyor, yani varsayılan yapılandırmada hiçbir şey ölçmez.
Nasıl koşulacağı iki adım hâlinde testin başında yazılı; köprüyle birlikte
silinecek.

---

## 2026-09-04 (2) — 2FA açık kullanıcılar iOS uygulamasına giremiyordu

Yayından saatler sonra çıktı: 2FA açık bir hesap mobilde ikinci adımda
**"Doğrulama süresi doldu"** alıyor ve giriş yapamıyordu. Hata, kendisini bir
zaman aşımı gibi gösteriyordu; gerçek sebep çerezin **adıydı**.

Better Auth çerez adlarına https'te `__Secure-` öneki ekliyor. Bizim
yapılandırmamızda `baseURL` verilmediği için karar `NODE_ENV`'e kalıyor:

| Ortam | Çerezin adı |
|---|---|
| geliştirme, E2E | `better-auth.two_factor` |
| production | `__Secure-better-auth.two_factor` |

Mobil 1.0 çerezi `indexOf("better-auth.two_factor=")` ile arıyordu. Aranan
dize **önekli adın içinde de geçiyor** — arama "buluyor" ama dokuz karakter
geç başlıyor ve önek geride kalıyor. Sunucu adı birebir arıyor, öneksiz ada
düşen yedek yol yok; bulamıyor ve `INVALID_TWO_FACTOR_COOKIE` dönüyor.

**Sonucu ağırdı.** 2FA açık hesaplar e-posta koduyla da giremiyor (bunu
`better-auth.ts`'deki kanca bilerek engelliyor, yoksa ikinci faktör hiç
sorulmazdı). Yani parola → 2FA tek yoldu ve o yol kırıktı. Web etkilenmedi:
çerezi tarayıcı taşıyor, adını ayrıştıran kimse yok.

**Bu sürümde sunucu köprüsü.** `expo-updates` kurulu değil, yani mobil
düzeltmesi yeni build + App Review demek; mağazadaki 1.0 o süre boyunca kırık
kalırdı. `/api/auth/two-factor/verify-*` uçlarında öneksiz gelen çerez önekli
adla da yazılıyor. İmza doğrulaması yerinde — atlanan bir denetim yok. Ödünü
ve neden geçici olduğu ADR-045'te.

Çerez adı köprüde **sabit yazılmadı**; `auth.$context` üzerinden Better
Auth'a soruluyor. Adı tahmin etmek zaten bu hataya yol açtı. Yan faydası:
geliştirmede önek olmadığı için köprü orada kendiliğinden devre dışı kalıyor,
ayrıca bir ortam koşulu yazmak gerekmedi.

**Testler bu sınıfı yapısal olarak yakalayamaz.** Öneki tetikleyen şey
`NODE_ENV` ve E2E geliştirme modunda koşuyor — orada önek hiç oluşmuyor.
Mevcut birim testleri gerçek bir yanıttan ölçülmüştü, ama geliştirme
sunucusundan; ölçüm uydurma değildi, ayırt edici özelliğin bulunmadığı bir
ortamda alınmıştı. Kalıcı korumayı bu yüzden bir teste değil kurala bağladık
(ADR-045): ad ya birebir eşleşir ya kütüphaneye sorulur.

10 birim testi eklendi; sonuncusu mağazadaki 1.0'ın ayrıştırıcısını birebir
taklit edip zincirin tamamını kilitliyor. E2E 56/56 geçti.

**Mobil ayrıştırıcı da düzeltildi** (aynı gün, ayrı commit). Yeni kural
öneki *tanımıyor*; işaretten sola doğru geçerli çerez-adı karakterleri
boyunca genişliyor, yani adın nerede bittiğini biliyor. Ayırıcıya
dayanmadığı için `Expires=Wed, 09 Jun ...` içindeki virgül tuzak olamıyor.
Yan fayda: eski kod yalnızca ilk geçişe bakıyordu ve silme satırı önce
geldiğinde gerçek meydan okumayı kaçırıyordu.

Mobil testlere production biçimi eklendi (6 yeni). **Kalan: 1.0.1 build'i ve
sonrasında köprünün kaldırılması** — köprü erken kaldırılırsa güncellemeyi
almamış her telefon yeniden kırılır.

---

## 2026-09-04 — 1.0 App Store'da yayında

Apple onayladı: *"your app, Owezy: Split Expenses, has been approved for
distribution."* Uygulama hem Türkiye hem ABD mağazasında canlı.

| | |
|---|---|
| Türkçe | **Owezy** — `apps.apple.com/tr/app/owezy/id6805650395` |
| İngilizce | **Owezy: Split Expenses** — aynı `id`, `/us/app/owezy-split-expenses/` |
| Sürüm | 1.0 · 36 MB · iOS 16.4+ · 127 cihaz · Finance · 4+ |
| Bundle | `net.owezy.app` · trackId `6805650395` |

**İki adlı kimlik tuttu.** Faz 30'da alınan karar — Türkçe mağazada
`Owezy`, İngilizce'de `Owezy: Split Expenses` — mağazada görünür hâlde
duruyor; Türkçe açıklama da yerinde. Kilidin **yerelleştirme başına**
olduğu o zaman ölçülmüştü, doğru çıktı.

**Ret zincirinin sonucu.** 1.0 önce Guideline 2.1 ile reddedilmişti — hata
değil, yedi maddelik bilgi talebi. Cevabı hazırlarken uygulama içi hesap
silme eksiği çıktı (Guideline 5.1.1(v), Faz 33) ve mobil arayüz baştan
elden geçirildi (Faz 34). Yani ret, kapatılması gereken iki gerçek eksiği
görünür yaptı.

**Mağaza "yalnızca İngilizce" diyor — küçük ama gerçek bir kusur.**
`itunes.apple.com/lookup` dil alanında yalnızca `EN` dönüyor. Sebebi
`app.json`'da `CFBundleLocalizations` bulunmaması: Expo paketi tek bir
`en.lproj` ile çıkıyor. Uygulama tamamen iki dilli — çeviri JS tarafında,
bundle'da değil — yani **işleyiş doğru**, yanıltıcı olan mağaza
sayfasındaki "Languages" satırı. Düzeltmesi yeni build gerektiriyor; 1.0.1
adayı olarak `CURRENT_TASK.md`'ye yazıldı.

**Durum App Store Connect'e girmeden ölçülebiliyor:**

```
curl -s "https://itunes.apple.com/lookup?bundleId=net.owezy.app&country=tr&lang=tr_tr"
```

---

## 2026-09-02 — 1.0 yeniden gönderildi

Build 9 App Store Connect'e yüklendi, Apple'ın yedi maddelik bilgi talebi
cevaplandı ve sürüm yeniden incelemeye verildi. Gönderim zinciri
(build → push → submit → ekran kaydı → cevap) tamamlandı.

**Apple fiziksel cihaz istiyor.** Ret metninin birinci maddesi
"captured on a physical device" diyor. Bu oturumda önce bir simülatör
kaydı üretildi — Expo Go izi olmayan, kendi başına çalışan bir `preview`
build'iyle, production arka uca bağlı. Kayıt teknik olarak iyiydi ama
**maddeyi karşılamıyordu** ve kullanılmadı; kayıt kullanıcının iPhone
12'sinde (iOS 26.6.1) yeniden çekildi. Simülatör kaydı yine de işe
yaradı: senaryo olarak kullanıldı.

Cevap ve Notes metinleri yazıldı. İkisi de **4000 karakterle sınırlı**;
cevap ilk hâlinde 4383 karakterdi ve kısaltıldı.

---

## 2026-09-01 (5) — Giriş ekranı temaya bağlandı

Ekran uzun süre kendi hex değerlerini taşıyordu (`#fff`, `#111`, `#ddd`,
`#666`) ve `useTheme()`'i hiç çağırmıyordu. İki sonucu vardı:

**Koyu temada bozuktu.** Tema `useColorScheme()`'i dinliyor; bu ekran onu
sormadığı için bütün uygulama koyuya geçerken giriş ekranı beyaz kalıyordu.
Başlığın rengi de hiç verilmemişti. Yani estetik değil, gerçek bir kusur.

**Kimlikten kopuktu.** Düğme siyahtı, oysa eylem rengi her yerde kobalt.
Fark App Store ekran kaydı çekilirken görüldü: videodaki ilk kare
gerisinden başka bir uygulamaya benziyordu.

Alan etiketleri `Cap` bileşenine geçti — uygulamanın başka her yerinde öyle,
ve büyük harfe çevirme dile duyarlı (`toLocaleUpperCase`), yani "E-POSTA"
doğru çıkıyor. Yer tutucu rengi de hiçbir alanda verilmemişti, eklendi.

Ekran testleri bu değişikliği **yakaladı** (13/14 düştü): etiketler artık
büyük harf. Beklenen dizeler tahminle değil hesaplanarak güncellendi —
"İKİ ADIMLI DOĞRULAMA" noktalı İ taşıyor.

---

## 2026-09-01 (4) — Grup adı düzenleme ve uygulama içinden dil seçimi

**Grup adı ve açıklaması** telefondan düzenlenebiliyor. Ayrı ekran, çünkü iki
alan var ve açıklama çok satırlı. Şema paylaşılıyor (`updateGroupSchema`), yani
doğrulama kuralı sunucuyla aynı yerden geliyor ve mesaj alanlarında metin değil
**kod** var — sunucu dil bilmiyor. Kart yalnızca **sahibe** görünüyor; yetki
kontrolü yine sunucuda, ama yapılamayacak bir formu doldurtmanın anlamı yok.

`GET /groups/:id` `role`'ü baştan beri döndürüyordu; mobil tipi yine dardı.

**Ekran dönüşte tazelenmiyordu.** Simülatörde görüldü: ad "Tatil2026" olarak
kaydedildi, geri dönüldü, başlık hâlâ "Tatil" diyordu. Odaklanmada yalnızca
özet ve bildirim sayacı yenileniyordu; aynı açık üyeler ve bakiyeler için de
vardı. Artık beş sorgunun hepsi yenileniyor — web'deki karşılığı
`router.refresh()` ve o da hepsini çekiyor. Maliyeti görünmüyor, çünkü
`useApiGet` tazelenirken eldeki veriyi koruyor.

**Dil seçimi** Hesap ekranına geldi. Sıra: cihaz dili ile başla → cihazda
saklanmış seçim varsa ona geç → kullanıcı değiştirince ekrana, cihaza ve
sunucuya yaz. Açılışta `/me` beklenmiyor; beklemek ilk ekranı ağ turu kadar
geciktirirdi. Sunucudaki kayıt yine yazılıyor ve **web onu okuyor**
(`i18n-server.ts`: çerez → `User.locale`), yani telefondan yapılan seçim
web'de de geçerli.

Diller kendi dillerinde yazılıyor ("Türkçe" / "English"): İngilizce açılmış bir
ekranda Türkçe arayan kişi "Turkish" yazısını daha zor tanır.

---

## 2026-09-01 (3) — Bildirimler, ve tek gruplu kullanıcının kapatılmış yolu

Bildirimler mobile geldi — **uygulama içi liste**, push değil. Uçlar
(`GET /notifications`, `.../read`, `read-all`) web'deki zili besleyen uçların
aynısı ve hazırdı. Metin üretimi paylaşılıyor: `describeNotification` ve
`formatRelativeTime` saf ve `src/lib/notification-text.ts`'de.

**Zil yerine kart.** Web'de zil kalıcı bir çubukta duruyor; mobilde uygulamada
**hiç ikon yok** — ne bağımlılık ne de arayüzde tek bir örnek. Zil uygulamadaki
tek ikon olurdu. Yerine uygulamanın kendi dili: grup ekranında Cap etiketli
kart + sayaç, gruplar ekranında alt satır.

### Tek gruplu kullanıcı hesap ekranına ulaşamıyordu

Bildirimlere yer ararken çıktı ve **ölçüldü**: `index.tsx` tek grubu olanı
`Redirect` ile doğrudan grubun içine düşürüyor, `Redirect` yığını
**değiştirdiği** için geri düğmesi hiç doğmuyor, grup ekranında da hesaba giden
bir bağlantı yoktu (Faz 34'te "geri düğmesi karşılar" varsayımıyla
kaldırılmışlardı). Sonuç üç katmanlı:

- **Hesabını silemiyordu** — Faz 33 tam olarak App Store 5.1.1(v) için yapılmıştı
- Çıkış yapamıyordu
- Gruplar listesine, dolayısıyla **daveti kabul etmeye** ulaşamıyordu

Grup ekranının altına iki kart eklendi: BİLDİRİMLER ve HESAP.

### `Intl.RelativeTimeFormat` Hermes'te yok

Bildirim ekranı `undefined cannot be used as a constructor` ile çöktü; kaynağı
uygulamanın kendi hata ekranı gösterdi: `notification-text.ts`. Hermes'in Intl
desteği Faz 18.2'de ölçülmüştü ama `NumberFormat` ve `DateTimeFormat` için.

Çoğul biçimler sözlüğe taşındı (ADR-044). Çıktı **değişmedi** — eski Intl
çıktısı iki dil için ölçüldü ve yeni metinler birebir aynı. İngilizce
tekil/çoğul testleri eklendi.

### Ölçümle bulunan iki tasarım hatası

**Ekran bir kez yükleniyordu.** Diğer ekranlardaki "ilk odaklanmayı atla"
deseni buraya kopyalanmıştı ve yanlıştı: orada veri ayrıca mount'ta çekiliyor,
burada yükleyen tek şey oydu. Yeni bildirimler eklendikten sonra ekran hâlâ
"Henüz bildirimin yok" diyordu.

**Sonra noktalar kayboldu.** Odaklanmada tazeleme `read-all`'dan sonra yeniden
çekiyor ve kayıtlar okunmuş dönüyordu — yani "hangileri yeniydi" bilgisi, onu
göstermeye çalıştığımız anda siliniyordu. Artık ziyaret başında yeni olanların
kimlikleri tutuluyor.

---

## 2026-09-01 (2) — Telefondan gruba katılma

Davet **oluşturmak** telefonda vardı, **kabul etmek** yoktu. Koddaki gerekçe
"universal link kurulumu, onaylanmış Apple hesabı bekleniyor" diyordu; hesap
onaylandı ama universal link'in kendisi hâlâ üç şey birden istiyor
(`apple-app-site-association` dosyası, Associated Domains yetkisi, yeni build)
ve **Expo Go'da çalışmıyor** — yani simülatörde açılıp bakılamıyordu.

Bunun yerine yapıştırma yolu geldi: gruplar ekranında, grup oluşturmanın tam
eşi bir satır. Girdi hem tam bağlantıyı hem çıplak kodu kabul ediyor
(`mobile/lib/invite-link.ts`, 9 test). Universal link sonradan geldiğinde bu
ekran değişmez; derin bağlantı yalnızca alanı doldurur.

**Asıl yer ilk açılış ekranı**: davet edilen kişi giriş yaptıktan sonra tam
oraya düşüyor. "Henüz bir grubun yok" metni de artık iki yolu birden anlatıyor
— eskiden yalnızca grup oluşturmayı söylüyordu.

Simülatörde iki yol da görüldü: geçersiz kod "Davet linki geçersiz" veriyor,
geçerli kod gruba katıp içine giriyor.

**Listeden çıkan iki madde.** Uçlar taranınca "mobilde kalanlar" listesindeki
iki maddenin mobil eksiği olmadığı çıktı: **ödeşme düzenleme** için hiçbir
yerde uç yok (web de yalnızca iptal edebiliyor, mobil bunu zaten yapıyor) ve
**silineni geri alma** ucu var ama web'de de arayüzü yok. İkisi de ürün
sınırı; ikisi de destek sayfasında zaten öyle yazılı.

---

## 2026-09-01 — Harcama listesi: tekrar temizlendi, mobile arama geldi

Kullanıcı listenin uzadıkça okunmaz hâle geldiğini söyledi; simülatörde
ölçüldü ve teşhis satır sayısı değil **tekrar** çıktı: dokuz harcamanın
ikincil satırında 43 karakterin 37'si dokuzunda da birebir aynıydı (aynı
tarih, aynı ödeyen).

Çizim kuralları `src/lib/expense-list-view.ts`'de toplandı — web ile mobil
aynı yerden okuyor:

- Tarih ve ödeyen yalnızca bir önceki satırdan **farklıysa** yazılıyor.
  Karşılaştırma **biçimlenmiş metin** üzerinde: ham güne bakmak, UTC'de aynı
  güne düşüp yerel saatte ayrı günlere düşen iki satırda yanlış gün
  okuttururdu.
- "Senin payın" tutarın aynısıysa yazılmıyor (satırın sağ ucunda zaten o
  sayı duruyor).
- Fiş satırında e-posta biçimindeki görünen ad "@" öncesine kısalıyor.
  Saklanan değer değişmiyor; üye listesi ve bakiyeler tam adresi gösteriyor.
- `groupByMonth` de buraya taşındı: mobildeki arama sonuçları da aya
  bölünüyor, ikinci bir kopya UTC gerekçesini taşımazdı.

Mobilde "senin payın" zaten hiç yoktu — eleme yer açınca eklendi.

**Mobile arama ve süzme geldi.** Web'in tek satırlık süzgeç çubuğu telefonda
bölündü: arama kutusu her zaman açık, kategori ve "yalnızca beni
ilgilendirenler" `FİLTRE` etiketiyle açılan panelde. Web'in kuralları
korundu — süzgeç açıkken ay katlama kapanıyor, ay ara toplamları yazılmıyor,
yerine sonuç sayısı ve toplamı çıkıyor. Sunucuda iş yoktu: uç `q`,
`category`, `mine` ve `matches`'i baştan beri destekliyordu.

CSV dışa aktarma mobilde yok (paylaşım sayfası ayrı bir bağımlılık); destek
sayfasındaki "bugünkü sınırlar" listesine yazıldı.

---

## 2026-08-29 (2) — Mobilde harcama düzenleme ve kategori

Eşit olmayan bölüşümlerin düzenleme kilidi kalktı; ayrım veri modelinden:
`EQUAL`/`PERCENTAGE`'ta tutar da değiştirilebiliyor, `EXACT`'te paylar mutlak
olduğu için yalnızca açıklama. Kilit gevşeyince ekrandaki uyarı ve destek
sayfası yalan oldu; ikisi de düzeltildi.

Harcama ekleme ekranına kategori seçimi geldi (yedi kategori). Seçilmezse
sunucu tahmin ediyor ve tahmin ekranda görünüyor.

Kullanıcının bildirdiği "Something went wrong" düzeltildi: ekran üç isteğin
hata durumunu ele almıyordu, boş form çizip sebebini söylemeden kaydetmiyordu.

---

## 2026-08-29 — Mobil arayüz elden geçiriliyor

Kullanıcı uygulamayı ilk kez açtı ve haklı bir şikâyette bulundu. Teşhis:
fiş tasarımı mobilde vardı, ama web'in grup sayfasındaki dokuz bloktan
yalnızca üçü çiziliyordu.

- `<Slot />` → `<Stack />`: ekranlardan geri dönülemiyordu, artık dönülüyor
- Grup ekranına ÖDEŞTİN mührü, kategori çubukları ve üye bakiyeleri geldi
- Harcama ekleme ekranı: kim ödedi, kimler paylaşıyor, bölüşme türü (iki adım)
- Açılış görseli yapılandırıldı (daha önce hiç yoktu)
- Üyeler ve ödeşmeler ekranlarındaki başlık tekrarları kalktı

Ayrıntı ve gerekçeler PROGRESS.md, Faz 34.

---

## 2026-08-28 (4) — Hesap silme

Apple 1.0'ı Guideline 2.1 (Information Needed) ile reddetti. Cevabı
hazırlarken gerçek bir eksik çıktı: **hesap silme yoktu** ve Guideline
5.1.1(v) onu zorunlu kılıyor.

`DELETE /api/v1/me`, `src/lib/account.ts`, mobilde yeni bir Hesap ekranı,
web'de bir onay penceresi. Silme soft: kişisel veri anonimleşiyor, üyelikler
kapanıyor, sahiplik en eski aktif üyeye geçiyor — **harcama ve ödeme
kayıtlarına dokunulmuyor**, yoksa grupta kalanların bakiyeleri bozulurdu.

ADR-031 uygulandı olarak işaretlendi; kararda değişen tek şey sahiplik
devrinin otomatik olması.

---

## 2026-08-28 (3) — Giriş ekranı otomatik doğrulanıyor

`app/sign-in.tsx` için 14 test (`jest-expo` + `@testing-library/react-native`).
Mobilde artık iki koşucu var ve sınır dizine göre: `lib/**` vitest'te,
`components/**` ve `app/**` jest'te (ADR-043). `npm test` ikisini birden
koşuyor.

En öğretici engel: **RNTL 14'te `render` ve `fireEvent` asenkron** — v13'te
senkrondu ve hata mesajı sebebi göstermiyor.

Üretim kodunda iki `testID` eklendi (parola ve iki adımlı kod alanları);
RNTL 14'te `UNSAFE_*` sorguları kaldırıldı ve o alanların görünür etiketi yok.

Altı mutasyonla doğrulandı, altısı da yakalandı.

---

## 2026-08-28 (2) — Mobil kodu artık lint görüyor

3745 satır hiçbir kural görmüyordu. `eslint-config-expo` kuruldu,
`mobile/eslint.config.js` yazıldı, CI'a adım eklendi.

İki ölçüm kayda değer. `npx expo lint` config üretmedi — `mobile/` içinde
yapılandırma olmadığı için ESLint kökünkini buluyor ve araç "zaten
yapılandırılmış" sanıyor. Ve `expo lint` gerçek bir hatada bile **0 dönüyor**,
o yüzden CI komutu `eslint . --max-warnings 0`.

İlk koşu dört şey buldu: `usePassword` adlı bir olay işleyicisi (React'te
`use` öneki kanca demek — `submitPassword` oldu), kullanılmayan bir import, ve
gerekçesiyle susturulan iki kanca kuralı.

---

## 2026-08-28 — Yeni kimlik işareti, ve adın nasıl çözüldüğü

`BrandMark` yenilendi: dolu iki parçalı daire yerine açık bir dış halka ve
içinde kısa bir yay. Claude Design'da altı tur sonunda seçilen `6a`.
Uygularken geometri değişti — tasarımdan geldiği hâliyle **16 pikselte** iki
yay birbirine yapışıyordu (`size-4` iki yerde kullanılıyor). İç yarıçap
`4` → `3.6`; net açıklık 0,80 pikselden 1,07 piksele çıktı. İkon
DEĞİŞTİRİLMEDİ.

Uygulama adı çözüldü ve sebebi beklediğimiz değildi. Apple'ın belgesi
"silince ismin sahipliğini kaybedersin" diyor — yani bekleyerek geri
gelmiyordu. Çözüm bir deneyden çıktı: **kilit yerelleştirme başına**. Türkçe
yerelleştirmede `Owezy` kabul edildi.

  Türkçe    Owezy                  · Grup hesabı, kolay ödeşme
  İngilizce Owezy: Split Expenses  · Group bills, settled fast

Türkçe ad alanına bir daha dokunulmayacak; gerekçesi PROGRESS.md'de.
Telefondaki ad `app.json`'dan geliyor ve değişmedi.

---

## 2026-08-27 (3) — Mobilde ilk otomatik testler

Mobilde **3745 satır kod ve sıfır test** vardı; CI kodun derlendiğine
bakıyordu, ne yaptığına bakan hiçbir şey yoktu. 53 test eklendi
(`cd mobile && npm test`, ~0,5 sn) ve CI'a bir adım olarak girdi.

Kapsam ölçümle belirlendi: yalnızca `react-native` import **etmeyen**
katman — `lib/api.ts`, `lib/auth.tsx`, `lib/session-store.ts`,
`lib/two-factor-cookie.ts`. En riskli mantık zaten orada: iki adımlı
doğrulamanın bütün durum makinesi. Ekranlar ve `components/*` dışarıda
(ADR-042).

`readChallengeCookie`, `lib/auth.tsx`'ten kendi modülüne (`lib/two-factor-cookie.ts`)
taşındı. Testler sekiz mutasyonla doğrulandı; sekizi de yakalandı.

**Yanlış bir yorum düzeltildi:** `verifySecondFactor` "başarılı ya da değil,
bu çerez bitti" diyordu ama erken `return` yüzünden başarısızlıkta çerezi
silmiyordu. Doğru olan koddu — yanlış kod giren kullanıcı parolasını baştan
girmemeli; kaba kuvveti sunucunun hız sınırı durduruyor (10 sn / 3 istek).

**Yan bulgu:** kökün eslint yapılandırması `mobile/**`'ı yok sayarken
gerekçe olarak `mobile/eslint.config.js`'i gösteriyordu — o dosya hiç var
olmadı, yani mobil kodu hiçbir lint görmüyor. Yorum düzeltildi, boşluk
PROGRESS.md'ye aday olarak yazıldı.

Gönderilen ikiliğe dokunulmadı: `expo export` çıktısı aynı, yeni derleme
gerekmiyor.

---

## 2026-08-27 (2) — Kullanıcının bulduğu iki şey

İkisini de **kullanıcı buldu**, ikisi de aynı aileden: bir zamanlar doğru
olan bir ölçüm eskimişti.

### Kayıt formu örnek isim olarak uygulamanın sahibinin adını gösteriyordu
`ui.display_name_placeholder` sözlükte harfi harfine `"Ahmet Örmeci"`
yazıyordu; yani kaydolan herkes örnek olarak onu görüyordu. İngilizcesi
baştan beri `"Alex Doe"` — kurgusal olduğu belli. Türkçesi artık
`"Ayşe Yılmaz"`.

### Avatar hiçbir zaman yüklenemezdi, kırık bir kutu gösteriyordu
Kullanıcı kendi hesabında ve demo hesabında kırık görsel kutusu gördü. İki
sebep üst üste geliyordu:

1. `avatarUrl` ve `hasImage`'i **yazan hiçbir kod yok** — o değerler Clerk
   devrinden kalma ve Clerk örneği 25.7'de söküldü.
2. Sökülmeseydi bile CSP geçirmezdi: `img-src 'self' data: blob:`, yani
   **uzak adresli hiçbir görsel yüklenemiyor.**

`PersonAvatar` ise `hasImage && avatarUrl` görünce `<img>` basıyor, geri
düşüşü yoktu. Artık adres CSP'den geçemeyecekse **görsel hiç denenmiyor**,
doğrudan baş harfe düşülüyor. Kontrol sunucuda: `onError` ile istemcide
yakalamak, önce kırık görseli göstermek ve üstüne avatar gösteren her
sayfaya JavaScript eklemek olurdu.

**ADR-039'un bir ölçümü çürüdü.** O karar `img-src`'i dar tutarken
*"veritabanında hasImage=true olan tek bir kullanıcı bile yok"* diye
ölçmüştü. Kullanıcının kendi hesabı öyle değilmiş. Karar değişmiyor — CSP
hâlâ dar — ama gerekçedeki cümle düzeltildi.

**Test kendi hatasını yakaladı:** ilk yazımda `//example.com/a.png` kabul
ediliyordu, çünkü o da `/` ile başlıyor — oysa protokol-göreli bir adres ve
tarayıcı onu dış sunucudan çeker. Dört birim testinden biri düştü ve kural
düzeltildi.

**Test:** 538 birim, 56 E2E.

---

## 2026-08-27 — E-posta koduyla giren kullanıcı parolasını kaybediyordu

App Store ekran görüntüsü için demo veri kurarken bir hesabın parolasının
kaybolduğu fark edildi. Dört adımda yeniden üretildi: parolayla kaydol,
e-posta koduyla gir, parola artık çalışmıyor. **credential hesap 1'den 0'a
düşüyor.**

Kütüphanenin hatası değil. `revokeUnprovenAccountAccess`,
`emailVerified: false` bir satıra e-posta koduyla ulaşıldığında o satırın
bütün hesap bağlarını siliyor — ve gerekçesi doğru: böyle bir satır, bağlı
erişimin posta kutusu sahibine ait olduğunun kanıtını taşımıyor. Biri
başkasının adresiyle kaydolup parola koyabilir; gerçek sahibi kendi koduyla
girdiğinde o parola çalışmaya devam etmemeli.

**Eksik olan bizim tarafımızdı:** e-postayı hiç doğrulamıyorduk, yani
parolayla kaydolan herkes kalıcı olarak "kanıtlanmamış" kalıyordu.

Artık kayıtla birlikte doğrulama kodu gidiyor, kayıt formunda atlanabilir bir
doğrulama adımı var, ve doğrulamayan kullanıcı güvenlik ekranında kalıcı bir
uyarı görüyor. Giriş doğrulamaya **bağlanmadı** — o, ADR-035'i (parolalı
yolun App Store inceleyicisini posta kutusundan bağımsız kılması) geri
açardı. Gerekçenin tamamı ADR-041'de.

Uyarı somut: *"Doğrulanmamış bir hesapta e-posta koduyla giriş yaparsan
parolan silinir."* Kullanıcı ancak kaybedeceği şeyi bilerek karar verebilir.

### Uygulama ikonu kılavuz çizgileriyle duruyordu
Simülatörde açılış ekranı görülünce fark edildi: `icon.png` kesikli merkez
çizgileri, kılavuz daireleri ve bir artı işareti taşıyordu — bitmiş bir ikon
değil, çalışma dosyası, ve App Store'a aynen gidecekti. Üstelik uygulamanın
kendi kimliğiyle alakasızdı. Yenisi uygulamanın kendi `BrandMark` SVG'sinden
üretildi, marka rengi `--brand` token'ından çözüldü (`#065ac0`), 1024×1024,
alfa kanalsız.

### Derleme ve gönderim hattı kuruldu
`eas.json` yazıldı; `EXPO_PUBLIC_API_BASE_URL` üretim profilinde
`https://owezy.net` olarak sabitlendi — o satır olmadan TestFlight'taki
uygulama `localhost:3000`'e bağlanmaya çalışırdı. İlk derleme bir bağımlılık
çakışmasında düştü (`react-native-worklets` 0.12 ile `expo-modules-core`
uyumsuz; `expo-router` reanimated'i joker yazdığı için npm en yenisini
seçmişti) — ikisi de sabitlendi ve derleme geçti.

**Test:** 534 birim, 56 E2E. Yeni test düzeltmesi kaldırılarak doğrulandı.

---

## 2026-08-26 (6) — İki adımlı doğrulama mobilde de yürüyor

Faz 27 bitti. 2FA açan bir hesap artık mobilde de girebiliyor: parola → ikinci
faktör (uygulama kodu ya da yedek kod) → içeri. Önceden bu hesap mobilde
**hiç** giremiyordu ve mesaj kullanıcıyı yapamayacağı şeye yönlendiriyordu —
e-posta kodu "parolanla gir" diyor, parola ise "bir şeyler ters gitti".

**Sunucuya tek satır eklenmedi.** Meydan okuma imzalı bir çerezle taşınıyor ve
mobil bilerek `credentials: "omit"` kullanıyor (ADR-038). O karar değişmedi:
çerez bir kez yakalanıp tam iki uca elle konuyor, yalnızca bellekte duruyor.
`Origin` de yalnızca çerez taşıyan çağrılara ekleniyor — her çağrıya koymak
`formCsrfMiddleware`'i tetikleyip bugün çalışan giriş akışını, biri
`EXPO_PUBLIC_API_BASE_URL`'i değiştirdiği gün kıracaktı.

`trustedOrigins`'e dokunulmadı, ve bu bir ölçümün sonucu: varsayılan liste
`BETTER_AUTH_URL`'i içeriyor, gönderdiğimiz `Origin` ise `apiBaseUrl()` — iki
ortamda da aynı adres. `CURRENT_TASK` 25.5'ten beri o adımı "yapılacak" diye
taşıyordu.

Parola kurtarma mobilde web'e yönlendiriyor; 2FA açma/kapatma web'de kalıyor.
"Bu cihazı hatırla" mobilde yok — hepsi ADR-040'ta gerekçeleriyle.

### Cihazda ölçmek, hiçbir testin görmediği bir hata buldu
Yedek kodlar büyük/küçük harfe duyarlı. iOS Safari ise metin girdilerinde ilk
harfi kendiliğinden büyütüyor: `pDHBX-yCqQf` sunucuya `PDHBX-yCqQf` olarak
gitti ve reddedildi. Kullanıcının göreceği şey "Kod doğrulanamadı" — doğru
kodu yazdığı hâlde giremeyen ve sebebini asla anlayamayan biri, üstelik tam da
"telefonumu kaybettim" yolunda. `autoCapitalize="none"` eklendi; Playwright'ın
`fill()`'i o davranışı taklit etmediği için testi bir akış değil **özniteliğin
kendisi** koruyor.

### İki hata kodu daha eşlendi
`INVALID_EMAIL` ve `PASSWORD_TOO_LONG` haritada yoktu. Birincisi kullanıcının
en sık yaptığı hata: e-postasını yanlış yazan herkes "Bir şeyler ters gitti"
görüyordu. Ayrı bir cümle aldı çünkü bu bir **biçim** hatası — "böyle bir
hesap yok" hâlâ ortak cümleye bağlı, yani hangi adreslerin kayıtlı olduğu
sınanamıyor.

**Test:** 534 birim, 55 E2E. Mobil tarafın otomatik testi yok (Playwright
web'e bağlı); doğrulama önce curl ile sunucu sözleşmesi, sonra iOS
simülatöründe gerçek akış olarak yapıldı.

---

## 2026-08-26 (5) — İki adımlı doğrulama web'de; parola kurtarma

2FA artık kullanılabilir: kullanıcı menüsünün içindeki güvenlik ekranından
açılıyor (QR + gizli anahtar + yedek kodlar + doğrulama), girişte ikinci adım
olarak soruluyor, "bu cihazı 30 gün hatırla" seçeneği var, yedek kodlar
yenilenebiliyor ve kapatılabiliyor.

**Kural ADR-040'ta:** 2FA açıksa giriş **parolayla** olur. Sebebi kütüphaneden
ölçüldü — `twoFactor` eklentisi ikinci faktörü bizim birincil giriş yolumuzda
(`/sign-in/email-otp`) hiç sormuyor.

### Bu karar bir kapıyı kapattı, aynı fazda yerine yenisi kondu
2FA'dan önce "parolamı unuttum"un çıkışı e-posta koduyla girmekti. 2FA açıkken
o yol kapalı — yani ekran olmasaydı, parolasını unutan bir 2FA kullanıcısı
hesabına **bir daha giremezdi**. Yedek kodlar kurtarmıyor: onlar *ikinci*
faktör, birincisi yine parola.

`/reset-password` geldi ve **sunucuya tek satır eklenmedi**: iki uç da
`emailOTP` ile zaten vardı, postası bizim `sendOtpEmail`'imizden geçiyor, konu
metni sözlükte hazırdı. Üstelik credential hesabı olmayan kullanıcıya onu
yaratıyor — yani aynı ekran "hiç parolam yok" durumunu da çözüyor.

### Parolasız kullanıcıya çalışmayan düğme gösterilmiyor
`/two-factor/enable` parola istiyor ve `allowPasswordless` kapalı kalmak
zorunda (açık olsaydı parolasız biri 2FA açar ve kendini tamamen dışarıda
bırakırdı). `GET /api/v1/me` artık `hasPassword` döndürüyor; güvenlik ekranı
"Aç" yerine "önce parola belirle" diyor.

### Yeni bağımlılık: `uqr` (bağımlılığı yok)
QR kodu için. `renderSVG` yerine `encode` kullanılıyor — dönen boolean
matristen `<path>` React içinde üretiliyor, yani `dangerouslySetInnerHTML`
yok. Güvenlik ekranı `next/dynamic` ile tembel yükleniyor: kullanıcı menüsü
her sayfada duruyor, QR üreticisinin her sayfanın paketinde olmasına gerek yok.

### Testler yazılırken bir boşluk çıktı
Better Auth'un `INVALID_PASSWORD` kodu hata haritasında yoktu: güvenlik
ekranının **en olası** hatası — parolayı yanlış yazmak — en anlamsız cümleyi
alıyordu ("Bir şeyler ters gitti"). Eklendi, kendi cümlesiyle ("Parola
hatalı." — "e-posta ya da parola hatalı" değil, çünkü o ekranda e-posta diye
bir alan yok).

**Test:** 534 birim, 55 E2E (11 yeni). E2E gerçek TOTP kodu üretiyor. **Dört
test düzeltme geri alınarak doğrulandı.**

---

## 2026-08-26 (4) — Faz 25 ve 26 canlıda; davet akışında bir hata

Göç `main`'e alındı (`069523e`) ve ~70 saniyede yayına girdi. Canlıda gerçek
isteklerle doğrulandı: güvenlik başlıkları yerinde, `x-clerk-*` ve
`x-powered-by` yok, `/api/webhooks/clerk` 404, `/privacy`'de Clerk geçen satır
sayısı sıfır. Şemanın sağlam olduğunu kanıtlayan kontrol: olmayan bir hesapla
giriş denemesi `401 INVALID_EMAIL_OR_PASSWORD` döndü — `User` tablosuna
gerçek bir sorgu.

### Davet linki, girişi olmayan biri için çalışmıyordu
Merge'den sonra **kullanıcı buldu**, ilk gerçek kullanımda. `/join/<token>`
ziyaretçiyi `/sign-in?redirect_url=...` adresine gönderiyor ama giriş formu o
parametreyi okumuyordu: giriş çalışıyor, kullanıcı ana ekrana düşüyor ve
"Gruba katıl" düğmesini hiç görmüyordu. Gruba katılmanın başka yolu yok.

25.4'te girmiş: Clerk'in `<SignIn />` bileşeni `redirect_url`'i kendisi
hallediyordu, kendi formumuzu koyduk ve davranış taşınmadı.

**Testler neden kaçırdı:** bütün davet testleri daveti *zaten girişli* bir
tarayıcıyla açıyordu. "Çıkışken tıkla → giriş yap → geri dön" yolunu hiçbiri
yürümüyordu. Artık yürüyen bir test var ve düzeltme geri alınarak doğrulandı —
üretimdeki belirtinin aynısıyla düştü.

**Parametre doğrulanıyor.** Olduğu gibi kullanılsaydı açık yönlendirme
açığı olurdu: kullanıcı **gerçek** owezy.net'te giriş yapar, sonra
saldırganın sayfasına düşürülür ve oradaki sahte forma bilgilerini yazar.
16 birim testi bilinen kaçış yollarını tek tek deniyor.

---

## 2026-08-26 (3) — Güvenlik başlıkları ve hız sınırı

### Giriş denemesi artık gerçekten sınırlı
Clerk bunu bizim için yapıyordu; 25.7'den beri iş bizde ve **yapılmıyordu.**
Better Auth'un sınırlayıcısı varsayılan olarak belleğe sayıyor, Vercel'de ise
her serverless örneği kendi belleğini taşıyor ve kısa ömürlü — sayaç sürekli
sıfırlanıyordu. Kural değil, **saydığı yer** yanlıştı. Artık veritabanına
sayıyor.

Doğrulandı: `/sign-in/email`'e dört istek → **401, 401, 401, 429**.

Sınır **her ortamda açık** (kütüphane yalnızca production'da açıyor): öyle
bırakılsaydı mekanizmanın ilk gerçek koşusu canlıda olurdu. E2E kurulumu
sınırın tavanına tam oturuyordu; çözüm sınırı gevşetmek değil, hazırlığın
kendi harcadığı sayacı silmesi oldu.

### Uygulamanın hiç göndermediği güvenlik başlıkları
Canlıya `curl -I` atıldı: Vercel yalnızca HSTS gönderiyordu, gerisi yoktu.
Eklendi: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`. `x-powered-by` kapatıldı.

`Referrer-Policy`'nin burada genel değil **somut** bir gerekçesi var: davet
linki bir sırdır (`/join/<token>`) ve adres çubuğunda durur.

### `/api/v1`'in yazma uçlarına kullanıcı başına bütçe
26.1 `/api/auth`'u kapattı; oturum açmış bir istemci `/api/v1`'e hâlâ
istediği kadar yazabiliyordu. En olası olay kötü niyet değil **kaçak bir
istemci**: bu kod tabanının gerçekten yaşadığı hata sonsuz bir render
döngüsüydü.

Anahtar kullanıcı, IP değil — her yazma ucu oturum istiyor ve IP operatör
ile NAT arkasında paylaşılıyor. Okuma uçları bilerek dışarıda.

**Tablo kendimizin olmak zorundaydı.** Better Auth kendi `RateLimit`
tablosunu buduyor ve eşiği yalnızca **kendi** pencerelerinden hesaplıyor;
bizim satırlarımız altımızdan silinir, sınır zaman zaman hiç uygulanmazdı.

**Kuralı bir yapısal test koruyor:** sınır 15 dosyaya elle kondu, on
altıncıda unutmak görünür hiçbir şey bozmaz — uç çalışır, yalnızca korumasız
olur. Test bir uçtan sınır kasten çıkarılarak doğrulandı.

Ölçüldü: 1–60 → 200, 61+ → 429.

### CSP — nonce'suz, ve bu bir karar (ADR-039)
Next 16'nın nonce yolu `proxy.ts`'i geri getiriyor (25.7'de bilerek silinmişti)
ve **her sayfayı dinamik render'a zorluyor**. Karşılığı ölçüldüğünde küçük
çıktı: kod tabanında tek bir `dangerouslySetInnerHTML` yok, yani her kullanıcı
metni zaten React'in kaçışından geçiyor.

Sıra kararın parçasıydı: önce `Report-Only` ile ana yüzeyler gezildi, sonra
zorlayıcıya çevrilip 43 E2E koşuldu — zorlayıcı modda bir ihlal *gerçekten*
bir şeyi bozar, Report-Only ise Playwright'ın bakmadığı bir konsola yazar.
Dev ile üretim aynı politikayı almadığı için (`'unsafe-eval'` yalnızca dev'de)
üretim derlemesi ayrıca yerelde koşuldu.

İki direktifin ölçülmüş gerekçesi var: `connect-src` Sentry'yi adıyla
taşıyor — `'self'` bırakılsaydı hata bildirimi sessizce kesilirdi — ve
`img-src` dar, çünkü `avatarUrl`'i yazan kimse kalmadı ve `hasImage=true` olan
tek bir kullanıcı bile yok.

---

## 2026-08-26 (2) — Clerk söküldü (hâlâ `better-auth` dalında)

### Kimlik doğrulamayı artık tamamen biz yapıyoruz
- **E2E önce taşındı, Clerk sonra söküldü** — sıra bilerek böyle. Kurulum
  Clerk'in tarayıcı SDK'sıyla giriş yapıyordu; tersi sırada 43 test birden
  düşer ve sökmeyi doğrulayacak hiçbir şey kalmazdı.
- E2E kurulumu yarı yarıya küçüldü: bot koruması, `window.Clerk.signIn`,
  sabit `424242` kodu ve `+clerk_test` adresleri gitti. Test kullanıcılarını
  **kurulum kendisi yaratıyor**, yani E2E veritabanı elle hazırlık istemiyor.
- Kimlik kapısı tek fonksiyona indi: `findCurrentUser`. `getOrCreateCurrentUser`
  ve onunla birlikte "lazy sync" (ADR-011), yarış için yazılmış `P2002`
  ele alması, webhook ve `clerk-sync` gitti. Hepsi Clerk'in kendi kullanıcı
  tablosunu tutmasından doğuyordu.
- `src/proxy.ts` **tamamen silindi**. Tek işi Clerk'in oturum bağlamını her
  isteğe eklemekti; hiçbir route'u korumuyordu — koruma her zaman
  `(app)/layout.tsx`'teydi ve orada kalıyor.
- `User.clerkId` ve `User.clerkUpdatedAt` sütunları düştü.

### ADR-007 karşılığını verdi
"Kimlik sağlayıcısı değiştirilebilir olmalı" diye yazılmıştı ve bir
varsayımdı. Sınandı: `Expense`, `Settlement`, `GroupMember`, `Notification` —
hepsi `User.id`'ye bağlıydı ve **hiçbirine dokunulmadı**. Göç tek bir
`ALTER TABLE "User" DROP COLUMN "clerkId"` ile bitti. `clerkId` her yere
foreign key olarak yayılsaydı, aynı iş veri modelini baştan yazmak olurdu.

### Gizlilik politikası yanlış olmuştu, düzeltildi
"Parolan bize hiç ulaşmaz; girişi Clerk yönetiyor" cümlesi 25.4'ten beri
doğru değildi: parola artık **bizim** sunucumuza geliyor, hash'lenip
veritabanımıza yazılıyor. Aynı cümle "toplamadıklarımız" listesinde de
duruyordu — bir gizlilik politikasındaki en kötü hata türü: tutmadığımızı
söylediğimiz bir şeyi tutmak. **Resend yeni bir veri işleyici** olarak
eklendi (giriş kodu e-postaları), Clerk listeden çıktı.

### Sökme bir boşluk açtı, aynı fazda kapatıldı
Görünen adı değiştirmenin tek yolu Clerk'in profil arayüzüydü. Kalksaydı,
e-posta koduyla giren birinin adı sonsuza kadar e-posta adresi olarak
kalırdı — üye listesinde, bakiyelerde, fişte. `PATCH /api/v1/me` artık
`displayName` de kabul ediyor; düzenleme başlıktaki kullanıcı menüsünde,
ayrı bir hesap ekranı açılmadan. E-posta hâlâ değiştirilemez ve bu kasıtlı.

### Ölçüm bir hatayı yakaladı
`prisma migrate diff` çıktısını okurken, bir yorumu düzenlerken `hasImage`
alanının kendisini de sildiğim görüldü. `tsc` bunu göremezdi: üretilmiş
Prisma client hâlâ eski tipi taşıyordu. Şema değişikliklerinde tek gerçek
kontrol, üretilen SQL'i okumak.

---

## 2026-08-26 (1) — `better-auth` dalı, `main`'e girmedi

Faz 25'in ilk beş adımı. Bu kayıt tek girişte toplandı çünkü adımlar bir
bütün olarak anlamlı ve hiçbiri henüz canlıda değil.

### Kimlik doğrulama Clerk'ten Better Auth'a taşınıyor
- **Kendi `User` tablomuz devralındı** (`modelName` + `fields`).
  `Expense`, `Settlement`, `GroupMember`, `Notification` yerinde kaldı ve
  `session.user.id` **doğrudan** bizim `User.id`'miz — ADR-007'nin taşıdığı
  `clerkId → User.id` eşlemesi ortadan kalkıyor. Yeni tablolar: `Session`,
  `Account`, `Verification`.
- **Tek seferlik kodu artık biz gönderiyoruz** (Resend). Gönderim
  beklenmiyor ve `after()` ile yapılıyor: beklemek kayıtlı/kayıtsız adres
  arasında ölçülebilir bir süre farkı yaratırdı, ve Vercel'de yalnızca
  "await etme" demek postanın hiç gitmemesi demek olabilirdi.
- **Kod e-postanın konusuna yazılmıyor.** Çoğu servis yazıyor; tam o yüzden
  yazmıyoruz — telefona yandan bakan biri kilit ekranında okuyabilir.
- `/sign-in`, `/sign-up` ve başlıktaki kullanıcı menüsü **bizim**.
  Clerk'in `<SignIn />`, `<SignUp />`, `<UserButton />` bileşenleri gitti.
  Sebep kozmetik değil: Clerk'in bileşenleri yalnızca **Clerk** oturumunu
  biliyor, Better Auth ile giren kullanıcıyı tanımıyorlardı.
- Hata metinleri: Better Auth'un **kodu** bizim mesaj kodumuza çevriliyor
  (`lib/auth-errors.ts`, web ve mobil ortak). "Kullanıcı yok" ile "parola
  yanlış" **aynı** cümleye bağlandı — ayırmak, hangi e-postaların kayıtlı
  olduğunu tek tek sınamaya izin verirdi.
- **Mobil de yalnızca Better Auth konuşuyor** (ADR-038). İstemci kütüphanesi
  kullanılmadı: paketin oturum makinesi `localStorage`,
  `document.visibilitychange` ve `navigator.onLine` üzerine kurulu ve
  React Native'de `window` tanımlı ama bu üçünün hiçbiri yok. Desteklenen
  RN yolu (`@better-auth/expo`) ise çerez tabanlı ve ADR-029'un Bearer
  sözleşmesini bozardı.
- **Geçersiz belirteç artık uygulamayı kilitlemiyor:** `/api/v1` 401 +
  `auth.not_signed_in` dönünce mobil oturumu bırakıyor. Clerk'te
  gerekmiyordu — SDK kısa ömürlü JWT'yi kendisi yeniliyordu.

### Ölçüm dokümanı üç kez yalanladı
- Better Auth'un id üreteci **UUID değil**; sütunlara güvenseydik ilk
  `INSERT` patlardı.
- `prisma migrate diff` çıktısı **olduğu gibi alınamıyor**: her seferinde
  `descriptionFold`'un `DEFAULT`'unu düşüren bir satır üretiyor ve o kolon
  `GENERATED ALWAYS ... STORED` (ADR-024). Arama katlaması bozulurdu.
- `@better-auth/cli` **eski bir sürümün** şemasını üretti ve `Account.issuer`
  atlandı; kayıt formu ilk gerçek denemede düştü. Şema artık
  `getAuthTables()` çağrılarak doğrulanıyor.
- **CSRF'i tetikleyen şey "Origin yok" değil, "çerez var"** — ve React
  Native'in `fetch`'i varsayılan olarak çerez tutuyor. `credentials: "omit"`
  yazılmasaydı mobil giriş **bir kez** çalışır, sonra 403 verirdi.

### Eşlenmeyen hatalar artık iz bırakıyor
Kayıt formu düştüğünde kullanıcı "Bir şeyler ters gitti" görüyordu ve
**geriye hiçbir iz kalmıyordu**; teşhis elenerek ilerlemek zorunda kaldı.
Kullanıcıya gösterilen cümle yine genel, ham hâli konsola düşüyor.

---

## 2026-08-25 (6)

### Mobilde ikinci faktör (ADR-036)
- **Neden gerekliydi:** giriş ekranı `"complete"` dışındaki her durumda
  kullanıcıyı web'e gönderiyordu. 2FA açıldığı anda, 2FA'yı etkinleştiren
  her kullanıcı **mobilden kilitlenirdi**.
- Yeni adım `components/second-factor.tsx`'te. Üç yol: **authenticator
  (TOTP)**, **e-posta kodu** (Device Trust burada), **yedek kod**.
- Hangi faktörün kullanılacağını **sunucu söylüyor**
  (`supportedSecondFactors`), biz tahmin etmiyoruz.
- **SMS dalı bilerek yazılmadı** — SMS örnek genelinde kapalı; test
  edilemeyen bir yolu yazmak çalıştığını sanmak olurdu.
- `describeError` → `lib/clerk-errors.ts`'e taşındı (iki dosya kullanıyor).
- "Başa dön" artık `signIn.reset()` de çağırıyor: yarım kalan doğrulama
  Clerk tarafında duruyordu.
- **Simülatörde uçtan uca doğrulandı:** e-posta kodu → ikinci faktör ekranı
  → gerçek TOTP koduyla giriş; ayrıca "yedek kod kullan" → gerçek yedek
  kodla giriş. Kod üreteci RFC 6238'in altı test vektörünü geçti.
- **Device Trust dalı SINANMADI:** o parolayla girişte tetikleniyor.

### Çıkış yapmak gerçekten çıkış yapıyor
İki ayrı hata birlikte "çıkış düğmesi çalışmıyor" görüntüsü veriyordu.
İkisi de Faz 21'de düzeltilen "çıkışta donan uygulama" hatasının aynı
ailesinden — o zaman `/` düzeltilmiş, gerisi geride kalmıştı.

- **Belirteç Keychain'de kalıyordu.** `lib/token-cache.ts`, Clerk'in
  `TokenCache` arayüzündeki **opsiyonel** `clearToken`'ı uygulamıyordu;
  yazdığımız belirteci silen hiçbir şey yoktu. Opsiyonel olması "gereksiz"
  demek değil: bellekte tutan bir önbellek için gereksiz, **kalıcı yazan**
  her önbellek için zorunlu.
- **Ekranların oturum koruması yoktu** (ADR-037). Yalnızca `/` korunuyordu.
- **Ölçüldü, tahmin edilmedi:** düzeltmeden önce çıkış sonrası uygulama
  yeniden açıldığında hâlâ girişliydi; düzeltmeden sonra giriş ekranı
  geliyor ve yeniden açılışta da çıkmış kalıyor.

### Clerk MFA panelde açıldı — yalnızca development
- `authenticator_app` ve `backup_code` **development**'ta açık
  (`second_factors: ["backup_code","totp"]`), **isteğe bağlı**.
- **Production'da kapalı:** MFA Clerk'te **Pro** özelliği ($25/ay).
  Development'ta ücretsiz. Karar ADR-036'da.

---

## 2026-08-25 (5)

### Mobilde parolayla giriş (ADR-035)
- **Sebebi App Store incelemesi:** tek giriş yolumuz e-posta koduydu, bu
  da inceleyiciye **okuyabileceği bir posta kutusu** vermek demekti —
  gönderimin kaderi kontrol etmediğimiz bir posta sağlayıcısına bağlanırdı.
- **Birincil yol değişmedi.** Ekranda önce "Kod gönder"; parola ikincil
  bir bağlantının arkasında.
- **Web'de zaten çalışıyordu:** `e2e/global.setup.ts` test kullanıcılarını
  baştan beri parolayla girdiriyor. Eksik olan yalnızca mobil ekrandı.
- Parola sıfırlama eklenmedi: unutan kullanıcı e-posta koduyla girebilir.
- **Simülatörde uçtan uca doğrulandı:** çıkış → parolayla giriş →
  grupların yüklenmesi. iOS'un parola kaydetme teklifi de alanın doğru
  tanındığının kanıtı.

### Mobil giriş ekranı sözlüğe taşındı
- Bu ekran mobildeki **tek sabit metinli** ekrandı; yeni metin eklemek onu
  daha da bozardı. Metinlerin hepsi `messages.ts`'e taşındı (iki dilde) ve
  ekran artık `useTranslate` kullanıyor.
- `describeError` artık bilmediği bir hata şekli için **null** dönüyor;
  cümleyi çağıran taraf sözlükten koyuyor. Fonksiyon bileşenin dışında ve
  çeviriciye erişemiyor.
- Tamamlanmamış giriş durumları (`needs_second_factor`,
  `needs_client_trust`) artık ham durum adı basmıyor; kullanıcıyı
  **çalışan yola** — web'e — yönlendiren bir cümle gösteriyor.

### Device Trust engeli çıktı ve aşıldı
- Parola tek başına yetmedi: Clerk'in **Device Trust** koruması doğru
  paroladan sonra bile ek doğrulama istiyor (`needs_client_trust`) ve o
  doğrulama e-posta koduyla yapılıyor — demo hesap kilitleniyordu.
  Kullanıcının JSON'ı tanıyı kesinleştirdi: `password_enabled: true`,
  `two_factor_enabled: false`, `last_sign_in_at: null` — Clerk'in saydığı
  **üç koşulun üçü de** sağlanıyor.
- **MFA açmak kurtarmıyor:** o durumda `needs_second_factor` dönüyor,
  yani ikinci adımdan kaçılmıyor, adı değişiyor.
- **Çözüm kullanıcı bazında muafiyet:** demo kullanıcının
  `bypass_client_trust` alanı Backend API ile `true` yapıldı. Böylece
  **Device Trust herkeste açık kaldı** — parolayı yeni açtığımız gün
  kimlik doldurma korumasını kapatmak kötü bir takas olurdu.
- **Alan belgelenmemiş.** Çalışıyor ama sessizce bozulabilir ve sonucu bir
  sonraki incelemede inceleyicinin içeri girememesi olur. Her gönderimden
  önce doğrulama adımı ADR-035'e yazıldı.

## 2026-08-25 (4)

### Gizlilik politikası ve destek sayfası (Faz 22, ADR-034)
- `/privacy` ve `/support` eklendi. İkisi de **giriş gerektirmiyor**, iki
  dilde, karşılama sayfasından bağlantılı. Mağazaların ikisi de zorunlu
  tutuyor ve ikisi de yoktu.
- **Metin yazılmadan önce kod okundu.** Şema, Sentry ayarı, çerezler,
  üçüncü taraflar ve silme akışı doğrulandı; politikadaki her cümlenin
  karşılığı kodda var.
- **Silme dürüstçe anlatıldı:** ad ve e-posta siliniyor, harcama
  kayıtları anonim olarak kalıyor — sebebiyle birlikte. Bir E2E testi bu
  cümleyi bekçiliyor.
- **Şifreleme abartılmadı:** aktarımda TLS (`sslmode=require` +
  `channel_binding=require`, bağlantı dizesinden doğrulandı) ve
  barındırıcının disk şifrelemesi yazıldı. Alan bazında şifreleme
  yapmıyoruz ve yapıyormuş gibi yazmadık.
- Metin `messages.ts`'e **konulmadı**: o sözlük istemciye gidiyor.
  `src/content/legal/` altında `Record<Locale, LegalDocument>` tipiyle —
  eksik dil hâlâ derleme hatası.
- 6 yeni E2E testi. En önemlisi: sayfaların **oturum açmadan** açıldığını
  doğrulayan test.

### Dil değiştirince Clerk menüsü eski dilde kalıyormuş
- İngilizce kullanırken profil menüsü Türkçe görünüyordu — hem de
  **çıkış yapmaya çalışırken**, yani kullanıcının "bozuk mu?" diyeceği yerde.
- Sebep zaten `language-toggle.tsx` içinde YAZILIYDI: Clerk bileşenleri
  `localization` ayarını yalnızca mount olurken okuyor, `router.refresh()`
  sunucu ağacını yeniliyor ama mount olmuş Clerk arayüzü eski dilde kalıyor.
  Herkese açık sayfalarda `fullReload` ile çözülmüştü.
- **Yanlış olan varsayımdı:** yorum "uygulama içi sayfalarda Clerk arayüzü
  YOK" diyordu. O cümle, başlığa `<UserButton />` eklendiği gün sessizce
  geçersizleşmiş.
- `fullReload` bayrağı kaldırıldı; düğme artık **her yerde** sayfayı baştan
  yüklüyor. Bedeli istemci durumu (yarım form, açık pencere); dil değiştirmek
  nadir, yarısı çevrilmemiş arayüz ise her seferinde yanlış.

### Yol boyunca bulunanlar
- **`ui.back_home` sözlükte zaten vardı**; yeni bir tane eklerken fark
  edildi ve kopya geri alındı. TypeScript de yakalardı ama sözlükte
  arama alışkanlığı daha ucuz.
- **2FA açılırsa mobil giriş kırılır.** Mobil giriş ekranı Clerk'in
  `needs_second_factor` durumunu ele almıyor; ikinci faktör isteyen bir
  kullanıcı uygulamaya giremez. Yeni `@clerk/expo` API'si gerekli her
  şeyi veriyor (`mfa.verifyTOTP`, `verifyBackupCode`, ...). Sıradaki iş.

## 2026-08-25 (3)

### `@clerk/expo` geçişi (Faz 21, ADR-033)
- `@clerk/clerk-expo@2` → `@clerk/expo@4`. Deprecation uyarısı gitti ve
  asıl mesele olan **sürüm ayrışması kapandı**: web Core 3 kullanırken
  mobil Core 2'de kalmıştı.
- **`app.json`'a config plugin eklendi.** Eski pakette yoktu; yenisi iOS
  deployment target'ını ve Android paketlemeyi ayarlıyor. Yazılmasaydı
  derleme eksik yapılandırmayla çıkardı — ve bu ancak TestFlight'ta
  görünürdü.
- **`useSignIn`'in sözleşmesi değişti** ve `tsc` bunu yakaladı. Giriş
  ekranı yeniden yazıldı ve **kısaldı**: `create()` + faktör arama +
  `prepareFirstFactor` yerine tek `emailCode.sendCode()`; `setActive`
  yerine `finalize()`. Hatalar artık fırlatılmıyor, dönüyor.
- **Çevrimdışı artık hata fırlatıyor.** `getToken()` çevrimdışıyken
  `clerk_offline` atıyor; tek yerde (`use-api.ts`) yakalanıp
  `server.offline` koduna çevriliyor, böylece hiçbir ekran değişmeden
  düzgün mesaj gösteriyor.
- **Kendi token cache'imiz korundu** — hazır olanı kara kutu, bizimkinin
  yorumlarında gerçek kararlar yazılı.

### Çıkış yapan kullanıcının uygulaması donuyormuş
- `app/index.tsx` önce "yükleniyor mu", sonra "girişli mi" diye
  bakıyordu. Çıkış yapmış kullanıcıda istek hiç atılmıyor, dolayısıyla
  durum **sonsuza kadar** "loading" kalıyor ve giriş ekranına yönlendiren
  satır ölü koda dönüyordu. Sıra düzeltildi.
- **Göçün getirdiği bir hata değil** — `git diff` o dosyada yalnızca
  import satırının değiştiğini gösteriyor. Baştan beri oradaydı ve
  görünmemişti çünkü çıkış yapma yolu hiç denenmemişti. Göçü sınamak için
  çıkış yapınca ortaya çıktı.
- Aynı test `signOut()`'un yeni SDK'da çalıştığını da kanıtladı.

## 2026-08-25 (2)

### CI mobil tarafa da bakıyor (Faz 20)
- Mevcut işe dört adım eklendi: `npm ci`, `tsc`, `expo-doctor`,
  `expo export`. Ölçülen süreler 9 / 1 / 2 / 7 saniye.
- **Ayrı job değil**, çünkü mobil tip kontrolü kökün üretilmiş Prisma
  client'ına bağlı. **Koşullu da değil**, çünkü `src/lib`'deki bir
  değişiklik mobili kırabiliyor.
- **`expo-doctor` ilk koşuşunda gerçek bir şey buldu:** `ClerkProvider`
  `expo-web-browser`'ı koşulsuz `require` ediyor ama paket yalnızca
  dolaylı kuruluydu. Native derlemede autolinking bunu kaçırabilirdi —
  yani TestFlight'ta çökme. `expo-web-browser` ve `expo-auth-session`
  artık doğrudan bağımlılık.
- **İki kapının kırmızıya düşebildiği kanıtlandı**: bağımlılık geçici
  kaldırılınca doctor 1 döndü, bozuk import eklenince export 1 döndü.
- **Yayın derlemesi için not:** `EXPO_PUBLIC_*` pakete gömülüyor ve
  Metro'nun önbelleği env değişikliğini görmüyor — aynı komut,
  `.env.local` varken ve yokken aynı paket hash'ini üretti. CI `--clear`
  kullanıyor; TestFlight derlemesinde de kullanılmalı.
- Mobil lint eklenmedi (yeni devDependency ister, Faz 18'deki altı
  gerçek hatanın hiçbirini yakalamazdı).

## 2026-08-25

### Eş zamanlı düzenleme artık sessizce kaybolmuyor (ADR-032)
- **`Expense.version` sayacı eklendi.** Harcamayı okuyan sayacı da alıyor,
  yazarken geri gönderiyor; sunucu `WHERE id = ? AND version = ?` ile
  yazıyor. Arada başkası yazdıysa **409** dönüyor ve yazma hiç olmuyor.
- **Kontrol `WHERE` içinde, JS'te değil.** Read Committed'da okuma satırı
  kilitlemediği için transaction içinde karşılaştırmak eş zamanlı iki
  isteğin ikisini de geçirebilirdi. Kilidi Postgres yapıyor.
- **Sürüm zorunlu.** Göndermeyen istemci sessizce ezmeye devam ederdi.
  TestFlight'a sürüm çıkmadığı için kırılan yüklü uygulama yok.
- **Çakışmada kullanıcı ne yazdıysa duruyor** ve **neyin değiştiği**
  yazılıyor ("Tutar: 100,00 ₺ → 500,00 ₺"). Tekrar kaydetmek geçiyor —
  ama artık üzerine yazdığını bilerek. Locking üzerine yazmayı
  engellemiyor, **sessiz olmasını** engelliyor.
- **Karşılaştırma tek yerde**: `src/lib/expense-diff.ts` saf bir modül,
  mobil de aynı dosyayı içe aktarıyor.
- **Kapsam yalnızca harcama** (düzenleme + silme). Ödeşme, grup düzenleme
  ve geri yükleme bilerek dışarıda — gerekçeler ADR-032'de. Geri yükleme
  sürüm istemiyor ama sayacı **artırıyor**.
- **`updatedAt` kullanılmadı**: onu Postgres değil Prisma yazıyor, yani
  sunucunun saati; Vercel'de örnekler arası saat kayması bu kontrolü
  sessizce yanıltabilirdi.

### Yan düzeltmeler
- `apiRequest` artık **hata kodunu ve HTTP durumunu taşıyor**
  (`ApiClientError`). Önce düz `Error` fırlatıyordu ve kod yolda düşüyordu;
  form 409'u başka bir hatadan ayırt edemiyordu. `.message` aynı kaldığı
  için çağıran hiçbir yer değişmedi.
- `updateExpense` güncellenmiş satırı **iki kez okuyordu**; tek okumaya indi.
- DATABASE.md'nin migration tablosu **üç migration eksikti**, "3 migration
  uygulanmış" diyordu; sekizi de listelendi.

## 2026-08-24 (14)

### Ödeşme mobilde (Faz 18.8)
- **Fişe ödeşme planı geldi**, bakiyenin hemen ardında. Öneriye
  dokununca ödeme kaydı ekranı dolu açılıyor.
- **Ödemeler kendi ekranında**: kaydetme, geçmiş ve iptal birlikte —
  ayırmak, yanlış kaydedilen bir ödemenin görülememesi demekti.
- **Yön seçimi arayüzde**, çünkü "ödemeyi ancak taraflardan biri
  kaydedebilir" kuralını oraya taşıyor.
- **Yakalanan hata:** yön `/api/v1/me` gelmeden hesaplanıyordu.
  `useState`'in başlangıç ifadesi yalnızca ilk render'da çalışıyor, o an
  `currentUserId` null. "Sana ödenecek" önerisine dokununca ekran "ben
  ödedim" diye açılıyordu. Yön artık parametrenin adından okunuyor.

### Web'de de olan bir hata düzeltildi
- Ödeme iptali onayında `ui.cancel` ile `ui.cancel_settlement` yan yana
  duruyor ve **İngilizcede ikisi de "Cancel"** oluyordu — zıt anlamlı iki
  aynı düğme, yıkıcı bir işlemde. Etiket artık neyi iptal ettiğini
  söylüyor. Mobili yazarken web'de bulunan ilk hata.

## 2026-08-24 (13)

### Mobilde grup oluşturma ve davet (Faz 18.7)
- **Önce bir hata düzeltildi:** grup ekranındaki "Gruplarım" bağlantısı
  tek gruplu kullanıcıda hiçbir şey yapmıyordu — `/` adresi tek grupta
  gruba geri yönlendiriyor, yani bağlantı aynı ekrana çarpıp dönüyordu.
  Tek gruplu biri listeye, dolayısıyla "grup oluştur"a hiç ulaşamıyordu.
  **Giriş ile liste ayrıldı**: `/` yönlendirir, `/groups` her zaman
  listeyi gösterir.
- **Grup oluşturma satır içi** — ilk açılış ekranında ve listede aynı
  bileşen. İlk açılış artık yalnızca "grup oluştur" demiyor, sunuyor da.
- **Davet linki iOS paylaşım sayfasıyla** gönderiliyor; React Native'in
  yerleşik `Share` modülü, yeni bağımlılık yok.
- **Daveti kabul etme mobilde yok** — universal link kurulumu, o da
  onaylanmış Apple hesabı gerektiriyor. Davet edilen web'den katılıyor.
- **İki metin gerçeğe uyduruldu:** davet uyarısı "Sayfayı yenilersen"
  diyordu (telefonda öyle bir şey yok), ve tekrar paylaşma düğmesi
  "Davet linki oluştur" ile aynı adı taşıyıp farklı iş yapıyordu.

## 2026-08-24 (12)

### Silme metni gerçeğe uyduruldu
- Eskiden "Kayıt tamamen yok olmaz; gerekirse geri yüklenebilir" diyordu.
  `restore` ucu sunucuda var ama **onu çağıran hiçbir arayüz yok** — web'de
  de yok — yani kullanıcı geri alamıyordu. Metin olmayan bir şeyi vaat
  ediyordu.
- Artık: **"Bu işlem geri alınamaz."** Yıkıcı bir dokunuştan önce
  kullanıcının ihtiyacı olan tek bilgi bu. Yumuşak silme ve denetim kaydı
  bir uygulama ayrıntısı; o anda söylenmesi "o zaman nasıl geri alırım"
  sorusunu doğuruyordu.
- İki dilde de değişti. Davranış aynı: silme hâlâ yumuşak, kayıt hâlâ
  fiziksel olarak silinmiyor. Değişen yalnızca kullanıcıya söylenen şey.

## 2026-08-24 (11)

### Harcama düzenleme ve silme, mobilde (Faz 18.6)
- **Fişteki her satır bir detay ekranına açılıyor**, yalnızca kendi
  kayıtların değil. Bazı satırların dokunulabilir olması fişin
  tekdüzeliğini bozardı ve hangisinin hangisi olduğu bakınca
  anlaşılmazdı. Başkasının satırı salt okunur açılıyor — ve orada
  18.4'te kesilen **"senin payın"** bilgisi var.
- **Yalnızca eşit bölüşüm düzenlenebiliyor.** `EXACT`/`PERCENTAGE` bir
  harcamayı `EQUAL` olarak göndermek, kullanıcının kurduğu bölüşümü
  sessizce yok etmek olurdu. Ekran bunu yazıyor.
- Düzenlenebilen: açıklama, tutar, kim ödedi. **Tarih gönderilmiyor** —
  sunucu mevcut tarihi koruyor, yani düzenleme tarihi bugüne kaydırmıyor.
- **Silmede modal onay** kullanıldı (18.5'te doğrulama hataları için
  modal'dan kaçınılmıştı; geri alınamaz görünen işlemde kesinti istenen
  şeydir).
- **Aynı sonsuz döngü hatası ikinci kez çıktı**, bu kez kendi
  `useApiGet`'imizden. Kaynağında düzeltildi (`useMemo`) ve
  CONVENTIONS.md'deki kural genişletildi: sorun Clerk'e özgü değil, her
  render'da yeniden üretilen **her** değer için geçerli.

### Bulundu: silme metni olmayan bir şeyi vaat ediyor
- `ui.delete_expense_hint` "kayıt silinmiyor, gerekirse geri
  alınabilir" diyor. Ama `restore` ucunu kullanan **hiçbir arayüz yok** —
  web'de de yok. Yani kullanıcı geri alamıyor. **Metin de arayüz de
  değiştirilmedi**; ikisi de web'i etkilediği için karar bekliyor.

## 2026-08-24 (10)

### Satır içi harcama girişi mobilde (Faz 18.5)
- **Fişin son satırı artık bir giriş.** Eşit bölüşüm, ödeyen sen, tarih
  bugün; kategori gönderilmiyor, sunucu açıklamadan tahmin ediyor.
  Varsayımlar gizlenmiyor, yazmaya başlayınca altta yazıyor.
- **Toast yok:** hatalar satırın altında, başarının teyidi satırın fişte
  belirmesi. React Native'de toast, modal bir `Alert` ya da ek paket
  demekti.
- **Klavye:** `KeyboardAvoidingView`, simülatörde yazılım klavyesi
  açılarak doğrulandı.
- **`GET /api/v1/me` grup ekranına eklendi** — `paidById` iç kimliğimizi
  istiyor.
- **`useApiGet` artık tazelemede veriyi koruyor.** Harcama eklendikten
  sonra özet yeniden çekilirken bütün ekranın spinner'a düşmesi,
  uygulamanın en sık yapılan işinin ardından sayfayı kaybettirirdi.
- Doğrulama simülatörde uçtan uca: boş grupta ilk harcama, kategori
  tahmininin ipucuyla aynı kaydedilmesi, doğrulama hatası, klavye.

## 2026-08-24 (9)

### Fiş ekranı mobilde (Faz 18.4)
- **Teknikler ölçüldü, tahmin edilmedi.** Tek kullanımlık bir deneme
  ekranında yedi yol gerçek cihazda denendi. Sonuç: noktalı ayraç
  tekrarlanan `·` + `ellipsizeMode="clip"` ile, perfore
  `borderStyle: "dashed"` ile, yırtık kenar border üçgen hilesiyle.
  **`react-native-svg` gerekmedi.**
- **İki şey tahmin edilseydi yanlış çıkardı:** iOS'ta
  `borderStyle: "dotted"` sessizce düz çizgiye dönüyor (`dashed`
  dönmüyor), ve React Native'in `textTransform` özelliği dil bilmediği
  için Türkçe büyük harfte "SENİN" yerine "SENIN" üretiyordu. Büyük harf
  artık `toLocaleUpperCase(locale)` ile.
- **Kâğıt greni yok.** Web'de SVG filtresi; React Native'de karşılığı bir
  PNG döşemek olurdu ve %5 opaklıkta bir doku telefonda görünmüyor.
- **Sayfalama var ve test edildi.** Bir ayda 20'den fazla harcama varsa
  "daha fazla" çıkıyor; ara toplam her zaman ayın gerçeğini söylüyor
  ("25 EXPENSES"), 20 satır gösterirken bile. 25 harcamalık gerçek
  veriyle doğrulandı.
- Kapsam dışı: ödeşme planı, harcama başına "senin payın", satır içi
  giriş (18.5).

## 2026-08-24 (8)

### Mobilin girişi (Faz 18.3)
- **"Grup listesi ekranı" yapılmadı; onun yerine giriş kararı uygulandı.**
  `GET /api/v1/groups` bakiye döndürmüyor, yani liste ad + rol'den ibaret
  kalırdı — web'de "bomboş" diye reddedilen ekranın aynısı. Web'in çözümü
  ADR-016'ydı: **0 grup** → ilk açılış, **1 grup** → doğrudan grubun içi,
  **2+** → liste (varış değil, geçiş yüzeyi). Mobil aynı kuralı uyguluyor.
- **Grup ekranı iskeleti**: grubun adı ve kullanıcının bakiyesi. 18.1'de
  yazılan `GET /groups/[groupId]` ilk kez kullanılıyor.
- **Sözlük web ile ortak.** `@/lib/messages` mobilde de kullanılıyor, yani
  ADR-020'nin "eksik çeviri = derleme hatası" garantisi mobilde de geçerli.
  Cihazın dili `Intl` ile okunuyor — 18.2'de Hermes Intl'i ölçtüğümüz için
  ek paket gerekmedi. İki yeni anahtar eklendi (`ui.sign_out`,
  `ui.try_again`), her ikisi de iki dilde.
- **Renk paleti**: web tokenlarının hex karşılıkları `mobile/lib/theme.ts`'te,
  oklch'den hesaplanarak. Açık ve koyu tema.
- **Bulundu: web'in React bileşenleri mobilde çalışmıyor.** `i18n.tsx`'i
  import etmek iki React kopyası yüzünden düştü. Sağlayıcı mobile taşındı,
  sözlük paylaşılmaya devam ediyor. Kural CONVENTIONS.md'de.
- **Bulundu: bakiye biçimi ayrışıyordu.** Mutlak değer yerine web'le aynı
  `formatSignedMoney` kullanılıyor artık.

## 2026-08-24 (7)

### Mobil iskelet ayakta (Faz 18.2)
- **`mobile/` açıldı**: Expo SDK 57, expo-router, `@clerk/clerk-expo` 2.20,
  `expo-secure-store`. Bundle ID / paket adı **`net.owezy.app`** (kalıcı).
- **Oturum belirteci Keychain'de** (`expo-secure-store`), AsyncStorage'da
  değil — orası düz metin.
- **Giriş ekranı kendi ekranımız**: Clerk'in Expo tarafında web'deki
  `<SignIn />` dengi yok. E-posta + doğrulama kodu ile; development
  örneğinin `+clerk_test` kullanıcıları ve 424242 kodu burada da çalışıyor.
- **ADR-029'un dayanağı ölçüldü.** `src/lib/money.ts` mobil ekranda import
  ediliyor ve iOS paketinin **içinde doğrulandı** (`expo export
  --no-bytecode` çıktısında `formatBasisPoints`, `DEFAULT_LOCALE`, `₺`).
  Saf modüllerin kopyalanmadan kullanılabildiği artık varsayım değil.
- **Çalışma anı da ölçüldü.** Uygulama iPhone 17 Pro / iOS 26.5
  simülatöründe çalıştırıldı; `formatMoney` çıktısı web'in birim
  testlerinin pinlediği değerlerle birebir aynı (`1.234.567,89 ₺`,
  `$1,234,567.89`, `%33,33`). Hermes'in Intl desteği bizim
  kullandığımız kadarıyla V8'den ayrışmıyor.
- **Uçtan uca doğrulandı.** Simülatörde test kullanıcısıyla giriş
  yapıldı; `getToken()` çalıştı, `GET /api/v1/me` Bearer ile 200 döndü,
  ekranda kullanıcı adı ve paylaşılan modülün biçimlendirdiği tutar göründü.
- **Çalıştırırken gerçek bir hata yakalandı ve düzeltildi.** `useAuth()`
  her render'da yeni bir `getToken` döndürüyor; onu `useCallback`
  bağımlılığına koymak sonsuz döngü üretiyordu
  (`Maximum update depth exceeded`) ve giriş sonrası ekranı kilitliyordu.
  Hiçbir statik kontrol göstermedi — tsc temizdi. Kural CONVENTIONS.md'ye
  "Mobil" başlığı altına yazıldı.
- **`@clerk/expo` geçişi denendi, şu an mümkün değil.** Paketin
  yayınlanmış her sürümü `@clerk/shared@^4.30.0` istiyor; npm'deki en
  yeni sürüm 4.29.3. Sürüm sabitlemesiyle de aşılmıyor (zincir
  `@clerk/react` ve `@clerk/clerk-js` üzerinden aynı yere çıkıyor).
  Denendi ve geri alındı. Koşul sağlanınca tekrar denenecek:
  `npm view @clerk/shared version` 4.30.0'ı gösterdiğinde.
- **Bulundu: `@clerk/clerk-expo` deprecated.** Yerine `@clerk/expo`.
  Önemi sürüm ayrışması: web Core 3 (`@clerk/react@^6`), kurduğumuz
  paket Core 2 (`@clerk/clerk-js@5`). Geçiş kararı bekliyor.
- **Kök doğrulama korundu**: `tsconfig.json` ve `eslint.config.mjs`
  `mobile/`'ı dışlıyor; olmasaydı `tsc` ve `lint` React Native
  dosyalarını Next'in ayarlarıyla derlemeye çalışıp patlardı.
  `.gitignore`'daki `.env*` kalıbı `mobile/.env.local.example`'ı da
  yakalıyordu; o dosya sır içermiyor ve commit edilmek zorunda.

### Sign in with Apple: eklenmeyecek (şimdilik)
- Clerk'te **e-posta ile girişin açık olduğu doğrulandı**, yani Guideline
  4.8'in istediği alternatif mevcut. Risk sıfır değil ama reddedilmenin
  bedeli bir tur; şimdi eklemenin bedeli **her kullanıcı için kalıcı çift
  hesap riski** (Hide My Email adresi Google adresiyle eşleşmiyor).

### ADR-031'e sıralama düzeltmesi
- Clerk'teki "kullanıcılar hesabını silebilir" anahtarı **şu an açık** ve
  silme uçtan uca çalışıyor. ADR-031'in "kapalı tutulacak" ifadesi **son
  durumu** tarif ediyor: anahtar `DELETE /api/v1/me` yayına girene kadar
  açık kalmalı, yoksa çalışan tek silme yolu kaldırılmış olur.

## 2026-08-24 (6)

### API'nin iki eksik ucu (Faz 18.1)
- **`GET /api/v1/groups/[groupId]`** eklendi (daha önce yalnızca `PATCH`
  vardı) ve **`GET /api/v1/groups/[groupId]/expenses/[expenseId]`** eklendi
  (daha önce `PUT` + `DELETE` vardı).
- İkisi de yeni mantık getirmiyor: `getGroupForUser` ve `getExpenseForUser`
  zaten yazılıydı, web sayfaları onları doğrudan çağırıyordu. Yapılan iş o
  okumaları HTTP'ye açmak (ADR-002).
- Tek harcamanın gövdesi **bilerek** liste ucundaki `expenses[]` elemanıyla
  aynı — farklı bir şekil, mobil tarafta iki ayrı çözümleyici demekti.
- Birim testi 510 → 518.

### Hesap silme karara bağlandı (ADR-031)
- **Silme uygulama içinden, kendi ucumuzla** (`DELETE /api/v1/me`);
  Clerk'in kendi silme düğmesi kapalı kalacak. **Borcu olan da
  silebilecek** — uyarı gösterilir, engellenmez.
- İşin zor kısmının **zaten yazılı olduğu görüldü**: webhook'a bağlı
  `markUserDeletedFromClerk` anonimleştirme, sahiplik devri, üyelik
  kapatma ve grup arşivlemeyi yapıyor; bakiyelere dokunmuyor. Eksik olan
  tek şey tetik.
- Henüz uygulanmadı.

### Yayınlama kararı
- **Önce iOS, Android sonra** (ADR-030). Gerekçe: Google'ın kişisel
  hesaplara dayattığı "kapalı testte 14 gün" kuralı bir takvim kuralı,
  kodla hızlandırılamıyor; iki platformu paralel yürütmek yerine tek
  platformda tam bir dikey dilim çıkarılacak.
- **Mağaza gereklerinin envanteri** PROJECT.md'ye yazıldı (TestFlight
  kanalları, demo hesap zorunluluğu, Play'in 14 gün kuralı, kalıcı
  bundle ID, ilk AAB'nin elle yüklenmesi).
- **İki gerek kodu değiştirecek ve henüz karara bağlanmadı:** uygulama
  içinden hesap silme (Guideline 5.1.1) ve Sign in with Apple (4.8).

## 2026-08-24 (5)

### Mobil fazının zemini (Faz 18.0)
- **Mobil uygulama Expo / React Native ile yazılacak, aynı repoda
  `mobile/` klasöründe.** Gerekçeler ADR-029'da; kısası, saf modüller
  (bölüşüm, para aritmetiği, sözlük, kategori tahmini) ikinci kez
  yazılmıyor.
- **ADR-002'nin dayandığı varsayım ölçüldü.** Çerez taşımayan bir istemci
  `Authorization: Bearer` ile `/api/v1`'i çağırabiliyor: token yokken 401,
  token varken 200. Sonuç kalıcı bir E2E testine bağlandı — biri ileride
  çerez varsayan bir kontrol eklerse mobil sözleşme sessizce kırılırdı.
- **API envanteri çıkarıldı.** Mobilin ihtiyacı olan okuma uçlarının
  neredeyse tamamı zaten var; iki eksik bulundu (`GET /groups/[groupId]`
  ve tek harcamanın `GET`'i).

## 2026-08-24 (4)

### Bağımlılıklar ve Next 16.3.2
- **`npm audit`: 12 → 3 açık.** Önce `npm audit fix` (19 yama seviyesi
  güncelleme, `package.json` değişmedi), sonra **Next 16.2.11 → 16.3.2**.
- **Yükseltme `--force` ile değil, bilinçli yapıldı.** `npm audit fix --force`
  aynı açıkları kapatmayı öneriyordu ama yanında Prisma'yı 6.12.0'a
  düşürüyordu — majör bir geri gidiş.
- **Kalan üç açık bilerek duruyor:** üçü de Prisma'nın düşürülmesini istiyor.
  Hiçbiri çalışan uygulamaya ulaşmıyor.
- **Sürüm sabitlemesi korundu.** `npm install` başına `^` eklemişti; bu repo
  Next'i tam sürümle sabitliyor, çünkü CI ile yerelin aynı sürümde olması
  bilinçli bir karar.

## 2026-08-24 (3)

### Kategori artık açıklamadan anlaşılıyor (Faz 17)
- **"Market alışverişi" yazınca kategori Alışveriş oluyor.** Kategori
  gönderilmediğinde açıklamadan tahmin ediliyor; marka adları da tanınıyor
  (Migros, A101, Uber, Airbnb, Netflix...). Gerekçe ADR-028.
- **Tahmin gizli değil.** Formda açıklamayı yazarken seçim kutusu değişiyor,
  elle dokununca susuyor. Satır içi girişte ipucu satırı tahmini yazıyor.
- **Açık bir seçimi asla ezmiyor** ve düzenlemede hiç çalışmıyor.
- **Türkçe iki iş gerektirdi:** karşılaştırma katlama üzerinden (aksana ve
  büyük/küçük harfe duyarsız), ve ünsüz yumuşaması kural olarak koda yazıldı
  ("yemek" → "yemeği").
- **Tek kategorili kırılımda çubuk çizilmiyor.** Karşılaştıracak ikinci bir
  şey yokken çubuk bir şey anlatmıyor — aynı kural aylık grafikte zaten vardı.

## 2026-08-24 (2)

### Grup sayfası fiş oldu (Faz 16.1–16.3)
- **Grup sayfası artık bir fiş.** Noktalı ayraçlar, mono tutarlar, perfore ay
  çizgileri, çift çizgiyle kapanan toplamlar, yırtık alt kenar. Gerekçe
  ADR-027; kısası: 1-2 gruplu bir kullanıcıda eski düzen geniş bir boşluktu ve
  boşluk doldurularak değil kompozisyona çevrilerek çözülür.
- **Geçmiş aylar katlanıyor.** Açık ay tam, eski aylar tek satır
  (`TEMMUZ 2026 · 11 harcama … 2.340,00`). Katlı bir ay hiç sorgu atmıyor.
  Açılınca o ayın tamamı çekiliyor — ay içinde de sayfalama var, çünkü
  sessizce kırpılmış bir ay, başlığındaki toplamla çelişirdi.
- **Harcama sayfadan çıkmadan eklenebiliyor.** Fişin son satırı yazılabilir.
  Yalnızca en yaygın durumu yapıyor (eşit bölüşüm, sen ödedin, bugün) ve
  yazmaya başlayınca bu varsayımları söylüyor.
- **Harcama kaydedince artık o harcamanın AYINA dönülüyor.** Geçmiş bir aya
  harcama eklendiğinde o ay katlı olduğu için kayıt kaybolmuş görünüyordu.
  Yan fayda: belirli bir ayı açan bağlantı paylaşılabilir (`?month=2026-07`).
- **Özet bloğundaki tekrar temizlendi.** TOPLAM/PAYIN kutuları ve "bakiyen
  nasıl oluştu" denklemi kalktı; ikisi de fişte vardı.

### Uygulama artık grubunun içine açılıyor (Faz 16.4–16.5)
- **Tek grubu olan kullanıcı doğrudan grubuna giriyor.** Karşılama sayfası ve
  başlıktaki marka işareti oraya gidiyor. `/groups` erişilebilir kalıyor —
  "Yeni grup" orada duruyor ve yönlendirseydi ikinci grup hiç kurulamazdı.
- **Başlıkta grup değiştirici.** İki veya daha fazla grubu olanlar için açılır
  menü; tek grubu olanda düz metin. Başlıkta uygulama adı yerine artık
  hangi grupta olduğun yazıyor.
- **Boş grup fişi dürüstleşti.** Sıfırlarla dolu toplamlar, yanlış bir
  "Ödeştin" damgası ve süzülecek şey yokken duran filtre çubuğu kalktı.
  Yerine yazılmayı bekleyen üç solan çizgi geldi.
- **İlk ekran.** Hiç grubu olmayan kullanıcı artık çizginin altında gri bir
  cümle değil, ortalanmış ve nefes alan bir başlangıç görüyor.

## 2026-08-24

### Kendi alan adı ve production kimlik doğrulama (Faz 15)
- **Uygulama artık https://owezy.net adresinde.** Alan adı Squarespace'ten
  alındı, DNS Cloudflare'e taşındı, hosting Vercel'de kaldı. Cloudflare
  **proxy'siz** kullanılıyor; apex birincil, `www` ona 307 ile yönleniyor
  (ADR-026).
- **Clerk production instance devrede.** Faz 8'den beri development
  anahtarlarıyla çalışan uygulama artık `pk_live_` kullanıyor; cevaplardaki
  `dev-browser-missing` başlığı kalktı.
- **GitHub ve Google girişleri kendi OAuth uygulamalarımızla çalışıyor.**
  Development'ta Clerk'in paylaşımlı hesapları yetiyordu, production'da
  yetmiyor (ADR-026).
- **Webhook production instance'ta yeniden tanımlandı**
  (`https://owezy.net/api/webhooks/clerk`; `user.created`, `user.updated`,
  `user.deleted`).
- **Production veritabanı sıfırlandı.** Bütün veri tabloları boşaltıldı ve
  Clerk production kullanıcıları silindi — içerideki her kayıt açılış öncesi
  test verisiydi. `_prisma_migrations` korundu. Bu, "finansal kayıtlar
  fiziksel olarak silinmez" kuralının **istisnası değil**: o kural
  uygulamanın çalışma anındaki davranışını bağlar; buradaki, hiç kullanıcıya
  açılmamış bir veritabanının tek seferlik temizliğidir.
- **Uygulama adı SplitApp → Owezy.** Arayüzdeki isim tek yerden geliyor
  (`ui.app_name`, TR + EN), o yüzden değişiklik iki satır.

## 2026-08-13

### Açılış öncesi borç kapatma (Faz 14.1–14.5)
- **Zile tıklamak bildirimleri okundu sayıyor.** Elle basılan "tümünü okundu
  işaretle" düğmesi kalktı. Rozet anında sıfırlanıyor ama **mavi noktalar menü
  kapanana kadar duruyor** — okurken hangisinin yeni olduğunu görebiliyorsun.
  Okundu işaretleme listeden sonra gidiyor: istek patlarsa bildirimler
  okunmamış kalıyor ve bir dahaki açılışta yine görünüyorlar.
- **Türkçe arama düzeldi (ADR-024).** "Işık" yazan bir harcama artık "ışık"
  aramasıyla bulunuyor. Katlamayı veritabanı üretiyor
  (`Expense.descriptionFold`, `GENERATED ALWAYS`), yani kural tek yerde ve
  mevcut kayıtlar için backfill gerekmedi. Yan etki olarak arama **aksana da
  duyarsız**: "kahvalti" artık "kahvaltı"yı buluyor.
- **Bakiye ve özet toplaması SQL'e taşındı (ADR-025).** Grup sayfası artık
  grubun bütün harcamalarını okumuyor; dönen satır sayısı harcama sayısına
  değil **üye sayısına** bağlı. Para kuralı saf fonksiyonda kaldı — bir test
  SQL yolu ile bellek yolunun **aynı sonucu** verdiğini koruyor.
- `createGroup` ve `acceptGroupInvite` birim testleri geldi (13 test).
  Aralarında bir güvenlik iddiası var: davet ham token'la değil **hash'iyle**
  aranıyor.
- `globals.css`'ten kullanılmayan `--chart-1..5` paleti kaldırıldı ve **neden
  palet olmadığı** yazıldı.
- **Bildirimler 60 gün saklanıyor.** Önceden sonsuza kadar birikiyordu.
  Temizlik bildirim listesi okunurken yapılıyor (cron yok) ve `where`'de
  `userId` var — hem başkasının kaydına dokunmuyor hem de mevcut index'i
  kullanıyor. Bu, "finansal kayıtlar silinmez" kuralını çiğnemiyor: bildirim
  finansal kayıt değil, geçici bir işaret.

### CSV dışa aktarma (Faz 13.3b)
- Filtre çubuğunda **"Dışa aktar"** bağlantısı. Hedef "doğru CSV" değil,
  **Excel'de düzgün açılan CSV** — kullanıcının dosyayla yapacağı ilk şey onu
  Excel'de açmak.
- **UTF-8 BOM**, **dile bağlı ayraç** (`tr` → `;`, `en` → `,`) ve ayraçla
  **birlikte değişen ondalık ayracı**. İkisi ayrışırsa `120,50` değeri iki
  hücreye bölünür ya da Türkçe Excel tutarı metin sanar.
- **Para birimi başlıkta, hücrede değil** (`Tutar (TRY)`): simgeli bir hücre
  Excel'de sayı olmaz, toplanamaz. Tarihler ISO — belirsizlik yok, metin
  olarak sıralandığında kronolojik.
- **Dışa aktarma filtreyi izler, sayfayı izlemez:** eşleşen her kayıt iner,
  ekrandaki 20 değil. Sessizce kırpılmış bir mali dosya, yanlış bir toplamdan
  daha kötüdür. Filtre koşulu listelemeyle aynı fonksiyondan geliyor.
- E2E dosyanın indiğini değil **içeriğini** doğruluyor: BOM, başlık, ayraç ve
  noktalı virgül içeren bir açıklamanın tırnaklanması.

### Harcamalarda arama ve filtre (Faz 13.3a)
- Arama kutusu, kategori seçici ve **"yalnızca beni ilgilendirenler"**.
  Filtreleme **sunucuda**: ekrandaki 20 satırı süzmek, aranan kayıt sonraki
  sayfadayken "sonuç yok" demek olurdu.
- "Beni ilgilendiren" **katılımcılığa** bakıyor, ödeyene değil. Başkası adına
  ödeyip bölüşüme girmeyen kişinin bakiyesi değişir ama o harcama onun kendi
  harcaması değildir.
- **Filtre açıkken ay toplamları gizleniyor**, yerine `1 sonuç · 100,00 ₺`
  yazıyor. Süzülmüş bir listenin üstünde ayın tam toplamı, yan yana
  konularak söylenen bir yalan olurdu. Sonuç sayısı listenin **aynı**
  `where`'inden geliyor.
- **Türkçe arama sınırı ölçüldü ve belgelendi:** collation `C.UTF-8`, büyük
  `I` küçültülünce `i` oluyor — "Işık" yazan harcama "ışık" aramasıyla
  bulunmuyor. Diğer harflerde sorun yok. Düzgün çözümü (Türkçe katlama yapan
  üretilmiş kolon) ayrı bir iş; uydurma çözüm "ısı" ile "isi"yi eşleştirirdi.

### Grup sayfası: özet bloğu ve ay başlıkları (Faz 13.1 + 13.2)
- **Harcama listesi aylara bölündü.** Her ay başlığında o ayın toplamı ve
  harcama sayısı var. Toplam **özetten** geliyor, ekrandaki satırlardan
  değil: sayfa ilk 20 kaydı yüklüyor ve bir ay sayfa sınırını aştığında
  yüklenmişleri toplamak sessizce yanlış sonuç verirdi.
- **Yeni özet bloğu:** toplam / senin payın / harcama sayısı, aylık sütunlar,
  kategori kırılımı ve **bakiyenin açıklaması** — `ödediğin − payın (± ödemeler)
  = bakiyen`. Sayfadaki en büyük rakam bugüne kadar gerekçesiz duruyordu.
  Bir birim testi bu dört sayının `calculateBalances`'in verdiği bakiyeyle
  birebir aynı sonucu verdiğini koruyor.
- **Kategori kırılımı tek renk** (kobalt, karşılaştırmayı uzunluk yapıyor).
  Yedi kategoriye yedi renk ADR-021'i çiğnerdi; ayrıca dar ekranda pasta
  okunmaz, çubuk listesi okunur. Yüzdeler basis point, float yok.
- **Yeni sorgu eklenmedi.** `getGroupBalances` grubun bütün harcamalarını
  zaten okuyordu; okuma `loadGroupFinancials`'a taşınıp `cache()` ile
  sarıldı, bakiye ve özet aynı istekte tek sorgu paylaşıyor.
- `GET /api/v1/groups/[groupId]/summary` — mobil istemci aynı hesabı çağıracak.
- **Ekran görüntüsü bir hata yakaladı:** aylık sütunlar zemin rengiyle
  boyanmıştı ve açık temada görünmüyordu; tutar etiketi de kabın dışına taşıp
  kırpılıyordu. Düzeltildi. Tek aylık grafik artık hiç gösterilmiyor —
  karşılaştıracak ikinci sütun yokken bir şey anlatmıyor.
- **E2E artık düzen hatası da yakalıyor:** 390 ve 768 px'te yatay kayma
  ölçülüyor. 11.5'teki kayma ancak ekran görüntüsüyle yakalanmıştı.

### `middleware.ts` → `proxy.ts` (Faz 12.4)
- Next.js 16 dosya kuralını yeniden adlandırdı; **özellik aynı**. `git mv` ile
  taşındı, dosya geçmişi korundu.
- Belgede iki nokta çıktı: **Proxy Node.js runtime'ında** çalışıyor ve
  `runtime` config seçeneği burada **kullanılamıyor** (verilirse Next hata
  fırlatıyor). Dosyamız runtime belirtmediği için etkilenmedi.
- Dosyanın yorumu da düzeltildi. "Hangi route'ların giriş zorunlu kılacağını
  burada netleştireceğiz" yazıyordu; o karar alındı ve **tersi** yönde —
  koruma sayfada (`(app)/layout.tsx`), proxy hiçbir route'u korumuyor.
- Ölçüldü: dev sunucusu zamanlama dökümünde artık `proxy.ts` yazıyor,
  korumalı sayfa yönlendirmesi çalışıyor, tam E2E koşusu 28/28.

### Grup para birimi desteklenen listeye daraltıldı (Faz 12.3)
- `createGroupSchema`'daki `currency` artık `z.string().length(3)` değil,
  `z.enum(SUPPORTED_CURRENCIES)` (**TRY, USD**). Önceden API'den `JPY` ile
  grup açılabiliyordu; `JPY` sıfır ondalıklı olduğu için o gruptaki bütün
  tutarlar **100 kat küçük** görünürdü ve arayüz bunu hiçbir yerde belli
  etmezdi. Arayüzden ulaşılamıyordu (form `currency` göndermiyor).
- Liste `money.ts`'te, çünkü kısıtın sebebi orada: `formatMoney`/`parseMoney`
  iki ondalık basamak varsayıyor. **`formatMoney`'nin parametresi bilerek
  daraltılmadı** — veritabanında ne yazıyorsa onu göstermeli.
- `createGroup`'un girdi tipi de daraldı: şema çalışma zamanında, tip derleme
  zamanında eliyor.
- Yeni `group-schemas.test.ts` (6 test). Ölçüldü: dev ve E2E veritabanlarında
  yalnızca `TRY` var — daraltma hiçbir mevcut kaydı etkilemiyor.

### Clerk'in giriş/kayıt formu artık Türkçe (Faz 12.2)
- **`@clerk/localizations` (4.15.1) eklendi**, `ClerkProvider` Türkçe modda
  `trTR` alıyor. İngilizce için bilerek hiçbir şey gönderilmiyor: Clerk'in
  yerleşik varsayılanı zaten İngilizce, `enUS` göndermek 1444 metni boşuna
  RSC yüküne eklerdi. Tip `React.ComponentProps` ile prop'un kendisinden
  türetiliyor — `@clerk/types` doğrudan bağımlılık değil.
- **Doğrulama gerçek bir hata buldu:** Clerk `localization`'ı yalnızca
  başlarken okuyor, prop değişince mount olmuş formu güncellemiyordu. Dil
  düğmesine basan ziyaretçi yarısı Türkçe yarısı İngilizce bir ekran
  görüyordu. Herkese açık sayfalarda dil düğmesi artık tam yeniden yükleme
  yapıyor (ADR-023); uygulama içinde `router.refresh()` korunuyor, çünkü orada
  Clerk arayüzü yok ve açık pencereler/form içeriği korunmalı.
- Hesaba yazan `PATCH /api/v1/me` isteği `keepalive: true` aldı — yeniden
  yükleme uçuştaki isteği iptal ederdi ve tercih hesaba hiç yazılmazdı.

### Yüzdeli harcamayı düzenlemek artık yüzdeleri silmiyor (Faz 12.1)
- **`ExpenseParticipant.basisPoints` kolonu** (nullable) geldi: `PERCENTAGE`
  bölüşümde kullanıcının **girdiği** yüzde artık saklanıyor. Önceden yalnızca
  sonuç payları kaydediliyordu; düzenleme formu yüzde alanlarını boş açıyor ve
  sadece açıklamayı düzeltmek isteyen kullanıcıya bütün yüzdeleri yeniden
  yazdırıyordu — yaklaşık yazarsa paylar sessizce değişiyordu.
- **Kolondan önceki kayıtlar için `inferBasisPoints`:** paylardan yüzde geri
  hesaplanıyor, ama yalnızca aday yüzdeler `splitByPercentage`'a verildiğinde
  kayıtlı payların **birebir aynısını** üretiyorsa. İspat geçmezse alan boş
  kalıyor. Gerekçe ADR-022'de: fonksiyon kullanıcının yazdığını bulmaz,
  aynı payları üreten bir yüzde kümesi bulur — garanti ettiği tek şey
  "dokunmadan kaydedersen tutar değişmez".
- Yüzde **audit snapshot'ına** da girdi. `PERCENTAGE`'dan `EQUAL`'a geçen bir
  harcamada satırdaki yüzde temizleniyor ama `previousData`'da duruyor.
- `formatMoneyForInput` / `formatBasisPointsForInput`: form alanlarını
  dolduran metin artık **tam sayı aritmetiğiyle** üretiliyor (eskisi
  `String(amount / 100)` idi — para üzerinde float bölmesi) ve ondalık ayracı
  dile göre değişiyor. İngilizce kullanan biri kendi girdiği tutarı `120,50`
  olarak geri görmüyor.
- Kırılan dört birim testi düzeltildi (bütün nesneyi karşılaştırıyorlardı) ve
  yeni davranışın testleri eklendi. **428 birim / 28 E2E.**

## 2026-08-12

### Görsel dil: kalan sayfalar ve avatarlar (Faz 11.6, ikinci parça)
- **`Card` deseni tek bir yer dışında kalktı.** Gruplar listesi, üyeler,
  davet yöneticisi, harcama formu ve karşılama sayfası çizgi desenine geçti.
  `Card` yalnızca `/join/[token]`'da kaldı — boş bir sayfanın ortasındaki tek
  odak yüzeyi; orada kutu doğru eleman.
- `SectionHead` paylaşılan bileşene çıktı: aynı desen artık dört sayfada ve
  birinde 2px değişirse diğerleri onunla değişmeli.
- Gruplar listesinde her grup bir kart değil bir **satır**. Boş durum da
  kutudan çıktı — boş bir liste için kart çizmek, olmayan bir şeye yer
  ayırmak.
- Harcama sayfalarının başlıkları (`text-2xl`) yeni ölçeğe indi; ekran
  görüntüsüne bakınca fark edildi.
- **Avatarlar geldi** (`PersonAvatar`): fotoğrafı olan gerçek fotoğrafını,
  olmayan baş harfini görüyor.
- **Yeni kolon `User.hasImage`** (nullable). Sebebi: Clerk, fotoğraf
  yüklememiş kullanıcıya da bir `image_url` veriyor — kendi ürettiği baş-harf
  görseli. `avatarUrl` varsa basmak, fotoğrafı olanları gerçek yüzle,
  olmayanları **Clerk'in tasarımıyla** gösterirdi. Migration dev ve E2E
  veritabanlarına uygulandı; production push ile gidecek.
- `null` = "bilmiyorum": `has_image` taşımayan eski bir webhook olayında
  `false` yazmak "fotoğrafı yok" demek olurdu. Hesap silinince `avatarUrl`
  ile birlikte `null`'a çekiliyor — biri silinip diğeri `true` kalsaydı arayüz
  olmayan bir görüntüyü göstermeye çalışırdı.
- Avatar rengi **isimden türetiliyor**, veritabanında saklanmıyor: aynı kişi
  her ekranda aynı rengi alıyor, yeni kolon gerekmiyor. Doygunluk ve açıklık
  sabit, yalnızca ton değişiyor — daireler birbirinden ayrılıyor ama hiçbiri
  sayfadaki tek renk olan bakiye işaretiyle yarışmıyor.
- `next/image` yerine düz `<img>`: `next/image`, `img.clerk.com` için
  `next.config`'e `remotePatterns` ister; görüntüler küçük ve ölçüleri sabit.
- 410 birim (2 yeni) / 27 E2E. Dört test nesnenin tamamını karşılaştırdığı
  için kırılmıştı; düzeltmenin yanına `has_image`'in **üç durumunun**
  (`true` / `false` / hiç yok) doğru taşındığını doğrulayan testler eklendi.
- Herkese açık dört sayfa 390 ve 768 px'te ölçüldü: yatay kayma yok.

### Görsel dil: token'lar ve grup sayfası (Faz 11.6, ilk parça)
- **Token katmanı ADR-021'e göre yeniden yazıldı.** Nötr kroma 0,004–0,03'ten
  0,001–0,009'a indi (sayfa artık maviye çalmıyor); `--credit`/`--debt`
  doygunluğu 0,113/0,15 → 0,085/0,105; `--radius` 10px → 8px; gövde metni
  16px → 14px.
- **Zemin/panel ilişkisi tersine döndü.** Eskiden zemin renkli, kart saf
  beyazdı ve kart öne çıkıyordu. Şimdi zemin neredeyse beyaz, panel bir tık
  koyu ve ayrımı gölge değil **1 px kenarlık** taşıyor.
- **`money` artık mono.** Bu bir para uygulaması ve tutarlar bugüne kadar
  açıklama metniyle aynı yazı tipinde duruyordu. Geist Mono zaten paketteydi,
  ek maliyeti yok.
- Yeni `label` utility'si (bölüm başlıklarının tek biçimi) ve `--line-soft`
  token'ı. İkincisinin sebebi: liste satırlarını ayıran çizgi bölüm
  sınırlarıyla aynı ağırlıkta olursa liste bir tabloya dönüşüyor.
- Gövde boyutu `html` yerine **`body`**'de değişti; kök ölçeği değiştirmek
  rem tabanlı bütün boşlukları da kaydırırdı.
- **Grup sayfasından `Card` kalktı.** Bölümler küçük bir etiket ve altındaki
  çizgiyle ayrılıyor. Durum paneli ince kenarlıklı bir panel: geniş ekranda
  solda tutar, sağda öneriler, arada dikey çizgi.
- Ödeşmiş durumda rakam artık `0,00 ₺` yazıyor; "Ödeştin" alt satıra indi.
  Sayı üç durumda da kahraman kalıyor.
- **Düzeltilen mantık hatası:** öneri sütunu "Herkes ödeşmiş durumda" diyordu.
  Ama kullanıcının ödemesi bitmiş olup **grupta başkalarının borcu duruyor**
  olabilir. Artık ayrım var: grupta hiç transfer yoksa "herkes ödeşmiş",
  varsa "bu grupta açık hesabın yok".
- 408 birim / 27 E2E değişmeden geçti.
- **Bilinen sapma:** tutardaki para birimi sembolü rakamlarla aynı boyutta;
  onaylanan mockup'ta ayrı ve soluktu. `formatSignedMoney` tek metin
  döndürdüğü için sembol ayrı biçimlendirilemiyor.

### Grup sayfası hiyerarşisi (Faz 11.5)
- Altı eşit ağırlıklı bloktan **üç kademeli dört bloğa** inildi (ADR-016).
  Önceki düzende "Senin durumun" ile "Kaydedilen ödemeler" göze eşit
  önemdeydi; her şey aynı sesle konuşunca hiçbiri duyulmuyordu.
- **Durum paneli** kart olmaktan çıktı: tam genişlik, `text-display` rakam,
  işarete göre zemin. "Kime ödeyeceğim" de içine girdi — o, "ne kadar
  borçluyum"un ikinci yarısı ve ayrı bir kartta eşit ağırlıktaydı.
- **"Ödeme kaydet" başlıktan panele taşındı.** Başlıkta yalnızca "Harcama
  ekle" kaldı: gruba her gün yapılan şey o. Ödeşmek bakiyeye bağlı bir eylem.
- **Öneriler filtreleniyor:** panelde yalnızca beni içerenler. Grubun kalanı
  ikincil kademede ayrı bir kartta ve **boşsa hiç görünmüyor** — "Önerilen
  ödemeler: yok" diyen bir kart, olmayan bir işi varmış gibi gösterir.
- Satır metinlerinde **fiil başlığa taşındı** ("Ödemen gerekenler" /
  "Sana ödenecekler"), satır yalnızca isim + tutar.
  `"{name} kişisine {amount} öde"` şablonu Türkçede ek ister ve ek ismin son
  harfine göre değişir (*Ayşe'ye*, *Mehmet'e*, *Burak'a*) — yer tutucuyla
  doğru yazılamaz. İngilizcede sorun yok, Türkçede her isimde kumar olurdu.
- Üçüncü kademe geniş ekranda iki sütun, mobilde tek sütun.
- **Ekran görüntüsü gerçek bir hata yakaladı:** mobilde sayfa yatay kayıyordu
  (390 px viewport'ta belge 550 px). Grid çocuklarının varsayılan
  `min-width: auto` değeri, içeriğin min-content genişliğinin altına inmeyi
  reddediyor; uzun bir e-posta adresi sütunu zorla genişletiyor ve içerideki
  `truncate` hiç devreye giremiyor. Önceki düzende bu kartlar flex-column
  çocuğuydu, o yüzden sorun yoktu — hata `md:grid-cols-2` ile geldi. İki
  `min-w-0` çözdü. **E2E bunu yakalayamazdı:** testler metnin varlığına
  bakıyor, sayfanın kaydığına değil.
- 408 birim / 27 E2E değişmeden geçti (grup sayfası 11 testin uğrağı).

### Dil tercihi hesapta da saklanıyor (Faz 11.4d-2)
- `User.locale` kolonu eklendi — **nullable ve varsayılansız**.
  `@default("tr")` mevcut her kullanıcının Türkçe *seçtiğini* iddia ederdi;
  `null` = "tercih belirtmedi" ve bu gerçek bir bilgi.
  Migration tek satır, tablo yeniden yazılmıyor.
- `PATCH /api/v1/me` — gövde `{ locale }`, Zod ile doğrulanıyor. Desteklenen
  diller `SUPPORTED_LOCALES`'ten okunuyor, şemaya elle yazılmıyor: üçüncü dil
  eklendiğinde şema sessizce eski kalırdı.
- Okuma sırası **çerez → hesap → `tr`**. Çerez "bu cihazda, şu an" cevabı;
  hesap önce gelseydi kullanıcının o cihazda yaptığı seçim her yenilemede
  geri alınırdı.
- **Sorgu maliyeti sıfırlandı.** Naif uygulama her isteğe bir sorgu eklerdi:
  çerezi olmayan giriş yapmış kullanıcı = düğmeye hiç basmamış herkes.
  `getOrCreateCurrentUser`'ın okuma adımı `cache()` ile sarılı
  `findCurrentUser()`'a taşındı; `getLocale()` ile `(app)` layout aynı
  istekte aynı satırı tek sorguda paylaşıyor.
- **`getLocale()` kullanıcı kaydı OLUŞTURMAZ.** `getOrCreateCurrentUser()`
  yan etkili; kök layout her istekte çalıştığı için onu çağırmak karşılama
  sayfasının render'ının kullanıcı satırı üretmesi demek olurdu. Ayrı bir
  test bunu koruyor.
- Hesaptan gelen değer de `normalizeLocale()`'den geçiyor: kolon `String` ve
  veritabanına elle bir şey yazılmış olabilir.
- Düğme çerezi yazıp `router.refresh()` çağırdıktan **sonra** PATCH'i arkada
  gönderiyor; beklemek arayüzü bir ağ isteği boyunca duraklatırdı. Hata
  yutuluyor (çıkışta 401 normal), konsola düşüyor.
- **Yeni E2E testi asıl boşluğu kapatıyor:** birim testleri hesabı yalnızca
  mock'la gösterebiliyor. Test giriş yapmış kullanıcıda dili değiştiriyor,
  **yalnızca `locale` çerezini** siliyor (hepsi silinse Clerk oturumu da
  giderdi) ve sayfanın hâlâ İngilizce geldiğini doğruluyor — o bilgi artık
  yalnızca veritabanından gelebilir.
- 408 birim / 27 E2E.

### İngilizce sözlük (Faz 11.4d-1)
- 231 kodun İngilizcesi yazıldı (185 `ui.*` + 46 hata kodu). Uygulama artık
  gerçekten iki dilli.
- **`DICTIONARIES` tipinden `Partial` kaldırıldı.** Eksik bir çeviri artık
  derleme hatası. Öncesinde unutulan bir kod sessizce Türkçeye düşerdi:
  İngilizce ekranın ortasında tek bir Türkçe cümle, hiçbir uyarı yok
  (ADR-020).
- **Göreli zamanlar sözlükten çıktı**, `Intl.RelativeTimeFormat`'a geçti.
  `{count} dakika önce` şablonu İngilizcede `1 minutes ago` yazardı; Türkçede
  çoğul eki olmadığı için sorun görünmüyordu. `numeric: "always"` seçildi —
  `"auto"` olsaydı Türkçede `1 gün önce` yerine `dün` yazardı ve mevcut çıktı
  değişirdi. Ölçüldü: Türkçe birebir aynı, üç sözlük kodu eksildi.
- **Dil ve tema düğmeleri herkese açık dört sayfaya eklendi**
  (`/`, `/sign-in`, `/sign-up`, `/join/[token]`). 11.4c'nin bilerek bıraktığı
  boşluk buydu: İngilizce metin geldiği anda, giriş yapmamış bir ziyaretçi
  İngilizce ekranı görüp dili değiştiremez hale gelirdi.
- **Üç yazım hatası düzeltildi:** "kisiden" → kişiden, "cikarilsin mi" →
  çıkarılsın mı, "kullanildi" → kullanıldı. `e5e69dd`'deki Türkçe karakter
  dönüşümünden kalmıştı; 11.4b çıktıyı sabit tutmak için dokunmamıştı.
- **Yeni test — yer tutucu eşliği.** `tsc` sözlüğün eksiksiz olduğunu
  garantiliyor ama yer tutucuları garantilemiyor: `"{amount} kuruşluk alacağı
  var"` cümlesini `"has a credit"` diye çevirmek derlenir, testler geçer ve
  **ekranda tutar kaybolur** — cümle hâlâ anlamlı olduğu için kimse fark
  etmez. Test iki dildeki `{...}` kümelerini karşılaştırıyor.
- **İlk dil E2E testi.** Bugüne kadar dil değiştirmek gözlemlenemiyordu (iki
  sözlük de Türkçeydi). Artık sınanabilir: karşılama sayfasında TR→EN→TR,
  yenilemede kalıcılık, ve bozuk çerezin 200 döndürmesi. Giriş gerektirmediği
  için ikisi toplam 2,4 saniye.
- 396 birim / 26 E2E.

### Dil gerçekten okunuyor (Faz 11.4c)
- `getLocale()` artık `locale` çerezini okuyor. Çerez adı, ömrü (1 yıl),
  `Locale` tipi ve doğrulaması `src/lib/locale.ts`'te — çerezi **istemci**
  yazıyor, **sunucu** okuyor, ikisinin ortak bir eve ihtiyacı vardı:
  `i18n-server.ts` `server-only`, `i18n.tsx` ise `"use client"`.
- **Çerezdeki değere güvenilmiyor.** Beyaz liste dışındaki her şey Türkçeye
  düşüyor. Ham değer `Intl.NumberFormat`'a gitseydi `RangeError` fırlatır ve
  sunucuda render edilen sayfa 500 verirdi — konsoldan `document.cookie`
  yazarak uygulamayı çökertmek mümkün olurdu. Gerçek sunucuda denendi:
  `locale=zz-ZZ` → 200, Türkçe.
- Kök layout dili tek yerde okuyup iki yöne dağıtıyor: `<html lang>` ve
  `LocaleProvider`. `lang` sabit `"tr"` idi; ekran okuyucu İngilizce metni de
  Türkçe telaffuz ederdi.
- `formatMoney` / `formatBasisPoints` / `formatSignedMoney` çağrılarının
  tamamına dil geçirildi (4 istemci bileşeni + 2 sunucu sayfası).
- **Tarihler de kapsama alındı.** Dört yerde `Intl.DateTimeFormat("tr-TR")`
  sabit yazılıydı; `src/lib/dates.ts` bunları tek `formatDate`'e indirdi.
  İngilizce kullanıcı tutarları doğru, tarihleri Türkçe görüyordu.
- **Tek bilinçli çıktı değişikliği:** bildirimlerdeki 7 günden eski tarih
  `5 Ağu` yerine `05 Ağu` — listelerdeki biçimin aynısı. Aynı tarihin
  uygulamanın iki yerinde farklı görünmesi için sebep yoktu.
- Başlığa dil düğmesi. Çerezi yazıp `router.refresh()` çağırıyor: sayfanın
  yarısı sunucuda render ediliyor, tam yenileme ise açık pencereleri ve form
  içeriğini silerdi. Çerezi neden istemcinin yazdığı ADR-019'da.
- **11.4b'den kaçan üç gömülü metin bulundu:** `settlement-list.tsx`'te iki
  `?? "Bilinmeyen"`, karşılama sayfasında sabit `360,00 ₺`. Üçü de Türkçe
  karakter içermediği için 11.4b'nin taramasına takılmamıştı — aynı kör nokta
  ikinci kez. `"Bilinmeyen"` sözlükteki değerle birebir aynı, çıktı değişmedi.
- Build'de tek fark: `/_not-found` statikten dinamiğe geçti. Diğer rotaların
  hepsi zaten dinamikti (Clerk her isteği sunucuda çalıştırıyor), yani çerez
  okumanın ölçülebilir bir maliyeti olmadı.
- 19 yeni birim testi (389 toplam). 24 E2E değişmeden geçti.

### GitHub Actions CI — `09d0e91`
- `main`'e her push'ta ve her pull request'te çalışıyor:
  `npm ci` → `prisma generate` → `tsc --noEmit` → `eslint` → `vitest run`.
- **`prisma generate` zorunlu bir adım.** Prisma 7'de `@prisma/client`'ın
  postinstall betiği yok; `npm ci` tek başına client'ı üretmiyor ve üretilmeden
  `tsc` bütün projeyi derleyemiyor. Yerelde görünmüyor çünkü client bir kez
  üretilip `node_modules` içinde duruyor.
- `DATABASE_URL` olarak açıkça sahte bir değer veriliyor
  (`postgresql://ci:ci@localhost:5432/ci_not_a_real_database`).
  `prisma.config.ts` tanımsızsa hata fırlatıyor ama `generate` hiçbir
  sunucuya bağlanmıyor — bu yüzden CI'a gerçek bir bağlantı dizesi
  koymak gerekmedi. Workflow'da hiçbir gerçek secret yok.
- **E2E bilerek dışarıda** (ADR-018). Yerelde çalışmaya devam ediyor.
- `permissions: contents: read` ve `concurrency` + `cancel-in-progress`.
- Commit'ten önce CI ortamı yerelde taklit edilerek doğrulandı: depo temiz
  bir dizine klonlandı (`.env.local` ve `node_modules` gelmeden), aynı adımlar
  aynı sırayla koşturuldu, beşi de 0 ile çıktı.

### Claude Code araç izinleri sıkılaştırıldı
- `.claude/settings.json` eklendi: `.env.local` ve `package-lock.json`
  `Edit`/`Write` ile değiştirilemiyor. Yalnızca bu iki dosya kapsandı.
- `.claude/settings.local.json`'dan iki riskli izin kaldırıldı:
  `Bash(git push *)` ve `Bash(python -c ' *)` (37 → 35 kural).
- **Bilinen sınır:** `allow` listesi yalnızca soran bir izin kipinde
  anlamlı. Mevcut kipte `git push` hâlâ sormadan çalışıyor; ölçüldü.
  `deny` ise kipten bağımsız uygulanıyor — koruma bu yüzden çalışıyor.
- Her iki dosya da `.claude/` gitignore'da olduğu için **git'te değil**.

---

## 2026-08-11

### Arayüz metinleri sözlüğe taşındı (Faz 11.4b)
- 18 dosyadaki ~190 gömülü metin `src/lib/messages.ts`'e taşındı.
  Kodda gömülü kullanıcı metni kalmadı.
- İki erişim kapısı: `useTranslate()` (istemci hook) ve `getTranslate()`
  (sunucu, async). Server Component'lar hook kullanamadığı için ikisi ayrı.
  `i18n-server.ts` başındaki `import "server-only"`, modülün yanlışlıkla
  istemciye sızmasını **derleme hatasına** çeviriyor.
- İkisi de şimdilik sabit `tr` döndürüyor. 11.4c yalnızca bu iki fonksiyonun
  içini değiştirecek; çağrı yerleri ikinci kez açılmayacak.
- JSX'te birleştirilen cümle parçaları (`{isim} ödedi`, `senin payın {tutar}`)
  bütün parametreli cümleye dönüştü — İngilizcede kelime sırası ters.
- `notification-text.ts` saf fonksiyon kaldı: çeviriciyi varsayılanlı
  parametre olarak alıyor, mevcut testleri değişmedi.
- Sabit `metadata` nesnesi `generateMetadata`'ya çevrildi (başlık da dile
  bağlı ve dil çalışma zamanında okunuyor).
- **Yeni test:** kaynak koddaki her `ui.*` kodunun sözlükte olduğunu
  doğruluyor. `translate()` bilerek `string` kabul ettiği için yazım
  hataları derlemede yakalanmıyordu — bu gerçekten yaşandı.
- Çıktı bit bit aynı: 24 E2E testi değişmeden geçti.

### API hata kodları (Faz 11.4a)
- API artık hata **metni** değil **kodu** döndürüyor:
  `{ ok: false, code: "group.not_found", params? }`. Türkçe metin sunucuda
  hiç kalmadı.
- Sözlük `src/lib/messages.ts`. `MessageCode` tipi sözlükten **türetiliyor**,
  yani sözlükte olmayan bir kodu fırlatmak derleme hatası.
- Kod → metin çevirisi `apiRequest` içinde tek yerde yapılıyor; onu çağıran
  9 bileşen hiç değişmedi.
- Parametreli mesajlar için `params` eklendi (`{total}`, `{userIds}`).
  ADR-017 bunu öngörmemişti — bazı hatalar çalışma zamanı değeri taşıyor.
- `assertCanModifyRecord` artık Türkçe etiket değil kayıt **türü** alıyor
  (`"expense"` / `"settlement"`); metin parametresi çevrilemez.
- Zod şemalarındaki doğrulama mesajları da kod taşıyor; şemalar paylaşıldığı
  için çeviri gösterim anında yapılıyor.
- Çıktı bit bit aynı: 24 E2E testi değişmeden geçti.
- **Bilerek değişmedi:** `member.has_credit` hâlâ ham kuruş yazıyor
  ("12000 kuruşluk alacağı var"). Para olarak biçimlemek bir davranış
  değişikliği; 11.4a'nın işi çıktıyı sabit tutmaktı.

### Para biçimlendirmesi dile duyarlı (Faz 11.3)
- `formatMoney` ve `formatBasisPoints` artık dil parametresi alıyor
  (varsayılan `tr`). İngilizce: `$1,234.56` ve `33.33%`; Türkçe: `1.234,56 ₺`
  ve `%33,33`. Sembolün ve yüzde işaretinin **yeri** de dile göre değişiyor.
- Bilinmeyen para biriminde kod başa yapıştırılmıyor (`120.50 JPY`).
- Para hâlâ hiçbir aşamada float'a dönüşmüyor: `Intl`'e yalnızca tam sayı
  olan lira kısmı gidiyor, kuruş metin olarak ekleniyor.
- `Intl.NumberFormat` dil başına bir kez kuruluyor — bakiye listelerinde
  satır başına çağrılıyordu.
- **`parseMoney` değişmedi.** Ölçüldüğünde zaten dilden bağımsız olduğu
  görüldü: kural ayracın kimliğine değil sonrasındaki basamak sayısına
  bakıyor, bu yüzden `2.500` ve `2,500` aynı sonucu veriyor. ADR-017'nin
  "1000 kat fark" gerekçesi bu ölçüme göre düzeltildi.

### Tasarım tokenları (Faz 11.2)
- **Kimlik rengi kobalt oldu.** Yeşil ve kırmızı bu uygulamada zaten anlam
  taşıdığı için (alacak / borç) kimlik rengi üçüncü bir renk ailesi açıyor.
- Renkler `oklch()` cinsinden yazıldı. Açıklık değeri gözle algılanan
  açıklıkla örtüştüğü için iki temayı dengelemek deneme yanılma olmaktan
  çıktı.
- Nötr renkler tam gri değil: hepsinde çok küçük bir chroma ve kobaltın tonu
  var. Kart saf beyaz kaldı, böylece zeminden gölgesiz ayrılıyor.
- `--credit` / `--debt` anlam tokenları eklendi. Sayfalardaki
  `text-emerald-600 dark:text-emerald-400` gibi doğrudan renkler kaldırıldı.
- Borç rengi saf kırmızı değil kiremit; `--destructive`ten doygunlukla
  ayrılıyor (0.245'e karşı 0.15). Borçlu olmak bir hata değil.
- `formatSignedMoney` eklendi: `+120,50 ₺` / `−120,50 ₺`. Renk artık tek
  başına bilgi taşımıyor. Eksi işareti U+2212 (kısa tire değil) — rakam
  genişliğinde olduğu için sütun hizasını bozmuyor.
- `money` yardımcı sınıfı: tüm tutarlarda eşit genişlikli rakamlar, böylece
  listelerde virgüller aynı sütunda duruyor.
- Tipografi ölçeğine `text-figure` ve `text-display` eklendi (Tailwind'in
  hazır ölçeği değiştirilmedi, üzerine eklendi).
- Marka işareti (`brand-mark.tsx`): eşit olmayan iki parçaya bölünmüş daire.
- Başlık yapışkan oldu; karşılama sayfası ham `zinc-*` sınıflarından
  kurtuldu ve ürünü örnek bir defterle gösteriyor.

### Yazı tipi düzeltmesi ve koyu tema (Faz 11.1)
- **Site arayüz fazından beri Times New Roman'da render ediliyormuş.**
  `globals.css` içindeki `--font-sans: var(--font-sans)` kendine referans
  veriyordu; değişken boş çözülünce tarayıcı varsayılan serif'e düşüyordu.
  Geist yükleniyor ama hiç kullanılmıyordu (`document.fonts` → `unloaded`).
  Muhtemelen `shadcn init` sırasında oluştu; `--font-mono` doğru kalmıştı.
- Koyu tema bağlandı: palet ve `next-themes` zaten vardı ama `ThemeProvider`
  olmadığı için `.dark` sınıfını hiçbir şey uygulamıyordu.
- Tema düğmesi eklendi. İkon seçimi JavaScript state'i yerine CSS ile
  yapılıyor (`dark:hidden` / `dark:block`) — hydration uyumsuzluğu ve
  effect içinde setState sorununu birlikte çözüyor.

### Bildirimler (Faz 10) — `e26ede0`, `98054f0`
- Altı olay bildirim üretiyor: harcama eklendi / güncellendi / silindi,
  ödeme kaydedildi / iptal edildi, gruba katılım
- `NotificationType` enum'u 6 değere çıktı (`GROUP_INVITE` → `MEMBER_JOINED`)
- `/api/v1/notifications` — listeleme, tekil okundu, tümü okundu
- Başlıkta zil ikonu, okunmamış sayacı ve açılır liste
- Bildirimler olayla **aynı transaction'da** yazılıyor; yalnızca etkilenen
  kişiye gidiyor, işlemi yapana gitmiyor

### Migration bağlantısı düzeltildi — `1f68d5c`
- Migration'lar artık Neon'un **havuzsuz** adresini kullanıyor. Yarıda kesilen
  bir migration, advisory lock'u PgBouncer havuzundaki bir bağlantıda bırakmış
  ve sonraki tüm migration'lar kilitlenmişti
- `DATABASE_URL` tanımsızken okunaksız `PrismaConfigEnvError` yerine ne
  yapılacağını söyleyen bir hata mesajı

### Arayüz metinleri Türkçe karakterlerle — `e5e69dd`
- Kullanıcıya görünen tüm metinler düzeltildi ("Giris yap" → "Giriş yap")
- Yorum satırları bilerek ASCII bırakıldı

### Canlıya çıkış (Faz 8) — `02cc5e6`
- Vercel deploy: https://split-app-mauve.vercel.app
- Sentry eklendi (PII kapalı, izleme kapalı)
- `vercel-build` migration'ı production veritabanına uyguluyor
- Ayrı production veritabanı (Neon)
- **Sınır:** Clerk development anahtarlarıyla çalışıyor

### Clerk webhook (Faz 9) — `61180fc`
- `user.created` / `user.updated` / `user.deleted` işleniyor
- Hesap silme: satır silinmiyor, anonimleştiriliyor; sahiplik devrediliyor
- `User.clerkUpdatedAt` eklendi (sırasız gelen olaylara karşı)
- Lazy sync korundu — webhook onun yerini almıyor

---

## 2026-08-11 (öncesi, tarih kesin değil)

### E2E test altyapısı — `0248d4d`
- Playwright, 3 gerçek Clerk kullanıcısı, ayrı Neon veritabanı
- Clerk "Device Trust" adımı test e-postalarıyla aşılıyor
- **İki gerçek hata bulundu ve düzeltildi:**
  - Yeni kullanıcının ilk sayfa açılışında yarış durumu (`P2002`)
  - Silinen harcamanın ekranda kalması (sunucu verisi state'e kopyalanmıştı)

### Arayüz düzeltmeleri — `c4c3972`
- Grup açıklaması düzenlenebilir oldu
- Silme onay pencereleri artık kapanıyor
- İptal edilen davet linki artık "kullanılamıyor" diyor
- Tükenmiş davet "İptal et" yerine "Tükendi" gösteriyor

### Web arayüzü (Faz 7) — `072f3bc`
- Grup listesi ve detayı, harcama formu (3 bölüşüm tipi, canlı önizleme),
  bakiye kartları, ödeme penceresi, üye ve davet yönetimi

### Üyelik yönetimi (Faz 6) — `23a9f3f`
- Davet iptali, gruptan ayrılma (bakiye kapalı olmalı), üye çıkarma,
  sahiplik devri, son üye ayrılınca grup arşivleniyor

### Ödeme kayıtları (Faz 5) — `6c4ca0d`
- Ödeme kaydetme, listeleme, iptal etme
- Yalnızca ödemenin tarafları kayıt girebilir

### Bakiye ve borç sadeleştirme (Faz 4) — `d548ac6`
- Net bakiye hesabı + greedy sadeleştirme (önerilen ödemeler)
- Ayrılmış ama borcu duran üyeler listede kalıyor

### Harcamalar (Faz 3) — `0c35de3` … `9e1c42f`
- Vitest altyapısı
- Bölüşüm mantığı: EQUAL, EXACT, PERCENTAGE (largest remainder)
- Harcama oluşturma, güncelleme, silme, geri yükleme
- `ExpenseEdit` audit log'u
- Cursor sayfalamalı listeleme
- **Yetki kuralı değişti:** kaydı yalnızca oluşturan değiştirebilir

### Gruplar ve kimlik doğrulama (Faz 2) — `f2adb48`, `9fb0e19`
- Clerk entegrasyonu, kullanıcı eşleme
- Grup oluşturma, listeleme, link tabanlı davet

### Kurulum (Faz 1) — `b0cafc4`, `8a15357`, `e9cbf8d`
- Next.js + TypeScript + Prisma 7 + Neon
- 9 modelli şema, elle yazılmış kısıt ve trigger'larla ilk migration
