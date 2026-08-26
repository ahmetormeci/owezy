# İlerleme Durumu

> Bu dosya **faz durumunun tek kaynağıdır**. Şu an ne yapıldığı için
> [CURRENT_TASK.md](CURRENT_TASK.md).
>
> **Numaralandırma notu:** Fazlar, işlerin **fiilen tamamlanma sırasına** göre
> numaralandırılmıştır (git geçmişinden doğrulanabilir). İlk plandaki
> numaralarla birebir örtüşmeyebilir — bu eşleşme doğrulanamadığı için
> numaralar burada yalnızca sıra belirtir.

**Özet:** 26 faz tamamlandı ve **Faz 25 ile 26 canlıda** (`main`'e alındı).
**Faz 27** (iki adımlı doğrulama) web tarafında bitti; geriye mobil arayüzü
kaldı. Uygulama canlıda ve `main`'e giden her değişiklik CI'dan geçiyor.

| Test | Sayı | Son durum |
|---|---|---|
| Birim (Vitest) | 534 | ✅ tümü geçiyor |
| E2E (Playwright) | 55 | ✅ tümü geçiyor |
| `npx tsc --noEmit` | — | ✅ temiz |
| `npm run lint` | — | ✅ temiz |

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
| **Mobilde otomatik test** | CI artık derleniyor mu diye bakıyor ama **davranışa** bakan hiçbir şey yok; mobilin doğrulaması hâlâ simülatörde elle |
| **Silineni geri alma arayüzü** | `restore` ucu var, hiçbir istemci kullanmıyor |
| **Mobilde bildirimler / dil seçimi / grup düzenleme** | Web'de var, mobilde yok |
| **Fişin canlıda gözle görülmesi** | Uzun açıklamalarda noktalı ayraç ve çok aylı katlama yalnızca yapay veriyle sınandı |
| **`disableLogger` ölçümü** | `next.config.ts`'teki satır Turbopack altında ölü olabilir; ölçülmeden dokunulmayacak |
| **Harcamaya fiş / fatura görseli** | Aşağıda ayrıca; kayda hiç geçmemişti |

### Aday ayrıntısı — harcamaya fiş / fatura görseli

Kullanıcı bunu bir kere sormuş ("veritabanını çok şişirir mi?") ama **kayda
hiç geçmemişti**: ne ADR, ne aday listesi, ne teknik borç, ne git geçmişi.
26 Ağustos'ta sorulunca ortaya çıktı ve unutulmasın diye buraya yazıldı.
**Karar değil, seçenek.**

Şişirme sorusunun cevabı: **görsel veritabanına konmaz.** Nesne depolamada
durur, veritabanında yalnızca anahtar + metadata olur — harcama başına birkaç
yüz bayt, yani ölçülemeyecek kadar az. Telefon fotoğrafı ~1600px'e küçültülüp
WebP'ye çevrilince 200–500 KB; ayda 25 fişli harcama ≈ 10 MB/ay/grup. Bunu
Postgres'e koymak Neon'da depolama ücreti demek ve o baytlar **her yedekte ve
her branch'te** çoğalır. Yığınımızdaki doğal yer **Cloudflare R2** (alan adı
zaten Cloudflare'de, ADR-026; çıkış trafiği ücretsiz).

**Asıl maliyet depolama değil, ve karar verilirken tartılacak olan bunlar:**
- **Gizlilik politikası yine değişir.** Bugün açıkça "dosya yükleme diye bir
  şey yok" diyor. Fiş fotoğrafı yeni bir veri kategorisi ve yeni bir işleyici.
- **App Store**: kamera/galeri izin metinleri `Info.plist`'e girer, App
  Privacy anketi değişir, izin isteyen uygulama incelemede daha çok soru alır.
- **Silme anlamı belirsiz.** Değiştirilemez kural finansal kayıtların fiziksel
  olarak silinmemesi; harcama soft-delete olunca fotoğraf ne olacak? Kalırsa
  "sildim" diyen kullanıcının fişi duruyor demektir.
- **Mobilde yeni bağımlılık** (`expo-image-picker`) ve yeni bir native izin.

## Bilinen teknik borç

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
