# Değişiklik Kaydı

Kronolojik, kısa. Faz durumu için [PROGRESS.md](PROGRESS.md), kararların
gerekçesi için [DECISIONS.md](DECISIONS.md).

> Tarihler commit geçmişinden doğrulanabilen yerlerde kesindir. İlk fazların
> tarihleri commit sırasından türetilmiştir; gün kesinliği yoktur.

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
