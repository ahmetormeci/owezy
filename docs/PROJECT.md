# Owezy — Proje Tanımı

> **Bu dosya high-level'dır.** Dosya yapısı ve katman kuralları için
> [ARCHITECTURE.md](ARCHITECTURE.md), veri modeli detayı için
> [DATABASE.md](DATABASE.md).

## Amaç

Grup içindeki ortak harcamaları kaydeden, kimin kime ne kadar borçlu olduğunu
hesaplayan ve borçların kapatılmasını takip eden bir web uygulaması
(Splitwise benzeri). Arayüz **Türkçe ve İngilizce**; dil çerezden, o yoksa
hesaptan okunur (`User.locale`).

**Canlı:** https://owezy.net

## Temel özellikler

| Özellik | Durum |
|---|---|
| Grup oluşturma, düzenleme, listeleme | ✅ |
| Link tabanlı davet (süre + kullanım limiti), davet iptali | ✅ |
| Harcama ekleme / düzenleme / silme / geri yükleme | ✅ |
| Üç bölüşüm tipi: EQUAL, EXACT, PERCENTAGE | ✅ |
| Bakiye hesaplama ve borç sadeleştirme (önerilen ödemeler) | ✅ |
| Ödeme (settlement) kaydı ve iptali | ✅ |
| Gruptan ayrılma, üye çıkarma, sahiplik devri | ✅ |
| Bildirimler (6 olay, zil menüsü) | ✅ |
| Kimlik doğrulama: e-posta kodu ya da parola (web + mobil, kendi uçlarımız) | ✅ |
| İki adımlı doğrulama (TOTP + yedek kod) | ✅ web + mobil |
| Parola belirleme / yenileme (e-posta koduyla) | ✅ web |
| Hesap silme (anonimleştirme) | ✅ |
| İki dil (TR/EN), açık/koyu tema, avatarlar | ✅ |

## Teknoloji stack'i

| Katman | Seçim | Not |
|---|---|---|
| Framework | Next.js 16.2.11 (App Router, Turbopack) | |
| Dil | TypeScript | strict |
| UI | React 19.2.4, Tailwind CSS 4, shadcn/ui (**Base UI** preset, "Nova") | Radix değil |
| Veritabanı | PostgreSQL (Neon serverless) | |
| ORM | Prisma 7.9.0 + `@prisma/adapter-neon` | |
| Kimlik doğrulama | Better Auth 1.7.1 | kendi `User` tablomuzun üstünde; ADR-038 |
| E-posta | Resend 6.22.1 | tek seferlik giriş kodları |
| Doğrulama | Zod 4.4.3 | sunucu ve istemci aynı şemayı paylaşır |
| Birim test | Vitest | sayı: PROGRESS.md |
| E2E test | Playwright | 3 test kullanıcısı, kurulum onları kendisi yaratıyor; sayı: PROGRESS.md |
| Hata takibi | Sentry (`@sentry/nextjs` 10.70) | |
| Hosting | Vercel | |

## Mimari yaklaşım

**Tek Next.js uygulaması.** Ayrı bir backend servisi yok.

**İş mantığı `/api/v1` Route Handler'larında, Server Actions'ta değil.**
Bunun tek sebebi var: projenin bir **mobil uygulaması** olacaktı.
Server Actions yalnızca aynı Next.js istemcisinden çağrılabilir; Route
Handler'larını mobil istemci de aynı şekilde çağırabilir. Kod tabanında hiç
`"use server"` yoktur ve olmamalıdır.

**O uygulama artık var** (Faz 18): `mobile/` altında Expo / React Native ile
yazıldı — native değil, çünkü bölüşüm ve para aritmetiğini üç kez yazmamak
için (ADR-029).

Bu gerekçe artık **ölçülmüş durumda**: çerez taşımayan bir istemci
`Authorization: Bearer` ile `/api/v1`'i çağırabiliyor (token yokken 401,
token varken 200). Bir E2E testi bu sözleşmeyi koruyor — bkz. ADR-029.

**Okuma yolu ile yazma yolu farklıdır:**
- **Okuma:** Server Component → doğrudan servis katmanı (`src/lib/*`).
  Sayfa zaten sunucuda render ediliyor; kendi kendine HTTP turu atmak
  gereksiz gecikme olurdu.
- **Yazma:** İstemci bileşeni → `fetch` → `/api/v1/*` → servis katmanı.

Detay: [ARCHITECTURE.md](ARCHITECTURE.md).

## Önemli tasarım prensipleri

1. **Para tam sayıdır.** Tüm tutarlar kuruş (minor unit) cinsinden `Int`.
   Float aritmetiği paraya hiçbir noktada dokunmaz — bildirim payload'ında bile.
2. **Yüzdeler basis point'tir.** `10000 = %100`, tam sayı.
3. **Küsurat kaybolmaz.** Bölüşüm sonuçlarının toplamı her zaman tutara birebir
   eşittir; artık kuruşlar deterministik biçimde dağıtılır.
4. **Finansal kayıtlar fiziksel olarak silinmez.** Soft delete + değiştirilemez
   audit log (`ExpenseEdit`).
5. **Kritik kurallar veritabanında da vardır.** Uygulama katmanı tek savunma
   hattı değildir; CHECK'ler ve trigger'lar aynı kuralları DB seviyesinde
   zorlar.
6. **Ayrılmış üyenin borcu kaybolmaz.** Bakiyesi sıfırlanmamış eski üyeler
   listede kalmaya devam eder.
7. **Mobil, kararların ortağı.** Bir seçim mobil tarafı zorlaştıracaksa
   alternatifi tercih edilir. Bu artık bir tahmin değil: mobil uygulama var
   ve aynı `/api/v1` uçlarını çağırıyor.

## Güvenlik prensipleri

- **Yetkilendirme her zaman sunucuda.** Arayüzdeki buton gizleme yalnızca
  kolaylıktır; asıl kontrol servis katmanındadır.
- **Yetki mantığı tek yerde.** `src/lib/group-access.ts` — harcama ve ödeme
  kayıtları aynı kuralları paylaşır; iki yere kopyalanıp zamanla ayrışması
  güvenlik hatalarının klasik kaynağıdır.
- **Kaydı yalnızca oluşturan değiştirebilir.** `paidById` hiçbir yetki
  vermez (düzenlenebilir bir alan olduğu için yetki yükseltme yolu olurdu).
  OWNER yalnızca oluşturan kişi gruptan ayrıldıysa devreye girer.
- **Var olmayan ile yetkisiz aynı cevabı alır.** Üye olmadığın bir grup 404
  döner — grubun varlığı bile sızdırılmaz.
- **Ham davet token'ı veritabanında saklanmaz.** Yalnızca SHA-256 hash'i
  tutulur; ham token kullanıcıya bir kez gösterilir.
- **Para birimi istemciden alınmaz.** Her zaman grubun kaydından türetilir.
- **Webhook imzası doğrulanmadan hiçbir işlem yapılmaz.** Yapılandırma
  eksikse sistem açık değil, kapalı kalır.
- **Bildirim sorguları kullanıcıya kilitlidir.** `where` koşulunda `userId`
  vardır; id bilmek başkasının kaydına erişim sağlamaz.

## Yayınlama — App Store ve Google Play

Bu bölüm bir karar listesi değil, **gereklerin envanteri**. Kararlar
ADR-030'da (önce iOS; hesap silme ve Sign in with Apple henüz karara
bağlanmadı).

> Mağaza kuralları değişiyor. Buradaki sayılar 2026-08 itibarıyla; kesin
> rakamı her zaman Apple/Google'ın kendi konsolu gösterir.

### Apple

- **Apple Developer Program**, yıllık 99 $, her yıl yenilenir.
- Kimlik doğrulaması artık iOS'taki **Apple Developer uygulaması** üzerinden.
  Başvuru onaylanana kadar `developer.apple.com` sitesi seni üye değilmiş gibi
  karşılar ve "Enroll Now" gösterir — bu normaldir, **ikinci kez kayıt olma**.
- **Bundle ID kalıcıdır.** Uygulama adı App Store Connect'te rezerve edilir.
- **TestFlight iki ayrı kanal:**

  | | Kim | Kaç kişi | İnceleme |
  |---|---|---|---|
  | Internal | App Store Connect kullanıcıları | 100 | Yok, dakikalar içinde |
  | External | E-posta daveti ya da açık link | 10.000 | İlk build için Beta App Review (~1 gün) |

  Build'ler **90 gün sonra sona erer**.
- **Export compliance**: yalnızca HTTPS kullandığımız için
  `ITSAppUsesNonExemptEncryption: false` yazılır, soru her build'de sorulmaz.
- **Demo hesap zorunlu.** Uygulama giriş duvarının arkasında olduğu için
  inceleyiciye çalışan bir hesap verilmek zorunda (App Review Information).
  İçinde örnek grup ve harcamalar olmalı.
- Mağaza sayfası: ekran görüntüleri, açıklama, **gizlilik politikası URL'si
  (zorunlu)**, App Privacy formu, yaş sınırı, kategori.
- İnceleme genelde 1-2 gün.

### Google

- **Play Console 25 $, bir kerelik** (yıllık değil).
- **Kişisel hesaplarda takvim kuralı:** production'a çıkmadan önce kapalı
  testte belirli sayıda test kullanıcısıyla **14 gün kesintisiz** test şart.
  Sayı kuralın ilk halinde 20'ydi, sonra 12'ye indirildi — **güncel rakamı
  Play Console kendi ekranında gösteriyor**. Organizasyon hesapları muaf ama
  onlar da D-U-N-S numarası istiyor (alması haftalar sürebiliyor).
- Kanallar: internal (100 kişi, inceleme yok) → closed (14 günlük saat burada
  işler) → open → production.
- Gerekenler: gizlilik politikası URL'si, **Data safety** formu, içerik
  derecelendirme anketi, hedef kitle beyanı, demo hesap ("App access"),
  reklam beyanı.
- **Paket adı kalıcıdır.**
- Teknik tuzak: **ilk AAB elle yüklenmek zorunda**; Google'ın API'si ilk
  sürümü oluşturamıyor, `eas submit` ancak ondan sonra çalışıyor.

### Sıralamanın mantığı

Bekleme süresi olan işler kodu beklemez; kodu değiştiren işler koddan önce
karara bağlanır. Mağaza sayfası, ekran görüntüleri ve inceleme ise en sona
kalır — uygulama çalışmadan yapılamazlar.

## Veri modeli — high-level

9 model, 5 enum. Detay ve kısıtlar: [DATABASE.md](DATABASE.md).

```
User ──< GroupMember >── Group
                          ├──< Expense ──< ExpenseParticipant
                          │        └──< ExpenseEdit  (immutable audit log)
                          ├──< Settlement
                          └──< GroupInvite

User ──< Notification
```

- **User** — kimliğin tek kaynağı. Better Auth aynı tabloya yazıyor, yani
  oturumun verdiği kimlik **doğrudan** bizim `User.id`'miz; arada eşleme yok.
  Faz 25'e kadar bir `clerkId` sütunu vardı ve göçün amacı onu kaldırmaktı.
- **Group** — tek para birimi taşır; oluşturulduktan sonra değiştirilemez.
- **GroupMember** — `leftAt` ile geçmiş üyelikler korunur; aynı kişi ayrılıp
  tekrar katılabilir.
- **Expense** + **ExpenseParticipant** — payların toplamı tutara eşit olmak
  zorundadır (DB trigger'ı ile garanti).
- **Settlement** — gerçek para transferi değildir; "şu ödeme yapıldı" kaydıdır.
- **Notification** — 6 olay tipi; payload anlık görüntü (snapshot) taşır.
