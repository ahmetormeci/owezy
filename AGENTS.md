<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SplitApp — bu repoda çalışırken

## Önce oku

Proje hafızasının kaynağı **`docs/` klasörü + repository'nin gerçek
durumudur**. Yeni bir oturuma başlarken şu sırayla oku; kullanıcıdan geçmişi
anlatmasını veya proje özeti vermesini **isteme**:

| Sıra | Dosya | Ne için |
|---|---|---|
| 1 | [docs/CURRENT_TASK.md](docs/CURRENT_TASK.md) | Şu an ne yapılıyor, hemen sonraki adım |
| 2 | [docs/PROJECT.md](docs/PROJECT.md) | Projenin ne olduğu (high-level) |
| 3 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Katmanlar, akışlar, bağımlılık kuralları |
| 4 | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Kod ve mimari kuralları |
| 5 | Gerektiğinde | [PROGRESS.md](docs/PROGRESS.md), [DECISIONS.md](docs/DECISIONS.md), [DATABASE.md](docs/DATABASE.md), [CHANGELOG.md](docs/CHANGELOG.md) |
| 6 | Kod | Yalnızca **gerektiği kadar** doğrula |

**Doküman ile kod çelişirse repository'deki gerçek durum doğrudur.** Önce
doğrula, sonra dokümanı düzelt — tersi değil. Dokümanda yazan mevcut durumu
varsayımla değiştirme.

## Sonra güncelle

Bir iş tamamlandığında: **testleri çalıştır → `git status`/`git diff` kontrol
et → dokümanları güncelle.** Kullanıcının "hafızayı güncelle" demesini bekleme.

| Dosya | Ne yazılır |
|---|---|
| `CURRENT_TASK.md` | Yalnızca **aktif** görev ve hemen sonraki adım. Geçmiş anlatmaz; yeni görevde **baştan yazılır**. |
| `PROGRESS.md` | Fazların gerçek durumu |
| `CHANGELOG.md` | Önemli değişiklikler |
| `DECISIONS.md` | Yeni mimari/teknik kararlar (ADR) |
| Diğerleri | Yalnızca içerikleri **gerçekten** değiştiyse |

Bir karar DECISIONS.md'de yoksa **alınmamış sayılır** — varsayma, sor.
**Gereksiz yere yeni doküman dosyası oluşturma**; mevcut sekiz dosya yeterli.

## Commit ve push

Commit her zaman kullanıcı istediğinde atılır. Push kuralı commit'in
içeriğine bağlıdır:

| Commit türü | Kapsam | Push |
|---|---|---|
| **Doküman** | Yalnızca `docs/**` ve/veya kök `*.md` (`AGENTS.md`, `README.md`) | **Otomatik at**, sorma |
| **Kod** | `src/`, `e2e/`, `prisma/`, `package.json`, config dosyaları — biri bile varsa | **Sorma­dan atma** |

Karışık commit (doküman + kod) **kod commit'i sayılır**.

Ayrımın sebebi: push, Vercel'de production deploy tetikler. Doküman
commit'i çalışan uygulamayı değiştirmez, o yüzden beklemesi anlamsız.
Kod commit'inde ise commit ile push arasındaki duraklama kullanıcının son
kez bakma fırsatıdır.

## Kendiliğinden yapılmayacaklar

- **"Sıradaki adaylardan" birini kullanıcı görev vermeden uygulama.**
  PROGRESS.md'deki aday listesi bir plan değil, seçenek listesidir.
- **Mevcut bir mimari kararı değiştirecek bir şey yapmadan önce sor.**

## Çalışma ritmi

Kullanıcı bu sırayı bekliyor; atlanması istenmiyor:

1. **Önce tasarım.** Ne yapılacağını, seçenekleri ve gerekçeleri yaz.
2. **Onay bekle.** Onay almadan kod yazma.
3. **Uygula.**
4. **Doğrula:** `npx tsc --noEmit`, `npm run lint`, `npm test`.
   E2E'yi ilgilendiren değişiklikte **commit öncesi tam koşu şart**:
   `npm run test:e2e`. Geliştirme turlarında daraltabilirsin —
   `npx playwright test e2e/expenses.spec.ts` ya da
   `npx playwright test -g "yuzdeli harcama"`; `setup` projesi yine çalışır,
   yalnızca kapsam daralır. Şema değiştiyse önce `npm run db:migrate:e2e`.
   **Şüphe varsa tam koşu.**
5. **Commit** — yalnızca kullanıcı isteyince.

Kullanıcı beginner seviyesinde bir geliştirici; **neden** öyle yapıldığını
açıklaman bekleniyor, yalnızca ne yaptığını değil.

## Değiştirilemez kurallar

Bunlar tartışılmış ve karara bağlanmıştır (gerekçeler DECISIONS.md'de):

- **Para kuruş cinsinden tam sayıdır.** Float paraya dokunmaz.
- **Güvenlik sonraya bırakılmaz.** Bir güvenlik ayarını "test kolay olsun"
  diye kapatma; kodda çöz.
- **`"use server"` kullanılmaz.** İş mantığı `/api/v1` altında — mobil
  istemci de aynı uçları çağıracak.
- **`currency` istemciden alınmaz.**
- **Çalışan kod gereksiz yere silinmez.**
- **Finansal kayıtlar fiziksel olarak silinmez** (soft delete + audit log).

## Ortam

- Windows, PowerShell. Kullanıcı `node`/`npx` komutlarını çalıştırabiliyor.
- Üç ayrı veritabanı: geliştirme, E2E, production. `E2E_DATABASE_URL` ile
  `DATABASE_URL` **asla** aynı olmamalı — `e2e/db-cleanup.ts` aynıysa
  çalışmayı reddeder.
- Tam E2E koşusu ~5–6 dakika sürer ve gerçek bir dev sunucusu başlatır (3100).
  **Koşu sürerken proje dosyalarına dokunma.**
- E2E çıktısındaki `[WebServer]` satırları dev sunucusunun stderr'i: Clerk'in
  "development keys" uyarısı ve tarayıcı kapanınca çıkan `ECONNRESET` /
  `Error: aborted` gürültüdür. Playwright'ta `stdout` zaten kapalı; `stderr`
  **bilerek açık** çünkü gerçek sunucu hataları da oradan geliyor.
