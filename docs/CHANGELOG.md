# Değişiklik Kaydı

Kronolojik, kısa. Faz durumu için [PROGRESS.md](PROGRESS.md), kararların
gerekçesi için [DECISIONS.md](DECISIONS.md).

> Tarihler commit geçmişinden doğrulanabilen yerlerde kesindir. İlk fazların
> tarihleri commit sırasından türetilmiştir; gün kesinliği yoktur.

---

## 2026-08-12

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
