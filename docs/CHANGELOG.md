# Değişiklik Kaydı

Kronolojik, kısa. Faz durumu için [PROGRESS.md](PROGRESS.md), kararların
gerekçesi için [DECISIONS.md](DECISIONS.md).

> Tarihler commit geçmişinden doğrulanabilen yerlerde kesindir. İlk fazların
> tarihleri commit sırasından türetilmiştir; gün kesinliği yoktur.

---

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
