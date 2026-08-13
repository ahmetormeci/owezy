# İlerleme Durumu

> Bu dosya **faz durumunun tek kaynağıdır**. Şu an ne yapıldığı için
> [CURRENT_TASK.md](CURRENT_TASK.md).
>
> **Numaralandırma notu:** Fazlar, işlerin **fiilen tamamlanma sırasına** göre
> numaralandırılmıştır (git geçmişinden doğrulanabilir). İlk plandaki
> numaralarla birebir örtüşmeyebilir — bu eşleşme doğrulanamadığı için
> numaralar burada yalnızca sıra belirtir.

**Özet:** 14 faz tamamlandı. Uygulama canlıda ve `main`'e giden her değişiklik
CI'dan geçiyor.

| Test | Sayı | Son durum |
|---|---|---|
| Birim (Vitest) | 493 | ✅ tümü geçiyor |
| E2E (Playwright) | 32 | ✅ tümü geçiyor |
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

- **Ürün riski:** `category` varsayılanı `OTHER`. Kimse dokunmazsa kategori
  kırılımı tek çubuk "Diğer" olur. Formdaki kategori seçiminin görünürlüğü
  artmalı.
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

## Faz dışı düzeltmeler

| İş | Commit |
|---|---|
| Playwright E2E altyapısı + bulduğu iki gerçek hata (kullanıcı oluşturmada yarış durumu, silinen harcamanın ekranda kalması) | `0248d4d` |
| Arayüz metinlerinin Türkçe karakterlerle yazılması | `e5e69dd` |
| Migration'ların havuzsuz bağlantıya alınması (PgBouncer'da asılı kalan advisory lock) | `1f68d5c` |
| GitHub Actions CI: `main`'e giden her değişiklikte tip kontrolü, lint ve birim testleri (E2E hariç, gerekçesi ADR-018) | `09d0e91` |
| Talimat dosyalarındaki tekrarların temizlenmesi, PROJECT.md'deki bayat bilgiler (tek dil, eski test sayıları) ve hedefli E2E koşusu tarifi | `f700fbe` |

---

## Sıradaki adaylar (henüz karar verilmedi)

Aşağıdakiler **planlanmış iş değildir**; kullanıcı hangisinin yapılacağına
karar vermemiştir.

| Aday | Neden önemli |
|---|---|
| **Alan adı + Clerk production instance** | Gerçek kullanıcılara açmanın önündeki tek engel (kullanıcı üstlendi) |
| **Bildirim saklama politikası** | Kayıtlar sonsuza kadar birikiyor |
| **`createGroup` / `acceptGroupInvite` birim testleri** | İkisi de yalnızca E2E'nin dolaylı kapsamında; davet kabulü bir güvenlik sınırı |
| **`npm audit fix`** | 10'un 5'i sürüm aralığı içinde kapanıyor; `package-lock.json` yazma izni gerekiyor |

## Bilinen teknik borç

- `createGroup` ve `acceptGroupInvite` için birim testi yok (E2E dolaylı kapsıyor)
- Optimistic locking yok (ADR-010, mobil aşamasına ertelendi)
- `schema.prisma` başındaki yorum bloğu güncel değil
- Vitest'te iki zararsız uyarı (CJS config yükleme, `vite-tsconfig-paths`
  artık Vite'a gömülü) — kullanıcı bunlara dokunulmamasını istedi
- **`npm audit`: 10 açık (1 orta, 9 yüksek).** **İncelendi:** hiçbiri çalışan
  uygulamaya ulaşmıyor — hepsi derleme veya geliştirme aracında. `sharp`
  yalnızca `next/image` üzerinden çağrılıyor, `next/image` hiç kullanılmıyor;
  `postcss` derleme zamanında çalışıyor. `npm audit fix` 5 tanesini sürüm
  aralığı içinde kapatıyor; kalan ikisi `--force` ve Next 16.2.11 → 16.3.0
  yükseltmesi istiyor, o ayrı bir iş olmalı. **Yapılmadı:**
  `package-lock.json` `.claude/settings.json` ile yazmaya kapalı.
- Dil düğmesi `/api/v1/me`'ye **çıkış yapmışken de** PATCH atıyor; herkese
  açık sayfalarda bu her zaman 401 dönüyor ve tarayıcı konsoluna hata
  düşüyor. Zararsız (kod bunu bekliyor ve yutuyor) ama gereksiz istek ve
  gürültü. Clerk'in `useAuth().isSignedIn` değeriyle atlanabilir.
- `PublicControls` konumunu `fixed` ile kendisi belirliyor. Dar ve kısa bir
  ekranda üstteki kartla çakışabilir. **11.6'nın listesindeydi, yapılmadı** —
  ölçülmedi de; kalan tek 11.6 maddesi bu.
- `src/components/ui/dialog.tsx` içinde ekran okuyucuya görünen `"Close"`
  metni sözlükte değil. `ui/` altı shadcn'in ürettiği kod; oraya dokunmak
  ayrı bir karar (yeniden üretimde kaybolur).
- `.claude/settings.json` (`.env.local` ve `package-lock.json` yazma koruması)
  **git'te değil** — `.claude/` gitignore'da. Yeni bir klonda bu koruma
  bulunmaz; elle yeniden oluşturulması gerekir.
