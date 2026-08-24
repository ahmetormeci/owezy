# Mimari Kararlar (ADR)

> Bu dosya **alınmış** mimari kararların tek kaynağıdır. Bir karar burada
> yoksa alınmamış sayılır.
>
> Tarihler karar tarihidir. Bazıları oturum bağlamından geldiği için gün
> kesinliği yoktur; kesin olmayanlar **(yaklaşık)** ile işaretlidir.
> Sıra doğrudur, tarih değeri yaklaşık olabilir.

---

## ADR-001 — Ayrı backend yerine tek Next.js uygulaması
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** NestJS gibi ayrı bir backend servisi yazılmayacak; her şey tek bir
Next.js uygulamasında olacak.

**Neden:** Tek geliştirici, tek deploy, tek tip sistemi. Ayrı backend iki
repo, iki deploy ve iki kimlik doğrulama entegrasyonu demekti.

**Alternatifler:** NestJS + ayrı frontend; tRPC.

**Sonuç:** Deploy ve geliştirme basitleşti. Karşılığında, iş mantığının
"framework'e sızmaması" için katman kuralları elle korunuyor
(bkz. [ARCHITECTURE.md](ARCHITECTURE.md)).

---

## ADR-002 — İş mantığı Route Handler'larda, Server Actions'ta değil
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Tüm yazma işlemleri `/api/v1/*` Route Handler'larından geçer.
Kod tabanında `"use server"` bulunmaz.

**Neden:** Proje sonraki aşamada **native mobil uygulamaya** dönüşecek.
Server Actions yalnızca aynı Next.js istemcisinden çağrılabilir; mobil
istemci bunları kullanamaz. Route Handler'ları her iki istemci de aynı
şekilde çağırır.

**Alternatifler:** Server Actions (daha az kod, daha az tip tekrarı);
ikisini karışık kullanmak.

**Sonuç:** Web tarafında biraz daha fazla kod (fetch + şema). Karşılığında
mobil aşamasında API'yi baştan yazma ihtiyacı ortadan kalktı.

---

## ADR-003 — Para, kuruş cinsinden tam sayı olarak saklanır
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Tüm tutarlar `Int` ve **minor unit** (kuruş). 120,50 TL → `12050`.
Float aritmetiği paraya hiçbir noktada dokunmaz.

**Neden:** `0.1 + 0.2 !== 0.3`. Finansal bir uygulamada float, zamanla
birikip bakiyeleri tutarsız hale getirir. Sorunun tamamen ortadan kalkması
için tek yol, ondalık sayıyı hiç kullanmamak.

**Alternatifler:** `Decimal` (Postgres NUMERIC) — doğru ama Prisma tarafında
`Decimal.js` nesnesiyle çalışmayı gerektirir ve JSON serileştirmede ek
yük getirir; float — reddedildi.

**Sonuç:** `Int` sınırı (2.147.483.647 kuruş ≈ 21,4 milyon TL) tek harcama
için üst sınır oldu; `MAX_SPLIT_AMOUNT` olarak açıkça kontrol ediliyor.
Biçimlendirme tek yerde: `src/lib/money.ts`. `formatMoney` bölme yerine
`Math.trunc` + `%` kullanır — biçimlendirme sırasında bile float'a düşmez.

---

## ADR-004 — Yüzdeler basis point olarak saklanır
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Yüzdeler tam sayı basis point'tir: `10000 = %100`, `3333 = %33,33`.

**Neden:** ADR-003'ün doğal uzantısı. `%33,33` float olarak saklanırsa
yuvarlama hataları paya taşınır. Basis point iki ondalık basamağa kadar
hassasiyeti tam sayıyla ifade eder.

**Alternatifler:** Ondalıklı yüzde; kesir (pay/payda).

**Sonuç:** Yüzde toplamının **tam olarak** 10000 olması zorunlu ve kontrol
ediliyor. Arayüz dönüşümü `parsePercentageToBasisPoints` / `formatBasisPoints`
ile tek yerde.

---

## ADR-005 — Küsurat dağıtımı: EQUAL'da ilk N kişiye, PERCENTAGE'da largest remainder
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:**
- **EQUAL:** `amount / n` tam bölünmezse kalan kuruşlar **ilk N katılımcıya**
  birer birer dağıtılır (100 TL / 3 → 33,34 + 33,33 + 33,33).
- **PERCENTAGE:** **Largest remainder (en büyük kalan)** yöntemi — önce her
  pay aşağı yuvarlanır, artan kuruşlar en büyük ondalık kalana sahip
  katılımcılara verilir.

**Neden:** Küsurat bir yere gitmek zorundadır; toplam **her zaman** tutara
birebir eşit olmalıdır. Largest remainder, dağıtımı yüzdelere en adil biçimde
yapan standart yöntemdir (seçim sistemlerinde de kullanılır).

**Alternatifler:** Kalanı tek kişiye vermek (adaletsiz); yuvarlayıp farkı
görmezden gelmek (toplam tutmaz — kabul edilemez); rastgele dağıtmak
(deterministik değil, test edilemez).

**Sonuç:** Dağıtım **deterministiktir** — aynı girdi her zaman aynı sonucu
verir, bu yüzden test edilebilir. Toplam eşitliği hem `split.ts` içinde hem
de veritabanı trigger'ı ile iki kez garanti altında.

---

## ADR-006 — Çok satır yazan her işlem tek transaction içinde
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Harcama + payları + audit kaydı + bildirimler **tek**
`prisma.$transaction` içinde yazılır. Yardımcı fonksiyonlar kendi
transaction'larını açmaz, çağıranın `tx`'ini parametre olarak alır.

**Neden:** Yarım yazılmış finansal kayıt, hiç yazılmamış kayıttan kötüdür.
Payları olmayan bir harcama bakiyeleri sessizce bozar. Bildirim sonradan
yazılsaydı, arada bir hata olduğunda harcama kaydolur ama kimsenin haberi
olmazdı.

**Alternatifler:** Sıralı yazma + hata halinde telafi (compensating writes) —
karmaşık ve hataya açık; bildirimleri kuyruğa almak — bu ölçekte gereksiz
altyapı.

**Sonuç:** `createNotifications(tx, ...)` imzası bu kararın somut hali.
Transaction içindeki her sorgunun `tx` kullanması zorunlu bir kural haline
geldi.

---

## ADR-007 — Kendi `User.id`'miz ile Clerk'in `clerkId`'si ayrılır
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Veritabanındaki tüm foreign key'ler bizim `User.id`'mize (UUID)
işaret eder. `clerkId` yalnızca `User` tablosunda bir eşleme alanıdır.
Uygulamanın geri kalanı `clerkId` görmez.

**Neden:** Kimlik sağlayıcısı değiştirilebilir olmalı. `clerkId`'yi her yere
foreign key olarak yaysaydık, Clerk'ten çıkmak veri modelini baştan yazmak
demek olurdu. Ayrıca dış sistemin kimlik formatı bizim şemamızı belirlememeli.

**Alternatifler:** `clerkId`'yi doğrudan birincil anahtar yapmak (daha az
tablo, daha az sorgu).

**Sonuç:** Her istekte bir `User` araması gerekiyor
(`getOrCreateCurrentUser`). Karşılığında kimlik sağlayıcısı bir tek tabloya
izole edildi ve hesap silmede kaydı anonimleştirip **finansal geçmişi
korumak** mümkün oldu.

---

## ADR-008 — `currency` istemciden asla alınmaz
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** `currency` hiçbir istek gövdesi şemasında yoktur. Harcama ve ödeme
kayıtlarının para birimi **her zaman** `Group.currency`'den türetilir.

**Neden:** İstemciden gelen para birimi, aynı grupta farklı para birimli
kayıtlar oluşturma yolu açardı — bakiye hesabı anlamsızlaşırdı. Kötü niyet
gerekmez; istemcideki bir hata da yeterlidir.

**Alternatifler:** İstemciden alıp grubunkiyle karşılaştırmak (kontrol
atlanabilir); harcama başına para birimine izin vermek (kur dönüşümü
gerektirir — kapsam dışı).

**Sonuç:** Zod'un "strip" davranışı sayesinde gövdede gönderilse bile eleniyor.
Ayrıca veritabanı trigger'ı aynı kuralı ikinci kez zorluyor. `Group.currency`
oluşturulduktan sonra değiştirilemez.

---

## ADR-009 — Kaydı yalnızca oluşturan kişi değiştirebilir
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Kabul edildi

**Karar:** Harcama/ödeme kaydını yalnızca `createdById` düzenleyebilir veya
silebilir. `paidById` **hiçbir yetki vermez**. Grup OWNER'ı yalnızca
oluşturan kişi artık grubun aktif üyesi değilse devreye girer.

**Neden:** Başlangıçta grubun her üyesi her kaydı düzenleyebiliyordu; bu,
başkasının girdiği harcamayı sessizce değiştirme imkânı veriyordu.
`paidById` düzenlenebilir bir alan olduğu için ona yetki bağlamak, kendini
"ödeyen" yapıp yetki kazanma yolu (privilege escalation) olurdu.

**Alternatifler:** Herkes düzenleyebilsin (ilk hal — reddedildi); OWNER her
zaman düzenleyebilsin (sahibi gitmemiş kayda müdahale).

**Sonuç:** Sahibi gruptan ayrılmış kayıtların sonsuza kadar kilitli kalmasını
önlemek için OWNER istisnası eklendi. Kural tek yerde:
`src/lib/group-access.ts`.

---

## ADR-010 — Optimistic locking mobil aşamasına ertelendi
**Tarih:** 2026-07 (yaklaşık) · **Durum:** Ertelendi

**Karar:** `Expense`/`Settlement` üzerine `version` alanı **eklenmedi**.

**Neden:** ADR-009'dan sonra eş zamanlı düzenleme riski "aynı kullanıcının
iki cihazı" senaryosuna indi; bu, tek istemcili web aşamasında nadir.
Çakışma çözüm arayüzü ise optimistic locking'i **önkoşul** olarak ister,
yani önce altyapı, sonra arayüz gerekir.

**Alternatifler:** Şimdi eklemek (kullanılmayan alan + her güncellemede ek
kontrol).

**Sonuç:** Mobil aşaması başladığında ilk ele alınacak konulardan biri.
Şu anki davranış: son yazan kazanır. Bkz. [DATABASE.md](DATABASE.md).

---

## ADR-011 — Kullanıcı senkronizasyonu: webhook + lazy sync birlikte
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** Clerk webhook'u (`/api/webhooks/clerk`) kullanıcı oluşturma,
güncelleme ve silmeyi işler. Sayfa render'ında çalışan "lazy sync"
(`getOrCreateCurrentUser`) **kaldırılmadı**; ikisi birlikte çalışır.

**Neden:** Lazy sync yalnızca *oluşturabilir* — e-posta/ad değişikliğini ve
hesap silmeyi hiç öğrenemez. Webhook ise birkaç saniye gecikebilir; kaydolup
hemen uygulamaya giren kullanıcı için kayıt henüz oluşmamış olabilir.

**Alternatifler:** Yalnızca webhook (gecikme penceresinde kullanıcı hata
alır); yalnızca lazy sync (güncelleme ve silme mümkün değil).

**Sonuç:** İkisi de **idempotent** olmak zorunda. Sırasız gelen olaylara karşı
iki katman: `clerkUpdatedAt` karşılaştırması ve "silme kalıcıdır" kuralı
(`deletedAt` doluysa hiçbir güncelleme uygulanmaz — silme olayının
payload'ında zaman damgası yoktur, o yüzden zamanla korunamaz).

Hesap silme: satır **silinmez**, anonimleştirilir (e-posta, ad, avatar
temizlenir, `clerkId` korunur). Finansal geçmiş bu satıra bağlıdır; ayrılmış
ama borcu duran üye bakiye listesinde kalmaya devam eder.

---

## ADR-012 — Migration'lar havuzsuz (direct) bağlantı üzerinden
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** Prisma migration komutları Neon'un `-pooler` adresini değil,
doğrudan adresini kullanır (`prisma-url.ts`). Uygulamanın kendisi havuzlu
adreste kalır.

**Neden:** Prisma Migrate, eş zamanlı iki migration'ı engellemek için
**oturum ömürlü advisory lock** alır. PgBouncer'da "oturum" istemci süreci
bittiğinde kapanmaz: yarıda kesilen bir migration, bağlantıyı kilidi
üzerindeyken havuza geri verdi ve o bağlantı sonra dev sunucusuna dağıtıldı.
Kilidi tutan oturumun son sorgusu sıradan bir `SELECT` idi ve kilidi kimse
serbest bırakmıyordu — sonraki tüm migration'lar zaman aşımına uğradı.

**Alternatifler:** Her seferinde elle kilit temizlemek; migration'ları
tamamen elle çalıştırmak.

**Sonuç:** `prisma-url.ts` içindeki tek satır (`replace("-pooler.", ".")`)
sorunu kaynağında çözüyor. Aynı dosya, `DATABASE_URL` tanımsızken Prisma'nın
okunaksız `PrismaConfigEnvError`'ı yerine ne yapılacağını söyleyen bir mesaj
veriyor (Vercel'deki ilk deploy hiçbir çıktı üretmeden bu yüzden düşmüştü).

---

## ADR-013 — Bildirimler yalnızca etkilenen kişiye, olayla aynı transaction'da
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** 6 olay bildirim üretir (harcama eklendi/güncellendi/silindi, ödeme
kaydedildi/iptal edildi, gruba katılım). Alıcılar yalnızca **etkilenenlerdir**
(harcamada katılımcılar, ödemede karşı taraf); işlemi yapan kişi kendi işlemi
için bildirim almaz. Bildirim, olayla aynı transaction'da yazılır.

**Neden:** Şemadaki enum yalnızca "ekleme" olaylarını kapsıyordu. Oysa
kullanıcıyı en çok ilgilendiren, **bakiyesini kendisi bir şey yapmadan
değiştiren** olaylardır: düzenleme, silme, iptal. Tüm gruba bildirim göndermek
ve kendi işlemini kendine bildirmek, bildirim listesinin işe yaramaz hale
gelmesinin en hızlı iki yoludur.

**Alternatifler:** Yalnızca mevcut üç tip (düzenleme/silme sessiz kalırdı);
tüm gruba göndermek (gürültü).

**Sonuç:** `GROUP_INVITE` → `MEMBER_JOINED` olarak yeniden adlandırıldı:
davetlerimiz link tabanlı olduğu için "davet edildin" bildirimi gönderilecek
bir alıcı yok. Güncellemede hem yeni hem eski katılımcılar bilgilendirilir —
bölüşümden çıkarılan kişinin de bakiyesi değişmiştir.

`payload` **anlık görüntü** tutar: "Ali 120,50 TL harcama ekledi" cümlesi,
harcama sonradan değişse de doğru kalmalıdır — `ExpenseEdit`'i değiştirilemez
kayıt yapan mantığın aynısı.

---

## ADR-014 — Arayüz metinleri Türkçe karakterlerle, yorumlar ASCII
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** Kullanıcıya görünen tüm metinler Türkçe karakter kullanır
("Giriş yap"). Kod yorumları ASCII kalır ("Giris kontrolu burada").

**Neden:** Kullanıcıya görünen metin ürünün dilidir; eksik yazım hatalı
görünür. Yorumlar geliştiriciye yöneliktir ve dönüştürmek diff'i iki katına
çıkarıp okuyucuya hiçbir şey kazandırmazdı.

**Alternatifler:** Her şeyi dönüştürmek; hiçbir şeyi dönüştürmemek;
metinleri tek bir çeviri dosyasında toplamak (i18n gerekene kadar erken).

**Sonuç:** Dönüşüm **birebir cümle eşlemesiyle** yapıldı, kelime bazlı değil:
kelime haritası `"Giriş tamamlanmadi"` gibi yarı çevrilmiş cümleler üretti ve
bu, hiç çevirmemekten kötüydü. Cümle eşlemesinde bir metin ya tamamen
çevrilir ya hiç dokunulmaz.

---

## ADR-015 — Kimlik rengi kobalt; yeşil ve kırmızı yalnızca anlam taşır
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** Marka/kimlik rengi **kobalt mavi**. Yeşil ve kırmızı yalnızca
bakiye anlamı için ayrılmıştır (yeşil = sana borçlular, kırmızı = sen
borçlusun) ve başka hiçbir amaçla kullanılmaz.

**Neden:** Bu üründe renk zaten **bilgi taşıyor**. Kimlik rengi de yeşil ya da
kırmızı olsaydı, kullanıcı bir rengin "marka mı, bakiye mi" olduğunu her
seferinde yeniden çözmek zorunda kalırdı. Kobalt bu paletle çakışmaz ve
yanlarında durunca ikisini de öne çıkarır.

**Alternatifler:** Yeşil kimlik (finans uygulamalarında yaygın — burada
anlamla çakışırdı); nötr gri kimlik (çakışmaz ama karaktersiz).

**Sonuç:** "Borç" rengi saf kırmızı değil, kiremit tonunda: arkadaşına 87 lira
borçlu olmak bir *hata* değildir, saf kırmızı hata mesajı gibi bağırır.
Nötrler hafif maviye çalıyor. Renk tek başına bilgi taşımaz: bakiye
satırlarında `+` / `−` işaretleri de bulunur — kırmızı-yeşil ayırt edemeyen
kullanıcı için asıl taşıyıcı bunlardır.

---

## ADR-016 — Sayfa hiyerarşisi bakiyeye göre kurulur
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi

**Karar:** Grup sayfasında "senin durumun" panelinin görsel ağırlığı diğer
bölümlerden belirgin biçimde büyüktür ve bakiyenin işareti sayfanın tonunu
belirler. Tutarlar **eşit genişlikli (tabular) rakamlarla** dizilir.

**Neden:** Kullanıcı bu sayfaya tek bir soruyla geliyor: *alacaklı mıyım,
borçlu muyum, ne kadar?* Önceki düzende beş özdeş kart vardı; "Senin durumun"
ile "Kaydedilen ödemeler" göze eşit önemdeydi. Her şey aynı sesle konuşunca
hiçbiri duyulmuyordu.

**Alternatifler:** Kartların tümünü korumak (mevcut durum); bakiyeyi başlığa
taşımak (sayfa bağlamı kaybolurdu).

**Sonuç:** Kuruşuna kadar doğru bölüşen bir uygulamada rakamların alt alta
hizalanması detay değil, ürünün karakteridir.

> **UYGULANDI (2026-08-12, Faz 11.5).** Kararın gerektirdiği ama burada
> yazmayan iki şey uygulama sırasında karara bağlandı:
>
> 1. **Önerilen ödemeler durum panelinin içine girdi ve filtrelendi.**
>    "Ne kadar borçluyum" ile "kime ödeyeceğim" aynı sorunun iki yarısı;
>    ayrı kartlarda eşit ağırlıkta durmaları bu ADR'nin şikâyet ettiği
>    şeyin ta kendisiydi. Panelde yalnızca kullanıcıyı içeren transferler
>    var; grubun tam takas planı doğru ama ikincil bir bilgi ve üçüncü
>    kademede, boşken hiç görünmeyen bir kartta duruyor.
> 2. **"Ödeme kaydet" başlıktan panele indi.** Başlıkta yalnızca "Harcama
>    ekle" kaldı — rutin eylem o. Ödeşmek bakiyeye bağlı bir eylem ve
>    yerinin borcun yanı olması daha tutarlı.
>
> **DÜZELTME (Faz 11.6).** İkinci madde geri alındı: "Ödeme kaydet" yeniden
> başlıkta, "Harcama ekle"nin yanında. Sebebi ADR-021'in getirdiği yoğun
> düzen — panel artık yalnızca bilgi taşıyor ve eylemler tek yerde duruyor.
> Dağılmış butonlar sıkışık bir arayüzde aranıyor. Birinci madde (önerilerin
> panele girip filtrelenmesi) **ayakta**.

---

## ADR-017 — İki dil: API kod döndürür, dil çerezde tutulur
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi (uygulanmadı — Faz 11.3/11.4)

**Karar:** Türkçe ve İngilizce desteklenecek.

1. API hata **metni** değil **kodu** döndürür (`group.not_found`); metni
   istemci üretir.
2. Dil tercihi çerezde ve hesap kaydında tutulur; **URL'de dil segmenti yok**.
3. **`formatMoney` / `formatBasisPoints`** dil parametresi alır ve bu iş
   **çeviriden önce** yapılır. `parseMoney` **dil parametresi almaz** —
   gerekçe aşağıda düzeltildi.
4. İngilizcede sembol başa gelir (`$1,234.56`), Türkçede sona
   (`1.234,56 ₺`). Yüzde işareti de yer değiştirir: `%33,33` / `33.33%`.

**Neden:**

1. Sunucu, isteğin hangi dilde cevaplanacağını bilemez — mobil istemci de
   aynı uçları çağıracak (ADR-002). Metin döndürmek, çeviri sözlüğünü
   sunucuya hapsederdi.
2. URL'de dil segmenti olsaydı tüm yönlendirmeler, davet linkleri ve 24 E2E
   testi değişirdi. Çerezle mevcut linkler olduğu gibi çalışır.
3. **Gösterim dile bağımlı, giriş değil.** `formatMoney` içinde
   `Intl.NumberFormat("tr-TR")` sabit yazılıydı ve sembol her zaman sona
   ekleniyordu; İngilizce kullanıcı `1.234,56 ₺` görürdü. Bu gerçek bir
   hata ve çeviriden önce çözülmeli — ekrandaki tutar yanlış okunursa
   arayüzün dili doğru olsa ne yazar.

> **DÜZELTME (2026-08-11, 11.3 uygulanırken).** Bu maddenin ilk hâli şunu
> iddia ediyordu: `parseMoney` `2.500` girdisini Türkçe kuralla `2500,00 ₺`
> okur, İngilizce niyet `2,50 ₺`'dir, **1000 kat fark**. Kod ölçüldüğünde bu
> doğru çıkmadı. `parseMoney` ayracın *kimliğine* değil, ondan sonraki
> *basamak sayısına* bakıyor; bu yüzden iki yazım da aynı sonucu veriyor:
>
> | Girdi | Sonuç | Girdi | Sonuç |
> |---|---|---|---|
> | `2.500` | 250000 | `2,500` | 250000 |
> | `2,50` | 250 | `2.50` | 250 |
> | `1.234,56` | 123456 | `1,234.56` | 123456 |
>
> Ayrıştırıcı zaten dilden bağımsız. Ona dil parametresi eklemek davranışı
> değiştirmez, yalnızca yanlış bir izlenim verir; katılaştırmak ise bugün
> çalışan girdileri reddederdi (numpad alışkanlığıyla `120.50` yazan Türk
> kullanıcı hata görürdü). **Kararın kendisi — 11.3'ün 11.4'ten önce
> gelmesi — ayakta**, gerekçesi yukarıda düzeltildi. Ölçüm
> `src/lib/money.ts` içindeki yorumda ve `money.test.ts`'teki
> "parseMoney - dilden bagimsizligi" testlerinde saklı.

**Alternatifler:** Sunucunun `Accept-Language` okuyup çeviriyi kendisinin
yapması (mobil istemciyi sunucunun desteğine bağımlı kılardı); yalnızca
arayüzü çevirip API mesajlarını Türkçe bırakmak (İngilizce kullanıcı hata
alınca Türkçe mesaj görürdü).

**Sonuç:** Mevcut ~40 hata mesajı koda dönüşecek ve onları kontrol eden
testler güncellenecek. Varsayılan dil Türkçe kaldığı için E2E testleri
değişmeden geçmeye devam etmeli.

---

## ADR-018 — CI tip kontrolü, lint ve birim testlerini koşar; E2E dışarıda kalır
**Tarih:** 2026-08-12 · **Durum:** Kabul edildi

**Karar:** `main`'e giden her değişiklik GitHub Actions'ta
`npm ci` → `prisma generate` → `tsc --noEmit` → `eslint` → `vitest run`
adımlarından geçer. **Playwright E2E koşusu CI'a alınmaz**; yerelde
`npm run test:e2e` ile çalışmaya devam eder.

**Neden:**

1. `main`'e push, Vercel'de **production deploy** tetikliyor. Bu dosyadan
   önce o yolun önünde otomatik hiçbir kapı yoktu — her doğrulama elle
   yapılıyordu ve elle yapılan doğrulama er geç atlanır.
2. E2E'yi CI'a taşımak, üç şeyi yeni bir ortama kopyalamak demek: gerçek
   Clerk test kullanıcılarının parolaları, ayrı bir Neon veritabanının
   bağlantı dizesi ve Clerk'in test anahtarları. Bu sırların bir kısmı
   **üretim dışı ama gerçek**; bir CI ortamına kopyalanmaları, korunacak
   yüzeyi genişletir. Kazandığı şey, elle koşturulan ve zaten koşturulan
   bir doğrulama.
3. Süre de sebebin bir parçası: E2E ~5,5 dakika sürüyor ve gerçek bir dev
   sunucusu ayağa kaldırıyor. Her push'ta ödenen bu maliyet, hızlı geri
   bildirim veren üç adımı da yavaşlatırdı.

**Alternatifler:** E2E'yi de CI'a almak (yukarıdaki sır yüzeyi); CI'ı hiç
kurmayıp elle doğrulamaya devam etmek (mevcut durum — atlanabilir olduğu
için terk edildi); E2E'yi yalnızca gecelik koşmak (yine aynı sırları
istiyor, ertelemekten başka bir şey çözmüyor).

**Sonuç:** CI **kırmızıysa deploy edilmez** kuralı henüz teknik olarak
zorlanmıyor — Vercel deploy'u CI sonucundan bağımsız. Dal koruma kuralı
(branch protection) bunu zorlayabilir; henüz açılmadı, ayrı bir karar.

E2E'nin CI dışında kalması, **E2E'yi koşturma sorumluluğunun kişide
kaldığı** anlamına gelir. Arayüzü ilgilendiren bir değişiklikte
`npm run test:e2e` atlanırsa, CI bunu yakalamaz.

---

## ADR-019 — Dil çerezini istemci yazar, bir API ucu değil
**Tarih:** 2026-08-12 · **Durum:** Kabul edildi

**Karar:** Dil düğmesi çerezi tarayıcıda `document.cookie` ile yazar ve
`router.refresh()` çağırır. `/api/v1` altında dil için bir uç **açılmadı**.

**Neden:**

1. Next 16'da çerez **yazmak** yalnızca Server Function ya da Route Handler
   içinde mümkün (`cookies()` dokümantasyonu bunu açıkça söylüyor). Server
   Function `"use server"` demek — bu projede yasak (ADR-002).
2. Geriye Route Handler kalıyordu, ama `/api/v1` altındaki uçlar **iş
   mantığı**: mobil istemcinin de çağıracağı, veritabanına dokunan uçlar.
   Dil tercihi bugün hiçbir yere kaydedilmiyor; temaya benzeyen bir gösterim
   tercihi. Kayıt olmayan bir şey için uç açmak, `/api/v1`'in ne olduğunu
   bulanıklaştırırdı.
3. Çerezi istemcinin yazması, **çıkış yapmış kullanıcıda da çalışır**.
   Karşılama sayfası herkese açık ve dil oradan da değişebilmeli.

**Alternatifler:** Server Action (yasak); `POST /api/v1/preferences/locale`
(ucu kimlik doğrulamasız açmak gerekirdi — çıkış yapmış kullanıcı da dil
değiştirebilmeli — ve bugün yazacağı bir kayıt yok); `localStorage`
(sunucuya ulaşmaz, sayfanın yarısı sunucuda render ediliyor).

**Sonuç:** Çerez `httpOnly` **değil** — istemcinin yazabilmesi gerekiyor. Bir
sır taşımadığı için bu bir bilgi sızıntısı değil, ama şu kuralı doğuruyor:
**çerezden gelen değere hiçbir zaman güvenilmez.** `normalizeLocale()` beyaz
liste uyguluyor; ham değer `Intl`'e gitseydi `RangeError` fırlatır ve sunucu
sayfası 500 verirdi.

11.4d'de `User.locale` geldiğinde durum değişir: o **gerçekten** bir kayıt
olacak ve `/api/v1` orada devreye girecek. Çerez o zaman da hızlı yol ve
"çıkış yapmış kullanıcı" yolu olarak kalır; okuma sırası çerez → hesap → `tr`.

---

## ADR-031 — Hesap silme uygulama içinden, kendi ucumuzla; borç engel değil
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi — **HENÜZ UYGULANMADI**

**Karar:** Kullanıcı hesabını uygulama içinden silebilecek. Silme **kendi
ucumuzdan** yapılacak (`DELETE /api/v1/me`), Clerk'in kendi silme düğmesi
**kapalı** tutulacak. **Borcu ya da alacağı olan da silebilecek**; ekranda
uyarı gösterilir ama engellenmez.

**Neden gerekti:** App Store Guideline 5.1.1, hesap açılabilen uygulamalarda
uygulama içi hesap silmeyi zorunlu kılıyor (ADR-030).

**Zaten var olanın envanteri — yeniden yazılmayacak:** İşin zor kısmı
`markUserDeletedFromClerk` (`src/lib/clerk-sync.ts`) içinde yazılı ve
`user.deleted` webhook'una bağlı. Kişisel veriyi temizliyor (e-posta
`deleted+<id>@deleted.invalid`, ad "Silinmiş kullanıcı", avatar null),
`deletedAt` işaretliyor, `clerkId`'yi koruyor, grup sahibiyse sahipliği en
eski aktif üyeye devrediyor, üyelikleri kapatıyor, gruptaki son kişiyse grubu
arşivliyor. Harcama ve ödeme kayıtlarına dokunmuyor — **bakiyeler bozulmuyor.**
Eksik olan tek şey **tetik**: kullanıcının basacağı düğme.

**Neden kendi ucumuz, Clerk'in hazır akışı değil:**
1. **Mobil.** Clerk'in Expo tarafında web'deki `UserProfile`'ın dengi hazır
   ekran yok. Clerk'in akışını seçsek bile 18.x'te kendi ekranımızı yazmak
   gerekecekti — o zaman ucu bir kez yazıp ikisinde de kullanmak daha ucuz
   (ADR-002).
2. **Senkronluk.** Webhook asenkron: Clerk'te silinmiş ama bizde henüz duran
   bir aralık oluşuyor. Kendi ucumuz o aralığı kapatıyor.

**Neden Clerk'in düğmesi kapalı kalıyor:** İki silme yolu iki farklı davranış
demek — biri senkron biri asenkron. Altı ay sonra hangisinin ne yaptığını
kimse hatırlamaz.

**Sıra ve emniyet ağı:** Önce Clerk'teki kullanıcı silinir, sonra
`markUserDeletedFromClerk` doğrudan çağrılır. Bu sıra bilinçli: ikinci adım
düşerse `user.deleted` webhook'u zaten aynı işi yapıyor ve fonksiyon
**idempotent** (`clerkId` korunduğu için "zaten silinmiş" diyebiliyor). Ters
sırada — önce bizde anonimleştirip sonra Clerk'te silmeye çalışsak — Clerk
adımı düştüğünde kullanıcı hâlâ giriş yapabilen ama verisi silinmiş bir
duruma düşerdi.

**Neden borç engel değil:** `leaveGroup` bakiye sıfır değilse ayrılmayı
reddediyor (`assertBalanceIsSettled`) ama silme için aynı kural uygulanmayacak.
Sebep: arkadaşı hiç ödeşmeyen biri hesabına süresiz mahkûm kalırdı, ve Apple
silmenin gerçekten çalışmasını istiyor — ön koşullu bir silme reddedilebilir.
Borç, grupta "Silinmiş kullanıcı" adına durmaya devam eder; bugün webhook'un
yaptığı da zaten bu.

**Geri alma penceresi YOK.** Clerk'te silme anında ve geri alınamaz; bizde
30 günlük bir pencere kurmak, orada olmayan bir şeyi taklit etmek olurdu.

**SIRALAMA — 2026-08-24 eki:** Clerk panelindeki "kullanıcılar hesabını
silebilir" anahtarının **şu an açık** olduğu doğrulandı, yani silme bugün uçtan
uca çalışıyor. Yukarıdaki "kapalı tutulacak" ifadesi **son durumu** tarif
ediyor, geçişi değil: anahtar `DELETE /api/v1/me` yayına girene kadar **açık
kalmalı**. Şimdi kapatmak, çalışan tek silme yolunu kaldırıp yerine hiçbir şey
koymamak olurdu.

**Bu ADR politikayı bağlıyor, uygulamayı değil.** Onay ekranı, uyarı metni ve
testler yazılırken tasarım ayrıca konuşulacak.

---

## ADR-030 — Önce iOS; mağaza gerekleri koda giriyor
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi

**Karar:** Mobil uygulama **önce iOS'ta** çıkacak. Android'e sonra dönülecek.

**Neden:** Apple Developer Program başvurusu zaten sürüyor (onay bekliyor).
Google tarafında ise kişisel geliştirici hesapları için **takvim kuralı** var:
production'a çıkmadan önce kapalı testte belirli sayıda test kullanıcısıyla
**14 gün kesintisiz** test yapmak gerekiyor. Bu kural kodla hızlandırılamıyor.
İki platformu paralel yürütmek yerine tek platformda tam bir dikey dilim
çıkarmak seçildi.

**Kabul edilen bedel açıkça yazılıyor:** Android yayını, o tarafa dönülen
günden **en az 2-3 hafta sonra** mümkün olacak. Bu bilinerek kabul edildi.
Expo/React Native seçimi (ADR-029) değişmiyor — Android kodu zaten yazılmış
olacak, yalnızca yayın süreci sonraya kalıyor.

**Mağaza gerekleri hakkındaki bilgi PROJECT.md'nin "Yayınlama" bölümünde.**
Orası bir karar listesi değil, gereklerin envanteri.

### HENÜZ KARAR VERİLMEDİ

Aşağıdakiler mağaza incelemesinin dayattığı ve **kodu değiştirecek** konular.
Hiçbiri karara bağlanmadı — bu ADR onları yalnızca kayda geçiriyor ki
unutulmasınlar:

- ~~Uygulama içinden hesap silme.~~ **KARARA BAĞLANDI — ADR-031.**
- **Sign in with Apple.** Guideline 4.8, üçüncü taraf girişi sunan
  uygulamalardan gizlilik korumalı bir alternatif de istiyor. Bizde Google ve
  GitHub girişi var. Kendi e-posta girişimiz şartı karşılıyor olabilir ama
  inceleyiciye göre değişiyor; garanti yol Sign in with Apple eklemek. Clerk'te
  hazır sağlayıcı, ancak **onaylanmış Apple hesabı olmadan kurulamıyor**.
- **Bundle ID / paket adı.** `net.owezy.app` önerildi, 18.2'de `app.json`'a
  yazılacak. Yayınlandıktan sonra **değiştirilemez**.
- **Gizlilik politikası ve destek sayfası.** İki mağaza da URL istiyor;
  owezy.net'te ikisi de yok.

---

## ADR-029 — Mobil uygulama Expo ile, aynı repoda; Bearer sözleşmesi ölçüldü
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi

**Karar:** Mobil uygulama **Expo / React Native** ile yazılacak ve **aynı
repoda `mobile/` klasöründe** duracak.

**Neden Expo:** Saf modüller olduğu gibi yeniden kullanılıyor — `split.ts`
(bölüşüm, largest remainder), `money.ts` (kuruş aritmetiği), `search-fold.ts`,
`expense-category-guess.ts`, `messages.ts` (iki dilli sözlük),
`notification-text.ts`. Bunları koruyan 510 birim testinin çoğu ikinci kez
yazılmıyor. Native (Swift + Kotlin) seçilseydi para aritmetiği ve bölüşüm
mantığı **üç kez** yazılırdı (web + iOS + Android) ve üç kez test edilirdi;
tek kişilik bir projede bu bakım yükü, native hissiyatın getirisinden ağır.

**Neden aynı repo, monorepo değil:** Monorepo daha temiz uzun vadeli yapı ama
bedeli çalışan her şeyi taşımak — CI, Vercel kökü, tsconfig yolları,
Playwright. Henüz tek satır mobil kod yokken yapılacak bir yeniden düzenleme
değil. `mobile/` kendi `package.json`'ıyla yan yana duruyor; paylaşılan saf
modüller önce göreli yolla kullanılıyor, gerçekten sıkışınca ortak paket
çıkarılır. Önce yapıyı kurup sonra ona ihtiyaç aramak yerine tersi.

**Neden ayrı repo değil:** Paylaşılan mantık kopyalanır ve zamanla ayrışır.
Para aritmetiğinde ayrışma, sessiz hata demektir.

## Bearer sözleşmesi artık ölçüldü

ADR-002 iş mantığını `/api/v1` altına koyarken gerekçesi "mobil istemci de
aynı uçları çağıracak"tı. Bu bugüne kadar bir **varsayımdı**: web istemcisi
Clerk oturumunu çerezle taşıyor, mobil ise `Authorization: Bearer`
kullanacaktı.

Ölçüldü (Faz 18 öncesi):

```
Çerezsiz, token yok  →  401
Çerezsiz, Bearer     →  200  {"ok":true,"groups":[...]}
```

Sonuç bir E2E testine bağlandı (`auth.spec.ts`). Sebebi: biri ileride çerez
varsayan bir kontrol eklerse (CSRF, SameSite, origin doğrulaması) mobil
sözleşme sessizce kırılırdı. Test önce **negatifi** doğruluyor — token yokken
401 — yoksa 200 "uç herkese açık" anlamına da gelebilirdi.

**API'de bulunan iki eksik:** `GET /groups/[groupId]` yok (yalnızca `PATCH`
var) ve tek bir harcamanın `GET`'i yok. Geri kalan her okuma ucu mevcut.

---

## ADR-028 — Kategori açıklamadan tahmin edilir, kullanıcıya sorulmaz
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi

**Karar:** Harcama kategorisi, kategori gönderilmediğinde **açıklamadan
tahmin ediliyor**. Tahmin `createExpense` içinde, yani **sunucuda** yapılıyor;
aynı saf fonksiyon (`expense-category-guess.ts`) formda canlı öneri olarak da
çalışıyor.

**Neden gerekti:** Kategori alanı vardı ama kimse doldurmuyordu. Form
varsayılan olarak "Diğer"i seçili getiriyordu, kullanıcı dokunmuyordu; satır
içi giriş de (Faz 16.3) hep `OTHER` gönderiyordu. Sonuç: "nereye gitti"
kırılımı tek çubuk "Diğer" — var olan bir özellik hiçbir şey anlatmıyordu.
Risk Faz 13'ten beri yazılıydı ve Faz 16 onu büyütmüştü.

**Neden zorunlu alan değil:** Kategoriyi zorunlu kılmak her harcamada bir
karar daha demek. İnsanlar en üsttekini seçer, veri yine çöp olur — üstelik bu
sefer sürtünme de eklenmiş olur.

**Neden sunucuda:** ADR-002. İş mantığı `/api/v1` altında çünkü mobil istemci
de aynı ucu çağıracak; tahmini tarayıcıya koysaydık mobil tarafın onu yeniden
yazması gerekirdi. Satır içi giriş bu yüzden kategori **hiç göndermiyor**.

**Neden aynı zamanda görünür:** Sessizce kategori atayan bir sistem,
kullanıcının bilmediği bir şey yapar. Form açıklamayı yazarken seçim kutusunu
güncelliyor; satır içi girişin ipucu satırı tahmini yazıyor
("Alışveriş · eşit bölünür · sen ödedin · bugün").

**Üç sınır:**

1. **Açık bir seçimi asla ezmiyor.** Yalnızca kategori hiç gönderilmediğinde
   çalışıyor.
2. **Düzenlemede baştan susuyor.** Kayıtlı bir kategoriyi, kullanıcı açıklamayı
   değiştirdi diye ezmek onun kararını geri almak olurdu.
3. **İpucu yoksa `null` dönüyor, `OTHER` değil.** Ayrım anlamlı: `null`
   "bilmiyorum", `OTHER` "biliyorum, diğeri" demek. Varsayılana çağıran taraf
   karar veriyor.

**Türkçe iki şey gerektirdi:**

- **Katlama.** Karşılaştırma `foldForSearch` üzerinden — 13.3a'da ölçülmüş,
  14.4'te çözülmüş bir işin yeniden kullanımı. Anahtarlar katlanmış biçimde
  yazılıyor.
- **Ünsüz yumuşaması.** "yemek" → "yemeği", yani baş eşleşmesi tek başına
  yetmiyor. İstisnaları listelemek yerine kural koda yazıldı: her anahtarın
  yumuşamış bir ikizi üretiliyor (k→g, p→b, t→d).

**Kısa anahtarlarda tam eşleşme şart** (3 harf ve kısası): "sok" baş
eşleşmesiyle çalışsaydı "sokak" da market sayılırdı. Sınır önce 4'tü ve "otel"
gibi çok yaygın bir kelimeyi ekli halleriyle kaçırıyordu.

**Liste geniş ama her marka değil.** Bilerek dışarıda bırakılanlar ve
sebepleri kodda yazılı: `mango` (meyve de olabilir), `vatan` ("vatandaş"ı
yakalardı), `apart` ("apartman aidatı"nı konaklama sayardı), `abonelik`
("Netflix abonelik"te eğlenceyi ezerdi — daha uzun anahtar kazanıyor).
Yaygın bir kelimeyle çakışan anahtarın yokluğu varlığından iyidir.

**Yanlış tahminin bedeli ucuz:** harcama düzenlenip değiştiriliyor.

**İkinci koruma:** Tek kategorili bir kırılımda çubuk artık hiç çizilmiyor
(aylık grafikte aynı kural Faz 13'ten beri vardı). Tahmin bu durumu
seyrekleştiriyor ama ortadan kaldırmıyor: iki harcaması da markete gitmiş bir
grup hâlâ tek çubuk.

---

## ADR-027 — Grup sayfası bir fiş; harcama listesi bir rulo
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi

**Karar:** Grup sayfası yeniden kuruldu. Üç parça:

1. **Sayfa bir NESNE.** Kâğıt yüzeyden bir ton açık (`--paper` / `--surface`),
   satırlar noktalı ayraçla tutara bağlanıyor, ay sınırları perfore çizgi,
   kapanış çift çizgi + toplamlar, altta yırtık kenar ve çok hafif gren.
2. **Ay penceresi SUNUCUDA.** `listExpenses` artık `month` alıyor
   (`YYYY-MM` → UTC aralık). Açık ay tam, geçmiş aylar tek satır katlı.
3. **Satır içi harcama girişi.** Fişin son satırı yazılabilir; yalnızca en
   yaygın durumu yapıyor (eşit bölüşüm, ödeyen sen, tarih bugün, kategori
   Diğer) ve bu varsayımları yazıyor.
4. **Uygulama tek gruplu kullanıcıyı doğrudan grubuna bırakıyor.** Karşılama
   sayfası (`/`) ve başlıktaki marka işareti, kullanıcının tek grubu varsa o
   gruba gider. `/groups` **yönlendirmiyor**; erişilebilir bir liste olarak
   kalıyor ve başlıktaki grup değiştiriciden ulaşılıyor.

**Neden:** Kullanıcı ekran görüntüsüyle şunu gösterdi: 1-2 gruplu birinde
"Gruplarım" ekranı geniş bir boşluktu. Sorun boşluk değil, ekranın bir DİZİN
sayfası olmasıydı — ve boşluk, doldurularak değil kompozisyona çevrilerek
çözülür. Fiş metaforu bunu yapıyor: dar bir sütun bir nesne olarak duruyor,
etrafındaki alan kaza değil tezgâh.

**"100 harcamada ne olacak" sorusunun cevabı katlama.** Fiş bir rulo gibi
davranıyor: uzuyor ama okunaksızlaşmıyor. Katlı bir ay HİÇ SORGU ATMIYOR —
taşıdığı toplam ve adet zaten hesaplanan özetten geliyor.

**Neden pencere sunucuda:** İstemcide süzseydik "daha fazla yükle" açık ayın
sınırını aşıp bir önceki ayın satırlarını açık ayın altına eklerdi.
Sayfalamanın doğru çalışması için pencerenin sorguda olması gerekiyor. Aynı
gerekçe ADR-024 öncesi 13.3a'da da kurulmuştu: filtre sunucuda.

**Bakiye tasarımda fişin ALTINDAYDI, kodda ÜSTTE.** Gerçek bir fişte toplam
en altta durur. Uygulamada öyle yapılmadı: 40 harcamalı bir grupta bakiye
ekranın çok altına düşerdi ve ADR-016'nın "sayfa bakiyeye göre kurulur"
kuralı fiilen bozulurdu. Hesap özetleri de aynı sebeple bakiyeyi başa koyar.
Fiş dili korundu, sırası değil.

**Neden `/groups` yönlendirmiyor:** İlk tasarım "tek grup varsa liste gruba
yönlensin"di. Uygulanmadı, çünkü **"Yeni grup" düğmesi yalnızca o listede
duruyor**: liste kendine gelen herkesi geri gönderseydi tek gruplu kullanıcı
ikinci bir grubu asla oluşturamazdı. Şikayetin kaynağı zaten listenin varlığı
değil, oraya **düşmekti** — o yüzden iniş noktası değişti, liste değil.

**Ödenen bedeller — ikisi de bilerek:**

- **Harcama sorgusu artık paralel değil sıralı.** Hangi ayın çekileceğini
  özet söylüyor, o yüzden özeti beklemek zorunda: bir ek gidiş-dönüş.
- **Satır içi giriş her zaman `OTHER` kategorisi kullanıyor** ve bu, PROGRESS'te
  zaten yazılı olan "kategori varsayılanı OTHER, kırılım tek çubuk Diğer
  çıkıyor" riskini BÜYÜTÜYOR. Hızlı girişe kategori seçimi koymak satırı
  şişirirdi; doğru çözüm muhtemelen kırılımın kendisinde.

**Kaldırılanlar:** Özet bloğundaki üç rakam kutusu (TOPLAM / PAYIN / HARCAMA)
ve "bakiyen nasıl oluştu" denklemi. İkisi de fişte zaten vardı; aynı sayı
sayfada iki kez duruyordu. Blok artık yalnızca fişte OLMAYANI taşıyor:
paranın nereye gittiği.

---

## ADR-026 — Alan adı Cloudflare'de, uygulama Vercel'de; proxy kapalı
**Tarih:** 2026-08-24 · **Durum:** Kabul edildi

**Karar:** `owezy.net` alındı ve açılış altyapısı üç kararla kuruldu:

1. **DNS Cloudflare'de, hosting Vercel'de.** Nameserver'lar Squarespace'ten
   Cloudflare'e çevrildi. Vercel'i gösteren bütün kayıtlar **proxy kapalı**
   (DNS only) girildi — Clerk'in kayıtları da dahil.
2. **Apex birincil.** `owezy.net` asıl adres, `www.owezy.net` ona 307 ile
   yönleniyor. Apex kaydı bir `CNAME`; Cloudflare onu flattening ile
   çözümlüyor.
3. **Production'da sosyal girişler kendi OAuth uygulamalarımızla.** GitHub ve
   Google için ayrı OAuth istemcileri oluşturuldu ve Clerk'e tanıtıldı.

**Neden proxy kapalı:** Turuncu bulut açıkken Cloudflare araya kendi CDN'ini
ve kendi TLS'ini sokuyor. Vercel alan adının sahipliğini doğrulayıp
sertifikasını üretemiyor, iki CDN üst üste binince önbellek ve yönlendirme
hataları çıkıyor. Clerk ise proxied kayıtlarla doğrulamayı hiç geçemiyor.
Sertifikayı zaten Vercel ve Clerk kendileri veriyor; Cloudflare'den istenen
tek şey DNS.

**Neden apex birincil:** Marka adı `owezy.net`. İki adresin de bağımsız
çalışması SEO açısından aynı sayfanın iki kopyası demek olurdu; biri seçilip
diğeri yönlendirilmek zorunda.

**Neden kendi OAuth uygulamalarımız:** Clerk paylaşımlı OAuth hesaplarını
yalnızca development instance'ında veriyor. Production'da kendi istemcini
tanıtmazsan "GitHub ile devam et" ve "Google ile devam et" düğmeleri çalışmaz.
Google tarafında istenen kapsamlar yalnızca `openid`, `userinfo.email` ve
`userinfo.profile` — Google'ın "hassas" saymadığı kapsamlar, bu yüzden
consent screen'i yayınlamak inceleme gerektirmedi.

**Sonuç:** Faz 8'den beri duran "development anahtarlarıyla çalışıyoruz"
sınırı kalktı. Development instance **silinmedi**: E2E testleri onun
`+clerk_test` kullanıcılarına ve sabit `424242` doğrulama koduna bağlı.

---

## ADR-025 — Para toplaması veritabanında, para kuralı saf fonksiyonda
**Tarih:** 2026-08-13 · **Durum:** Kabul edildi

**Karar:** Bakiye ve özet hesabı ikiye ayrıldı:

- **Toplama** veritabanında (`GROUP BY` + `SUM`). `loadGroupTotals` kişi başına
  dört sayı döndürüyor: ödediği, payı, yaptığı ödemeler, aldığı ödemeler.
- **Kural** saf fonksiyonda. `calculateBalancesFromTotals` ve
  `buildGroupSummary` bu toplanmış girdiyi alıp sonucu üretiyor.

`calculateBalances(expenses, settlements)` ve `calculateGroupSummary(...)`
**kaldırılmadı**: toplamayı bellekte yapıp aynı saf fonksiyona veriyorlar.

**Neden:** `getGroupBalances` grubun bütün harcamalarını katılımcılarıyla
birlikte çekiyordu ve üstünde limit yoktu. 1000 harcamalı, 3 katılımcılı bir
grupta bu 4000 nesne demekti — her sayfa görüntülemesinde. Artık dönen satır
sayısı harcama sayısına değil **üye sayısına** bağlı.

**Neden eski fonksiyonlar duruyor:** Para kuralının 35 testi onların üzerinden
yazılmıştı. Kuralı SQL'e taşımak o güvenceyi kaybettirirdi — SQL'de yazılmış
bir aritmetik hatası birim testiyle yakalanamaz. Şimdi kural tek yerde ve iki
farklı yoldan (bellek ve SQL) beslenebiliyor; bir test iki yolun **aynı
sonucu** verdiğini koruyor.

**Neden ham SQL yok:** Aylık kırılım için `date_trunc` gerekiyordu. Onun
yerine Prisma `groupBy` ile **gün** bazında toplanıp aya katlama bellekte
yapılıyor. Dönen satır sayısı farklı gün sayısı kadar — harcama sayısı kadar
değil — ve kod tipli kalıyor.

**Dürüst sınır:** Bugünkü veri boyutunda (12 harcama) bu değişiklik ölçülebilir
bir kazanç sağlamıyor; dört paralel sorgu, tek okumadan daha hızlı değil.
Kazanç ölçek büyüdüğünde başlıyor. Yapılma sebebi alan adı alınmadan borcun
kapatılmak istenmesi.

---

## ADR-024 — Arama katlaması veritabanının ürettiği bir kolonda
**Tarih:** 2026-08-13 · **Durum:** Kabul edildi

**Karar:** `Expense.descriptionFold` kolonu **`GENERATED ALWAYS ... STORED`**.
Türkçe harfler ASCII karşılığına iniyor ve metin küçültülüyor. Arama hem kaydı
hem aranan metni aynı şekilde katlıyor (`src/lib/search-fold.ts`).

**Neden katlama gerekiyordu:** 13.3a'da ölçüldü — veritabanı collation'ı
`C.UTF-8` ve büyük `I` küçültülünce `i` oluyor, `ı` değil. "Isik" yazan bir
harcama "ışık" aramasıyla bulunmuyordu.

**Neden üretilmiş kolon, uygulamanın yazdığı bir kolon değil:**

1. **Tek kaynak.** Katlama kuralı SQL'de; `createExpense`/`updateExpense`'in
   hatırlaması gereken bir şey yok, unutulamaz.
2. **Backfill yok.** Mevcut satırların değeri kolon eklenirken hesaplandı —
   ayrı bir betik ve üç veritabanında ayrı bir adım gerekmedi. Ölçüldü:
   12 mevcut kayıt kendiliğinden doldu, JS katlamasıyla sıfır fark.

**Neden index yok:** Arama `%metin%` kalıbı kullanıyor; onu ancak `pg_trgm`
uzantısıyla bir GIN index hızlandırır. Bugünkü veri boyutunda sequential scan
yeterli ve gerçek bir ihtiyaç doğmadan uzantı bağımlılığı almak doğru değil.

**Yan etki (istenen):** Arama aksana da duyarsız oldu — "kahvalti" artık
"kahvaltı"yı buluyor. Bir arama kutusunda fazla eşleşmek, hiç eşleşmemekten
iyidir.

**Reddedilen alternatif:** Aranan metinde `ı`→`i` çevirmek. "ısı" ile "isi"yi
eşleştirip **yanlış** sonuç üretirdi ve kayıt tarafını hiç düzeltmezdi.

**Dikkat:** `search-fold.ts`'teki tablo ile migration'daki `translate()`
çağrısı birebir aynı olmak zorunda. Bir test tabloların aynı uzunlukta
olduğunu koruyor — farklı olsalardı `translate()` sessizce karakter düşürürdü.

---

## ADR-023 — Herkese açık sayfalarda dil değişimi tam yeniden yükleme yapar
**Tarih:** 2026-08-13 · **Durum:** Kabul edildi

**Karar:** `LanguageToggle` iki davranış taşır. Uygulama içi sayfalarda
`router.refresh()` (bugünkü davranış korunuyor), herkese açık sayfalarda
(`PublicControls`: karşılama, giriş, kayıt, davet) `window.location.reload()`.

Hesaba yazan `PATCH /api/v1/me` isteği `keepalive: true` taşır — aksi halde
yeniden yükleme uçuştaki isteği iptal ederdi ve tercih hesaba hiç yazılmazdı.

**Neden:** Clerk'in giriş/kayıt formu kendi metinlerini taşıyor ve
`localization` ayarını **yalnızca başlarken** okuyor. `router.refresh()`
sunucu ağacını tazeliyor, `<html lang>` ve bizim metinlerimiz değişiyor, ama
zaten mount olmuş Clerk arayüzü eski dilde kalıyor. Sonuç, 12.2'nin
düzeltmeye çalıştığı hatanın aynısı: aynı ekranda iki dil.

Ölçüldü, tahmin edilmedi: `router.refresh()` sonrası form Türkçe kalıyordu,
tam yeniden yüklemede doğru dil geliyordu. Düzeltmeden sonra iki yön de
tarayıcıda doğrulandı.

**Neden her yerde değil:** `router.refresh()` istemci state'ini koruyor —
açık pencereler, yarım kalmış harcama formu. Uygulama içi sayfalarda Clerk
arayüzü **yok**, dolayısıyla o gerekçe orada hâlâ geçerli ve bozmaya sebep
yok. Herkese açık sayfalarda korunacak state de yok; oradaki tek form
Clerk'in kendi formu.

**Alternatif (reddedildi):** `ClerkProvider`'a `key={locale}` verip dil
değişince yeniden mount etmek. Kök layout tüm uygulamayı sarmalıyor, yani
uygulama içinde dil değiştiren kullanıcı bütün istemci state'ini kaybederdi —
yeniden yüklemenin bedelini ödeyip ekstra bir Clerk kurulumu da eklerdi.

---

## ADR-022 — Kullanıcının girdiği yüzde saklanır; geri hesaplama ancak ispatlanırsa kullanılır
**Tarih:** 2026-08-13 · **Durum:** Kabul edildi

**Karar:** `ExpenseParticipant` yeni bir **nullable** `basisPoints` kolonu
taşır. `PERCENTAGE` bölüşümde kullanıcının girdiği yüzde buraya yazılır;
`EQUAL` / `EXACT` bölüşümde `null` kalır. Yüzde audit snapshot'ına da girer.

Kolon eklenmeden önceki kayıtlar için yüzde **paylardan geri hesaplanabilir**,
ama yalnızca `inferBasisPoints` şu ispatı geçerse: aday yüzdeler
`splitByPercentage`'a geri verildiğinde **kayıtlı payların birebir aynısı**
çıkmalı. Çıkmıyorsa alan boş kalır.

**Neden kolon:** Düzenleme formu yüzde alanlarını boş açıyordu, çünkü yüzde
hiçbir yerde saklanmıyordu — elde yalnızca sonuç payları vardı. Yalnızca
açıklamayı düzeltmek isteyen kullanıcı bütün yüzdeleri yeniden yazmak zorunda
kalıyordu ve yaklaşık yazarsa paylar sessizce değişiyordu. Para kaydında bu
kabul edilemez.

**Neden nullable:** `EQUAL` bölüşümde yüzde diye bir şey yok. `0` yazmak
"yüzdesi sıfır" demek olurdu; doğru cevap "böyle bir bilgi yok". Eski
kayıtlarda da yüzde hiç saklanmadı — orada da `null` dürüst olan.

**Neden ispat, neden tahmin değil:** Yüzde → pay dönüşümü kayıplıdır. 100
kuruşun 34/33/33 bölünmesi hem `%33,33/%33,33/%33,34`'ten hem
`%34/%33/%33`'ten çıkar. `inferBasisPoints` **kullanıcının yazdığını
bulmaz** — kayıtlı payları birebir üreten *bir* yüzde kümesi bulur. Garanti
ettiği tek şey şu: **kullanıcı formu açıp hiçbir şeye dokunmadan kaydederse
tutarlar değişmez.** İspatı geçmeyen durumda alan boş kalır, yani bugünkü
davranış. Uydurup doldurmak, ADR-021'in "arayüz bilmediği şeyi söylemez"
kuralının para tarafındaki karşılığını çiğnerdi.

**Alternatif (reddedildi):** Kolon eklemeden her seferinde paylardan geri
hesaplamak. Yuvarlanmış yüzdeler tam `%100`'e toplanmayabilir; kullanıcı
formu açıp kaydete bastığında bir kuruş yer değiştirebilirdi.

---

## ADR-021 — Görsel dil kısıtlama üzerine kurulur; renk yalnızca durum taşır
**Tarih:** 2026-08-12 · **Durum:** Kabul edildi

**Karar:** Arayüzün karakteri renkten değil **yoğunluk, saç teli çizgiler ve
kesin tipografiden** gelir. Somut kurallar:

1. **Renk yalnızca durum taşır** — tutarın işareti (alacak/borç), doygunluğu
   düşük (kroma ≈ 0,10). Ödeşmiş durumda ekranda renk kalmaz.
2. **Kobalt üç yerde:** marka işareti, birincil düğme, bağlantı vurgusu.
   Zemin ya da geniş alan boyamaz.
3. **Ölçek küçük ve yoğun:** gövde 14 px, etiket 11 px büyük harf, sayfa
   başlığı 17 px. Tutar mono yazı tipiyle 38 px — afiş değil, arayüz.
4. **Kutu yerine çizgi:** `Card` deseni bırakılır. İçerik sayfanın üstünde
   durur, 1 px çizgilerle ayrılır. Köşe yarıçapı 8 px.
5. **Hareket 180 ms ve az.** Zıplama, yaylanma yok.
6. **Sayılar mono.** Rakamlar gövde metniyle aynı sesle konuşmaz.

**Neden:** Faz 11.2'de token sistemi kuruldu ama bileşen katmanına hiç
dokunulmadı; uygulama kutudan çıktığı gibi (stok shadcn) görünmeye devam
etti. Kullanıcı bunu "dünyanın en dümdüz sitesi" diye tarif etti ve haklıydı.

Yön üç denemede bulundu; ilk ikisinin **neden reddedildiği** kararın parçası:

| Deneme | Ne yapıldı | Neden reddedildi |
|---|---|---|
| 1 | Denge ekseni + bakiye çubukları, solgun renk yıkaması | Borsa terminali gibi durdu. Bakiye "veri" gibi görselleştirilmişti; bu bir arkadaş hesabı, gösterge paneli değil |
| 2 | Doygun renk alanı, büyük rakam, kişi yüzleri | Renk fazla iddialı geldi. Kişiler ve olgu metinleri **kaldı** |
| 3 | Kısıtlama: renk yalnızca işarette, küçük ölçek, çizgi deseni | Kabul edildi |

**Alternatifler:** Mevcut shadcn görünümünü korumak (kullanıcı reddetti);
veri görselleştirmesiyle karakter kazandırmak (deneme 1); doygun renk
alanıyla iddia kurmak (deneme 2).

**Sonuç:** Kimlik ~40 CSS değişkeninde durduğu için token katmanını
değiştirmek ucuz; pahalı olan `Card` deseninin sayfa sayfa terk edilmesi.
Bu, ADR-015'i (kobalt kimlik) **iptal etmiyor** — kobaltı ilk kez gerçekten
kullanıyor, çünkü o güne kadar yalnızca butonun üstündeydi.

Bir kural da metin için: **arayüz bilmediği şeyi söylemez.** "Tek bir
ödemeyle kapanıyor" cümlesi tasarım denemesinde yazılmış ve kaldırılmıştır;
`simplifyDebts` bir öneri üretir, kullanıcının nasıl ödeyeceğini bilemez.
Öneri bloğunun başlığı bu yüzden "Önerilen ödeme".

---

## ADR-020 — Eksik çeviri derleme hatasıdır, sessiz bir geri düşüş değil
**Tarih:** 2026-08-12 · **Durum:** Kabul edildi

**Karar:** `DICTIONARIES` tipi `Record<Locale, Record<MessageCode, string>>`.
`Partial` **kullanılmaz**. Yeni bir metin eklerken her iki dilin karşılığı
aynı anda yazılır; yazılmazsa `tsc` patlar.

**Neden:** Sözlük bir haritadır ve haritanın en kolay bozulma biçimi
**eksilmedir**. `Partial` ile, unutulan bir kod çalışma zamanında Türkçeye
düşerdi: İngilizce bir ekranın ortasında tek bir Türkçe cümle, konsola bir
uyarı bile düşmeden. Bunu yakalayan tek şey, o ekranı İngilizce açan bir
insanın gözü olurdu.

Bu, 11.4a'daki fikrin aynısı: `MessageCode` sözlükten **türetildiği** için
var olmayan bir kodu fırlatmak zaten derleme hatası. Aynı korumayı ikinci
dile de uyguluyoruz.

**Alternatifler:** `Partial` + eksikleri sayan bir test (test yazılmazsa ya
da unutulursa koruma yok; tip sistemi bedava ve unutulamaz); eksik çeviride
konsola uyarı basmak (uyarıyı kimse görmez); İngilizceyi kısmi bırakıp
zamanla tamamlamak (yarı çevrilmiş bir arayüz, hiç çevrilmemiş olandan daha
kırık görünür).

**Sonuç:** Bedeli gerçek: yeni bir Türkçe metin eklemek artık İngilizcesini
de yazmayı zorunlu kılıyor, ve "sonra çeviririm" diye bırakmak mümkün değil.
Kabul edilen bedel bu.

Tipin garanti **etmediği** bir şey var: yer tutucular. `"{amount} kuruşluk
alacağı var"` cümlesini `"has a credit"` diye çevirmek derlenir, testler
geçer ve ekranda tutar kaybolur — cümle hâlâ anlamlı olduğu için fark
edilmez. `messages.test.ts` içindeki "yer tutucuları iki dilde aynı" testi
bu boşluğu kapatıyor.
