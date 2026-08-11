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

---

## ADR-017 — İki dil: API kod döndürür, dil çerezde tutulur
**Tarih:** 2026-08-11 · **Durum:** Kabul edildi (uygulanmadı — Faz 11.3/11.4)

**Karar:** Türkçe ve İngilizce desteklenecek.

1. API hata **metni** değil **kodu** döndürür (`group.not_found`); metni
   istemci üretir.
2. Dil tercihi çerezde ve hesap kaydında tutulur; **URL'de dil segmenti yok**.
3. `formatMoney` / `parseMoney` dil parametresi alır ve bu iş **çeviriden
   önce** yapılır.

**Neden:**

1. Sunucu, isteğin hangi dilde cevaplanacağını bilemez — mobil istemci de
   aynı uçları çağıracak (ADR-002). Metin döndürmek, çeviri sözlüğünü
   sunucuya hapsederdi.
2. URL'de dil segmenti olsaydı tüm yönlendirmeler, davet linkleri ve 24 E2E
   testi değişirdi. Çerezle mevcut linkler olduğu gibi çalışır.
3. **Ayracın anlamı dile göre değişiyor.** `parseMoney` son ayraçtan sonraki
   basamak sayısına bakıyor: 3 basamak ⇒ binlik ayracı. Kullanıcı `2.500`
   yazdığında Türkçe kural `2500,00 ₺` okur; İngilizce niyet `2,50 ₺`'dir.
   **1000 kat fark.** Bu, 8. kuralın (finansal doğruluk en yüksek öncelik)
   tam merkezinde; yanlış okunan bir tutar, yanlış çevrilmiş bir etiketten
   çok daha pahalıdır.

**Alternatifler:** Sunucunun `Accept-Language` okuyup çeviriyi kendisinin
yapması (mobil istemciyi sunucunun desteğine bağımlı kılardı); yalnızca
arayüzü çevirip API mesajlarını Türkçe bırakmak (İngilizce kullanıcı hata
alınca Türkçe mesaj görürdü).

**Sonuç:** Mevcut ~40 hata mesajı koda dönüşecek ve onları kontrol eden
testler güncellenecek. Varsayılan dil Türkçe kaldığı için E2E testleri
değişmeden geçmeye devam etmeli.
