# Kurallar (Conventions)

> Bunlar tercih değil, projede uyulan kurallardır. Gerekçeler için
> [DECISIONS.md](DECISIONS.md).

## Dil

- **Kullanıcıya görünen metinler:** Türkçe, Türkçe karakterlerle ("Giriş yap").
- **Kod yorumları:** Türkçe ama **ASCII** ("Giris kontrolu burada").
- **Tanımlayıcılar (değişken, fonksiyon, tip):** İngilizce (`createExpense`,
  `paidById`).
- **Commit mesajları:** İngilizce, conventional commits (`feat:`, `fix:`,
  `test:`, `build:`, `chore:`).

Yorum yazarken **ne** yaptığını değil **neden** öyle olduğunu yaz. Kodun
kendisi zaten ne yaptığını söylüyor.

## Adlandırma

| Şey | Kural | Örnek |
|---|---|---|
| Dosya | kebab-case | `group-access.ts` |
| Servis fonksiyonu | fiil + nesne | `createExpense`, `listSettlements` |
| Yetki kontrolü | `assert` öneki (hata fırlatır) | `assertActiveMemberOfGroup` |
| Zod şeması | `...Schema` | `expenseBodySchema` |
| Sayfalama sabitleri | `DEFAULT_*_PAGE_SIZE`, `MAX_*_PAGE_SIZE` | |
| Test dosyası | kaynak yanında `.test.ts` | `split.test.ts` |
| E2E dosyası | `e2e/*.spec.ts` | `expenses.spec.ts` |

`.test.ts` ve `.spec.ts` ayrımı **anlamlıdır**: Vitest yalnızca
`src/**/*.test.ts` dosyalarını toplar (`vitest.config.ts`), Playwright ise
`e2e/` altını.

## Route / lib ayrımı

**Route handler'ın işi dörttür:** kimliği çöz, parametreyi al, gövdeyi
doğrula, servisi çağır. İş mantığı, yetki kontrolü ve veritabanı erişimi
route'ta **bulunmaz**.

```ts
// DOĞRU
const expense = await createExpense(user.id, groupId, body);

// YANLIŞ — route doğrudan prisma kullanıyor
const expense = await prisma.expense.create({ ... });
```

`lib/*` asla route handler import etmez. Bağımlılık tek yönlüdür.

## Prisma kullanımı

- Uygulama kodunda tek `PrismaClient` örneği: `src/lib/prisma.ts`. Başka
  yerde `new PrismaClient()` yazılmaz.
- Transaction içinde **her** sorgu `tx` kullanır. Bir tanesi `prisma`
  kullanırsa transaction dışında kalır ve geri alınmaz.
- Yardımcı fonksiyonlar kendi transaction'larını açmaz; `tx`'i parametre
  olarak alır (`createNotifications(tx, ...)`).
- Yetki kontrolü gereken güncellemelerde `updateMany` + `where`'e `userId`
  koymak, `findUnique` + kontrol + `update` üçlüsüne tercih edilir: kontrol
  ile yazma arasında boşluk kalmaz.

## Auth

- Kimlik doğrulama route'ta, **yetkilendirme serviste**.
- Servise her zaman bizim `User.id`'miz geçer, `clerkId` değil.
- Yetki mantığı `src/lib/group-access.ts` içinde tek yerde durur; harcama ve
  ödeme kayıtları aynı fonksiyonu kullanır.
- Arayüzde buton gizlemek yetkilendirme **değildir**, yalnızca kolaylıktır.

## Validation

- Zod şemaları `src/lib/*-schemas.ts` içinde; sunucu ve istemci aynı şemayı
  paylaşır.
- İstemci doğrulaması hızlı geri bildirim içindir; **sunucu her zaman tekrar
  doğrular**.
- `z.coerce.boolean()` **kullanılmaz** — boş olmayan her string `true` olur.
  Bunun yerine: `z.enum(["true","false"]).transform((v) => v === "true")`.
- `currency` hiçbir gövde şemasında yer almaz.

## Para (money handling)

- Tüm tutarlar **kuruş cinsinden `Int`**. `Float` ve `Number` ondalıkları
  paraya dokunmaz.
- Yüzdeler **basis point** (`10000 = %100`), tam sayı.
- Biçimlendirme ve ayrıştırma yalnızca `src/lib/money.ts` üzerinden.
- Bölüşüm sonuçlarının toplamı **her zaman** tutara birebir eşit olmalıdır.
- Kural bildirim payload'ında da geçerlidir: orada da tutar tam sayıdır.

## Error handling

- Servis katmanı `AppError` türevleri fırlatır (`ValidationError`,
  `ForbiddenError`, `NotFoundError`, `ConflictError`); HTTP bilmez.
- Route handler `try/catch` içinde `handleApiError(error)`'a devreder.
- **Yetkisiz erişimde `NotFoundError`** kullanılır — kaynağın varlığı bile
  sızdırılmaz.
- `catch` bloğu yalnızca beklenen hatayı yutar, kalanını yeniden fırlatır:
  ```ts
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    // beklenen: yarışı başkası kazandı
  }
  throw error;
  ```

## Soft delete

- Finansal kayıtlar **fiziksel olarak silinmez**. Silme = `deletedAt` /
  `cancelledAt` işaretlemek.
- Tüm foreign key'ler `onDelete: Restrict`.
- Listeleme sorguları varsayılan olarak silinmişleri **hariç tutar**;
  `includeDeleted` / `includeCancelled` ile istenirse gösterilir.
- Harcama silmede `ExpenseParticipant` satırlarına **dokunulmaz** — paylar
  korunur ve toplam trigger'ı bozulmaz.
- Her silme/geri yükleme `ExpenseEdit` kaydı üretir (aynı transaction'da).

## Test yaklaşımı

**Birim testler (Vitest)** — servis ve saf mantık. Prisma `vi.hoisted` +
`vi.mock` ile taklit edilir; gerçek veritabanına dokunulmaz.

**Route testleri** — servis mock'lanır; test edilen şey durum kodu, yetki
kontrolünün varlığı ve doğrulama davranışıdır.

**E2E (Playwright)** — gerçek tarayıcı, gerçek veritabanı (ayrı Neon),
3 gerçek Clerk kullanıcısı.

Kurallar:

- **Assertion, doğru şeyi ölçtüğünü kanıtlamalı.** `toBeHidden()` öğe hiç
  yoksa da geçer; önce göründüğünü doğrula.
- **E2E'de gerçek olayı bekle**, gevşek metin eşleşmesini değil. Sayfa
  geçişini `waitForURL` ile bekle: beklemeden devam etmek, uçuştaki isteği
  iptal eder.
- **Paylaşılan veritabanında iddia, teste ait veriye çıpalanır.** "Menüde
  şu metin var mı" değil, "bu satırda şu var mı".
- **Hata tipine bak, mesaja değil** (`NotFoundError` gibi). Mesaj metni
  değişince test kırılmasın.
- E2E koşusu sürerken proje dosyalarına dokunma.

## Bağımlılıklar

- Yeni paket eklemeden önce mevcut bağımlılıkların yeterli olup olmadığına
  bak (örn. webhook doğrulaması için ek paket gerekmedi).
- `src/components/ui/*` shadcn tarafından üretilir; **elle düzenlenmez**.
- Next.js/Prisma/Clerk sürümleri eğitim verisinden farklı olabilir —
  yazmadan önce `node_modules` içindeki tip tanımlarını veya dokümanı oku.
  Bu, `AGENTS.md`'de de yazılı bir kuraldır.

## Dokümantasyon güncelleme kuralı

Her önemli feature/bug/faz tamamlandığında, **commit ile aynı turda**:

**Hafıza hiyerarşisi** — çelişki halinde aşağıdaki her satır bir üsttekini
geçersiz kılar:

```
Konuşma geçmişi   →  yardımcı, kaybolabilir
docs/*.md         →  asıl hafıza
Repository + git  →  GERÇEK DURUM
```

Bir doküman kodla çelişiyorsa **kod doğrudur**: önce repoyu doğrula, sonra
dokümanı düzelt. Dokümanda yazan durumu varsayımla değiştirme.

`CURRENT_TASK.md` **geçmişi anlatmaz.** Sabit, kısa bir operasyonel durum
dosyasıdır (`Current task` / `Status` / `Completed in this task` /
`Next action` / `Blocked by`). Yeni görev başlarken **baştan yazılır**,
alta eklenmez; biten işin ayrıntısı CHANGELOG.md ve PROGRESS.md'ye taşınır.
Başındaki `Reflects:` satırı dosyanın yazıldığı commit'tir — `git log
--oneline -1` ile tutmuyorsa dosya bayat olabilir, önce repoyu doğrula.

| Dosya | Ne zaman |
|---|---|
| [CURRENT_TASK.md](CURRENT_TASK.md) | **Her** iş başlangıcında ve bitişinde |
| [PROGRESS.md](PROGRESS.md) | Faz durumu değişince |
| [DECISIONS.md](DECISIONS.md) | Mimari karar alınınca (yeni ADR) |
| [CHANGELOG.md](CHANGELOG.md) | Kullanıcıya görünen değişiklikte |
| [DATABASE.md](DATABASE.md) | Şema/migration değişince |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Katman/akış değişince |
| [CONVENTIONS.md](CONVENTIONS.md) | Yeni bir kural benimsenince |

Kullanıcının "dokümanı güncelle" demesi beklenmez.
