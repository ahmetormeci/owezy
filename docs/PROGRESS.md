# İlerleme Durumu

> Bu dosya **faz durumunun tek kaynağıdır**. Şu an ne yapıldığı için
> [CURRENT_TASK.md](CURRENT_TASK.md).
>
> **Numaralandırma notu:** Fazlar, işlerin **fiilen tamamlanma sırasına** göre
> numaralandırılmıştır (git geçmişinden doğrulanabilir). İlk plandaki
> numaralarla birebir örtüşmeyebilir — bu eşleşme doğrulanamadığı için
> numaralar burada yalnızca sıra belirtir.

**Özet:** 31 faz tamamlandı, **Faz 36 sürüyor** (1.0.1 build'i bekliyor). **Faz 35 ile iOS uygulaması
App Store'da yayında** (1.0, 4 Eylül 2026) — web zaten canlıydı, artık iki
istemci de kullanıcıya açık. Yayından sonra çıkan 2FA giriş hatasının sunucu
tarafı kapatıldı; mobil düzeltmesi 1.0.1'e kaldı (Faz 36). `main`'e giden her
değişiklik CI'dan geçiyor.

| Test | Sayı | Son durum |
|---|---|---|
| Birim — kök (Vitest) | 584 | ✅ tümü geçiyor |
| Birim — mobil (Vitest) | 77 | ✅ tümü geçiyor |
| Ekran — mobil (jest-expo) | 18 | ✅ tümü geçiyor |
| E2E (Playwright) | 57 | ✅ tümü geçiyor |
| `npx tsc --noEmit` | — | ✅ temiz (kök + mobil) |
| `npm run lint` | — | ✅ temiz (kök + mobil) |

Mobilde **iki koşucu** var ve sınır dizine göre (ADR-042, ADR-043):
`lib/**` → Vitest, `components/**` ve `test/screens/**` → jest-expo. Mobil
testler kökten koşmuyor — ağaçta iki ayrı React kopyası var.

---

## Faz 1 — Proje kurulumu ve veritabanı bağlantısı · **DONE**

**Yapıldı:** Next.js + TypeScript iskeleti, Prisma 7 yapılandırması
(`prisma.config.ts`), 9 modelli şema, elle yazılmış kısıt/trigger bloğuyla ilk
migration, Neon bağlantısı (`@prisma/adapter-neon`), `/api/v1/health`.

**Test:** Yok (altyapı fazı).
**Commit:** `b0cafc4`, `8a15357`, `e9cbf8d`

---

## Faz 2 — Kimlik doğrulama ve gruplar · **DONE**

**Yapıldı:** Clerk entegrasyonu, `getOrCreateCurrentUser` ile kullanıcı
eşleme, grup oluşturma/listeleme, link tabanlı davet ve katılım.

**Test:** Manuel (curl / tarayıcı konsolu).
**Commit:** `f2adb48`, `9fb0e19`

---

## Faz 3 — Bölüşüm mantığı ve harcama CRUD · **DONE**

**Yapıldı:** Vitest altyapısı; `src/lib/split.ts` (EQUAL / EXACT /
PERCENTAGE, largest remainder); `createExpense`; harcama API'si; güncelleme,
silme, geri yükleme; `ExpenseEdit` audit log'u; cursor sayfalamalı listeleme.

Bu fazda yetki kuralı değişti: kaydı yalnızca oluşturan kişi
değiştirebilir (bkz. [DECISIONS.md](DECISIONS.md) ADR-009).

**Test:** Birim testler bu fazda başladı (split 31 test → faz sonunda 113).
**Commit:** `0c35de3`, `30c68d8`, `2c9a689`, `a2f245a`, `5c318ba`, `9e1c42f`

---

## Faz 4 — Bakiye hesaplama ve borç sadeleştirme · **DONE**

**Yapıldı:** `calculateBalances` (saf fonksiyon), `simplifyDebts` (greedy;
≤ n−1 transfer — gerçek minimum NP-hard), `getGroupBalances` servisi,
`/api/v1/groups/[groupId]/balances`.

Ayrılmış ama bakiyesi sıfırlanmamış üyeler listede kalır — aksi halde para
"kaybolmuş" görünürdü.

**Test:** 138 birim testi.
**Commit:** `d548ac6`

---

## Faz 5 — Ödeme (settlement) kayıtları · **DONE**

**Yapıldı:** `createSettlement`, `listSettlements`, `cancelSettlement`;
ödeme kaydını yalnızca tarafları girebilir; ayrılmış üyeyle ödeme
kaydedilebilir (borç kapatılabilmeli).

**Test:** 152 birim testi.
**Commit:** `6c4ca0d`

---

## Faz 6 — Davet iptali ve üyelik yönetimi · **DONE**

**Yapıldı:** Davet iptali (davet eden **veya** OWNER), davet listeleme
(`tokenHash` asla seçilmez), gruptan ayrılma (bakiye kapalı olmalı, OWNER
sahipliği devretmeli), üye çıkarma, son üye ayrılınca grubun arşivlenmesi.

**Test:** 220 birim testi.
**Commit:** `23a9f3f`

---

## Faz 7 — Web arayüzü · **DONE**

**Yapıldı:** shadcn/ui (Base UI, "Nova") kurulumu; grup listesi ve detayı,
harcama formu (üç bölüşüm tipi + canlı önizleme), harcama listesi ve
sayfalama, bakiye kartları, ödeme kaydı penceresi, üye ve davet yönetimi,
davet kabul sayfası.

Manuel testte çıkan 4 hata aynı fazda düzeltildi (grup açıklaması
düzenlenemiyordu, silme penceresi kapanmıyordu, iptal edilen davet linki hâlâ
davet gösteriyordu, tükenmiş davet "iptal et" sunuyordu).

**Test:** 276 birim testi.
**Commit:** `072f3bc`, `c4c3972`

---

## Faz 8 — Canlıya çıkış (Vercel + Sentry) · **DONE**

**Yapıldı:** `build`/`vercel-build` script'leri (Prisma 7'de postinstall
olmadığı için `prisma generate` şart), Sentry (`instrumentation.ts` +
`instrumentation-client.ts`, PII kapalı), `.env.example`, ayrı production
veritabanı, Vercel deploy.

**Doğrulandı (canlıda):** ana sayfa, korumalı sayfa yönlendirmesi, webhook'un
imzasız isteği 400 ile reddetmesi, Sentry'ye olay ulaşması.

**Bilinen sınır:** Clerk **development** anahtarlarıyla çalışıyor; gerçek
kullanıcılara açmadan önce alan adı + production instance gerekiyor.

**Test:** 316 birim / 21 E2E.
**Commit:** `02cc5e6`

---

## Faz 9 — Clerk webhook ile kullanıcı senkronizasyonu · **DONE**

**Yapıldı:** `/api/webhooks/clerk` (imza doğrulaması), `syncUserFromClerk`,
`markUserDeletedFromClerk` (anonimleştirme + sahiplik devri + grup arşivleme),
`User.clerkUpdatedAt` migration'ı.

**Doğrulandı (canlıda):** Clerk panelinden webhook tanımlandı; yeni kayıt
`User` satırı oluşturdu.

**Test:** 301 birim testi (17 yeni).
**Commit:** `61180fc`

---

## Faz 10 — Bildirimler · **DONE**

**Yapıldı:**
- 10.1 `NotificationType` 6 değere çıktı, `(userId, createdAt)` index'i
- 10.2 `src/lib/notifications.ts` + altı olaya bağlantı
- 10.3 `/api/v1/notifications` (liste, tekil okundu, tümü okundu)
- 10.4 Zil ikonu + açılır liste, `notification-text.ts` (saf fonksiyon)

**Doğrulandı (canlıda):** Kullanıcı tarafından uçtan uca denendi ve çalıştığı
teyit edildi.

**Test:** 342 birim / 24 E2E.
**Commit:** `e26ede0`, `98054f0`

---

## Faz 11 — Tasarım yenilemesi + iki dil · **DONE**

Tasarım yönü onaylandı: kobalt kimlik (yeşil/kırmızı zaten alacak/borç anlamı
taşıdığı için kimlik rengi onlarla çakışmamalı), bakiye odaklı hiyerarşi,
eşit genişlikli rakamlar.

| Aşama | Durum | İş |
|---|---|---|
| 11.1 | **DONE** | Yazı tipi hatası + koyu tema bağlantısı |
| 11.2 | **DONE** | Tasarım tokenları (kobalt, alacak/borç, tipografi ölçeği) |
| 11.3 | **DONE** | Para biçimlendirmesi dile duyarlı hale gelir |
| 11.4a | **DONE** | API hata kodları (görünür değişiklik yok) |
| 11.4b | **DONE** | Arayüzdeki gömülü metinler sözlüğe taşınır |
| 11.4c | **DONE** | Dil çerezden okunur, `formatMoney`'e geçirilir, dil düğmesi |
| 11.4d-1 | **DONE** | İngilizce sözlük + herkese açık sayfalara dil düğmesi |
| 11.4d-2 | **DONE** | `User.locale` migration + hesap tercihi + `PATCH /api/v1/me` |
| 11.5 | **DONE** | Grup sayfası hiyerarşisi |
| 11.6 | **DONE** | Görsel dilin uygulanması (ADR-021) — token'lar, `Card` deseninin terki, avatarlar |

**11.1'de yapıldı:** `globals.css`'teki `--font-sans: var(--font-sans)`
kendine referans veriyordu; site arayüz fazından beri Times New Roman'da
render ediliyormuş. Tek satırla düzeltildi. Koyu palet zaten yazılıydı ama
`ThemeProvider` olmadığı için `.dark` sınıfı hiç uygulanmıyordu — bağlandı,
tema düğmesi eklendi.

**11.2'de yapıldı:** Kobalt kimlik, `--credit` / `--debt` anlam tokenları,
`oklch()` tabanlı iki ayrı tema paleti, `money` yardımcı sınıfı (eşit
genişlikli rakamlar), `formatSignedMoney` (renk artık tek başına bilgi
taşımıyor), tipografi ölçeğine iki basamak, marka işareti. Sayfalardaki
doğrudan renk sınıfları (`text-emerald-600` vb.) kaldırıldı.

11.6'nın kapsamındaki **karşılama sayfası öne alındı**: kobalt bir uygulamanın
önünde gri bir karşılama sayfası tutarsız olurdu. Butonların sırası da
değişti, birincil eylem ("Kayıt ol") öne geçti.

**11.3'te yapıldı:** `formatMoney` ve `formatBasisPoints` dil parametresi
aldı (varsayılan `tr`). `parseMoney`'ye **dokunulmadı** — ölçüldüğünde zaten
dilden bağımsız olduğu görüldü, ADR-017'nin bu maddesi düzeltildi.

Dilin **nereden geldiği** henüz bağlı değil; fonksiyonlar saf, tesisat
11.4'ün işi. Bugün her çağrı varsayılanı kullandığı için ekran çıktısı
bit bit aynı.

**11.4a'da yapıldı:** 54 `throw` noktası metin yerine kod taşıyor; sözlük
`src/lib/messages.ts`. `MessageCode` tipi sözlükten türediği için var olmayan
bir kodu fırlatmak derleme hatası — "çevirisi unutulmuş mesaj" oluşamıyor.
Çeviri `apiRequest` içinde yapılıyor, o yüzden onu çağıran 9 bileşen
değişmedi. Çıktı bit bit aynı kaldı, 24 E2E testi değişmeden geçti.

**11.4 neden dörde bölündü:** 11.4a'da ekran çıktısının değişmemesi
gerekiyordu; bu, 24 E2E testini tam bir regresyon ağına çevirdi. Dil
tesisatı aynı commit'te olsaydı bir test kırıldığında sebebi iki değişiklik
arasından aramak gerekirdi.

**11.4b'de yapıldı:** 18 dosyadaki ~190 gömülü metin sözlüğe taşındı.
Erişim iki kapıdan: `useTranslate()` (istemci, hook) ve `getTranslate()`
(sunucu, async) — Server Component'lar hook kullanamadığı için ikisi ayrı.
İkisi de şimdilik sabit `tr` döndürüyor; 11.4c yalnızca bu iki fonksiyonun
içini değiştirecek, ~190 çağrı yeri bir daha açılmayacak.

Mekanik olmayan üç yer: JSX'te birleştirilen **cümle parçaları** bütün
parametreli cümleye dönüştü (İngilizcede kelime sırası ters), bildirim
metinleri saf fonksiyon kalsın diye çeviriciyi **varsayılanlı parametre**
olarak aldı, ve sabit `metadata` nesnesi `generateMetadata`'ya çevrildi.

**11.4c'de yapıldı:** Dil artık gerçekten okunuyor. Çerez adı, doğrulaması ve
`Locale` tipi `locale.ts`'te tek yerde: çerezi **istemci** yazıyor, **sunucu**
okuyor ve ikisinin ortak bir eve ihtiyacı vardı (`i18n-server.ts` server-only,
`i18n.tsx` "use client" — ikisi de bu işi yapamazdı).

Çerezden gelen değer beyaz listeden geçiyor. Ham değer `Intl`'e gitseydi
`RangeError` fırlar ve sunucuda render edilen sayfa 500 verirdi — tarayıcı
konsolundan `document.cookie` yazarak uygulamayı çökertmek mümkün olurdu.
Gerçek sunucuda denendi: `locale=zz-ZZ` → sayfa 200, Türkçeye düşüyor.

**Kapsam tarifin ötesine geçti:** dört yerde `Intl.DateTimeFormat("tr-TR")`
sabit yazılıydı. İngilizce kullanıcı tutarları doğru, tarihleri Türkçe
görürdü — 11.3'ün düzelttiği hatanın aynısı. `dates.ts` bu dördünü tek
fonksiyona indirdi.

**11.4b'den kaçan üç gömülü metin bulundu:** `settlement-list.tsx`'te iki
`?? "Bilinmeyen"` ve karşılama sayfasında sabit `360,00 ₺`. Üçü de Türkçe
karakter içermediği için 11.4b'nin taramasına takılmamıştı.

**11.4d-1'de yapıldı:** 231 kodun İngilizcesi yazıldı. `DICTIONARIES` tipinden
`Partial` **kaldırıldı** — eksik bir çeviri artık derleme hatası (ADR-020).

Göreli zamanlar (`3 dakika önce`) sözlükten çıkıp `Intl.RelativeTimeFormat`'a
geçti: `{count} dakika önce` şablonu İngilizcede `1 minutes ago` yazardı.
Türkçede çoğul eki olmadığı için şablon çalışıyordu. `numeric: "always"` ile
Türkçe çıktı birebir aynı kaldı — mevcut testler değişmeden geçti.

Dil ve tema düğmeleri herkese açık dört sayfaya eklendi (`PublicControls`).
11.4c'nin bilerek bıraktığı boşluk buydu: İngilizce metin geldiği anda giriş
yapmamış ziyaretçi dili değiştiremez hale gelirdi.

Üç yazım hatası düzeltildi (`kisiden`, `cikarilsin`, `kullanildi`).

**11.4d-2'de yapıldı:** `User.locale` kolonu (nullable, varsayılansız) ve
`PATCH /api/v1/me`. Okuma sırası çerez → hesap → `tr`; çerez "bu cihazda, şu
an" cevabı, hesap yeni bir cihaz için yedek.

Naif uygulama her isteğe bir sorgu eklerdi: çerezi olmayan giriş yapmış
kullanıcı = düğmeye hiç basmamış herkes. `getOrCreateCurrentUser`'ın okuma
adımı `cache()` ile sarılı `findCurrentUser()`'a taşındı; `getLocale()` ile
`(app)` layout aynı istekte aynı satırı **tek sorguda** paylaşıyor. Net ek
maliyet sıfır, çıkış yapmış ziyaretçide hiç sorgu yok.

`getLocale()` **kayıt oluşturmaz** — `getOrCreateCurrentUser()` yan etkili ve
kök layout'tan çağrılsaydı karşılama sayfasının render'ı kullanıcı satırı
üretirdi. Ayrı bir test bunu koruyor.

**11.5'te yapıldı:** Grup sayfası altı eşit bloktan üç kademeli dört bloğa
indi (ADR-016). Durum paneli kart olmaktan çıkıp sayfanın baskın bloğu oldu;
"kime ödeyeceğim" de içine girdi — o, "ne kadar borçluyum"un ikinci yarısı ve
ayrı bir kartta eşit ağırlıktaydı. Harcamalar gövdeye çıktı; üyeler,
kaydedilen ödemeler ve "grubun geri kalanı" üçüncü kademeye indi.

Öneriler artık filtreleniyor: panelde yalnızca beni içerenler, grubun kalanı
ikincil kartta (boşsa hiç görünmüyor).

Satır metinleri **fiili başlığa taşıdı** ("Ödemen gerekenler" + isim + tutar).
`"{name} kişisine {amount} öde"` şablonu Türkçede ek ister ve ek ismin son
harfine göre değişir (*Ayşe'ye*, *Burak'a*) — yer tutucuyla doğru yazılamaz.

**Ekran görüntüsü gerçek bir hata yakaladı:** mobilde sayfa yatay kayıyordu
(390 px viewport'ta belge 550 px). Grid çocuklarının varsayılan
`min-width: auto` değeri içeriğin altına inmeyi reddediyor; uzun isimler
sütunu genişletiyor ve `truncate` devreye giremiyor. İki `min-w-0` ile
düzeltildi. E2E bunu yakalayamazdı — testler metnin varlığına bakıyor,
sayfanın kaydığına değil.

**11.6'da yapıldı:** Token katmanı ADR-021'e göre yeniden yazıldı, `Card`
deseni `/join/[token]` dışında her yerden kalktı, avatarlar geldi
(`User.hasImage` kolonu + `PersonAvatar`). Ayrıntı CHANGELOG'da.

**Doğrulandı (canlıda):** `User.locale` ve `User.hasImage` migration'larının
production veritabanına uygulandığı Vercel build log'undan teyit edildi.

**Test:** 410 birim / 27 E2E.
**Commit:** `a125fc3` (11.2), `eb861af` (11.3), `18abd81` (11.4a),
`9b01802` (11.4b), `79f1d10` (11.4c), `648b558` (11.4d-1), `2289e0f` (11.4d-2),
`af3299e` (11.5), `dfab327` + `9632123` (11.6) — hepsi push edildi.

**Sıra neden böyle:** Para biçimlendirmesi (11.3) çeviriden (11.4) önce
geliyor — yanlış okunan bir tutar, yanlış çevrilmiş bir etiketten pahalıdır.

---

## Faz 12 — Açılış öncesi düzeltmeler · **DONE**

Gerçek kullanıcı gelmeden kapatılması gereken dört küçük iş. Ortak noktaları
yeni yetenek getirmemeleri: dördü de **bugün yanlış olan bir şeyi** düzeltiyor.

| Aşama | Durum | İş |
|---|---|---|
| 12.1 | **DONE** | Yüzdeli harcamayı düzenlemek yüzdeleri siliyor |
| 12.2 | **DONE** | Clerk giriş/kayıt formu Türkçe modda İngilizce |
| 12.3 | **DONE** | `createGroupSchema` desteklenmeyen para birimini kabul ediyor |
| 12.4 | **DONE** | `middleware.ts` → `proxy.ts` (Next 16 deprecation'ı) |

**Sıra neden böyle:** 12.1 tek veri bütünlüğü hatası — kullanıcının girdiği
tutarı sessizce değiştirebiliyor. Diğer üçü yanlış ama zararsız.

**12.1'de yapıldı:** `ExpenseParticipant.basisPoints` kolonu (nullable) ve
eski kayıtlar için ispata bağlı geri hesaplama (ADR-022). Yüzde audit
snapshot'ına da girdi. Form alanlarını dolduran metin `String(amount / 100)`
float bölmesinden `formatMoneyForInput`'un tam sayı aritmetiğine geçti ve
ondalık ayracı dile duyarlı oldu.

Kırılan dört birim testi bütün nesneyi karşılaştırdığı için kırılmıştı;
düzeltmenin yanına yeni davranışın testleri de yazıldı. **Yeni E2E testi:**
yüzdeli harcama düzenlenirken alanların dolu geldiği ve dokunmadan
kaydetmenin bölüşümü bozmadığı uçtan uca doğrulanıyor.

**12.2'de yapıldı:** `@clerk/localizations` (4.15.1) eklendi ve `ClerkProvider`
Türkçe modda `trTR` alıyor. İngilizcede **bilerek hiçbir şey gönderilmiyor** —
Clerk'in yerleşik varsayılanı zaten İngilizce, `enUS` göndermek 1444 metni
boşuna RSC yüküne eklerdi.

Doğrulama sırasında **gerçek bir hata çıktı:** Clerk `localization`'ı yalnızca
başlarken okuyor. `router.refresh()` sunucudan yeni dili getiriyor ama zaten
mount olmuş form eski dilde kalıyordu — dil düğmesine basan ziyaretçi yarısı
Türkçe yarısı İngilizce bir ekran görüyordu, yani düzeltilen hatanın aynısı.
Çözüm ADR-023'te: herkese açık sayfalarda dil düğmesi tam yeniden yükleme
yapıyor. Tarayıcıda iki yönde de ölçüldü.

**12.3'te yapıldı:** `currency` artık `z.string().length(3)` değil,
`z.enum(SUPPORTED_CURRENCIES)`. Liste `money.ts`'te duruyor — kısıtın sebebi
orada yaşıyor: `formatMoney`/`parseMoney` her para biriminin **iki ondalık
basamağı** olduğunu varsayıyor, `JPY` (sıfır ondalık) ile açılan bir grupta
tutarlar 100 kat küçük görünürdü.

`formatMoney`'nin `currency` parametresi **bilerek daraltılmadı**: o,
veritabanında ne yazıyorsa onu göstermek zorunda. Daraltmak eski ya da elle
oluşturulmuş bir kaydı okunamaz yapardı. `createGroup`'un girdi tipi ise
daraldı — şema çalışma zamanında, tip derleme zamanında eliyor.

Ölçüldü: dev ve E2E veritabanlarında yalnızca `TRY` var, yani daraltma hiçbir
mevcut kaydı etkilemiyor. Arayüz zaten `currency` göndermiyor; açık yalnızca
API'den ulaşılabilirdi.

EUR ve GBP de iki ondalıklı, yani teknik olarak güvenli; listede
olmamalarının sebebi ürün kapsamı, hesaplama değil.

**12.4'te yapıldı:** `src/middleware.ts` → `src/proxy.ts` (`git mv`, geçmiş
korundu). Next 16 dosya kuralını yeniden adlandırdı; **özellik aynı**.

Belgelerde iki nokta çıktı, ikisi de sadece yeniden adlandırma olmadığını
gösteriyor: **Proxy Node.js runtime'ında** çalışıyor ve `runtime` config
seçeneği burada **kullanılamıyor** (verilirse Next hata fırlatıyor). Dosyamız
runtime belirtmediği için etkilenmedi.

Ölçüldü, varsayılmadı: dev sunucusu artık zamanlama dökümünde `proxy.ts`
yazıyor (`middleware` deprecation uyarısı yok), giriş yapmamış istek
`/groups` → 307 → `/sign-in` ile yönleniyor, tam E2E koşusunda üç auth testi
dahil 28 test geçiyor.

Dosyanın kendi yorumu da düzeltildi: "hangi route'ların giriş zorunlu
kılacağını burada netleştireceğiz" yazıyordu — o karar alındı ve **tersi**
yönde (koruma `(app)/layout.tsx`'te, ADR gerekçesi ARCHITECTURE.md'de).

**Test:** 434 birim / 28 E2E.
**Commit:** `3578386` (12.1), `d18997f` (12.2) — push edildi.
`90fb6b5` (12.3), `07a8e7d` + `40a6095` (12.4) — **push edilmedi**.

12.4 ikiye bölündü çünkü tek commit'te yorum da değişince git dosyayı
%100 rename saymıyor ve `git log --follow` zinciri kopuyordu. Şimdi saf
rename ayrı: dosyanın geçmişi `f2adb48`'e (Faz 2) kadar takip ediliyor.

---

## Faz 13 — Grup sayfası 100 harcamada · **DONE**

Sayfa 2 harcamada iyi çalışıyor, 100 harcamada üç ayrı şey bozuluyor — **yön**
(ay sınırı yok), **anlam** ("nereye gitti" sorusunun cevabı hiçbir yerde yok)
ve **bulma** (arama/filtre yok). Grafik yalnızca ikincisine cevap veriyor.

| Aşama | Durum | İş |
|---|---|---|
| 13.1 + 13.2 | **DONE** | Ay başlıkları + özet bloğu (bakiyenin açıklaması + kategori/ay kırılımı) |
| 13.3a | **DONE** | Arama + kategori + "yalnızca beni ilgilendirenler" + sonuç satırı |
| 13.3b | **DONE** | CSV dışa aktarma |

**13.1 ve 13.2 neden birleşti:** Ay başlığındaki toplam ekrandaki 20 kayıttan
hesaplanamaz — bir ay sayfa sınırını aştığında sessizce yanlış olurdu. Doğru
toplam özetin verisinden geliyor, yani 13.1 zaten 13.2'nin veri katmanına
bağımlıydı. Ayrı yapmak aynı yere iki kez dokunmak olurdu.

**13.1 + 13.2'de yapıldı:**

- `loadGroupFinancials` (`balances.ts`) — grubun harcama ve ödemelerini okuyan
  tek yer, `cache()` ile sarılı. Bakiye ve özet aynı istekte **tek sorgu**
  paylaşıyor; sarılmasaydı sayfa bütün harcamaları iki kez okurdu.
- `summary.ts` — saf `calculateGroupSummary` + `getGroupSummary` servisi.
  Yüzdeler basis point, float yok. Ay anahtarı `toISOString()`'ten alınıyor
  (`getMonth()` DEĞİL — `@db.Date` UTC gece yarısı döner ve UTC'nin
  gerisindeki bir dilimde ayın ilk günü bir önceki aya düşerdi).
- `GET /api/v1/groups/[groupId]/summary` — mobil istemci için.
- `GroupSummary` bileşeni + harcama listesinde ay başlıkları.
- `formatMonth` (`dates.ts`), `formatBasisPoints` yeniden kullanıldı.

**Ekran görüntüsü yine gerçek bir hata yakaladı:** aylık sütunları
`bg-panel-strong` ile boyamıştım — o zemin rengi, açık temada neredeyse
görünmüyordu ve sütunlar boş kutu gibi duruyordu. Ayrıca tutar etiketi sabit
yükseklikli kabın dışına taşıp kırpılıyordu. Sütunlar kobalta çevrildi,
çubuk kendi sabit kabına alındı. **Tek aylık grafik artık hiç
gösterilmiyor** — karşılaştıracak ikinci sütun yokken grafik bir şey
anlatmıyor.

**E2E artık düzen hatası da yakalıyor:** yeni testin sonunda 390 ve 768 px'te
`scrollWidth > innerWidth` ölçülüyor. 11.5'teki yatay kayma ancak ekran
görüntüsüyle yakalanmıştı; bu ölçüm o boşluğu kapatıyor.

**13.3a'da yapıldı:** `listExpenses` artık `q`, `category` ve `mine`
alıyor; filtre **sunucuda**. Ekrandaki 20 satırı süzmek, aranan kayıt sonraki
sayfadayken "sonuç yok" demek olurdu.

"Beni ilgilendiren" **katılımcılığa** bakıyor, ödeyene değil: başkası adına
ödeyip bölüşüme girmeyen kişinin bakiyesi değişir ama o harcama onun kendi
harcaması değildir. E2E bunu tam olarak bu senaryoyla doğruluyor.

**Bir çelişki çözüldü:** filtre açıkken ay başlığı o ayın tam toplamını
göstermeye devam etseydi, süzülmüş bir listenin üstünde yanlış bir sayı
dururdu. Filtre açıkken ay toplamları gizleniyor, yerine tek bir sonuç satırı
yazıyor (`1 sonuç · 100,00 ₺`). O sayı listenin **aynı** `where`'inden geliyor;
bir test iki koşulun eşit olduğunu koruyor.

**TÜRKÇE ARAMA SINIRI (ölçüldü):** veritabanı collation'ı `C.UTF-8`. Büyük
`I` küçültülünce `i` oluyor, `ı` değil — yani "Işık" yazan bir harcama "ışık"
aramasıyla **bulunmuyor**. Diğer Türkçe harflerde sorun yok, "İstanbul" da
"istanbul" ile eşleşiyor. Düzgün çözüm Türkçe katlama yapan üretilmiş bir
kolon + index; kendi başına bir iş. Aranan metinde `ı`→`i` çevirmek **çözüm
değil**, "ısı" ile "isi"yi eşleştirip yanlış sonuç üretir.

**13.3b'de yapıldı:** `GET /api/v1/groups/[groupId]/expenses/export`, `csv.ts`
(saf) ve filtre çubuğundaki dışa aktarma bağlantısı.

Kullanıcının isteği "Excel'de açabileyim"di, o yüzden hedef **doğru CSV**
değil **Excel'de düzgün açılan CSV**:

- **UTF-8 BOM** — onsuz Türkçe Windows'ta Excel dosyayı yerel kod sayfasıyla
  okuyor ve Türkçe harfler bozuluyor.
- **Ayraç dile bağlı** (`tr` → `;`, `en` → `,`) ve **ondalık ayracıyla
  birlikte** değişiyor. İkisi ayrışırsa `120,50` değeri virgüllü ayraçla iki
  hücreye bölünür ya da Türkçe Excel tutarı metin sanır.
- **Para birimi başlıkta, hücrede değil** — `120,50 ₺` yazan bir hücre Excel'de
  sayı değil metin olur ve toplanamaz.
- **ISO tarih** (`2026-08-13`) — belirsizlik yok ve metin olarak sıralandığında
  kronolojik kalıyor.
- Açıklama kullanıcıdan geldiği için RFC 4180 kaçışı şart: ayraç, tırnak ya da
  satır sonu içeren değer tırnaklanıyor, iç tırnaklar ikiye katlanıyor.

**Dışa aktarma filtreyi izliyor ama sayfayı izlemiyor:** eşleşen her kayıt
iniyor, ekrandaki 20 değil. Sessizce kırpılmış bir mali dosya, yanlış bir
toplamdan daha kötü — eksik olduğu hiçbir yerde belli olmaz. Filtre koşulu
listelemeyle **aynı** fonksiyondan geliyor (`buildExpenseWhere`).

E2E dosyanın indiğini değil **içeriğini** doğruluyor: BOM, başlık satırı,
noktalı virgül ayraç, noktalı virgül içeren bir açıklamanın tırnaklanması ve
filtreliyken satır sayısının düşmesi.

**Test:** 465 birim / 31 E2E.
**Commit:** `b301e85` (13.1+13.2), `7bfd57f` (13.3a) — push edildi.
`35c7fee` (13.3b) — **push edilmedi**.

### Faz 13'ten kalan borç

- ~~**Ürün riski:** `category` varsayılanı `OTHER`, kırılım tek çubuk "Diğer"
  olur.~~ **Faz 17'de çözüldü** (ADR-028): kategori açıklamadan tahmin
  ediliyor. Tamamen ortadan kalkmadı — harcamaları gerçekten tek kategoriye
  düşen grupta kırılım hâlâ tek çubuk, ama artık çubuk hiç çizilmiyor.
- **Dışa aktarmada limit yok** (`listExpensesForExport`). Bilerek: kırpılmış
  bir mali dosyanın eksik olduğu hiçbir yerde belli olmaz. Grup sayfasındaki
  toplamalar 14.5'te SQL'e taşındığı için limitsiz kalan tek okuma bu ve
  yalnızca kullanıcı dosyayı indirdiğinde çalışıyor.
- **Arama index'i yok.** `%metin%` kalıbını ancak `pg_trgm` + GIN
  hızlandırır; gerçek ihtiyaç doğmadan uzantı bağımlılığı alınmadı (ADR-024).

---

## Faz 14 — Açılış öncesi borç kapatma · **DONE**

Kullanıcı alan adını almadan önce aday listesindeki borçların kapatılmasını
istedi. Hiçbiri yeni yetenek değil.

| # | Durum | İş |
|---|---|---|
| 14.1 | **DONE** | Zile tıklayınca bildirimler okundu sayılıyor |
| 14.2 | **DONE** | `--chart-1..5` kaldırıldı |
| 14.3 | **DONE** | `createGroup` / `acceptGroupInvite` birim testleri |
| 14.4 | **DONE** | Türkçe arama katlaması (ADR-024) |
| 14.5 | **DONE** | Bakiye/özet toplaması SQL'e taşındı (ADR-025) |
| 14.6 | **DONE** | Bildirim saklama politikası (60 gün) |

**14.1:** Menüyü açmak artık bildirimleri okundu sayıyor; elle basılan "tümünü
okundu işaretle" düğmesi kalktı (açılışta sayı zaten sıfırlanacağı için hiç
görünmezdi). **İncelik:** rozet anında sıfırlanıyor ama listedeki `readAt`'e
dokunulmuyor — mavi noktalar menü açık kaldığı sürece duruyor, kullanıcı
hangisinin yeni olduğunu okurken görebiliyor. Okundu işaretleme listeden
**sonra** gidiyor: istek başarısız olursa bildirimler okunmamış kalıyor.

**14.2:** Beş renk hiçbir yerde kullanılmıyordu ve ADR-021 ile çelişiyordu.
`globals.css`'in token açıklamasına **neden palet olmadığı** yazıldı — yoksa
biri "grafik rengi yok" deyip geri ekler.

**14.3:** İkisi de yalnızca E2E'nin dolaylı kapsamındaydı. 13 yeni test;
aralarında bir güvenlik iddiası var: davet **ham token'la değil hash'iyle**
aranıyor ve ham token hiçbir sorgu argümanında geçmiyor.

**14.4:** Ayrıntı ADR-024'te. Ölçüldü: SQL `translate()` ile JS
`foldForSearch()` 10 zor örnekte ve mevcut 12 kayıtta **sıfır fark**.

**14.5:** Ayrıntı ADR-025'te. Dürüst not: bugünkü veri boyutunda ölçülebilir
bir kazanç yok, kazanç ölçekte başlıyor.

**14.6:** Bildirimler **60 gün** saklanıyor (kullanıcı 45–60 dedi, güvenli uç
alındı). Temizlik **okuma sırasında**: cron yok ve kullanıcı zaten orada.
Silme `deleteMany` ile ve `where`'de `userId` var — hem başkasının kaydına
dokunmuyor hem de mevcut `(userId, createdAt)` index'i tam bu sorguyu
karşılıyor, yani eski kayıt yoksa maliyeti bir index taraması. Liste
sorgusuyla **paralel** gidiyor, gecikme eklemiyor.

**Bu, "finansal kayıtlar silinmez" kuralını çiğnemiyor:** bildirim finansal
kayıt değil, olan biteni haber veren geçici bir işaret; payload'ı zaten bir
anlık görüntü. Harcama, ödeme ve audit log'a dokunulmuyor.

**Test:** 493 birim / 32 E2E.
**Commit:** `671e7d4` (14.1+14.6), `020955e` (14.3), `ea48316` (14.2),
`948f93c` (14.5), `257912c` (14.4) — hepsi push edildi.

---

## Faz 15 — Kendi alan adı ve production kimlik doğrulama · **DONE**

Faz 8'den beri bilinen sınır: uygulama Clerk'in **development** anahtarlarıyla
çalışıyordu ve gerçek kullanıcıya açılamıyordu. Alan adı işini kullanıcı
üstlenmişti; `owezy.net` alınınca bu faz açıldı.

| # | Durum | İş |
|---|---|---|
| 15.1 | **DONE** | DNS Squarespace'ten Cloudflare'e; Vercel kayıtları proxy kapalı |
| 15.2 | **DONE** | Clerk production instance ve alan adı doğrulaması |
| 15.3 | **DONE** | GitHub ve Google için kendi OAuth uygulamalarımız |
| 15.4 | **DONE** | Webhook production instance'ta yeniden tanımlandı |
| 15.5 | **DONE** | Uygulama adı SplitApp → Owezy |

**Kararların gerekçesi ADR-026'da** (proxy neden kapalı, apex neden birincil,
sosyal girişler için neden kendi OAuth uygulamalarımız).

**Kod değişikliği yalnızca 15.5:** `ui.app_name` (TR + EN) ve `brand-mark.tsx`
yorumları. Arayüzdeki isim tek yerden geldiği için iki satır yetti. Geri kalan
her şey panel işi oldu — kodda hiçbir yerde sabit alan adı yok.

**Yolda iki gerçek hata çıktı, ikisi de öğreticiydi:**

1. **`NEXT_PUBLIC_` değişkenleri derleme anında gömülür.** Vercel'de
   publishable key değiştirildi ama site günlerce değil, deploy'lar boyunca
   `pk_test_` sunmaya devam etti: derleme önbelleği eski değeri taşıyan paketi
   yeniden kullanıyordu. Önbelleksiz deploy çözdü. Sunucu tarafı sırları
   (`CLERK_SECRET_KEY`) bu sorunu yaşamaz — onlar çalışma anında okunuyor.
2. **Webhook 400 döndü: `Base64Coder: incorrect characters`.** Sır yanlış
   değil **bozuktu** — Clerk sırrı `.env` satırı biçiminde gösteriyor
   (`CLERK_WEBHOOK_SIGNING_SECRET=whsec_...`) ve satırın tamamı değer kutusuna
   yapıştırılmıştı. Hata mesajı ayırt ediciydi: yanlış ama geçerli bir sır
   imza uyuşmazlığı verirdi, çözümleme hatası değil.

**Doğrulama dışarıdan yapıldı** (`dig` + `curl`), panel ekranına güvenilmedi:
delegasyonun `.net` kayıt sunucusunda Cloudflare'i gösterdiği, beş Clerk
kaydının proxy'siz olduğu, sertifikanın çıktığı, sayfaya gömülü anahtarın
`pk_live_` → `clerk.owezy.net` olduğu ve `dev-browser-missing` başlığının
kalktığı tek tek ölçüldü.

**Açılış öncesi temizlik:** Production veritabanındaki bütün veri tabloları
boşaltıldı ve Clerk production kullanıcıları silindi. Kayıtların tamamı
kullanıcının ve arkadaşlarının test verisiydi. `_prisma_migrations`
korundu — silinseydi bir sonraki deploy migration'ları baştan uygulamaya
çalışıp var olan tablolar yüzünden patlardı.

**Development instance silinmedi:** E2E testleri onun `+clerk_test`
kullanıcılarına ve sabit `424242` koduna bağlı. Yerel `.env.local` `pk_test_`
ile kalıyor, yalnızca Vercel'in Production kapsamı `pk_live_` kullanıyor.

**Test:** Kod değişikliği arayüz metniyle sınırlı; 493 birim / 32 E2E.

---

## Faz 16 — Fiş tasarımı · **DONE**

Kullanıcı ekran görüntüsüyle bir şey gösterdi: 1-2 gruplu birinde "Gruplarım"
ekranı geniş bir boşluktu. Teşhis, satırların çirkinliği değil ekranın bir
DİZİN sayfası olmasıydı — ve boşluk doldurularak değil kompozisyona
çevrilerek çözülür.

Üç yön hazırlandı (akış diyagramı, fiş, koyu pano); kullanıcı **fiş**
yönünü seçti. Kararların tamamı ADR-027'de.

| # | Durum | İş |
|---|---|---|
| 16.1 | **DONE** | Fiş görünümü: kâğıt, noktalı ayraçlar, perfore ay çizgileri, çift çizgi + toplamlar, yırtık kenar |
| 16.2 | **DONE** | Katlanan aylar + sunucu tarafı ay penceresi (`listExpenses(month)`) |
| 16.3 | **DONE** | Satır içi harcama girişi |
| 16.4 | **DONE** | Uygulama tek gruplu kullanıcıyı doğrudan grubuna bırakıyor; başlıkta grup değiştirici |
| 16.5 | **DONE** | Boş ve ödeşmiş durumların fiş dilinde karşılıkları |

**Ekran görüntüsü üç gerçek hata yakaladı, üçü de koddan bakınca görünmüyordu:**

1. **Toplamlar sayfada iki kez vardı.** Fişte TOPLAM/PAYIN, hemen altındaki
   özet bloğunda yine TOPLAM/PAYIN. Özet bloğu artık yalnızca fişte olmayanı
   taşıyor.
2. **Yırtık kenar hiç çizilmiyordu.** Desen 14 px yüksekti, şerit 7 px — yani
   yalnızca düz üst yarısı görünüyordu. Maskeye çevrildi: üçgen maskede, renk
   `--paper`'dan geliyor, koyu tema kendiliğinden doğru.
3. **Filtre çubuğu kâğıdın üstüne bırakılmış arayüz gibiydi.** Kenarlıklar
   kalktı, satır iki kesikli çizgi arasına alındı; erişilebilirlik korundu.

**16.2'de çıkan ürün kusuru:** geçmiş bir aya harcama eklendiğinde o ay katlı
olduğu için kayıt **kaybolmuş görünüyordu**. Form artık harcamanın ayına
dönüyor (`?month=YYYY-MM`). Ekran görüntüsü testi olmasa fark edilmezdi.

**16.3'te tam koşu 19 test kırdı ve sebebi test değildi:** satır içi girişin
alanlarına `Açıklama` / `Tutar` demiştim; bu adlar grup düzenleme penceresinde
ve harcama formunda zaten vardı. Yani aynı sayfada iki "Açıklama" alanı vardı —
ekran okuyucu için de belirsizlik. Satır içi giriş kendi diline bağlandı:
**"Ne aldın?" / "Ne kadar?"**. Hedefli koşular bunu göstermemişti; yalnızca
tam koşu gösterdi.

**16.4'te plandan sapıldı ve sebebi ADR-027'de:** "gruplar listesi gruba
yönlensin" fikri, tek gruplu kullanıcının ikinci grubu oluşturmasının önünü
kapatıyordu ("Yeni grup" yalnızca o listede). İniş noktası değiştirildi, liste
değil.

**16.5'te mockup'tan sapıldı:** tasarımda boş fişte örnek açıklamalar vardı
("Kahvaltı", "Benzin"). Kodda satırlar BOŞ bırakıldı — uydurma içerik ekranda
gerçek kayıtla karışır. Boş noktalı çizgiler aynı şeyi uydurmadan söylüyor.

Boş bir grupta bakiye bloğu, ödeşme planı, toplamlar ve filtre çubuğu artık
hiç çizilmiyor. Dördü de sıfır ya da boş gösteriyordu; "Ödeştin" damgası ise
düpedüz yanlıştı — ödeşecek bir şey hiç olmadı.

**Test:** 498 birim / 35 E2E. Üç yeni E2E: satır içi girişin uçtan uca
eklemesi, bozuk tutarın reddi ve tek gruplu kullanıcının ana sayfadan
doğrudan grubuna girmesi. 5 yeni birim testi ay aralığının sınırlarını
kapsıyor (ay/yıl dönümü, şubat, UTC).

---

## Faz 17 — Kategori tahmini · **DONE**

Faz 13'ten beri yazılı bir ürün riskiydi ve Faz 16 onu büyütmüştü: kategori
alanı vardı ama kimse doldurmuyordu, satır içi giriş de hep `OTHER`
gönderiyordu. "Nereye gitti" kırılımı tek çubuk "Diğer" çıkıyordu.

**Yapıldı:** Açıklamadan kategori tahmini (`expense-category-guess.ts`, saf).
Tahmin sunucuda, `createExpense` içinde; aynı fonksiyon formda canlı öneri,
satır içi girişte de ipucu satırında görünüyor. Gerekçeler ve sınırlar
**ADR-028**'de.

**İki Türkçe sorunu çıktı:**

1. **Ünsüz yumuşaması.** "yemek" → "yemeği"; baş eşleşmesi tutmuyordu.
   İstisna listelemek yerine kural koda yazıldı (k→g, p→b, t→d).
2. **Kısa anahtar eşiği fazla katıydı.** 4 harf ve kısası tam eşleşme
   isteyince "otel" ekli hallerini kaçırıyordu. 3'e indirildi; "sok", "gaz",
   "mac" hâlâ tam eşleşme istiyor ki "sokak" market, "gazete" fatura
   sayılmasın.

**Bir birim testi doğru şeyi yakaladı:** `createExpense`'in mevcut testi
`category: "OTHER"` bekliyordu ve fikstürün açıklaması "Aksam yemegi"ydi.
Tahmin devreye girince FOOD oldu — yani test, davranış değişikliğini
bağırarak bildirdi. Güncellendi, üstüne kuralın iki yönü de bağlandı
(açık seçim ezilmiyor, ipucu yoksa OTHER).

**İkinci koruma:** tek kategorili kırılımda çubuk çizilmiyor; ay ve kategori
kırılımının ikisi de anlamsızsa özet bloğu tamamen kayboluyor.

**Test:** 510 birim / 35 E2E. 12 yeni birim testi: 9'u tahmin fonksiyonunun
kendisi (katlama, yumuşama, kısa anahtar, marka, çakışmada en uzun kazanır,
ipucu yoksa null), 3'ü `createExpense`'in sınırları.

---

## Faz 18 — Mobil uygulama · **BİTTİ**

Projenin baştan beri hedefi. ADR-002 iş mantığını `/api/v1` altına bunun için
koymuştu; bu faz o kararın karşılığını alıyor.

**Kararlar ADR-029'da:** Expo / React Native, aynı repoda `mobile/` klasörü.

**Zemin ölçüldü, varsayılmadı.** API yüzeyinin envanteri çıkarıldı ve mobilin
ihtiyacı olan okuma uçlarının neredeyse tamamının zaten var olduğu görüldü.
En riskli varsayım — çerezsiz bir istemcinin `/api/v1`'i çağırabilmesi — bir
ölçümle doğrulandı ve kalıcı bir E2E testine bağlandı.

| # | Durum | İş |
|---|---|---|
| 18.0 | **DONE** | API envanteri + Bearer sözleşmesinin ölçülmesi ve teste bağlanması |
| 18.1 | **DONE** | Eksik iki uç: `GET /groups/[groupId]` ve tek harcamanın `GET`'i |
| 18.2 | **DONE** | `mobile/` Expo iskeleti + Clerk oturumu |
| 18.3 | **DONE** | Uygulamanın girişi: 0 / 1 / 2+ grup — ilk dikey dilim |
| 18.4 | **DONE** | Fiş ekranı |
| 18.5 | **DONE** | Satır içi harcama girişi |
| 18.6 | **DONE** | Harcama detayı: düzenleme ve silme |
| 18.7 | **DONE** | Grup oluşturma, üyeler ve davet linki |
| 18.8 | **DONE** | Ödeşme: plan, ödeme kaydı, iptal |

**18.3 — ekran değil, GİRİŞ KARARI.** "Grup listesi ekranı" olarak
planlanmıştı; yapılmadı. Sebep: `GET /api/v1/groups` bakiye döndürmüyor, yani
liste ad + rol'den ibaret kalırdı — web'de "bomboş" diye reddedilen ekranın
aynısı. Web'in çözümü satırları güzelleştirmek değil ADR-016'ydı: tek grubu
olan kullanıcı listeyi hiç görmez. Mobil de aynı kuralı uyguluyor:

| Grup | Ne görünür |
|---|---|
| 0 | İlk açılış — marka yazısı + tek cümle |
| 1 | Doğrudan grubun içi, liste yok |
| 2+ | Liste — varış değil, **geçiş** yüzeyi |

**Listede bakiye BİLEREK yok.** Eklemek her grup için bakiye hesabı demekti;
liste artık varış noktası olmadığı için değmez. Gerçek kullanımdan sonra
tekrar bakılabilir.

**Doğrulama simülatörde, üç durum da:** 0 grup (ilk açılış), 1 grup
(yönlendirme), 2 grup (liste + satıra dokunup gezinme). Bakiye ekranı gerçek
veriyle görüldü — ikinci bir üye ve 480,00 ₺'lik bir harcama üretilip
`+₺240.00` yeşil olarak doğrulandı.

**Bulunan iki şey:**
1. **İki React kopyası.** Web'in `i18n.tsx`'i mobilden import edilemiyor;
   kural [CONVENTIONS.md](CONVENTIONS.md)'ye yazıldı. Sözlük paylaşılmaya
   devam ediyor, sağlayıcı mobile taşındı.
2. **Bakiye biçimi ayrışıyordu.** Mutlak değer yazıyordum, web
   `formatSignedMoney` kullanıyor. Aynı bakiyenin iki istemcide farklı
   okunması istenmediği için web'e hizalandı.

**18.4 — fiş kuruldu, teknikler ÖLÇÜLDÜ.** "React Native'de CSS yok"
diye yazılan zorluk, tek kullanımlık bir deneme ekranıyla çözüldü: yedi teknik
gerçek cihazda yan yana denendi. Sonuç `react-native-svg` gerektirmedi.
Ayrıntı [CONVENTIONS.md](CONVENTIONS.md) "Mobil" bölümünde.

İki şey tahmin edilseydi yanlış çıkardı: iOS'ta `borderStyle: "dotted"`
**sessizce düz çizgiye dönüyor** (`dashed` dönmüyor), ve React Native'in
`textTransform` özelliği dil bilmediği için Türkçe büyük harfte "İ" yerine
"I" üretiyordu.

**Ekranda ne var:** harcama satırları (açıklama · noktalı ayraç · tutar, altında
tarih · kategori · kim ödedi), ay perforasyonları, ay ara toplamları, çift
çizgi + üç toplam, yırtık kenar. Geçmiş aylar katlı (ADR-016'nın gerekçesi
telefonda daha da geçerli).

**Sayfalama var ve test edildi.** Bir ayda 20'den fazla harcama varsa "daha
fazla" çıkıyor; ara toplam satırı her zaman **ayın gerçeğini** söylüyor
("25 EXPENSES") — 20 satır gösterirken toplamı 20 satıra göre yazmak, kendiyle
çelişen bir fiş bırakırdı. 25 harcamalık gerçek veriyle doğrulandı.

**Kapsam dışı bırakılanlar:** ödeşme planı, harcama başına "senin payın"
(`/api/v1/me` gerektiriyordu, bakiye zaten en üstte), satır içi giriş (18.5).

**18.5 — fiş kendi kendine büyüyor.** Kâğıdın son satırı bir giriş:
`+ Ne aldın? ······ 0,00`. Yalnızca en yaygın durum (eşit bölüşüm, ödeyen
sensin, tarih bugün) ve kategori **gönderilmiyor** — sunucu açıklamadan tahmin
ediyor (ADR-028). Varsayımlar gizlenmiyor: yazmaya başlayınca altta
"Konaklama · Eşit bölünür · sen ödedin · bugün" beliriyor.

**Mobilin kendi soruları ve verilen cevaplar:**
- **Toast yok.** Web `sonner` kullanıyor; RN'de karşılığı modal bir `Alert`
  ya da ek paket. Hatalar **satırın altında**, hatanın olduğu yere yakın.
  Başarıda ayrı bildirim yok — eklenen satırın fişte belirmesi teyidin
  kendisi.
- **Klavye.** `KeyboardAvoidingView`; simülatörde yazılım klavyesi açılarak
  doğrulandı, giriş satırı klavyenin üstünde kalıyor.
- **`/api/v1/me` eklendi.** `paidById` bizim iç kimliğimizi istiyor.
  Sunucuyu "ödeyeni varsayılan olarak çağıran yap" diye değiştirmek daha
  kolaydı ama açık olan doğrusu ve o değişiklik web'i de etkilerdi.
- **Tazelemede ekran kaybolmuyor.** Harcama eklenince özet yeniden çekiliyor;
  `useApiGet` artık **aynı adresin** tazelenmesinde eldeki veriyi koruyor.
  Yoksa en sık yapılan işin ardından sayfa spinner'a düşerdi.

**18.6 — harcamayı düzeltmek ve silmek.** Fişteki **her** satır bir detay
ekranına açılıyor, yalnızca düzenlenebilir olanlar değil: bazı satırların
dokunulabilir olması fişin tekdüzeliğini bozardı ve hangisinin hangisi olduğu
bakınca anlaşılmazdı. Başkasının satırında ekran salt okunur — ve o hâliyle de
işe yarıyor, çünkü 18.4'te kesilen **"senin payın"** bilgisi oraya yerleşti.

**Yalnızca eşit bölüşüm düzenlenebiliyor.** `EXACT`/`PERCENTAGE` bir
harcamanın tutarını değiştirmek kişi başı payların toplamıyla çelişirdi; onu
`EQUAL` olarak göndermek ise kullanıcının kurduğu bölüşümü **sessizce yok
etmek** olurdu. Ekran bunu söylüyor, sessizce salt okunur kalmıyor.

**Düzenlenebilen:** açıklama, tutar, kim ödedi. Tarih gönderilmiyor —
sunucu gönderilmediğinde mevcut tarihi koruyor, yani düzenleme tarihi sessizce
bugüne kaydırmıyor. Tarih ve bölüşüm tipi kapsam dışı (biri yeni bağımlılık,
diğeri çok daha büyük bir form).

**Silme metni düzeltildi.** 18.6'da bulunan sorun — metnin olmayan bir geri
almayı vaat etmesi — karara bağlandı ve metin gerçeğe uyduruldu:
"Bu işlem geri alınamaz." `restore` ucu hâlâ duruyor ama hiçbir arayüz
kullanmıyor; artık yanlış bir vaat değil, yalnızca kullanılmayan bir uç.

**Silmede modal kullanıldı** — 18.5'te doğrulama hataları için modal'dan
kaçınılmıştı; geri alınamaz görünen bir işlemde kesinti istenen şeydir.

**Aynı hata sınıfı ikinci kez çıktı.** `useApiGet` her render'da yeni bir nesne
döndürüyordu ve onu `useFocusEffect` bağımlılığına koymak yine sonsuz döngü
üretti. Kaynağında düzeltildi (`useMemo`) ve kural
[CONVENTIONS.md](CONVENTIONS.md)'de **genişletildi**: sorun Clerk'e özgü değil,
her render'da yeniden üretilen **her** değer için geçerli.

**18.7 — grup oluşturma ve davet.** Ama önce **bulunan bir hata**: grup
ekranındaki "Gruplarım" bağlantısı **tek gruplu kullanıcıda hiçbir şey
yapmıyordu.** `/` adresine gidiyordu, orası da tek grupta gruba geri
yönlendiriyordu — yani kullanıcı aynı ekrana çarpıp dönüyordu ve **listeye,
dolayısıyla "grup oluştur"a hiç ulaşamıyordu**. 18.3'te yazılmış, fark
edilmemişti çünkü o sırada test kullanıcısının iki grubu vardı.

Çözüm yapısal: **giriş ile liste ayrıldı.** `/` yalnızca yönlendirme yapıyor,
`/groups` **her zaman** listeyi gösteriyor.

**Grup oluşturma satır içi** — ayrı form ekranı yok. Hem ilk açılış ekranında
hem listede aynı bileşen; harcama bestecisiyle aynı mantık. İlk açılış ekranı
artık yalnızca "grup oluştur" demiyor, oluşturmayı da sunuyor.

**Davet linki iOS'un kendi paylaşım sayfasıyla** gönderiliyor — React
Native'in yerleşik `Share` modülü, **yeni bağımlılık yok**. Ham kod sunucudan
yalnızca bir kez dönüyor, o yüzden ekranda da bırakılıyor.

**Daveti kabul etme mobilde YOK.** Link `owezy.net/join/<kod>` adresine
gidiyor; uygulama içinde açmak universal link kurulumu, o da **onaylanmış
Apple Developer hesabı** ister. Davet edilen web'den katılıyor.

**İki metin gerçeğe uyduruldu:** `ui.invite_once_warning` "Sayfayı
yenilersen" diyordu — telefonda sayfa yenileme diye bir şey yok, ifade
platform-nötr hâle getirildi. Ve tekrar paylaşma düğmesi "Davet linki oluştur"
ile **aynı adı taşıyordu** ama farklı iş yapıyordu; ayrı bir anahtar aldı
(`ui.share_link`).

**Kapsam dışı (bilinçli):** daveti iptal etme, üye çıkarma, sahiplik devri,
grup adı/açıklaması düzenleme.

**18.8 — ödeşme.** Fişe **ödeşme planı** geldi (18.4'te kapsam dışıydı),
bakiyenin hemen ardında: ADR-016 sayfayı bakiyenin etrafında kuruyor ve plan
"bu bakiyeyle ne yapacağım" sorusunun cevabı. Web'in üçlü ayrımı korundu —
ödemen gerekenler / sana ödenecekler / diğerleri (soluk ve dokunulamaz: grubun
takas planı doğru bilgi ama senin işin değil). **Fiil başlıkta**, satırda
değil; Türkçede "{isim}'e öde" yer tutucuyla doğru yazılamıyor.

**Ödemeler kendi ekranında** (`/groups/[id]/settlements`): kaydetme **ve**
geçmiş **ve** iptal, üçü birlikte. Ayırmak daha küçük bir adım olurdu ama o
zaman yanlış kaydedilen bir ödeme görülemez ve iptal edilemezdi — bu fazda iki
kez düzeltilen tuzağın aynısı.

**Yön seçimi arayüzde** ("Ben ödedim" / "Bana ödendi") ve bu yalnızca kolaylık
değil: *ödemeyi ancak taraflardan biri kaydedebilir* kuralını arayüze taşıyor,
yani geçersiz bir istek oluşturmak mümkün değil.

**Yakalanan hata — async veriden `useState` başlatmak.** Yön, `/api/v1/me`
gelmeden hesaplanıyordu; `useState`'in başlangıç ifadesi yalnızca ilk
render'da çalıştığı için `currentUserId` o an `null` oluyor ve "sana
ödenecek" önerisine dokununca ekran "ben ödedim" diye açılıyordu. Yön artık
parametrenin **adından** okunuyor, kimlik karşılaştırması yok.

**Web'de de olan bir hata bulundu ve düzeltildi.** Ödeme iptali onay
penceresinde `ui.cancel` ile `ui.cancel_settlement` yan yana duruyor ve
İngilizcede **ikisi de "Cancel"** oluyordu — zıt anlamlı iki aynı düğme,
üstelik yıkıcı bir işlemde. Etiket artık neyi iptal ettiğini söylüyor
("Ödemeyi iptal et" / "Cancel settlement"). **Mobili yazarken web'de bulunan
ilk hata.**

**Bilinen imlâ pürüzü (iki istemcide de):** karşı taraf başlığı her iki yönde
de "Kime ödedin?" diyor; "Bana ödendi" seçiliyken teknik olarak yanlış. Seçilen
kişi her iki durumda da karşı taraf olduğu için kullanıcıyı yanlış yönlendirmiyor.

**Kapsam dışı:** ödeme düzenleme (API'de de yok), tarih seçimi (bugüne sabit),
ödeşme planında avatarlar.

**18.4 için bilinen zorluk:** React Native'de CSS yok. Fişin noktalı ayracı
(`border-bottom: 1px dotted`), perfore çizgisi ve yırtık kenarı web'deki
tekniklerle kurulamaz; başka türlü çözülmeleri gerekecek.

**18.1 not:** İki uç da yeni mantık getirmedi — `getGroupForUser` ve
`getExpenseForUser` zaten yazılıydı, web sayfaları onları doğrudan çağırıyordu.
Yapılan iş o okumaları HTTP'ye açmak. Tek harcamanın gövdesi **bilerek** liste
ucundaki `expenses[]` elemanıyla aynı şekilde dönüyor: farklı bir şekil, mobil
tarafta aynı veri için iki ayrı çözümleyici yazmak demekti.

**Platform sırası (ADR-030):** önce iOS, Android sonra.

**18.2 ne kuruldu:** Expo SDK 57 + expo-router + `@clerk/clerk-expo` 2.20,
oturum belirteci `expo-secure-store`'da (Keychain). Giriş ekranı e-posta +
doğrulama kodu — Clerk'in Expo tarafında web'deki `<SignIn />` dengi yok,
kancalarla kendimiz kurduk. Bundle ID / paket adı: `net.owezy.app`.

**ADR-029'un dayanağı ölçüldü.** "Saf modüller olduğu gibi kullanılıyor"
varsayımdı; artık değil. `src/lib/money.ts` mobil ekranda import ediliyor ve
iOS paketinin içinde **doğrulandı**: `expo export --no-bytecode` çıktısında
`formatBasisPoints`, `DEFAULT_LOCALE` ve `\u20ba` (₺) var. Metro depo kökünü
izliyor (`watchFolders`) ve `@/` takma adını tsconfig'ten çözüyor.

**Çalışma anı da ölçüldü.** Uygulama iOS Simulator'da (iPhone 17 Pro, iOS 26.5)
çalıştırıldı ve `formatMoney` çıktısı web'in birim testlerinin pinlediği
değerlerle **birebir** aynı çıktı:

| | Web testi | Hermes |
|---|---|---|
| `formatMoney(123456789)` | `1.234.567,89 ₺` | aynı |
| `formatMoney(123456789,"USD","en")` | `$1,234,567.89` | aynı |
| `formatBasisPoints(3333,"tr")` | `%33,33` | aynı |

Yani Hermes'in `Intl.NumberFormat` desteği bizim kullandığımız kadarıyla
V8 ile ayrışmıyor. Ölçüm geçici bir kod parçasıyla yapıldı ve geri alındı.

**UÇTAN UCA DOĞRULANDI.** Simülatörde test kullanıcısıyla giriş yapıldı:
Clerk oturumu açıldı, `getToken()` çalıştı, `GET /api/v1/me` Bearer ile 200
döndü ve ekranda kullanıcının adı ile paylaşılan modülün biçimlendirdiği tutar
göründü. ADR-002'nin mobil ayağı artık tam.

**ÇALIŞTIRIRKEN GERÇEK BİR HATA YAKALANDI** — kodda vardı, testte yoktu:
`useAuth()` her render'da yeni bir `getToken` döndürüyor; onu `useCallback`
bağımlılığına koymak sonsuz döngü üretti (`Maximum update depth exceeded`) ve
giriş sonrası ekranı tamamen kilitledi. Düzeltildi (güncel referans deseni),
kural [CONVENTIONS.md](CONVENTIONS.md) "Mobil" bölümüne yazıldı. **Bu hatayı
hiçbir statik kontrol göstermedi** — tsc temizdi, paket doğru derleniyordu;
yalnızca uygulamayı açıp giriş yapınca çıktı.

**`@clerk/expo` GEÇİŞİ O SIRADA YAPILAMADI** (Faz 21'de yapıldı — ADR-033).
Sebep bizde değil:
`@clerk/expo`'nun yayınlanmış her sürümü (4.5.1, 4.5.2, 4.5.3 — `latest` dahil)
dolaylı olarak **`@clerk/shared@^4.30.0`** istiyor ama npm'deki en yeni sürüm
**4.29.3**. Yani paket kurulamıyor. Bir sürüm sabitlemesiyle aşılmıyor: zincir
`@clerk/react` ve `@clerk/clerk-js` üzerinden de aynı yere çıkıyor, yani
kırık bir yayın penceresinin etrafına büyüyen bir sabitleme listesi gerekirdi —
auth katmanında yapılacak şey değil. Denendi, geri alındı, ağaç temiz.

**TEKRAR DENEME KOŞULU DOLDU** (25 Ağustos): `@clerk/shared` 4.30.0 yayınlandı
ve geçiş yapıldı. Bkz. **Faz 21**.

**BULUNAN SORUN — `@clerk/clerk-expo` DEPRECATED.** Uygulama açılışta uyarı
basıyor: paket bırakılmış, yerine `@clerk/expo` geçmiş. Bu kozmetik değil,
sürüm ayrışması: web (`@clerk/nextjs@7.5.22`) `@clerk/react@^6` yani **Core 3**
kullanıyor; `@clerk/clerk-expo` ise `@clerk/clerk-js@5` yani **Core 2**.
`@clerk/expo@4.5.2` Core 3'te. Yani geçiş bir ayrışma yaratmaz, **var olanı
kapatır**. ~~Karar bekliyor — henüz yapılmadı.~~ **YAPILDI, Faz 21.**

**Bilinen boşluk (O SIRADA):** CI mobil tarafı doğrulamıyordu. **Faz 20'de
kapatıldı.** Kök CI `npm ci` + tsc + lint koşuyordu ve `mobile/`
bağımlılıklarını kurmuyordu. Tek ekranı olan bir uygulama
için CI'a ikinci kurulum adımı eklemek erken; ekran sayısı artınca dönülecek.

**Test:** 518 birim / 36 E2E — **ikisi de yalnızca web'i kapsıyor.** Mobilin otomatik testi yok, doğrulama simülatörde elle yapılıyor.

---

## Faz 19 — Eş zamanlı düzenleme · **BİTTİ**

Faz 18'in açtığı borcu kapatıyor: iki istemci vardı ve aynı harcamaya iki
yerden dokunulduğunda biri diğerini **sessizce** eziyordu.

`Expense.version` sayacı eklendi; okuyan alıyor, yazarken geri gönderiyor,
sunucu `WHERE id = ? AND version = ?` ile yazıyor. Çakışmada 409 dönüyor,
kullanıcının yazdıkları formda kalıyor ve **neyin değiştiği** yazılıyor.
Tekrar kaydetmek geçiyor — üzerine yazmak engellenmiyor, **sessiz olması**
engelleniyor. Gerekçelerin tamamı ADR-032'de.

Karşılaştırma iki istemcide de aynı saf modülden geliyor
(`src/lib/expense-diff.ts`), yani mobil için ikinci kez yazılmadı.

**Yan bulgular:** `apiRequest` hata kodunu düşürüyordu, artık taşıyor
(`ApiClientError`); `updateExpense` güncellenmiş satırı iki kez okuyordu;
DATABASE.md'nin migration tablosu üç migration eksikti.

**Test:** 535 birim / 37 E2E. Yeni E2E, çakışmayı **aynı kullanıcının iki
cihazı** üzerinden kuruyor — gerçek senaryo bu, çünkü harcamayı yalnızca onu
giren kişi düzenleyebiliyor. Aynı andaki yarışı Postgres'in satır kilidi
çözüyor; onun kanıtı testte değil, kontrolün `WHERE` içinde olmasında.

**Kapsam dışı bırakılanlar** (ADR-032): ödeşme, grup düzenleme, geri yükleme.

---

## Faz 20 — CI mobili de doğruluyor · **BİTTİ**

Faz 18 sekiz ekranlık bir uygulama bıraktı ve CI hiçbirine bakmıyordu;
`mobile/` bağımlılıkları bile kurulmuyordu. Mevcut işe dört adım eklendi:
bağımlılık kurulumu, tip kontrolü, `expo-doctor`, `expo export`.

**Ayrı job değil**, çünkü mobil tip kontrolü **kökün üretilmiş Prisma
client'ına bağlı**: `mobile/tsconfig.json` `@/*`'ı `../src/*`'a eşliyor ve
paylaşılan modüllerden ikisi `@prisma/client`'tan tip alıyor. Ayrı bir job
kök kurulumunu ve `prisma generate`'i baştan yapmak zorunda kalırdı.

**Koşullu da değil** ("yalnızca `mobile/` değiştiyse"): `src/lib`'deki bir
değişiklik mobili kırabiliyor — kapatılan boşluğun adı zaten "bazen
bakılmıyor".

**`expo-doctor` ilk koşuşunda gerçek bir şey buldu:** `ClerkProvider`
`expo-web-browser`'ı koşulsuz `require` ediyor ama paket yalnızca **dolaylı**
kuruluydu. Expo Go'da görünmüyor; native derlemede autolinking uygulamanın
kendi bağımlılık listesine baktığı için native modül bağlanmayabiliyor —
yani tam da TestFlight'ta. `expo-web-browser` ve `expo-auth-session` artık
doğrudan bağımlılık, `expo-web-browser` ayrıca config plugin olarak eklendi.

**Ölçülen süreler:** `npm ci` 9 sn, tsc 1 sn, doctor 2 sn, export 7 sn.

**İki kapının kırmızıya düşebildiği kanıtlandı**, çünkü düşemeyen bir kapı
kapı değildir: bağımlılık geçici olarak kaldırılınca `expo-doctor` **1**
döndü, bozuk bir import eklenince `expo export` **1** döndü.

**Yan bulgu — yayın derlemesi için önemli:** `EXPO_PUBLIC_*` değerleri pakete
**gömülüyor**, ve Metro'nun önbelleği env değişikliğini görmüyor: aynı komut,
`.env.local` varken ve yokken **birebir aynı paket hash'ini** üretti. Yayın
derlemesinde bunun bedeli yanlış API adresi gömülü bir uygulama olur.
CI `--clear` kullanıyor; TestFlight derlemesinde de kullanılmalı.

**Kapsam dışı:** mobil lint (bugün yok; eklemek yeni devDependency ister ve
Faz 18'deki altı gerçek hatanın hiçbirini yakalamazdı) ve mobil birim testi
(ayrı aday olarak duruyor).

---

## Faz 21 — `@clerk/expo` geçişi · **BİTTİ**

Faz 18'den kalan son borç. Uygulama her açılışta deprecation uyarısı
basıyordu ve altında **sürüm ayrışması** vardı: web Core 3, mobil Core 2.
Geçiş bir ayrışma yaratmadı, var olanı kapattı. Gerekçeler ADR-033'te.

**Beklediğimden fazlası çıktı, ikisi de iyi tarafa:**

`useSignIn`'in sözleşmesi değişmiş ve **`tsc` bunu yakaladı** — göçün en
riskli parçası derlemede görünür oldu. Yeni API bizim akışımızı
**kısalttı**: `create()` + `supportedFirstFactors` içinde faktör arama +
`prepareFirstFactor` yerine tek `emailCode.sendCode({emailAddress})`.

`app.json`'a **config plugin** eklemek gerekiyordu; eski pakette böyle bir
şey yoktu. Bu, sessizce atlanabilecek türden: eksikliği ancak native
derlemede, yani TestFlight'ta görünürdü.

**Simülatörde çıkış yapınca bir hata ortaya çıktı ve göçle ilgisi yoktu.**
`app/index.tsx` önce "yükleniyor mu" sonra "girişli mi" diye bakıyordu;
çıkış yapmış kullanıcıda istek hiç atılmadığı için durum sonsuza kadar
"loading" kalıyor ve yönlendirme satırı ölü koda dönüyordu — yani çıkış
yapan kullanıcının uygulaması donuyordu. `git diff` o dosyada yalnızca
import satırının değiştiğini gösteriyor: hata baştan beri oradaydı,
görünmemişti çünkü çıkış yolu hiç denenmemişti.

**Doğrulama derlemeyle değil, simülatörde uçtan uca:** çıkış → e-posta
koduyla giriş → grupların yüklenmesi → uygulamayı öldürüp yeniden açınca
oturumun durması. Sonuncusu `tokenCache`'in tek gerçek kanıtı; kimlik
SDK'sının major atlamasında `tsc` bunu gösteremez.

**Ertelenen:** `react-dom`, `expo-web-browser`, `expo-auth-session` yeni
sürümde opsiyonel peer oldu. Aynı commit'te silmek, bir şey bozulduğunda
hangi değişikliğin bozduğunu bilinmez yapardı.

**Test:** 535 birim / 37 E2E (ikisi de web). Mobil dört CI adımı da geçti.

---

## Faz 22 — Gizlilik politikası ve destek sayfası · **BİTTİ**

App Store ve Play, ikisini de **zorunlu** tutuyor ve ikisi de yoktu.
`/privacy` ve `/support` eklendi; ikisi de giriş gerektirmiyor, iki dilde,
karşılama sayfasından bağlantılı.

**Metin yazılmadan önce kod okundu.** Şema, Sentry yapılandırması, çerezler,
üçüncü taraf paketleri ve silme akışı tek tek doğrulandı — çünkü yanlış bir
gizlilik politikası, hiç olmamasından kötüdür. Politikanın söylediği her
şeyin karşılığı kodda var: para/kart verisi hiç toplanmıyor, parola bize
ulaşmıyor, analitik paketi kurulu bile değil, Sentry'ye `sendDefaultPii:
false` ile gidiliyor, yazı tipleri derleme anında indirilip kendi alan
adımızdan sunuluyor.

**En zor cümle silme hakkındaydı ve dürüst yazıldı:** hesabını silen
kullanıcının adı ve e-postası temizleniyor ama **harcama kayıtları kalıyor**,
anonimleşmiş bir kullanıcıya bağlı olarak. Sebebi de yazıldı — ortak bir
defterde tek kişinin kayıtlarını silmek diğer herkesin bakiyesini bozar.
Bir E2E testi bu cümlenin varlığını bekçiliyor.

**Abartılmadı:** "verileriniz şifrelenir" gibi bir cümle, alan bazında
şifreleme yaptığımızı ima ederdi; yapmıyoruz (şifrelenmiş tutarın toplamı
alınamaz). Yazılan şey ölçülebilir olan: aktarım TLS
(`sslmode=require` + `channel_binding=require`, bağlantı dizesinden
doğrulandı) ve barındırıcının disk şifrelemesi.

**Metin `messages.ts`'e konulmadı** (ADR-034): o sözlük istemciye gidiyor ve
doküman metni her sayfanın paketini şişirirdi. `src/content/legal/` altında,
`Record<Locale, LegalDocument>` tipiyle — yani ADR-020'nin "eksik çeviri =
derleme hatası" garantisi korunuyor.

**Test:** 535 birim / 43 E2E (6 yeni). Yeni testlerin varlık sebebi tek
cümle: bu iki adres **giriş yapmadan** açılabilmek zorunda; biri korumayı
genişletirse uygulama mağazadan döner ve sebebi hiçbir yerde görünmez.

**`destek@owezy.net` açık** (26 Ağustos, kullanıcı doğruladı): Cloudflare
Email Routing kuralı var, oraya gelen postalar kullanıcının kendi kutusuna
yönleniyor. Alan adının MX'i de `route1/2/3.mx.cloudflare.net` — yani
destek sayfasındaki adres gerçekten çalışıyor.

---

## Faz 40 — Mobilde gruptan ayrılma · **BİTTİ**

Kullanıcı bildirdi: **telefonda gruptan çıkılamıyor.** Ölçüldü — uç
(`POST .../leave`) ve web arayüzü (`member-actions.tsx`) baştan beri vardı,
mobil üyeler ekranı ise salt okunurdu. Telefonda gruba katılmak kolay (davet
bağlantısını yapıştır), çıkmak imkânsızdı.

Üyeler ekranının altına, **fişin dışına** ayrılma eylemi geldi. Sahip
arkasında üye bırakıyorsa önce devralacak kişiyi seçiyor — kural sunucuda
(`owner_must_transfer`), burada sorulması kullanıcıyı reddedilecek bir
istekle karşılaştırmamak için. Ayrılınca `router.replace` ile gruplar
listesine gidiliyor; `push` olsaydı geri düğmesi artık üyesi olmadığımız bir
gruba dönerdi.

### Ekranda doğrulandı — ve dokunuş sorununun çözümü bulundu

`Manage members` bağlantısı dokunuşları kabul etmiyordu (`Delete` ile aynı
desen: küçük metin hedefleri yanıtsız, kartlar ve satırlar çalışıyor). Sebep
bulunamadı — taze simülatör ve düşük yükte de sürdü, yani ortam değil.

**Çözüm dokunmamak: DERİN BAĞLANTI.**

```
grep -oE "groups/[0-9a-f-]{36}" <dev sunucusu logu>   # grup kimliği
xcrun simctl openurl <udid> "exp://127.0.0.1:8081/--/groups/<id>/members"
```

Ekran doğrudan açıldı. Sonrası sorunsuz: `Leave group` basıldı, onay
penceresi çıktı ("Geçmiş harcamaların grupta kalır…"), onaylandı, gruplar
listesine gidildi ve **geri düğmesi doğmadı** — `replace` kararı da böylece
doğrulandı. Devir seçici tek üyeli sahipte hiç çizilmedi; koşullu mantık
doğru.

### Kalan

- Üye çıkarma ve sahiplik devri mobilde hâlâ yok (web'de var)

---

## Faz 39 — Silinen harcamayı geri alma · **BİTTİ**

Dokümanda "uç var, arayüz yok" yazıyordu; ölçünce sunucu tarafında **hiçbir
iş olmadığı** çıktı — `restore` ucu, `?includeDeleted=true` ve `deletedAt`
üçü de hazırdı.

Silinenler **listeye katılıyor**: ayrı bir çöp kutusu ekranı yeni bir uç ve
iki istemciye yeni gezinme isterdi, oysa silinen kayıt en çok kendi tarih
sırasında anlam taşıyor. Satır soluk, üstü çizili ve `silindi` rozetli;
eylem `Geri al`. Renk kullanılmadı (ADR-015: yeşil/kırmızı yalnızca bakiye).
Geri almada onay yok — yıkıcı değil.

E2E testi üç adımı kilitliyor (görünmüyor → görünüyor → geri geldi). 57 geçti.

### Mobil tarafı — BİTTİ ve ekranda doğrulandı

Filtre paneline "Include deleted" çipi geldi, `ReceiptLine` silinmiş satırı
soluk ve üstü çizili çiziyor (renk yok — ADR-015), rozet satırın başında,
eylem `Geri al`. Silinmiş satır detaya **gitmiyor**: o ekran düzenleme
ekranı ve silinmiş kayıt düzenlenemiyor.

**Ekranda uçtan uca görüldü:** silinmiş satır soluk ve üstü çizili, `deleted`
rozeti başta, `RESTORE` sağda kobalt, toplamlar ₺0.00. `RESTORE`'a
basılınca kayıt normal görünümüne döndü ve toplamlar geri geldi.

### Ekrana bakınca çıkan kusur — ÇIKIŞSIZ DURUM

Tek harcamasını silen kullanıcı onu **geri alamıyordu**. Özet yalnızca
silinmemiş kayıtları sayıyor, sayaç sıfırlanınca "boş grup" dalı çiziliyor
ve o dalda süzgeç satırı yok — dolayısıyla "silinenleri göster" çipine
ulaşılamıyor. Kod okuyarak görünmezdi.

Düzeltme: `isEmpty` artık `!showDeleted` de arıyor, ve boş durumda ayrıca
bir `INCLUDE DELETED` bağlantısı duruyor.

---

## Faz 38 — CSV dışa aktarma telefonda · **BİTTİ**

Uç ve filtre desteği zaten vardı; eksik olan telefon tarafıydı. Düğme filtre
satırında ve her zaman görünür — web'deki yerinin aynısı, çünkü dışa aktarma
ekrandaki filtreyi izliyor ve bu bağ görünür kalmalı.

| Karar | Gerekçe |
|---|---|
| Filtre satırında, panelin içinde değil | Panel mobilde kapalı başlıyor; içine konsa filtrelemeyen kullanıcı bulamazdı |
| Dosya adı sunucudan | İstemcide üretmek web ile ayrışmaya yol açardı |
| `useApiClient` değil, elle `fetch` | O istemci JSON çözüyor; buradan ham CSV geliyor. Bearer sözleşmesi korunuyor |
| Önbellek dizini | Paylaşım sayfasına verilen geçici kopya; belgelere yazmak birikirdi |

**Yol boyunca iki kusur bulundu ve düzeltildi:**

Dosya adını "temizleyen" ilk kural boşluğu, tireyi ve `.csv`'deki noktayı da
siliyordu — modülün varlık sebebi olan "web ile aynı ad" hedefini bozuyordu.
Yalnızca yol ayıracına daraltıldı.

**Dil**: mobil çerez göndermediği için (ADR-029) sunucu hesabın dilini
kullanıyordu, oysa arayüz cihazın dilini gösteriyor. Uygulama İngilizceyken
Türkçe dosya iniyordu. Mobil artık o istekte `Cookie: locale=<dil>`
gönderiyor; **sunucu değişmedi**. Ayıraç da düzeldi: uç dile göre `;` / `,`
seçiyor.

Bunun bir öncesi var: uca `locale` parametresi eklemek denendi ve **E2E'yi
kırdı** (beş koşuda collaboration testleri düştü, değişikliksiz üçünde
geçti). Mekanizma bulunamadı — diff yalnızca bir API ucuna ekti ve modül
grafiğine yeni bir şey katmıyordu. Açıklanamayan risk üretime taşınmadı.

Simülatörde uçtan uca doğrulandı — paylaşım sayfası, dosya adı, BOM, içerik.
9 birim testi (`content-disposition`).

---

## Faz 37 — Bildirim zili başlıkta · **BİTTİ**

Bildirimler grup ekranının **en altındaki bir karttaydı**; çok harcamalı bir
grupta uzun bir kaydırmanın arkasında kalıyordu. Web'de zil uygulama
düzeyindeki başlıkta (`(app)/layout.tsx`), yani her sayfada — mobil de artık
öyle.

| Karar | Gerekçe |
|---|---|
| Gerçek zil ikonu | `@expo/vector-icons` — **uygulamanın ilk ikonu**. Görsel dil tipografikti; başlıktaki yer bir kelimeyi taşımıyor ve zil evrensel olarak tanınıyor. Renk kobalt (ADR-015). |
| Tüm ekranlarda | `Stack`'in `screenOptions`'ında. Ekran ekran eklemek, bir sonrakinde unutulacak bir şey demekti — AuthGuard'ın çözdüğü sorunun aynısı (ADR-037). |
| Ekrana gidiyor, açılır pencere değil | Bildirimler ekranı zaten var; dar bir ekranda popover listeyi iki kez çizmek olurdu. |
| Bildirimler ekranında zil yok | Kullanıcıyı bulunduğu yere götüren bir düğme. |

### Sayaç neden ayrı bir sağlayıcı

Zil bir ekran değil, başlığın parçası — **odaklanacak ekranı yok**, yani
`useFocusEffect` çalışmıyor. `lib/unread.tsx` onun yerine **adres değişimini**
dinliyor: kullanıcı nereye giderse gitsin sayı tazeleniyor, bildirimler
ekranından çıkıldığında kendiliğinden sıfırlanıyor. İlk çalışma atlanıyor
çünkü `useApiGet` bağlandığında zaten çekiyor.

### Simülatörde çıkan şey

Gruplar ekranının altında da bir "Bildirimler" bağlantısı vardı; zil gelince
aynı yere iki yol açılmıştı. Kaldırıldı. **Kod okuyarak fark edilmezdi** —
ekrana bakılınca görüldü.

**Hesap kartı taşınmadı.** Tek gruplu kullanıcının hesabına ulaşmasının tek
yolu o (Faz 33, App Store 5.1.1(v)).

### Doğrulama

Soğuk açılışta `Redirect` yolu üretildi: tek gruplu kullanıcı doğrudan gruba
düşüyor, geri düğmesi doğmuyor, **zil başlıkta**. Açık ve koyu temada ayrı
ayrı bakıldı. 4 birim testi (rozet: 0'da yok, 9'a kadar sayı, sonrası `9+`).

Rozet gerçek bir sayıyla **ekranda görülmedi** — geliştirme hesabında bildirim
yoktu. Testlerle kapsandı.

---

## Faz 36 — 2FA girişi mobilde kırıktı · **SÜRÜYOR**

1.0 yayına girdikten saatler sonra çıktı: **2FA açık hesaplar iOS
uygulamasına hiç giremiyordu.** İkinci adımda "Doğrulama süresi doldu"
diyordu — yani hata kendisini bir zaman aşımı gibi gösteriyordu.

### Sebep: çerezin adı ortama göre değişiyor

Better Auth çerez adlarına https'te `__Secure-` öneki ekliyor. Mobil 1.0
çerezi `indexOf` ile arıyordu ve aranan dize **önekli adın içinde de
geçiyor**; arama "buluyor" ama dokuz karakter geç başlıyor, önek geride
kalıyor. Sunucu adı birebir arıyor, bulamıyor. Ayrıntı ve ölçümler ADR-045'te.

Ağırlığı şuradan: 2FA açık hesap e-posta koduyla da giremiyor (kanca bunu
bilerek engelliyor), yani parola → 2FA **tek yoldu** ve o yol kırıktı.

| | Etkilenme |
|---|---|
| Web | yok — çerezi tarayıcı taşıyor, adını ayrıştıran kimse yok |
| Mobil, 2FA kapalı | yok — oturum `set-auth-token` başlığıyla geliyor |
| Mobil, 2FA açık | **hiç giriş yapılamıyor** |

### Yapıldı — sunucu köprüsü (4 Eylül, canlıda)

`expo-updates` kurulu değil, yani mobil düzeltmesi yeni build + App Review
demek; mağazadaki 1.0 o süre boyunca kırık kalırdı. `/api/auth/two-factor/
verify-*` uçlarında öneksiz gelen çerez önekli adla da yazılıyor. İmza
doğrulaması yerinde — atlanan bir denetim yok.

Çerez adı **sabit yazılmadı**, `auth.$context` üzerinden Better Auth'a
soruluyor: adı tahmin etmek zaten bu hataya yol açtı. Yan faydası,
geliştirmede önek olmadığı için köprünün orada kendiliğinden devre dışı
kalması — ayrıca bir ortam koşulu yazmak gerekmedi.

10 birim testi eklendi; sonuncusu mağazadaki 1.0'ın ayrıştırıcısını birebir
taklit edip zinciri kilitliyor. E2E 56/56.

### Yapıldı — mobil ayrıştırıcı (4 Eylül)

Kural artık **öneki tanımıyor, adın nerede bittiğini biliyor**: işaretten
sola doğru geçerli çerez-adı karakterleri (RFC 6265 token) boyunca
genişliyor. Ayırıcıya dayanmadığı için `Expires=Wed, 09 Jun ...` içindeki
virgül tuzak olamıyor, ve `__Host-` gibi gelecekteki bir öneki de
kendiliğinden taşıyor.

Yan fayda: eski kod yalnızca **ilk** geçişe bakıyordu; silme satırı gerçek
meydan okumadan önce geldiğinde `null` dönerdi. Yeni kural bütün geçişlere
bakıyor.

Testlere production biçimi eklendi (6 yeni, toplam 68 vitest). Asıl koruyan
onlar: eski grup geliştirme sunucusundan ölçülmüştü ve ayırt edici özellik
orada yoktu.

### Köprünün ilk hâli çalışmadı — ve aynı tuzaktı

İlk sürüm `new Request(request, { headers })` ile isteği klonluyordu ve
üretimde `TypeError: Cannot read private member #state` ile patlıyordu: Next
kendi `NextRequest`'ini veriyor. Mağazadaki uygulama bu kez "Bir şeyler ters
gitti" diyordu (gövdesi boş 500 eşlenemiyor).

**Sebebi tanıdıktı:** o satır düz Node'da ölçülmüştü, orada çalışıyor. Doğru
şey, yanlış ortamda — fazın konusu olan hatanın aynı sınıfı. İstek artık
parçalarından kuruluyor.

### Uçtan uca doğrulama (negatif kontrolüyle)

E2E'ye, mağazadaki 1.0'ın ayrıştırıcısını birebir taklit eden bir test
eklendi: gerçek parolayla giriş → gerçek `__Secure-` önekli imzalı çerez →
önek düşürülüyor → geçerli TOTP.

| | Sonuç |
|---|---|
| Köprü açık | **200** + `set-auth-token` |
| Köprü kapalı | **401** |

Test `skip` — öneki `NODE_ENV` tetikliyor, E2E geliştirme modunda koşuyor.
Çalıştırma talimatı testin başında; köprüyle birlikte silinecek.

### Kalan

- 1.0.1 build + submit (sürüm `app.json`'da 1.0.1'e alındı)
- **Köprünün kaldırılması** — 1.0.1 yaygınlaşınca, önce değil

---

## Faz 35 — App Store yayını · **BİTTİ**

1.0 **4 Eylül 2026'da** yayına girdi. Türkiye ve ABD mağazalarında canlı;
`net.owezy.app`, trackId `6805650395`, iOS 16.4+, 127 cihaz.

### Yol iki reddin üzerinden geçti — ikisi de işe yaradı

**Guideline 2.1 — Information Needed.** Hata değil, yedi maddelik bilgi
talebi. Cevabı hazırlarken **uygulama içi hesap silme** eksiği çıktı
(Guideline 5.1.1(v) zorunlu kılıyor) → Faz 33.

**Sonra kullanıcı mobil uygulamayı ilk kez açtı** ve "dümdüz bir metinler
topluluğu" dedi. Gönderim durduruldu, arayüz elden geçirildi → Faz 34. O
sırada gönderimi doğrudan ilgilendiren **bir kusur daha** çıktı: tek grubu
olan kullanıcı hesap ekranına hiç ulaşamıyordu — yani incelemeci, Apple'ın
zorunlu tuttuğu silme akışını bulamazdı.

Yani her iki duraklama da kapatılması gereken gerçek eksikleri görünür
yaptı. İnceleme süreci burada bir engel değil, bir ölçüm aracı olarak
çalıştı.

### Apple simülatör kaydı kabul etmiyor

Ret metninin birinci maddesi açıkça *"captured on a physical device"*
diyor. Bu oturumda önce bir simülatör kaydı üretildi — Expo Go izi
olmayan, kendi başına çalışan bir `preview` build'iyle, production arka uca
bağlı. Kayıt teknik olarak iyiydi ve **kullanılamadı**; kullanıcının
iPhone 12'sinde (iOS 26.6.1) yeniden çekildi. Simülatör kaydı yine de işe
yaradı: senaryo olarak kullanıldı.

Cevap ve Notes metinlerinin ikisi de **4000 karakterle sınırlı** — cevap
ilk hâlinde 4383 karakterdi ve kısaltıldı.

### İki adlı kimlik mağazada tuttu

| Yerelleştirme | Ad | Alt başlık |
|---|---|---|
| Türkçe | **Owezy** | Grup hesabı, kolay ödeşme |
| İngilizce | **Owezy: Split Expenses** | Group bills, settled fast |

Faz 30'da kilidin **yerelleştirme başına** olduğu ölçülmüştü; doğru çıktı.
Türkçe açıklama da yerinde.

### Yayından sonra çıkan tek kusur

Mağaza sayfası uygulamayı **yalnızca İngilizce** gösteriyor
(`languageCodesISO2A: ["EN"]`). Sebebi `app.json`'da
`CFBundleLocalizations` bulunmaması — Expo paketi tek bir `en.lproj` ile
çıkıyor. Uygulama tamamen iki dilli; çeviri **JS tarafında**, bundle'da
değil. Yani işleyiş doğru, yanıltıcı olan yalnızca mağazadaki "Languages"
satırı. Düzeltmesi yeni build gerektirdiği için 1.0.1 adayı.

### Durum panele girmeden ölçülebiliyor

```
curl -s "https://itunes.apple.com/lookup?bundleId=net.owezy.app&country=tr&lang=tr_tr"
```

`trackName`, `version`, `currentVersionReleaseDate` ve
`languageCodesISO2A` buradan okunuyor — App Store Connect'e girmeye gerek
kalmadan.

---

## Faz 34 — Mobil arayüz, web'in bilgi mimarisine getiriliyor · **BİTTİ**

Kullanıcı mobil uygulamayı **ilk kez** 29 Ağustos'ta açtı ve "dümdüz bir
metinler topluluğu, web'le hiç alakası yok" dedi. Haklıydı — ve sebebi şu:
**ben de o güne kadar bu uygulamaya hiç bakmamıştım.** Davranışını testlerle,
uçlarını ölçümle doğrulamıştım; ekranda neye benzediğini hiç görmemiştim.

Simülatörü açıp hesap yaratıp gruba girince teşhis netleşti. Eksik olan
**tasarım sistemi değildi**: fiş metaforu mobilde de vardı ve tekniği RN için
tek tek ölçülerek yazılmıştı (noktalı ayraç `borderStyle: "dotted"` ile
çalışmıyor, tekrarlanan `·` kullanılmış; yırtık kenar üçgen hilesiyle).
Eksik olan **içiydi**: web'in grup sayfasındaki dokuz bloktan mobil üçünü
çiziyordu.

| Adım | Ne yapıldı |
|---|---|
| 1 | `<Slot />` → `<Stack />`: başlık çubuğu, geri düğmesi, kaydırma hareketi |
| 2 | Grup ekranı web'in blok sırasına getirildi: fiş başlığı, ÖDEŞTİN mührü, kategori çubukları, üye bakiyeleri |
| 3 | Harcama ekleme ekranı: kim ödedi, kimler paylaşıyor, bölüşme türü — **iki adımda** |
| 4 | Açılış görseli, ekranlardaki başlık tekrarları |
| 5 | Eşit olmayan bölüşümün düzenlenmesi, kategori seçimi, yükleme hatasının gösterilmesi |
| 6 | Liste satırındaki tekrar temizlendi (web + mobil), mobile arama ve süzme geldi |
| 7 | Telefondan gruba katılma: davet bağlantısını yapıştırma |
| 8 | Bildirimler (uygulama içi liste), ve tek gruplu kullanıcının hesaba giden yolu |
| 9 | Grup adı düzenleme, uygulama içinden dil seçimi |
| 10 | Giriş ekranı temaya bağlandı (koyu temada bozuktu) |

**Hiçbiri API işi değildi.** `/summary` kategori kırılımını, `/balances` üye
bakiyelerini baştan beri döndürüyordu; mobilin tip tanımları dardı ve veri
gelip **atılıyordu**.

**Geri dönememe gerçek bir kusurdu.** Kök yerleşim `<Slot />` kullanıyordu ve
`Slot` bir navigator değil — üyeler, ödeşmeler, harcama detayı ve hesap
ekranlarından çıkış yolu yoktu.

**Adımlama keyfi değil:** bölüşme ekranı tutara bağımlı. Tam tutar kipinde
kalan hesabı tutar olmadan anlamsız, yüzde kipinde payların karşılığı
gösterilemiyor.

**Açılış görseli yapılandırması hiç yoktu.** `app.json`'da `splash` anahtarı
yoktu; Expo Go'da görünen şablon logosu Expo Go'nun kendi ekranıydı, üretimde
ise hiçbir şey yoktu. Artık `BrandMark`'ın aynı iki path'inden üretilen bir
görsel, açık ve koyu tema için ayrı.

**Yöntem değişikliği kayda değer:** bu fazda her adımdan sonra simülatörde
**bakıldı**. Uygulama `tsc`, lint ve 67 test yeşilken kullanılamaz haldeydi;
yeşil sinyaller ürünün iyi olduğunu değil, yazılanın yazıldığı gibi
çalıştığını söylüyor.

**Bir yanlış teşhis kaydı:** sunucu logunda "POST'tan sonra hiç GET yok"
görülüp "geri dönüşte tazelenmiyor" sonucuna varıldı. Yanlıştı — simülatör
dokunuşları ıskalamıştı, hiç gezinme olmamıştı. Log doğruydu, okuma yanlıştı.

**5. adımda çıkanlar.** Harcama düzenleme kilidi bölüşme türüne göre
gevşetildi ve ayrım veri modelinden geldi: `EQUAL` ve `PERCENTAGE`'ta tutar da
değiştirilebiliyor (yüzdeli olanda sunucu payları yeniden hesaplıyor),
`EXACT`'te paylar mutlak olduğu için yalnızca açıklama. Kilit gevşeyince **iki
metin birden yalan oldu** — ekrandaki uyarı ve destek sayfası; ikisi de
düzeltildi. İkincisi ancak kaldırılan sözlük anahtarını kimin kullandığı
aranınca fark edildi.

Kategori seçimi eklendi (yedi kategori, 1. adımda). Seçilmezse sunucu tahmin
ediyor ve **tahmin ekranda görünüyor** — varsayılan sessiz kalmıyor.

**Kullanıcının bildirdiği "Something went wrong" hatası benim ekranımdandı:**
ödeyen çözülemediğinde `server.unexpected`'a düşüyordu. Tetikleyen şey
sunucunun kapalı olmasıydı (E2E için kapatılmış, açılmamıştı) ama asıl kusur
ekranın üç isteğin **hata** durumunu hiç ele almamasıydı — boş form çizip
sebebini söylemeden kaydetmiyordu.

**6. adımda çıkanlar.** Kullanıcı listenin uzadıkça okunmadığını söyledi.
Simülatörde bakıldı ve teşhis **satır sayısı değil tekrar** çıktı: dokuz
harcamanın ikincil satırında 43 karakterin 37'si dokuzunda da birebir aynıydı.
Ölçülen ekran olmasa "daha az satır göster" gibi yanlış bir çözüme gidilirdi.

Çizim kuralları `src/lib/expense-list-view.ts`'de toplandı; web ile mobil
aynı yerden okuyor. Tarih ve ödeyen yalnızca **değiştiğinde** yazılıyor ve
karşılaştırma **biçimlenmiş metin** üzerinde — ham güne bakmak, UTC'de aynı
güne düşüp yerel saatte ayrı günlere düşen iki satırda yanlış gün okuttururdu
(23:00Z ile 01:00Z, UTC+3'te 30 ve 29 Ağustos). Gün başlıkları denendi ve
**vazgeçildi**: 20 güne yayılmış bir ayda içerikten çok çerçeve üretiyordu.

Eleme yer açınca mobilde hiç olmayan "senin payın" eklendi — ve hemen
ardından ölçüm ikinci bir tekrar gösterdi: tek üyeli grupta pay tutarın
aynısıydı, yani satırın sağ ucundaki sayı iki kez yazılıyordu. Pay artık
tutardan farklıysa yazılıyor.

Arama/süzme mobile geldi. Web'in **tek satırlık** süzgeç çubuğu telefonda
dörde sığmadığı için bölündü: arama her zaman açık, kategori ve "yalnızca beni
ilgilendirenler" `FİLTRE` etiketiyle açılan panelde. Ayrı bir arama ekranı
denenmedi çünkü sonuçları fişin dışına taşırdı. Web'in üç kuralı korundu:
süzgeç açıkken katlama kapanıyor, ay ara toplamları yazılmıyor, yerine sonuç
sayısı ve toplamı çıkıyor (aynı `where`'den gelen `matches`).

**Yine API işi yoktu:** uç `q`, `category`, `mine` ve `matches`'i baştan beri
destekliyordu.

**7. adımda çıkanlar.** Davet **kabul etmek** mobilde yoktu ve koddaki
gerekçe eskimişti: "onaylanmış Apple hesabı bekleniyor" diyordu, hesap
onaylandı. Ama universal link'in kendisi hâlâ üç şey birden istiyor ve biri
belirleyici — **Expo Go'da çalışmıyor**, yani simülatörde açıp bakılamıyor.
Bu fazın yöntemi tam olarak "bakmak" olduğu için görülmeden yazılacak bir
kurulum yerine bugün doğrulanabilen yol seçildi: bağlantıyı **yapıştırmak**.
Universal link sonradan geldiğinde ekran değişmiyor, yalnızca alanı dolduruyor.

Bileşen `GroupCreator`'ın tam eşi ve **iki yerde** duruyor; asıl olanı ilk
açılış ekranı, çünkü davet edilen kişinin girdikten sonra gördüğü ilk şey o.
Orada olmasaydı, uygulamayı kurmasının sebebi olan işi yapamazdı.

**Uçlar taranınca listeden iki madde düştü.** "Mobilde kalanlar" listesi
mobil eksiğiyle **ürün eksiğini** karıştırıyormuş: ödeşme düzenleme için
hiçbir yerde uç yok (web de yalnızca iptal edebiliyor ve mobil bunu zaten
yapıyor), silineni geri alma ucu var ama web'de de arayüzü yok. İkisi de
`support.ts`'de zaten ürün sınırı olarak yazılı; yapmak mobili web'e
yaklaştırmaz, iki tarafa birden yeni özellik eklemek olur.

**8. adımda çıkanlar.** Bildirimler geldi — uygulama içi liste, **push
değil**; push ayrı bir iş (APNs, izin istemi, App Privacy anketi). Zil yerine
kart kullanıldı çünkü uygulamada **hiç ikon yok** ve zil tek ikon olurdu.

Bildirimlere yer ararken **daha ciddi bir kusur** ölçüldü: tek grubu olan
kullanıcı hesap ekranına hiç ulaşamıyordu. `Redirect` yığını değiştiriyor,
geri düğmesi doğmuyor, grup ekranında da hesaba giden bağlantı yoktu — Faz
34'te "başlık çubuğundaki geri düğmesi karşılar" denip kaldırılmışlardı. O
varsayım tek gruplu kullanıcı için hiç doğru değildi ve **hesap silmeyi**
erişilemez yapıyordu (App Store 5.1.1(v)).

`Intl.RelativeTimeFormat` Hermes'te yok (ADR-044). Faz 18.2'deki Intl ölçümü
`NumberFormat` ve `DateTimeFormat` içindi; "Intl çalışıyor" diye bir bütün yok.

İki tasarım hatası da ölçümle bulundu: ekran bir kez yükleniyordu (odaklanma
deseni yanlış kopyalanmıştı), sonra tazeleme okunmamış noktalarını siliyordu.

**9. adımda çıkanlar.** Grup adı düzenleme ve dil seçimi geldi; ikisinin de
ucu hazırdı. Dil için kök yerleşim veriye bağımlı hâle geldi ve sıralama
önemliydi: cihaz dili → cihazda saklanan seçim → sunucu. Açılışta `/me`
beklenmiyor çünkü beklemek ilk ekranı ağ turu kadar geciktirirdi; sunucudaki
kayıt yine yazılıyor ve web onu okuyor.

Yine ölçümle bir kusur: grup adı kaydedilip geri dönülünce **başlık
eskisini gösteriyordu**. Odaklanmada yalnızca özet ve bildirim sayacı
yenileniyordu. Bu ekrandan gidilen her yer buradaki verilerden birini
değiştirebiliyor ve "hangisi değişti" sorusunu ekranın bilmesinin yolu yok —
artık beşi de yenileniyor, web'de de karşılığı `router.refresh()`.

**10. adımda çıkanlar.** Giriş ekranı temayı hiç kullanmıyormuş: renkleri
elle yazılmıştı ve `useTheme()` çağrılmıyordu. Koyu temada bütün uygulama
koyulaşırken o ekran beyaz kalıyordu. **App Store ekran kaydı çekilirken
görüldü** — videodaki ilk kare gerisinden başka bir uygulama gibiydi.
Ekran testleri değişikliği yakaladı ve beklenen dizeler hesaplanarak
güncellendi (Türkçe büyütme noktalı İ üretiyor).

**Faz kapandı ve 1.0 yeniden gönderildi (2 Eylül).** Build 9, commit
`b45577a`. Ekran kaydı kullanıcının iPhone 12'sinde çekildi — Apple'ın
birinci maddesi fiziksel cihaz şart koşuyor ve bu oturumda üretilen
simülatör kaydı kullanılamadı.

**Kalan:** CSV dışa aktarma. Ertelenmiş: universal link, push bildirim.
Üçü de inceleme sonuçlanmadan başlatılmayacak.

---

## Faz 33 — Hesap silme · **BİTTİ**

Apple 1.0'ı **Guideline 2.1 — Information Needed** ile reddetti. Ret bir
anket: yedi madde bilgi istiyor, hiçbiri hata bildirmiyor. Ama cevabı
hazırlarken gerçek bir eksik çıktı — istenen ekran kaydı şunu göstermeli:
*"Account registration, login, and **account deletion** flows"*.

**Hesap silme yoktu.** Üç yerden doğrulandı: `/api/v1/me` altında yalnızca
`GET` ve `PATCH` vardı, ne web'de ne mobilde arayüz vardı, ve ADR-031 zaten
"HENÜZ UYGULANMADI" diyordu. **Guideline 5.1.1(v)** hesap açılabilen her
uygulamada uygulama içi silmeyi zorunlu kılıyor; Owezy hesap açıyor. Yani
kayıt olduğu gibi çekilseydi bir sonraki ret 5.1.1'den gelecekti.

| Katman | Ne geldi |
|---|---|
| Servis | `src/lib/account.ts` — tek transaction |
| Uç | `DELETE /api/v1/me` |
| Mobil | `app/account.tsx` — yeni ekran, iki adımlı onay |
| Web | `components/delete-account-dialog.tsx` |

**Korunan şey silinen şeyden önemli.** Testlerin yarısı "şuna dokunmadı mı"
diye soruyor: harcama ve ödeme satırları yerinde kalıyor, çünkü onlar yalnızca
silinen kişinin kaydı değil — grupta kalanların bakiyeleri de onlardan
hesaplanıyor. Silinselerdi başkalarının parası yanlış görünürdü ve bunu
kimse fark etmezdi; bakiye yine bir sayı döndürürdü.

**Borç engel değil** (ADR-031). `leaveGroup` bakiye kapalı değilse ayrılmayı
reddediyor ve gruptan çıkma için bu doğru; hesap silmeyi borca bağlamak
kullanıcıyı kendi verisinin içinde rehin tutmak olurdu. Uyarı arayüzde.

**ADR-015 araya girdi.** Mobil temada `danger` diye bir token yoktu ve
olmaması tesadüf değil: bu üründe kırmızı "sen borçlusun" demek. Web'de
`--debt` ile `--destructive` zaten bilerek ayrı (farkı doygunluk taşıyor);
mobil temaya `destructive` eklendi.

**Bir mutasyon kaçtı ve test düzeltildi.** "En eski üye yerine en yeniye
devret" yakalanmadı, çünkü taklit `findMany` sıralamayı yok sayıyor. Sonucu
belirleyen şey sorgunun kendisi; `orderBy` de sabitlendi. 7/7.

**Doğrulama:** 554 kök birim (16 yeni), 53 + 14 mobil, kök ve mobil `tsc` +
lint, **56 E2E (10,3 dk)** — kullanıcı menüsüne düğme eklendiği için tam koşu
yapıldı, hiçbir seçici kırılmadı.

---

## Faz 32 — Giriş ekranı artık otomatik doğrulanıyor · **BİTTİ**

`app/sign-in.tsx` mobilin en riskli ekranıydı ve **yalnızca simülatörde, elle**
doğrulanıyordu. 14 test eklendi (`jest-expo` + `@testing-library/react-native`,
ADR-043).

**Neden bu ekran:** Faz 29 bir kat aşağısını — sunucuyla konuşan durum
makinesini — kapsıyordu. Buradaki soru farklı: o katmanın verdiği cevaba ekran
doğru tepkiyi veriyor mu? İkisi ayrı ayrı doğru olup birlikte yanlış olabilir
ve 27.4'te tam olarak bu oldu.

**Altı mutasyon, altısı da yakalandı:**

| Geri getirilen hata | Düşen test |
|---|---|
| 2FA dalı silinirse (ekran katmanı) | **6** |
| `replace` yerine `push` | 3 |
| `forgetChallenge()` çağrılmazsa | 1 |
| Yedek koda geçerken kod temizlenmezse | 1 |
| Yedek kod bayrağı hep `false` gönderilirse | 1 |
| Kod isteme başarısızken de adım ilerlerse | 1 |

**Kurulum dört engel çıkardı** ve dördü de ADR-043'te yazılı. En öğreticisi:
**RNTL 14'te `render` ve `fireEvent` asenkron** — v13'te senkrondu ve belirtisi
yanıltıcı, çünkü hata mesajı (*"render function has not been called"*) sebebi
göstermiyor. Diğerleri: `jest.mock()` fabrikasının `mock` ön eki zorunluluğu,
`expo-modules-core`'un hoist edilmemesi, ve `tsconfig`'e `types: ["jest"]`
gerekmesi.

**Üretim kodunda iki satır değişti:** parola ve iki adımlı kod alanlarına
`testID` eklendi. RNTL 14'te `UNSAFE_*` sorguları kaldırıldı ve o alanların
görünür etiketi yok.

**Kapsam dışı kalanlar:** `components/*` (fiş, harcama düzenleyici, grup
oluşturucu) ve diğer ekranlar. Makine artık kurulu, sıradaki testler ucuz.

**Doğrulama:** mobil `tsc` + lint + 53 vitest + 14 jest, kök `tsc` + lint +
538 test, `expo-doctor` 20/21 (düşen tek kontrol CocoaPods — makinede kurulu
değil, Linux'ta koşmuyor).

---

## Faz 31 — Mobil kodu artık lint görüyor · **BİTTİ**

3745 satır hiçbir kural görmüyordu. Boşluk 27 Ağustos'ta ortaya çıktı: kökün
eslint yapılandırması `mobile/**`'ı yok sayıyordu ve gerekçe olarak
`mobile/eslint.config.js`'i gösteriyordu — **o dosya hiç var olmamıştı**.

Kurulum `eslint-config-expo` (flat config), `mobile/eslint.config.js`,
`cd mobile && npm run lint`, ve CI'da ayrı bir adım. Prettier **bilerek
alınmadı**: web tarafında da yok, yalnızca mobile eklemek iki ağaç arasında
tutarsızlık ve 3745 satırlık biçimlendirme gürültüsü demekti.

### İki tuzak, ikisi de ölçülerek bulundu

**`npx expo lint` bu dosyayı üretmedi.** "ESLint has been configured 🎉" dedi,
sonra `all of the files matching the glob pattern .../mobile/app are ignored`
diye düştü. Sebep: `mobile/` içinde config olmadığı için ESLint yukarı yürüyüp
**kökün** config'ini buluyor, araç da "zaten yapılandırılmış" sanıp geçiyor.
Sessiz değil, yanıltıcı bir başarısızlık.

**`expo lint` gerçek bir lint HATASINDA BİLE 0 dönüyor.** Kanca kuralı ihlali
enjekte edilip ölçüldü: `expo lint → 0`, `eslint . → 1`. CI'a `expo lint`
koymak, hiçbir zaman kırılmayan ama kırılıyormuş gibi duran bir adım demekti —
hiç olmamasından kötü. Komut `eslint . --max-warnings 0`; eşik bilinçli, çünkü
uyarılar da kırmazsa görünmeden birikiyor.

### İlk koşuda bulduğu dört şey

| Bulgu | Ne yapıldı |
|---|---|
| `sign-in.tsx`: `usePassword` "kanca callback içinde çağrılamaz" | **Gerçek isim hatası.** Düz bir olay işleyicisiydi ama `use` öneki React'te kancaya işaret ediyor — hem linter hem okuyan insan yanılıyor. `submitPassword` oldu; kardeşi `requestCode()` ile aynı aileden |
| `app/index.tsx`: kullanılmayan `View` importu | Kaldırıldı |
| `groups/[groupId]/index.tsx`: efekt içinde `setState` | Susturuldu, gerekçesiyle: dış veri çekmek efektin meşru kullanımı, döngü riski `!months[openMonth]` koşuluyla kapalı |
| `lib/auth.tsx`: render sırasında ref erişimi | Susturuldu, gerekçesiyle: efekte taşınamaz — `getToken()` o sözü beklemek zorunda, yoksa girişli kullanıcı her açılışta bir kez dışarı atılır. Davranış `auth.test.tsx`'te testle sabit |

Susturmaların ikisi de **hedefli** (`eslint-disable-next-line`), kural
kapatma yok.

**Doğrulama:** mobil lint + `tsc` + 53 test, kök lint + `tsc` + 538 test,
`expo export` hâlâ çalışıyor.

---

## Faz 30 — Kimlik işareti ve mağaza kimliği · **BİTTİ**

İki iş bir arada yürüdü: yeni bir marka işareti ve günlerdir tıkalı olan
uygulama adı.

### Yeni işaret (`6a`)

Claude Design'da altı tur, 24 seçenek üretildi. Seçilen `6a`: açık bir dış
halka ve içinde daha kısa ikinci bir yay — aynı merkez, farklı uzunluklar.
Eskisi eşit olmayan iki parçaya bölünmüş **dolu** bir daireydi; yeni hâli
aynı fikri konturla kuruyor.

**Elenenlerin sebebi kayda değer.** `4a` ve `4d` fikir olarak iyiydi ama
ADR-015'i ihlal ediyordu: kimlik rengi olarak `#FF4F3B` ve `#FFB43A`
kullanıyorlardı, oysa bu üründe kırmızı "sen borçlusun" demek. Ayrıca
`4a`'nın dilimleri birbirinden yalnızca **renkle** ayrılıyordu — arayüzde
işaret `currentColor` ile çizildiği için tek renge inince fikir yok oluyordu.
`6d`'yi tasarımın kendisi eledi: Wi-Fi/sinyal ikonuna fazla yakın.

**Uygularken gerçek bir arıza çıktı ve geometri değişti.** Tasarımdan geldiği
hâliyle 16 pikselte iki yay birbirine yapışıp lekeye dönüyordu — ve `size-4`
iki yerde kullanılıyor (`(app)/layout.tsx`, `legal-page.tsx`). Ölçüldü: dış
halka ile iç yay arasındaki net açıklık 1,2 birim, yani 16 pikselte **0,80
piksel**. Bir pikselin altındaki boşluk dolar. Önce ince kontur denendi ama o
da büyük boyları zayıflattı; tek değer ikisini birden vermiyordu. Çözüm iç
yarıçapı `4` → `3.6` çekmek oldu: açıklık 1,6 birime, 16 pikselte 1,07
piksele çıktı. Sayılar ve sebepleri bileşenin yorumunda duruyor — bir sonraki
kişinin aklına "konturu kalınlaştırayım" gelecek ve **16 pikselte** denemek
gelmeyecek.

**Telif/marka sorusu soruldu ve ayrıştırıldı.** Telif basit geometrik
biçimleri korumuyor, risk orada değil; asıl risk marka benzerliği ve
biçimler basit olduğu için **daha yüksek**. TMview görsel aramasıyla
(`tmdn.org/tmview`, 142 milyon marka) bakıldı, aynı sınıfta bariz bir
çakışma çıkmadı. Bu bir clearance değil, not düşülüyor.

**İkon uygulanmadı.** `mobile/assets/icon.png` ve `app.json` duruyor; ikonu
değiştirmek yeni derleme + `eas submit` demek ve o an isim meselesi hâlâ
açıktı. İkon adayları üretildi, uygulanmadı.

### Uygulama adı — çözüldü, ama beklediğimiz gibi değil

Günlerce "Apple destek dönünce çözülür" diye bekledik. **Yanlıştı.** Apple'ın
kendi belgesi şunu yazıyor:

> "If you remove an app, you'll lose ownership of the app name."

Yani silmek adı geçici olarak değil, sahiplik olarak bırakıyor. Ölçüm de
tutarlıydı: mağazada o adı **kimse** kullanmıyordu, ama hesap alamıyordu —
sorun rekabet değil, kendi silme işlemimizdi.

**Kullanıcı `Certificates, Identifiers & Profiles` ekranında ikinci kanıtı
buldu:** eski yanlış bundle ID (`net.wezy.app`) silinemiyor, panel
*"appears to be in use by the App Store"* diyor. Apple bunu da belgeliyor —
build almış bir bundle ID aynı organizasyonda bir daha kullanılamaz. Zararsız
ama silinen kaydın kalıcı iz bıraktığını gösteriyor.

**Asıl çözüm bir deneyden çıktı: kilit YERELLEŞTİRME BAŞINA.** İngilizce
tarafa varyant ad yazıldıktan sonra Türkçe yerelleştirmede sadece `Owezy`
denendi ve **kabul edildi**. Yani engel hesabın tamamında değildi.

| Dil | Ad | Altyazı |
|---|---|---|
| Türkçe | `Owezy` | `Grup hesabı, kolay ödeşme` |
| İngilizce | `Owezy: Split Expenses` | `Group bills, settled fast` |

**TÜRKÇE AD ALANINA BİR DAHA DOKUNULMAYACAK.** Normalde tavsiye tersi
olurdu — ad en ağır indekslenen alan ve "Owezy" uydurma bir kelime, kimse
aramıyor. Ama bu hesap bu ismi bir kez kalıcı olarak kaybetti; bırakılırsa
geri alınabileceğinin garantisi yok. Jenerik terimlerin altyazı ve anahtar
kelime alanında başka yolu var, adın geri gelmesinin yok.

Ad ile altyazının kelimeleri **bilerek çakışmıyor**: App Store ikisini de
indeksliyor, aynı kelimeyi ikisine koymak adın arama değerini harcamak olurdu.

**Telefondaki ad değişmedi:** ikonun altındaki ad `mobile/app.json`'daki
`name`den geliyor ve `"Owezy"` olarak kaldı. Yeni derleme gerekmedi.

**Doğrulama:** kök `tsc` + lint + 538 birim. E2E bu değişikliğe hiç bakmıyor
(`BrandMark` `aria-hidden`, hiçbir test onu seçmiyor), tam koşu yapılmadı.

---

## Faz 29 — Mobilde ilk otomatik testler · **BİTTİ**

App Store adı Apple'da beklerken seçilen iş. Seçilme sebebi tek cümle:
**gönderilen ikiliğe dokunmuyor** — `expo export` çıktısı değişmiyor, yeni
derleme gerekmiyor, App Privacy anketi aynı kalıyor. Fotoğraf adayı bunların
üçünü de geri sardırırdı.

**Başlangıç durumu ölçüldü:** mobilde **3745 satır kod, sıfır test**, test
koşucusu bile kurulu değil. CI mobilde üç şeye bakıyordu — tip kontrolü,
`expo-doctor`, `expo export` — üçü de kodun **derlendiğine** bakıyor,
hiçbiri ne yaptığına bakmıyor.

**Kapsamı ikinci bir ölçüm belirledi.** `mobile/lib` ve `mobile/components`
taranınca `react-native` importları şurada çıktı: `lib/theme.ts`
(`useColorScheme`), `components/*`, `app/*`. Çıkmadığı yerler: `lib/api.ts`,
`lib/auth.tsx`, `lib/i18n.tsx`, `lib/use-api.ts`. Yani **en riskli mantık —
iki adımlı doğrulamanın bütün durum makinesi — native hiçbir şeye
dokunmuyor** ve jsdom ile render edilebiliyor. Karar ve gerekçeleri ADR-042.

| Dosya | Ne sabitleniyor | Test |
|---|---|---|
| `lib/api.test.ts` | HTTP → sözleşme eşlemesi; `credentials: "omit"`; `Content-Type` yalnızca gövdeyle | 13 |
| `lib/two-factor-cookie.test.ts` | RN'in virgülle birleştirdiği üçlü `Set-Cookie`'den yalnızca meydan okumanın çıkarılması | 7 |
| `lib/session-store.test.ts` | Keychain patlarsa **fırlatmama** — girişi/çıkışı yarıda kesmemek | 9 |
| `lib/auth.test.tsx` | Giriş durum makinesinin tamamı | 24 |

**Geçen test hiçbir şey kanıtlamaz; düşen test kanıtlar.** Sekiz mutasyon
uygulandı, sekizi de yakalandı — en önemlisi 27.4'te bulunan hata (2FA dalı
silindiğinde 6 test düşüyor). Diğerleri: `credentials` `include`'a
çevrilince, silme satırı meydan okuma sanılınca, Keychain hatası fırlatılınca,
çıkışta önce sunucu çağrılınca, yanlış kodda meydan okuma yakılınca, ikinci
faktörde `Origin` düşürülünce, belirteçsiz 200 girişli sayılınca.

**Yanlış bir yorum bulundu ve düzeltildi.** `verifySecondFactor` "başarılı ya
da değil, bu çerez bitti" diyordu ama üstündeki erken `return` yüzünden
**başarısızlıkta çerezi silmiyordu**. Doğru olan koddu: 6 haneli kodu yanlış
yazan kullanıcı parolasını baştan girmemeli. Kaba kuvveti durduran şey de
çerezin tükenmesi değil — `/two-factor/*` uçları **10 saniyede 3 istekle**
sınırlı (`better-auth` two-factor eklentisinden okundu).

**Yan bulgu:** kökün eslint yapılandırması `mobile/**`'ı yok sayarken gerekçe
olarak `mobile/eslint.config.js`'i gösteriyordu — o dosya **hiç var olmadı**.
Yorum düzeltildi, boşluk aday listesine yazıldı; kapsam genişletilmedi.

**Doğrulama:** 53 mobil test (~0,5 sn), mobil `tsc` temiz, `expo-doctor`
20/21 (düşen tek kontrol CocoaPods — makinede kurulu değil, dört yeni
devDep'le ilgisi yok), kök `tsc` + lint temiz, 538 kök birim testi.
E2E'ye dokunan bir şey yok.

---

## Faz 28 — E-posta doğrulama; sessiz bir parola kaybı · **BİTTİ**

Planlanmış bir faz değildi. App Store ekran görüntüsü için demo veri
kurarken bir kullanıcının parolasının kaybolduğu fark edildi ve iz sürüldü.

**Ölçüldü, dört adımda yeniden üretildi:** doğrulanmamış bir hesapta e-posta
koduyla giriş yapmak **parolayı siliyor** — credential hesap 1'den 0'a
düşüyor, sonraki parola girişi 401 dönüyor.

**Sebep kütüphanenin hatası değildi.** `revokeUnprovenAccountAccess`,
`emailVerified: false` bir satıra e-posta koduyla ulaşıldığında o satırın
bütün hesap bağlarını siliyor; gerekçesi doğru ve bizde de geçerli — böyle
bir satır, bağlı erişimin posta kutusu sahibine ait olduğunun kanıtı değil.
Eksik olan bizim tarafımızdı: e-postayı **hiç** doğrulamıyorduk, yani
parolayla kaydolan herkes kalıcı olarak "kanıtlanmamış" kalıyordu.

**Kimi vuruyordu:** parolayla kaydolup sonra bir kez e-posta kodunu kullanan
herkesi. 2FA açık kullanıcılar etkilenmiyordu (o yol onlarda zaten kapalı),
ama 2FA'yı **açmadan önce** kodu kullanan biri parolasını kaybediyor ve
artık 2FA açamıyordu — yani delik ADR-040'ı da altından oyuyordu.

**Çözüm (ADR-041):** kayıtta doğrulama kodu gidiyor
(`sendVerificationOnSignUp`), kayıt formunda atlanabilir bir doğrulama adımı
var, ve güvenlik ekranı doğrulanmamış hesapta kalıcı bir uyarı + doğrulama
yolu gösteriyor. Giriş doğrulamaya **bağlanmadı** — o, ADR-035'i geri
açardı.

**Metin somut, "güvenlik için" demiyor:** *"Doğrulanmamış bir hesapta
e-posta koduyla giriş yaparsan parolan silinir."* Kullanıcı atlayıp
atlamayacağına ancak kaybedeceği şeyi bilerek karar verebilir.

**Test:** birim 534 ✅ · E2E 56 ✅. Yeni test `password-reset.spec.ts` içinde
ve **düzeltmesi kaldırılarak** doğrulandı.

**Aynı turda bulunan iki şey daha:**
- **Uygulama ikonu tasarım kılavuz çizgileriyle duruyordu** — kesikli merkez
  çizgileri, kılavuz daireleri, artı işareti. Bitmiş bir ikon değil, çalışma
  dosyasıydı; App Store'a aynen gidecekti. Üstelik uygulamanın kendi kimliğiyle
  de alakasızdı (web'deki `BrandMark` eşit olmayan iki parçaya bölünmüş bir
  daire). Yenisi uygulamanın kendi SVG'sinden üretildi, marka rengi
  `--brand` token'ından çözüldü, 1024×1024 ve alfa kanalsız.
- **Node 24'ün `fetch`'i `Sec-Fetch-*` başlıkları gönderiyor**, bu da Better
  Auth'un origin doğrulamasını zorluyor. Sunucuya betikle istek atarken
  `Origin` başlığı şart; yoksa `MISSING_OR_NULL_ORIGIN`.

---

## Faz 27 — İki adımlı doğrulama · **BİTTİ (web + mobil)**

Faz 25'in ertelediği iş. 25.6'da "eklentiyi tak" sanılıyordu; ölçünce üç ayrı
karar işi çıktı ve fazın kendisi oldu.

| Adım | Durum | Commit |
|---|---|---|
| 27.1 Şema (`TwoFactor` + `User.twoFactorEnabled`) | ✅ | `98d79b5` |
| 27.2 Sunucu (eklenti + e-posta kodu kapısı) | ✅ | `98d79b5` |
| 27.3 Web arayüzü + parola kurtarma | ✅ | `e9f3de1` |
| 27.4 Mobil ikinci faktör | ✅ | — |
| 27.5 Dokümanlar (ADR-040) | ✅ | — |

**Kararın kendisi ADR-040'ta.** Özeti: 2FA açıksa giriş **parolayla** olur,
çünkü Better Auth'un eklentisi ikinci faktörü bizim birincil giriş yolumuzda
(`/sign-in/email-otp`) **hiç sormuyor** — ölçüldü, kaynağında o yol yok.

**27.3'ün asıl bulgusu bir arayüz işi değildi:** bu karar "parolamı unuttum"un
o güne kadarki tek kaçış kapısını kapatıyor. Kapatıp yerine bir şey
konmasaydı, 2FA açan biri parolasını unuttuğu anda hesabına bir daha
giremezdi. Bu yüzden `/reset-password` aynı fazda geldi — ve **sunucuya tek
satır eklenmeden**: iki uç da `emailOTP` ile zaten geliyordu, gönderdikleri
posta bizim `sendOtpEmail`'imizden geçiyor, konu metni sözlükte hazırdı.
`reset-password` credential hesabı olmayan kullanıcıya onu **yaratıyor**, yani
aynı ekran hem "unuttum"a hem "hiç parolam yok"a yetiyor.

**Parolasız kullanıcı için düğme gösterilmiyor.** `/two-factor/enable` parola
istiyor ve `allowPasswordless` **kapalı kalmak zorunda** (açık olsaydı
parolasız biri 2FA açar ve kendini tamamen dışarıda bırakırdı). Arayüz bunu
`GET /api/v1/me`'nin yeni `hasPassword` alanından biliyor ve "Aç" yerine
"önce parola belirle" diyor — çalışmayan bir düğme değil.

**QR kodu için tek yeni bağımlılık: `uqr`** (bağımlılığı yok). `renderSVG`
değil `encode` kullanılıyor: dönen boolean matristen `<path>` React'in kendi
içinde üretiliyor, yani sayfaya ham HTML enjekte eden bir satır yok. Gizli
anahtar QR'ın yanında metin olarak da duruyor — kamerası olmayan da kurabilsin.

**Güvenlik ekranı tembel yükleniyor.** Kullanıcı menüsü `(app)/layout.tsx`
içinde, yani her sayfada; QR üreticisi ve Better Auth istemcisi doğrudan
import edilseydi ikisi de her sayfanın istemci paketine girerdi.

**Test:** Birim 534 ✅ · E2E 55 ✅. On bir yeni E2E: sekizi 2FA
(`e2e/two-factor.spec.ts`), üçü parola kurtarma (`e2e/password-reset.spec.ts`).
Testler **gerçek TOTP kodu üretiyor** ve burada ölçülmüş bir tuzak var:
`createOTP(secret).url(...)` gizli anahtarı URI'ye **base32'leyerek** yazıyor,
yani ekrandaki değer ham anahtar değil. Doğrudan kullanılırsa yanlış kod
üretiliyor ve test "2FA çalışmıyor" gibi düşüyor.

**Dört test düzeltme geri alınarak doğrulandı** — her biri kendi düzeltmesi
kaldırılınca gerçekten düşüyor: kanca (e-posta koduyla giriş reddediliyor),
`twoFactorRedirect` dalı (girişte ikinci faktör soruluyor), `INVALID_PASSWORD`
eşlemesi (yanlış parola anlaşılır bir cümle veriyor), `trustDevice` (bu cihazı
hatırla).

**Bir boşluk testi yazarken çıktı:** Better Auth'un `INVALID_PASSWORD` kodu
`auth-errors.ts`'te eşlenmemişti. Güvenlik ekranının **en olası** hatası —
parolayı yanlış yazmak — en anlamsız cümleyi alıyordu ("Bir şeyler ters
gitti"). 27.4'te aynısının iki tanesi daha çıktı: `INVALID_EMAIL` ve
`PASSWORD_TOO_LONG`. Üçü de eklendi; `INVALID_EMAIL` ayrı bir cümle aldı çünkü
o bir **biçim** hatası, "böyle bir hesap yok" değil.

### 27.4 — mobil ikinci faktör

**Sunucuya tek satır eklenmedi.** Meydan okuma imzalı bir çerezle taşınıyor ve
mobil bilerek `credentials: "omit"` kullanıyor (ADR-038). O karar
**değişmedi**: çerez bir kez yakalanıp tam iki uca elle konuyor, yalnızca
bellekte duruyor. `Origin` de yalnızca çerez taşıyan çağrılara ekleniyor —
her çağrıya koymak `formCsrfMiddleware`'i tetikleyip bugün çalışan giriş
akışını kırılgan hâle getirirdi.

`trustedOrigins`'e dokunulmadı ve bu bir ölçümün sonucu: varsayılan liste
`BETTER_AUTH_URL`'i içeriyor, gönderdiğimiz `Origin` ise `apiBaseUrl()` —
iki ortamda da aynı adres. `CURRENT_TASK` 25.5'ten beri o adımı yapılacak
diye taşıyordu.

**Parola kurtarma mobilde web'e yönlendiriyor** (seçenek A1, kullanıcı
kararı): uçlar zaten aynı, yani ekran ileride mobile taşınırsa sunucuda
hiçbir şey değişmiyor. **2FA açma/kapatma mobilde yok** (B1): kurulum web'de
kalıyor, QR'ı authenticator'ın kurulu olduğu telefonda göstermek zaten garip.

**Cihazda ölçmek, hiçbir testin görmediği bir hata buldu.** Yedek kodlar
büyük/küçük harfe duyarlı; iOS Safari metin girdilerinde ilk harfi
kendiliğinden büyütüyor. `pDHBX-yCqQf` sunucuya `PDHBX-yCqQf` gitti ve
reddedildi — kullanıcı doğru kodu yazdığı hâlde giremez ve sebebini
anlayamazdı, üstelik "telefonumu kaybettim" yolunda. `autoCapitalize="none"`
eklendi. Playwright'ın `fill()`'i bu davranışı taklit etmediği için testi bir
akış değil **özniteliğin kendisi** koruyor.

**Test:** birim 534 ✅ · E2E 55 ✅. Mobil tarafın otomatik testi **yok**
(Playwright web'e bağlı, aday listesinde duruyor); doğrulama önce curl ile
sunucu sözleşmesi, sonra iOS simülatöründe gerçek akış olarak yapıldı.

---

## Faz 26 — Güvenlik başlıkları ve hız sınırı · **CANLIDA**

Gizlilik politikasındaki "makul teknik tedbirler" cümlesini gerçek yapan iş.
Faz 25 onu aciller listesine taşıdı: **giriş denemelerini eskiden Clerk
sınırlıyordu, artık biz sorumluyuz.**

| Adım | Durum | Commit |
|---|---|---|
| 26.1 `/api/auth` hız sınırı gerçekten sayıyor | ✅ | `ee9e32e` |
| 26.2 Güvenlik başlıkları | ✅ | `abb6697` |
| 26.3 CSP | ✅ | `fbfed02` |
| 26.4 `/api/v1` hız sınırı | ✅ | `c698eaa` |

**26.1 — sayaç yanlış yerdeydi, kural değil.** Better Auth'un varsayılan
kuralları okununca makul çıktı (giriş/kayıt 3/10sn, e-posta kodu 3/60sn). Ama
depolama varsayılanı `"memory"` ve Vercel'de her serverless örneği kendi
belleğini taşıyor; sayaç sürekli sıfırlanıyordu. `storage: "database"` +
`RateLimit` tablosu. `lastRequest` **BigInt**: değer `Date.now()`, doğrulama
sırasında yazılan satır `1787719884665` — 32-bit `INTEGER` 2.147.483.647'de
biter.

Sınır **her ortamda açık**, kütüphanenin production-only varsayılanında
bırakılmadı: öyle kalsaydı mekanizmanın ilk gerçek koşusu canlıda olurdu.
Bedeli ölçüldü ve çözüm sınırdan değil kurulumdan geldi — E2E üç kullanıcıyı
arka arkaya yaratıyor ve tavana tam oturuyordu (koşu sonrası sayaç 3'te
kaldı); hazırlık artık kendi harcadığı sayacı siliyor, sınır testler boyunca
tam olarak açık kalıyor.

**26.2 — canlı ölçülerek yazıldı.** `curl -I` ile bakıldı: Vercel yalnızca
HSTS gönderiyor (iki yıl), gerisi yoktu. Eklenenler: `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `x-powered-by`
kapatıldı. HSTS'e dokunulmadı — kendi başlığımızı eklersek aynı başlık iki kez
gidebilir ve bu deploy etmeden ölçülemez.

`Referrer-Policy`'nin bizde **somut** bir sebebi var: davet linki bir sır
taşıyor (`/join/<token>`) ve adres çubuğunda duruyor.

**26.3 — CSP, nonce'suz (ADR-039).** Nonce yolu `proxy.ts`'i geri getirir ve
her sayfayı dinamik render'a zorlar; karşılığında kazanılan şey ölçüldüğünde
küçük çıktı — kod tabanında tek bir `dangerouslySetInnerHTML` yok.

**26.4 — yazma bütçesi, kullanıcı başına.** Anahtar kullanıcı, IP değil:
her yazma ucu oturum istiyor, yani anonim sel diye bir tehdit yok ve IP
operatör/NAT arkasında paylaşılıyor. **Okuma uçları bilerek dışarıda** — grup
sayfası tek seferde beş paralel GET atıyor.

Tablo **kendimizin olmak zorundaydı** ve bu ölçüldü: Better Auth kendi
`RateLimit` tablosunu buduyor ve eşiği yalnızca kendi pencerelerinden
hesaplıyor; bizim satırlarımız altımızdan silinirdi — sınır zaman zaman hiç
uygulanmazdı.

**Kuralı bir yapısal test koruyor.** Sınır 15 dosyaya elle kondu; on altıncıda
unutmak görünür hiçbir şey bozmaz. Test, bir uçtan sınır kasten çıkarılarak
doğrulandı ve adını verdi: `'/groups/route.ts -> POST'`.

Ölçüm: 1–60 → 200, 61+ → 429. E2E'nin en yoğun anı bir pencerede **4** yazma.

**Test:** Birim 513 ✅ · E2E 43 ✅ (dört kez) · üretim derlemesi yerelde
koşulup konsol okundu ✅

---

## Faz 25 — Clerk'ten Better Auth'a geçiş · **CANLIDA**

26 Ağustos'ta `main`'e alındı (`069523e`) ve ~70 saniyede yayına girdi.
Merge'den önceki son kontrol preview'da yapıldı: `/api/auth/get-session`
`null` döndü, yani Better Auth Vercel'in kendi ortamında ayağa kalkıyordu —
derlemeyi düşürebilecek tek şey (`BETTER_AUTH_SECRET`) böylece elendi.

Merge sonrası canlıda doğrulandı: güvenlik başlıkları yerinde, `x-clerk-*` ve
`x-powered-by` yok, `/api/webhooks/clerk` 404, `/privacy`'de Clerk geçen satır
sayısı sıfır. En önemlisi **veritabanı turu**: olmayan bir hesapla giriş
denemesi `401 INVALID_EMAIL_OR_PASSWORD` döndü — `User` tablosuna gerçek bir
sorgu, yani `clerkId`'nin düşürüldüğü şema sağlam.

Yayından **önce** yapılıyor: production'da sıfır kullanıcı var. Sonra yapmak
herkese parola sıfırlatmak demekti (Clerk parola hash'ini dışarı vermiyor).

| Adım | Durum | Commit |
|---|---|---|
| 25.1 Şema ve iskelet | ✅ | `aa6f6cb` |
| 25.2 Resend + tek seferlik kod | ✅ | `6dbb997` |
| 25.3 Sunucu kimliği (`auth.ts`, `/api/v1`) | ✅ | `bd9ae88` |
| 25.4 Web arayüzleri (giriş/kayıt/menü) | ✅ | `0952ad2`, `e8163e6`, `c4107b2` |
| 25.5 Mobil | ✅ | `b3156e9` |
| 25.8 E2E Better Auth'a geçti | ✅ | `fb4e167` |
| 25.7 Clerk'in sökülmesi | ✅ | `d10146f`, `c9a8869`, `eddace3`, `980c76d`, `a23dc5a` |
| 25.6 İkinci faktör | ⏸ ertelendi | |

**Sıra bilerek değişti (kullanıcı kararı).** E2E kurulumu Clerk'in tarayıcı
SDK'sıyla giriş yapıyordu; Clerk önce sökülseydi 43 test birden düşer ve
sökmeyi doğrulayacak hiçbir şey kalmazdı. 2FA ise ertelendi çünkü ölçüldüğünde
"eklentiyi tak" işi olmadığı görüldü — Better Auth'un 2FA kancası
`/sign-in/email-otp`'yi hiç görmüyor ve meydan okuma çerezle taşınıyor
(mobil çerez taşımıyor). Ayrıntı ve üç seçenek CURRENT_TASK'ta.

**Kazanç şimdiden görülüyor:** kendi `User` tablomuz devralındı (`modelName` +
`fields`), yani `Expense`/`Settlement`/`GroupMember`/`Notification`'ın tamamı
yerinde kaldı ve `session.user.id` **doğrudan** bizim `User.id`'miz — ADR-007'nin
taşıdığı `clerkId → User.id` eşlemesi ortadan kalkıyor.

**25.5 — mobil.** Mobil artık yalnızca Better Auth konuşuyor. Better Auth'un
istemci kütüphanesi **kullanılmadı**; gerekçe ve iki ölçüm ADR-038'de —
CSRF'i tetikleyen şey "Origin yok" değil "çerez var", ve React Native'in
`fetch`'i varsayılan olarak çerez tutuyor. Belirteç geçersizleşirse
(401 + `auth.not_signed_in`) oturum bırakılıyor; Clerk'te bu gerekmiyordu.

**Üç kez doküman/üretici yanıldı, çalışma zamanı haklı çıktı:** Better Auth'un
id üreteci UUID değil; `prisma migrate diff` çıktısı olduğu gibi alınamıyor
(ADR-024'ün üretilmiş kolonunu bozuyor); `@better-auth/cli` eski bir sürümün
şemasını üretti ve `Account.issuer` atlandı. Şema artık `getAuthTables()`
çağrılarak doğrulanıyor.

**25.7 — Clerk'in sökülmesi.** Kimlik kapısı tek fonksiyona indi
(`findCurrentUser`); `getOrCreateCurrentUser`, "lazy sync" (ADR-011), webhook,
`clerk-sync`, `ClerkProvider` ve `src/proxy.ts` gitti. `src/proxy.ts` tamamen
silindi: tek işi Clerk'in oturum bağlamını taşımaktı, hiçbir route'u
korumuyordu. `User.clerkId` ve `User.clerkUpdatedAt` sütunları düştü.

**ADR-007 karşılığını verdi.** "Kimlik sağlayıcısı değiştirilebilir olmalı"
bir varsayımdı; sınandı. `Expense`, `Settlement`, `GroupMember`,
`Notification` — hepsi `User.id`'ye bağlıydı ve **hiçbirine dokunulmadı**.
Göç tek bir `DROP COLUMN` ile bitti.

**Gizlilik politikası yanlış olmuştu.** "Parolan bize hiç ulaşmaz; girişi
Clerk yönetiyor" cümlesi 25.4'ten beri doğru değildi — parola artık bizim
sunucumuza geliyor ve hash'lenip veritabanımıza yazılıyor. Düzeltildi; Resend
yeni bir veri işleyici olarak eklendi, Clerk listeden çıktı.

**Sökme bir boşluk açtı ve aynı fazda kapatıldı:** görünen adı değiştirmenin
tek yolu Clerk'in profil arayüzüydü. `PATCH /api/v1/me` artık `displayName`
de kabul ediyor.

**Test:** Birim 510 ✅ · E2E 43 ✅ · `tsc`/lint ✅ · `expo-doctor` 21/21 ✅ ·
`expo export` ✅ · mobil uçtan uca simülatörde ✅

---

## Faz 24 — Mobilde ikinci faktör ve çıkışın gerçekten çıkış yapması · **BİTTİ**

İki iş bir arada, ikisi de kimlik doğrulama. Gerekçeler ADR-036 ve ADR-037'de.

**İkinci faktör.** Giriş ekranını biz yazdık ve `"complete"` dışındaki her
durumda kullanıcıyı web'e gönderiyordu. 2FA açıldığı anda, 2FA'yı
etkinleştiren her kullanıcı **mobilden kilitlenirdi**. Yeni adım
`components/second-factor.tsx`'te; üç yol destekleniyor (TOTP, e-posta kodu,
yedek kod), SMS dalı bilerek yazılmadı.

**Panelde MFA açıldı — yalnızca development.** Clerk'te MFA bir **Pro**
özelliği ($25/ay); development'ta ücretsiz. Uygulamanın henüz kullanıcısı
ve geliri yokken maliyet üstlenilmedi. Kod hazır duruyor.

**Kod ücretsiz planda da işe yarıyor:** `needs_client_trust` (Device Trust)
production'da zaten karşımıza çıkıyor ve o ekran artık çıkmaz değil.

**Çıkış hatası — verifikasyon sırasında bulundu.** Çıkış düğmesi
çalışmıyordu ve sebebi ikiydi: (1) `lib/token-cache.ts` Clerk'in
**opsiyonel** `clearToken`'ını uygulamıyordu, yani belirteç Keychain'de
kalıyordu; (2) `/` dışındaki hiçbir ekranın oturum koruması yoktu. İkisi de
Faz 21'de düzeltilen "çıkışta donan uygulama" hatasının aynı ailesinden.

**Doğrulama simülatörde, gerçek kodlarla:** e-posta kodu → ikinci faktör
ekranı → **gerçek TOTP koduyla** giriş; ayrıca **gerçek yedek kodla** giriş.
Kod üreteci RFC 6238'in altı test vektörünü geçti, yani ürettiği sayı
doğrulanmış. Çıkış için: düzeltmeden önce yeniden açılışta hâlâ girişliydi,
sonra çıkmış kalıyor.

**SINANMADI:** Device Trust dalı. O durum parolayla girişte tetikleniyor.

**Test:** Birim 535 ✅ · E2E 43 ✅ · mobil `tsc`/`expo-doctor`/`expo export` ✅

---

## Faz 23 — Mobilde parolayla giriş · **BİTTİ**

App Store incelemesinin açtığı bir iş. Tek giriş yolumuz e-posta koduydu ve
bu, inceleyiciye **okuyabileceği bir posta kutusu** vermek demekti — yani
gönderimin kaderi bizim kontrol etmediğimiz bir posta sağlayıcısına
bağlanırdı. Parola o bağımlılığı kaldırdı. Gerekçeler ADR-035'te.

**Aslında yarısı zaten vardı:** `e2e/global.setup.ts` test kullanıcılarını
**baştan beri parolayla** girdiriyor, yani development instance'ında parola
açık. Web'de de Clerk'in kendi formu alanı gösteriyor. Eksik olan yalnızca
mobil ekrandı.

**Birincil yol değişmedi.** Ekranda önce "Kod gönder", altında ikincil bir
"Parolayla gir" bağlantısı.

**Yan iş — mobil giriş ekranı sözlüğe taşındı.** Bu ekran mobildeki **tek**
sabit metinli ekrandı; yeni metin eklemek kuralı daha da bozardı. Metinler
`messages.ts`'e taşındı, `describeError` bilmediği şekilde artık `null`
dönüyor ve cümleyi çağıran taraf sözlükten koyuyor. Tamamlanmamış giriş
durumları da ham durum adı basmak yerine kullanıcıyı çalışan yola (web'e)
yönlendiriyor.

**Device Trust engeli çıktı ve aşıldı.** Parola tek başına yetmedi: Clerk'in
Device Trust koruması doğru paroladan sonra bile ek doğrulama istiyor
(`needs_client_trust`) ve o doğrulama e-posta koduyla yapılıyor. Çözüm,
demo kullanıcıyı `bypass_client_trust` ile muaf tutmak oldu — böylece koruma
**herkeste açık kaldı**. Alan belgelenmemiş olduğu için her gönderimden önce
doğrulanmalı; adımlar ADR-035'te.

**Doğrulama simülatörde uçtan uca:** çıkış → parolayla giriş → grupların
yüklenmesi. iOS'un parola kaydetme teklifi de alanın doğru tanındığının
kanıtı. Ayrıca kök tsc/lint/535 birim ve dört mobil CI adımı.

---

## Faz dışı düzeltmeler

| İş | Commit |
|---|---|
| Playwright E2E altyapısı + bulduğu iki gerçek hata (kullanıcı oluşturmada yarış durumu, silinen harcamanın ekranda kalması) | `0248d4d` |
| Arayüz metinlerinin Türkçe karakterlerle yazılması | `e5e69dd` |
| Migration'ların havuzsuz bağlantıya alınması (PgBouncer'da asılı kalan advisory lock) | `1f68d5c` |
| GitHub Actions CI: `main`'e giden her değişiklikte tip kontrolü, lint ve birim testleri (E2E hariç, gerekçesi ADR-018) | `09d0e91` |
| Talimat dosyalarındaki tekrarların temizlenmesi, PROJECT.md'deki bayat bilgiler (tek dil, eski test sayıları) ve hedefli E2E koşusu tarifi | `f700fbe` |
| `npm audit fix`: 12 → 6 açık, 19 yama seviyesi güncelleme (`package.json` değişmedi) | `430e378` |
| Next 16.2.11 → 16.3.2: kalan `postcss` ve `sharp` açıkları kapandı, 6 → 3 | *(bu commit)* |

---

## Sıradaki adaylar (henüz karar verilmedi)

Aşağıdakiler **planlanmış iş değildir**; kullanıcı hangisinin yapılacağına
karar vermemiştir.

| Aday | Neden önemli |
|---|---|
| **Mobil ekran testleri** | Birim katmanı 27 Ağustos'ta kapandı (ADR-042) ama `components/*` ve `app/*` hâlâ yalnızca simülatörde elle doğrulanıyor. `@testing-library/react-native` + jest-expo gerektiriyor — ikinci bir koşucu |
| **Mobil kodu lint görmüyor** | Kökün eslint'i `mobile/**`'ı yok sayıyor ve gerekçe olarak gösterdiği `mobile/eslint.config.js` **hiç var olmadı** (27 Ağustos'ta ölçüldü). Yani 3745 satır hiçbir kural görmüyor. `eslint-config-expo` var, kurulumu küçük |
| **Silineni geri alma arayüzü** | `restore` ucu var, hiçbir istemci kullanmıyor |
| **Mobilde bildirimler / dil seçimi / grup düzenleme** | Web'de var, mobilde yok |
| **Fişin canlıda gözle görülmesi** | Uzun açıklamalarda noktalı ayraç ve çok aylı katlama yalnızca yapay veriyle sınandı |
| **`disableLogger` ölçümü** | `next.config.ts`'teki satır Turbopack altında ölü olabilir; ölçülmeden dokunulmayacak |
| **Fiş / fatura VE profil fotoğrafı** | Aşağıda ayrıca. İkisi tek aday: aynı depo, aynı yükleme arayüzü, aynı beyan güncellemeleri |

### Aday ayrıntısı — fiş / fatura VE profil fotoğrafı

**İkisi tek aday**, çünkü ikisi de aynı üç şeyi gerektiriyor: bir nesne
deposu, bir yükleme arayüzü, ve gizlilik/mağaza beyanlarının güncellenmesi.
Ayrı ayrı yapılırsa aynı bedel iki kez ödenir.

Kullanıcı fiş fotoğrafını bir kere sormuş ("veritabanını çok şişirir mi?")
ve **kayda hiç geçmemişti**; 26 Ağustos'ta sorulunca ortaya çıktı. Profil
fotoğrafı ise 27 Ağustos'ta kendini gösterdi: kullanıcı kendi hesabında
kırık bir görsel kutusu gördü. Sebep bir özellik eksikliği değil, Clerk'ten
kalan ölü bir adresti — ama isteğin kendisi oradan doğdu.

**Şişirme sorusunun cevabı: görsel veritabanına konmaz.** Nesne depolamada
durur, veritabanında yalnızca anahtar + metadata olur — kayıt başına birkaç
yüz bayt. Telefon fotoğrafı ~1600px'e küçültülüp WebP'ye çevrilince
200–500 KB; ayda 25 fişli harcama ≈ 10 MB/ay/grup. Bunu Postgres'e koymak
Neon'da depolama ücreti demek ve o baytlar **her yedekte ve her branch'te**
çoğalır. Yığınımızdaki doğal yer **Cloudflare R2** (alan adı zaten
Cloudflare'de, ADR-026; çıkış trafiği ücretsiz).

**Asıl maliyet depolama değil:**
- **CSP değişmek zorunda.** Bugün `img-src 'self' data: blob:` ve bu, uzak
  adresli her görseli engelliyor — 27 Ağustos'ta ölçüldü, kırık avatarın
  sebeplerinden biri buydu. Görseller kendi kökenimizden servis edilirse
  değişiklik gerekmez; R2'den doğrudan gelecekse gerekir.
- **Gizlilik politikası yine değişir.** Bugün açıkça "dosya yükleme diye bir
  şey yok" diyor. Fotoğraf yeni bir veri kategorisi ve yeni bir işleyici.
- **App Store**: kamera/galeri izin metinleri `Info.plist`'e girer, App
  Privacy anketine "Photos or Videos" eklenir, izin isteyen uygulama
  incelemede daha çok soru alır.
- **Silme anlamı KARARA BAĞLANDI (ADR-046, 4 Eylül).** Harcama silinince
  fiş fotoğrafı **kalır** — geri alma var, yoksa geri alınan kayıt sakat
  dönerdi. Hesap silinince hem profil hem fiş fotoğrafları **silinir**:
  gizlilik tek cümleyle anlatılabilsin diye ("hesabını silersen yüklediğin
  her şey gider"). Bakiyeler etkilenmiyor, değiştirilemez kural
  çiğnenmiyor — giden şey kaydın kendisi değil ekli görsel.
- **Mobilde yeni bağımlılık** (`expo-image-picker`) ve yeni bir native izin.

**Kod tarafında hazır olan:** `User.avatarUrl` ve `User.hasImage` sütunları
duruyor (Clerk devrinden), `PersonAvatar` da `hasImage` ayrımını taşıyor.
Yani profil fotoğrafı geldiğinde yazacak yer hazır — ama `canRenderAvatar`
bugün yalnızca aynı kökenden gelen adresleri geçiriyor, uzak depo seçilirse
o da CSP ile birlikte değişmeli.

## Bilinen teknik borç

- **`src/lib/two-factor-cookie-bridge.ts` GEÇİCİ ve silinmeli.** Mağazadaki
  mobil 1.0'ın 2FA çerezini karşılamak için var (Faz 36, ADR-045). 1.0.1
  yaygınlaşınca köprü, testi ve `route.ts`'teki sarmalayıcı kaldırılıp dosya
  eski hâline (yalnızca `toNextJsHandler`) dönmeli. **Erken kaldırılmamalı:**
  kaldırıldığı anda güncellemeyi almamış her telefon yeniden kırılır. Ölçüt
  "1.0.1 gönderildi" değil, "eski sürüm pratikte kalmadı".

- **E2E bir kez ACIKLANAMAYAN sekilde yavasladi ve sonra kendiliginden
  duzeldi.** 27 Agustos: ayni test kumesi 10 dk -> 26 dk -> 1.6 saat diye
  uzadi, tek tek testler 15 DAKIKA surdu (oysa test zaman asimi 60 sn) ve
  ilgisiz testler dustu - hepsi ayni aileden, "kaydettim ama ekran
  guncellenmedi".

  **Sebep BULUNAMADI, ama neyin olmadigi olculdu:** veritabani normaldi
  (140 ms sorgu, 901 baglantidan 13'u kullanimda), bellek %56 bostu,
  14 cekirdek, isinma yok, kacak surec yok, sunucu logunda hata yok.
  **Degisiklikler de suclu degildi:** ayni yavaslama, o turun butun
  degisiklikleri stash'lenmis TEMIZ AGACTA da uretildi - temiz agacta ilk
  test 10 dakikada bile bitmedi.

  Bir sure sonra ayni kod, ayni makinede 56/56 ve 10.4 dakika. Yani gecici
  bir dis etkendi. **Bir daha olursa once bu madde okunmali** ve zaman
  kodda aranmamali; dogrudan "temiz agacta da oluyor mu" sorusuyla
  baslanmali - o soru bir turu bastan eliyor.

- **Tek seferlik kodlar veritabanında DÜZ METİN duruyor.** `emailOTP`
  eklentisinin `storeOTP` varsayılanı `"plain"` ve değiştirmedik (ölçüldü:
  `email-otp/otp-token.mjs`). `Verification.value` alanında kodun kendisi
  yazıyor — yani veritabanına okuma erişimi olan biri (sızmış bir yedek,
  salt-okunur bir replika) o an uçuşta olan bir kodla giriş yapabilir. Kod 5
  dakika yaşıyor, ama yine de bir kimlik bilgisi.

  **`"hashed"` bedava değil, karar gerekiyor:** `tryReuseOTP` hash'li bir
  kodu geri okuyamıyor, yani "kodu yeniden gönder" diyen kullanıcıya **yeni**
  bir kod gidiyor ve **ilk e-postadaki kod ölüyor**. İki e-postası olan
  kullanıcı yanlış olanı deneyebilir. Takas ölçülmeden değiştirilmemeli.

  **Değiştirilirse `e2e/db-cleanup.ts`'teki `readOtpFromDatabase` de
  değişmek zorunda** — iki E2E dosyası kodu oradan okuyor.

- **Harcama formu kaydettikten sonra "Kaydediliyor..."da takılabiliyor.**
  26 Ağustos'ta iki E2E testi bu yüzden düştü, aynı koşu tekrarlandığında
  geçti. Playwright'ın sayfa görüntüsü sebebi açıkça gösteriyor: POST
  **başarılı** (toast "Harcama eklendi" çıkmış), ama ardından gelen gezinme
  tamamlanmamış — düğme devre dışı, sayfa formda kalmış.
  `expense-form.tsx:352-353` `router.push(...)` çağırıp **hemen ardından**
  `router.refresh()` çağırıyor. Kullanıcı tarafında görünen hâli: kayıt
  gitti ama ekran öyle söylemiyor. Aynı aile: giriş formlarındaki donma
  (25.7'de düzeltildi). Ölçülmeden değiştirilmemeli — `refresh()` kaldırılırsa
  fişin güncellenmemesi riski var
- `schema.prisma` başındaki yorum bloğu güncel değil
- Vitest'te iki zararsız uyarı (CJS config yükleme, `vite-tsconfig-paths`
  artık Vite'a gömülü) — kullanıcı bunlara dokunulmamasını istedi
- **`next.config.ts`'teki `disableLogger: true` ölü olabilir.** Derlemede
  Sentry uyarı veriyor: seçenek kullanımdan kaldırılmış, yerine
  `webpack.treeshake.removeDebugLogging` öneriliyor **ve ikisi de
  Turbopack'te desteklenmiyor**. Next 16 varsayılan olarak Turbopack
  kullandığı için bu satır muhtemelen hiçbir şey yapmıyor. Dokunulmadı:
  Sentry'nin debug loglarının bundle'dan gerçekten çıkıp çıkmadığını
  ölçmeden değiştirmek, sessizce bundle büyütebilir. Ölçülüp karar verilmeli
- **`npm audit`: 3 yüksek açık** (önce 12'ydi). Önce `npm audit fix`, sonra
  Next 16.3.2 yükseltmesi uygulandı. `npm audit fix` ile kapananlar:
  `brace-expansion`, `fast-uri`, `js-yaml`, `find-my-way`, `valibot` ve
  Prisma'nın alt paketleri kapandı — 19 yama seviyesi güncelleme, hepsi
  beyan edilen aralık içinde, `package.json` değişmedi.

  **Next 16.3.2 ile `postcss` ve `sharp` de kapandı** (sharp 0.34.5 →
  0.35.3, postcss 8.5.23/8.5.26). İkisi de zaten çalışan uygulamaya
  ulaşmıyordu — `sharp` yalnızca `next/image` üzerinden çağrılıyor ve
  `next/image` kod tabanında hiç kullanılmıyor, `postcss` derleme
  zamanında çalışıyor — ama artık yamalılar.

  **Kalan üçü bilerek açık.** Üçü de aynı şeyi istiyor: `deepmerge-ts` ve
  `valibot` için Prisma'yı **7.9.1'den 6.12.0'a düşürmek**. Majör bir geri
  gidiş; şema, `prisma.config.ts` ve adapter'ın tamamı 7 için yazılmış. Bir
  derleme aracındaki DoS açığını kapatmak için çalışan uygulamayı kırmak
  takas değil.

  **Not:** "package-lock.json yazmaya kapalı" engeli sanıldığı kadar güçlü
  değilmiş — `.claude/settings.json`'daki kural Claude'un dosya düzenleme
  araçlarını engelliyor, `npm` komutunu değil.
- Dil düğmesi `/api/v1/me`'ye **çıkış yapmışken de** PATCH atıyor; herkese
  açık sayfalarda bu her zaman 401 dönüyor ve tarayıcı konsoluna hata
  düşüyor. Zararsız (kod bunu bekliyor ve yutuyor) ama gereksiz istek ve
  gürültü. Çözüm bir prop: `PublicControls` zaten herkese açık sayfalarda
  kullanılıyor, oturum durumunu sunucudan geçirmek yeterli. (Öneri bir ara
  "Clerk'in `useAuth().isSignedIn`'i" diyordu — Clerk 25.7'de söküldü.)
- `PublicControls` konumunu `fixed` ile kendisi belirliyor. Dar ve kısa bir
  ekranda üstteki kartla çakışabilir. **11.6'nın listesindeydi, yapılmadı** —
  ölçülmedi de; kalan tek 11.6 maddesi bu.
- `src/components/ui/dialog.tsx` içinde ekran okuyucuya görünen `"Close"`
  metni sözlükte değil. `ui/` altı shadcn'in ürettiği kod; oraya dokunmak
  ayrı bir karar (yeniden üretimde kaybolur).
- `.claude/settings.json` (`.env.local` ve `package-lock.json` yazma koruması)
  **git'te değil** — `.claude/` gitignore'da. Yeni bir klonda bu koruma
  bulunmaz; elle yeniden oluşturulması gerekir.
