# Veritabanı

> Kaynak: `prisma/schema.prisma` + `prisma/migrations/`. Bu dosya onların
> özetidir; çelişki halinde **şema ve migration'lar doğrudur**.

PostgreSQL (Neon). 9 model, 5 enum, 3 migration.

## Enum'lar

| Enum | Değerler |
|---|---|
| `GroupRole` | OWNER, MEMBER |
| `SplitType` | EQUAL, EXACT, PERCENTAGE |
| `ExpenseCategory` | FOOD, TRANSPORT, ACCOMMODATION, SHOPPING, BILLS, ENTERTAINMENT, OTHER |
| `ExpenseEditAction` | UPDATE, DELETE, RESTORE |
| `NotificationType` | EXPENSE_ADDED, EXPENSE_UPDATED, EXPENSE_DELETED, SETTLEMENT_RECORDED, SETTLEMENT_CANCELLED, MEMBER_JOINED |

## Modeller

### User
Clerk kimliğinin bizim tarafımızdaki karşılığı. `clerkId` UNIQUE, `email`
indexli (UNIQUE **değil** — hesap silmede anonimleştirme çakışma yaratmasın).

`deletedAt` — hesap kapatma (anonimleştirme) işareti.
`clerkUpdatedAt` — Clerk'teki kaydın son güncellenme zamanı; sırasız gelen
webhook olaylarında eski veriyle üzerine yazmayı engeller. Bizim `updatedAt`
alanımızdan farklıdır (o bizim satırımızın zamanı).

`locale` — arayüz dili tercihi (`"tr"` / `"en"`). **Nullable ve
varsayılansız**, bilerek: `@default("tr")` mevcut her kullanıcının Türkçe
*seçtiğini* iddia ederdi, oysa hiçbiri seçmedi. `null` = "tercih belirtmedi"
ve okuma sırası bunu doğal karşılıyor: çerez → hesap → varsayılan (ADR-019).

`hasImage` — kullanıcı Clerk'e **gerçekten** bir fotoğraf yükledi mi?
Nullable ve bilerek `avatarUrl`'den ayrı: Clerk, fotoğraf yüklememiş
kullanıcıya da bir `image_url` veriyor (kendi ürettiği baş-harf görseli).
`avatarUrl`'in varlığına bakıp fotoğraf basmak, fotoğrafı olanları gerçek
yüzle, olmayanları **Clerk'in tasarımıyla** gösterirdi — aynı listede iki
ayrı görsel sistem. `null` = "bilmiyorum" (bu alanı taşımayan eski bir
webhook olayı); arayüzde `false` gibi davranıyor. Hesap silinince
`avatarUrl` ile birlikte `null`'a çekiliyor.

`locale` kolonu `String`, enum değil — dil listesi büyüdüğünde migration
gerektirmesin.
Doğrulama uygulamada: `normalizeLocale()` beyaz liste uyguluyor ve **hem
çerezden hem veritabanından** gelen değeri aynı kapıdan geçiriyor. Ham değer
`Intl`'e ulaşırsa `RangeError` fırlatır ve sunucuda render edilen sayfa 500
verir.

### Group
Tek para birimi taşır (`@db.Char(3)`). Oluşturulduktan sonra
**değiştirilemez** — mevcut harcama ve ödeme kayıtlarıyla tutarlılık için.

### GroupMember
`leftAt` ile geçmiş üyelikler korunur. Aynı kişi ayrılıp tekrar katılabilir;
bu durumda **birden fazla satır** oluşur ve bu istenen davranıştır.

### Expense / ExpenseParticipant
`amount` ve `shareAmount` **kuruş cinsinden `Int`**. `expenseDate` `@db.Date`
(saat bilgisi taşımaz). `ExpenseParticipant` üzerinde `@@unique([expenseId, userId])`.

`Expense.descriptionFold` aramada karşılaştırılan katlanmış biçim ("Işık" →
"isik"). **`GENERATED ALWAYS ... STORED`** — değeri Postgres üretir, uygulama
hiçbir zaman yazmaz. Bu yüzden Prisma şemasında **nullable**: zorunlu olsaydı
Prisma `create`'te değer isterdi ve üretilmiş kolona yazmak hata verirdi.
Katlama tablosu `src/lib/search-fold.ts` ile birebir aynı olmak zorunda
(ADR-024).

`ExpenseParticipant.basisPoints` (nullable `Int`, 10000 = %100) kullanıcının
**girdiği** yüzdeyi tutar; `shareAmount` onun sonucudur ve yuvarlama yüzünden
sonuçtan girdiye her zaman geri dönülemez. Yalnızca `PERCENTAGE` bölüşümde
dolu; `EQUAL`/`EXACT`'ta ve kolondan önceki kayıtlarda `null` (ADR-022).

`Expense` üç ayrı `User` ilişkisi taşır: `paidById`, `createdById`, `deletedById`.

### Settlement
"X kişisi Y kişisine Z tutar ödedi" kaydı. **Gerçek para transferi değildir**;
sistem para taşımaz, yalnızca bakiye hesabından düşer. Dört ayrı `User`
ilişkisi: `fromUserId`, `toUserId`, `createdById`, `cancelledById`.

### ExpenseEdit
**Değiştirilemez audit log.** Satırlar yalnızca INSERT edilir; hiçbir zaman
UPDATE/DELETE edilmez.

| action | previousData | newData |
|---|---|---|
| UPDATE | dolu | dolu |
| DELETE | dolu | boş |
| RESTORE | dolu (silinmiş hal) | dolu (geri yüklenen hal) |

### GroupInvite
`tokenHash` — ham token'ın SHA-256 hash'i. **Ham token veritabanında asla
saklanmaz**, kullanıcıya bir kez gösterilir. `maxUses` / `useCount` / `expiresAt`
/ `revokedAt` ile ömrü sınırlanır.

### Notification
`payload` JsonB — anlık görüntü (grup adı, işlemi yapanın adı, tutar).
Tutar burada da **kuruş cinsinden tam sayıdır**.

## İlişkiler ve silme davranışı

**Tüm foreign key'ler `onDelete: Restrict`.** Hiçbir kayıt, kendisine bağlı
kayıtlar varken silinemez. Bu bilinçlidir: finansal geçmiş cascade ile
silinememelidir. Silme işlemleri her yerde soft delete olarak yapılır.

## Veritabanı seviyesinde garanti edilen kurallar

`prisma/migrations/20260722161707_init/migration.sql` içindeki elle yazılmış
blok (otomatik üretilmedi):

| # | Kural | Nasıl |
|---|---|---|
| 1 | Bir kullanıcının bir grupta aynı anda tek aktif üyeliği olur | `CREATE UNIQUE INDEX ... WHERE "leftAt" IS NULL` (partial unique index) |
| 2 | `Expense.amount > 0` | CHECK |
| 3 | `ExpenseParticipant.shareAmount >= 0` | CHECK (sıfır olabilir) |
| 4 | `Settlement.amount > 0` | CHECK |
| 5 | `Settlement.fromUserId <> toUserId` | CHECK |
| 6 | `GroupInvite.useCount <= maxUses` | CHECK |
| 7 | `Expense.currency == Group.currency` | BEFORE INSERT/UPDATE trigger |
| 7 | `Settlement.currency == Group.currency` | BEFORE INSERT/UPDATE trigger |
| 8 | `SUM(ExpenseParticipant.shareAmount) == Expense.amount` | **DEFERRABLE INITIALLY DEFERRED** constraint trigger |

Sonradan eklenen kısıtlar (kendi migration'larında):

| # | Kural | Nasıl |
|---|---|---|
| 9 | `ExpenseParticipant.basisPoints` NULL ya da 0–10000 arası | CHECK (`20260812214219`) |
| 10 | `Expense.descriptionFold` her zaman açıklamanın katlanmış hâli | `GENERATED ALWAYS ... STORED` (`20260813120000`) |

9 numaralı kuralın "toplam 10000 olmalı" tarafı burada **yok**: o, çoklu satır
toplamı gerektirir ve 8 numaralı kuralla aynı sebepten CHECK'e yazılamaz.
Uygulama katmanında `splitByPercentage` garanti ediyor.

### 8 numaralı kural neden ertelenmiş (deferred)

Bir harcamanın 3 payı tek tek INSERT edilir. Kontrol her satırda çalışsaydı
ilk pay eklendiği anda "toplam tutmuyor" diye patlardı. `DEFERRABLE INITIALLY
DEFERRED` sayesinde kontrol **COMMIT anında** yapılır.

Trigger `AFTER INSERT OR UPDATE OR DELETE ON "ExpenseParticipant"` üzerindedir
— yani `Expense.amount` tek başına değiştirilirse **tetiklenmez**. Uygulama
katmanı bu yüzden güncellemede payları her zaman baştan yazar
(bkz. [ARCHITECTURE.md](ARCHITECTURE.md#transaction-yaklaşımı)).

Trigger `DELETE`'te de çalıştığı için tabloları tek tek `deleteMany` ile
boşaltmak hata verir; E2E temizliği bu yüzden `TRUNCATE ... CASCADE` kullanır
(satır trigger'larını çalıştırmaz).

## Uygulama seviyesinde garanti edilen kurallar

Veritabanı bunları zorlamaz; ihlal edilirse veri sessizce bozulur:

| Kural | Nerede |
|---|---|
| Bölüşüm sonuçlarının toplamı = tutar (yazmadan önce) | `src/lib/split.ts` |
| Yüzdelerin toplamı tam olarak %100 (10000 bp) | `src/lib/split.ts` |
| Kaydı yalnızca oluşturan değiştirebilir; OWNER yalnızca oluşturan ayrıldıysa | `src/lib/group-access.ts` |
| Ödeme kaydını yalnızca tarafları girebilir | `src/lib/settlements.ts` |
| Harcama katılımcıları grubun **aktif** üyesi olmalı | `src/lib/expenses.ts` |
| Ödeme tarafları üye olmalı (aktif olmak zorunda değil — borç kapatılabilmeli) | `src/lib/settlements.ts` |
| Gruptan ayrılmadan önce bakiye kapatılmalı | `src/lib/groups.ts` |
| Her grupta her zaman bir OWNER bulunur | `src/lib/groups.ts`, `src/lib/clerk-sync.ts` |
| Son aktif üye ayrılınca grup arşivlenir | `src/lib/groups.ts`, `src/lib/clerk-sync.ts` |
| `currency` istemciden alınmaz, gruptan türetilir | `src/lib/expenses.ts`, `src/lib/settlements.ts` |
| Bildirim yalnızca kendi sahibi tarafından okundu işaretlenebilir | `src/lib/notifications.ts` |

## Migration'lar

| Migration | İçerik |
|---|---|
| `20260722161707_init` | 9 tablo, 5 enum, tüm index'ler + elle yazılmış kısıt/trigger bloğu |
| `20260811074141_add_user_clerk_updated_at` | `User.clerkUpdatedAt` (nullable) |
| `20260811120730_notification_types` | `NotificationType` 6 değere çıktı, `Notification(userId, createdAt)` index'i |
| `20260812085643_add_user_locale` | `User.locale` (nullable, varsayılansız). Tek satır: `ALTER TABLE "User" ADD COLUMN "locale" TEXT;` — tablo yeniden yazılmıyor |
| `20260812170020_add_user_has_image` | `User.hasImage` (nullable boolean). Kullanıcının gerçekten fotoğraf yükleyip yüklemediği; gerekçesi yukarıda |

Migration'lar **havuzsuz (direct) bağlantı** üzerinden uygulanır — bkz.
[DECISIONS.md](DECISIONS.md) ADR-012.

## Yapılmamış işler (DB tarafı)

- [ ] **`Notification` için saklama/temizleme politikası yok.** Kayıtlar
      sonsuza kadar birikir. Eski okunmuşları silen bir mekanizma
      tasarlanmadı.
- [ ] **Optimistic locking yok.** `Expense`/`Settlement` üzerinde `version`
      alanı bulunmuyor; aynı kullanıcının iki cihazdan eş zamanlı düzenlemesi
      son yazana göre sonuçlanır. Mobil aşamasına bilinçli olarak ertelendi
      (bkz. ADR-010).
- [ ] **Hesap silmede bildirimler temizlenmiyor.** `Notification` satırları
      anonimleştirilmiş kullanıcıya bağlı kalır.
- [ ] **`schema.prisma` başındaki yorum bloğu güncel değil**: "bu dosya henüz
      migration'a dönüştürülmedi" diyor; oysa 3 migration uygulanmış durumda.
      Yalnızca yorum, davranışa etkisi yok.
