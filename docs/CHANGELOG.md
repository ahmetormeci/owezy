# Değişiklik Kaydı

Kronolojik, kısa. Faz durumu için [PROGRESS.md](PROGRESS.md), kararların
gerekçesi için [DECISIONS.md](DECISIONS.md).

> Tarihler commit geçmişinden doğrulanabilen yerlerde kesindir. İlk fazların
> tarihleri commit sırasından türetilmiştir; gün kesinliği yoktur.

---

## 2026-08-11

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
