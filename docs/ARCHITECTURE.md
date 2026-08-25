# Mimari

> Low-level. Projenin ne olduğu için [PROJECT.md](PROJECT.md), veri modeli için
> [DATABASE.md](DATABASE.md).

## Klasör yapısı

```
src/
├─ app/
│  ├─ (app)/                    Route group: giriş yapmış kullanıcı sayfaları
│  │  ├─ layout.tsx             Auth kontrolü + başlık (zil ikonu burada)
│  │  └─ groups/...             Grup, harcama, üye sayfaları
│  ├─ api/
│  │  ├─ v1/                    Kendi versiyonladığımız API (web + mobil)
│  │  └─ webhooks/clerk/        Clerk'ten gelen olaylar (v1 DEĞİL, bkz. aşağı)
│  ├─ join/[token]/             Davet kabul sayfası (giriş gerektirmez)
│  ├─ sign-in/, sign-up/        Clerk sayfaları
│  ├─ layout.tsx                Kök layout, ClerkProvider
│  └─ page.tsx                  Karşılama sayfası
├─ components/
│  ├─ ui/                       shadcn/ui (Base UI) primitifleri — elle düzenlenmez
│  └─ *.tsx                     Uygulamaya özel bileşenler
├─ lib/                         SERVİS KATMANI + saf mantık
├─ instrumentation.ts           Sentry (sunucu)
├─ instrumentation-client.ts    Sentry (tarayıcı)
└─ proxy.ts                     clerkMiddleware() — koruma YAPMAZ, bkz. auth

mobile/                         Expo / React Native uygulaması (Faz 18)
├─ app/                         expo-router: dosya tabanlı rotalar
│  ├─ index.tsx                 YALNIZCA yönlendirme (0 / 1 / 2+ grup)
│  ├─ sign-in.tsx               e-posta + doğrulama kodu (kendi ekranımız)
│  └─ groups/                   liste, fiş, üyeler, ödemeler, harcama detayı
├─ components/                  fiş parçaları, besteci, grup oluşturucu
├─ lib/                         API istemcisi, tema, i18n taşıyıcı
└─ metro.config.js              depo kökünü izler (paylaşılan modüller için)

e2e/                            Playwright (YALNIZCA web)
prisma/                         schema.prisma + migrations
docs/                           Bu dokümanlar
```

**`/api/webhooks/clerk` neden `/api/v1` altında değil:** `/api/v1` bizim
istemcilerimizin (web ve mobil) kullandığı, sözleşmesini bizim
belirlediğimiz ve versiyonladığımız yüzeydir. Webhook ise dışarıdan çağrılan,
sözleşmesini Clerk'in belirlediği ayrı bir yüzeydir.

## Katmanlar ve bağımlılık kuralları

```
Server Component ─┐
                  ├──► lib/*  ──►  lib/prisma  ──►  PostgreSQL
Route Handler ────┘
        ▲
        │ fetch (yalnızca yazma)
İstemci bileşeni
```

**Kurallar:**

| Kural | Gerekçe |
|---|---|
| `lib/*` **asla** route handler'a import etmez | Bağımlılık tek yönlü; servis HTTP'den bağımsız kalır |
| Route handler **asla** doğrudan `prisma` kullanmaz | İş mantığı ve yetki kontrolü servis katmanında toplanır |
| Server Component **yazma** yapmaz, yalnızca okur | Yazma yolu tek: `/api/v1` (mobil de aynısını kullanıyor) |
| `components/ui/*` elle düzenlenmez | shadcn tarafından üretilir; değişiklik güncellemede kaybolur |
| `"use server"` **kullanılmaz** | Server Actions mobil istemciden çağrılamaz |
| Şema dosyaları (`*-schemas.ts`) servisten import **etmez** | Servisi mock'layan route testleri şemayı da bozardı |

Sayfalama sabitleri (`DEFAULT_*_PAGE_SIZE`) şema dosyalarında tanımlıdır ve
servis onları oradan okur — ters yön değil.

## API → lib → Prisma akışı

Her `/api/v1` route handler'ı aynı iskeleti izler:

```ts
export async function POST(request: NextRequest, { params }) {
  try {
    const user = await getOrCreateCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = someSchema.parse(await request.json());

    const result = await someService(user.id, groupId, body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Sıra sabittir: **kimlik → parametre → doğrulama → servis → cevap**.

Servise her zaman **bizim `User.id`'miz** geçer, `clerkId` değil.

### Cevap sözleşmesi

| Durum | Gövde | HTTP |
|---|---|---|
| Başarılı | `{ ok: true, ... }` | 200 / 201 |
| Hata | `{ ok: false, code, params? }` | 400 / 401 / 403 / 404 / 409 / 500 |

İstemci tarafında bu sözleşme tek yerde yorumlanır: `src/lib/api-client.ts`
içindeki `apiRequest<T>()`. Hata durumunda `ApiClientError` fırlatır:
`message` çevrilmiş cümledir (çağıranların çoğu yalnızca onu okur), ama
`status` ve `code` de üzerinde durur — bazı çağıranların hatayı **ayırt
etmesi** gerekiyor (ilk örnek: 409 + `expense.version_conflict`).

Mobil tarafta karşılığı `mobile/lib/api.ts`: fırlatmak yerine
`{ ok: false, status, code }` döndürüyor.

## Auth akışı

```
İstek
 └─► proxy.ts — clerkMiddleware()
      Yalnızca oturum bilgisini isteğe ekler. HİÇBİR ROUTE'U KORUMAZ.
 └─► (app)/layout.tsx — auth() → userId yoksa redirect("/sign-in")
 └─► Sayfa/route — getOrCreateCurrentUser() → bizim User kaydımız
```

**Koruma neden proxy'de değil:** Proxy yol eşleştirmesine dayanır ve Next.js'in
gerçek yönlendirmesinden sapabilir; bu, korunması gereken bir sayfanın açıkta
kalmasına yol açabilir. Clerk'in kendi dokümantasyonu da korumayı sayfada
yapmayı önerir. (`createRouteMatcher` deprecated'dır.)

Dosya Next 16'ya kadar `middleware.ts` adını taşıyordu; özellik aynı, yalnızca
dosya kuralı yeniden adlandırıldı (bkz. sürüm tuzakları).

### `getOrCreateCurrentUser()` (`src/lib/auth.ts`)

Clerk kimliğini bizim `User` satırımıza bağlar. Kayıt yoksa oluşturur
("lazy sync"). **Yarışa dayanıklıdır:** bir sayfa açılışında tarayıcı eş
zamanlı birden fazla istek atar; hepsi "kayıt yok" görüp oluşturmaya
çalışabilir. `P2002` (benzersizlik ihlali) bir hata değil, "yarışı başkası
kazandı" sinyali olarak ele alınır ve kazananın kaydı okunup döndürülür.

Webhook (`/api/webhooks/clerk`) bu yolun yerini **almaz**: webhook birkaç
saniye gecikebilir. İkisi birlikte çalışır, ikisi de idempotenttir.

## Mobil istemci (Faz 18)

`mobile/` kendi `package.json`'ı ile aynı repoda duruyor; monorepo'ya
geçilmedi (ADR-029). Web ile ilişkisi üç maddeyle özetlenebilir:

**Aynı API'yi çağırıyor.** Web oturumu çerezle taşıyor, mobil
`Authorization: Bearer` ile. Bu bir varsayım değil, ölçüldü ve kalıcı bir E2E
testine bağlandı (`e2e/auth.spec.ts`) — biri ileride çerez varsayan bir
kontrol eklerse mobil sözleşme sessizce kırılırdı.

**Saf modülleri paylaşıyor, React bileşenlerini PAYLAŞMIYOR.** `money.ts`,
`split.ts`, `messages.ts`, `dates.ts`, `expense-category-guess.ts`,
`expense-labels.ts`, `expense-diff.ts` mobilde `@/lib/...` ile doğrudan
import ediliyor; takma ad `mobile/tsconfig.json`'dan, kök izleme
`mobile/metro.config.js`'ten geliyor. React bileşenleri geçemiyor:
mobil ağacın dışındaki bir dosyadan `react` çözülünce kökteki kopya bulunuyor
ve iki React kopyası kancaları boş bir dispatcher'a gönderiyor. Ayrıntı ve
kural [CONVENTIONS.md](CONVENTIONS.md) "Mobil" bölümünde.

**Otomatik testi yok, ama CI artık ona da bakıyor.** E2E ve birim testleri
hâlâ yalnızca web'i kapsıyor; mobilin **davranışını** doğrulayan hiçbir şey
yok ve doğrulama iOS Simulator'da elle yapılıyor. CI (Faz 20) mobil tarafta
dört şey koşuyor: bağımlılık kurulumu, `tsc`, `expo-doctor` ve
`expo export`. Sonuncusu tip sisteminin göremediği katmanı kapsıyor —
Metro'nun depo kökü üzerinden `@/lib` takma adını gerçekten çözebilmesi ve
paketin kurulabilmesi.

Mobil adımlar **ayrı bir job değil**: mobil `tsc`, kökün üretilmiş Prisma
client'ına bağlı (paylaşılan modüllerden ikisi `@prisma/client`'tan tip
alıyor ve `mobile/node_modules`'ta `@prisma` yok, çözüm köke çıkıyor).

**Rotalar:** `/` yalnızca yönlendirir (0 grup → liste, 1 grup → doğrudan
gruba, 2+ → liste); `/groups` her zaman listeyi gösterir. İkisinin ayrı
olması bir hatanın sonucu: aynı dosyadayken "Gruplarım" bağlantısı tek gruplu
kullanıcıda kendi ekranına geri yönlendiriyordu.

## Error handling

`src/lib/errors.ts` — HTTP durum kodunu **hatanın kendisi taşır**:

| Sınıf | Status |
|---|---|
| `ValidationError` | 400 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

`src/lib/api.ts` içindeki `handleApiError(error)` tek dönüşüm noktasıdır:
`AppError` → kendi status'u, `ZodError` → 400 + `issues`, bilinmeyen →
`console.error` + 500.

**Kural:** Servis katmanı HTTP bilmez, `AppError` türevleri fırlatır. Route
handler yalnızca `handleApiError`'a devreder.

**Sızıntı kuralı:** Yetkisiz erişimde `NotFoundError` kullanılır
(`ForbiddenError` değil) — üye olmadığın bir grubun *var olduğu* bilgisi bile
sızdırılmaz.

## Transaction yaklaşımı

**Birden fazla satır yazan her işlem tek `prisma.$transaction` içindedir.**

```ts
export async function createExpense(userId, groupId, input) {
  return prisma.$transaction(async (tx) => {
    // ... doğrulama, yazma, audit, bildirim — hepsi tx üzerinden
  });
}
```

Kurallar:

1. Transaction içindeki **tüm** sorgular `tx` kullanır, `prisma` değil.
   Bir sorgu `prisma` kullanırsa transaction dışında kalır ve geri alınmaz.
2. **Audit kaydı aynı transaction'da yazılır.** Transaction geri alınırsa log
   da geri alınır; "olmayan bir değişikliğin kaydı" oluşmaz.
3. **Bildirimler aynı transaction'da yazılır.** `createNotifications(tx, ...)`
   çağıranın transaction'ını alır, kendi transaction'ını açmaz. Harcama
   kaydedildiyse bildirim de kaydedilmiştir.
4. **Harcama güncellemesinde paylar her zaman baştan yazılır** (`deleteMany`
   + `createMany`). Sebebi: toplam kontrolü yapan trigger yalnızca
   `ExpenseParticipant` değişiminde tetiklenir, `Expense.amount` değişiminde
   değil. Payları yeniden yazmak trigger'ın her güncellemede çalışmasını
   garanti eder.
5. **Transaction eş zamanlılığı ÇÖZMEZ.** Sık karışan nokta bu: `$transaction`
   tek bir isteğin içini atomik yapar, ama iki *ayrı* isteğin arasındaki
   bayatlığı görmez. Aynı harcamayı iki cihazdan düzenlemek buna örnek —
   iki istek de kendi içinde kusursuzdur, kaybolan şey istemcinin elindeki
   verinin güncelliğidir. Çözüm optimistic locking (ADR-032) ve kontrolü
   **`WHERE` içine** yazmak: Read Committed'da okuma satırı kilitlemediği
   için `tx` içinde okuyup JS'te karşılaştırmak iki eş zamanlı isteğin
   ikisini de geçirebilir. Prisma'da bu `updateMany` demek —
   `update()` yalnızca benzersiz alanla filtreleyebiliyor:

   ```ts
   const guard = await tx.expense.updateMany({
     where: { id: expenseId, version: expectedVersion },
     data: { ...alanlar, version: { increment: 1 } },
   });
   if (guard.count === 0) throw new ConflictError("expense.version_conflict");
   ```

## Validation yaklaşımı

**Zod, sunucu ve istemci arasında paylaşılır** (`src/lib/*-schemas.ts`).

İstemcideki doğrulama yalnızca hızlı geri bildirim içindir; **asıl kontrol her
zaman sunucuda tekrar yapılır** — istemci doğrulaması atlanabilir.

İki tuzak, bilerek atlanmıştır:

1. **`z.coerce.boolean()` kullanılmaz.** Boş olmayan her string `true` olur;
   `?includeDeleted=false` bile `true` olurdu. Bunun yerine kabul edilen
   değerler açıkça listelenir:
   ```ts
   z.enum(["true", "false"]).transform((v) => v === "true").optional()
   ```
2. **`currency` hiçbir body şemasında yoktur.** Zod'un varsayılan "strip"
   davranışı sayesinde istemci gönderse bile elenir; servis her zaman grubun
   para birimini kullanır.

## Sayfalama

Cursor tabanlıdır. **Sıralama benzersiz olmak zorundadır**, yoksa cursor
kayıt atlar veya tekrarlar:

```ts
orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
take: limit + 1,                                  // "daha var mı" için
...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
```

`id` her zaman son sıralama anahtarıdır.

## Önemli bağımlılıklar ve sürüm tuzakları

| Paket | Tuzak |
|---|---|
| Prisma 7 | `datasource.url` **schema'da yasak**; bağlantı `prisma.config.ts`'te. `@prisma/client`'ta **postinstall yok** → build'de `prisma generate` şart. Migration'lar **havuzsuz** bağlantı ister (`prisma-url.ts`). |
| Clerk 7 | `SignedIn`/`SignedOut` yok → `<Show when="signed-in">`. `createRouteMatcher` deprecated. Webhook doğrulaması `standardwebhooks` ile (ek paket gerekmez). |
| Base UI (shadcn) | Radix değil. `Button render={<Link/>}` **çalışmaz** — bileşen native `<button>` bekler, aksi halde React ağacı çöker ve sayfa boş kalır. Link için `buttonVariants({...})` sınıfları doğrudan `<Link>` üzerine verilir. `sentry.client.config.ts` Turbopack ile çalışmaz → `instrumentation-client.ts`. |
| Next.js 16 | `middleware.ts` → **`proxy.ts`** (Faz 12.4'te taşındı). Özellik aynı, isim değişti. Proxy **Node.js runtime'ında** çalışır ve `runtime` config seçeneği burada **kullanılamaz** — verilirse Next hata fırlatır. Dosya `app/` ile aynı seviyede olmak zorunda (`src/proxy.ts`). |

## Veritabanları

Üç ayrı Neon veritabanı:

| Değişken | Kullanım |
|---|---|
| `DATABASE_URL` | Yerel geliştirme (Vercel'de production) |
| `E2E_DATABASE_URL` | Playwright — her koşunun başında `TRUNCATE` edilir |
| (Vercel ayarı) | Production |

`e2e/db-cleanup.ts`, `E2E_DATABASE_URL === DATABASE_URL` ise çalışmayı
**reddeder**. Bu iki değer bir kez karıştırılmıştı; kod artık kendisi engelliyor.

Şema değişikliğinde: `npx prisma migrate dev --name <ad>` yeterlidir;
`npm run test:e2e` E2E veritabanına migration'ı kendisi uygular.
