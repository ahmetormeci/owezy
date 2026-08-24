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

## Mobil (React Native)

**Clerk kancalarından gelen fonksiyonlar bağımlılık listesine KONMAZ.**
`useAuth()` her render'da **yeni bir** `getToken` döndürüyor. Onu
`useCallback`/`useEffect` bağımlılığına koymak sonsuz döngü üretiyor:
fonksiyon değişir → efekt yeniden çalışır → `setState` yeni render tetikler →
fonksiyon yine değişir. Ekranda `Maximum update depth exceeded` olarak çıkıyor.

Bu tahmin değil; 18.2'de simülatörde bizzat görüldü ve giriş sonrası ekranı
tamamen kilitledi. Çözüm, fonksiyonun kendisini değil **her zaman güncel bir
referansını** tutmak (`useRef` + her render'da güncelleyen bir efekt), böylece
`useCallback`'in kimliği sabit kalıyor. Örnek: `mobile/app/index.tsx`.

**Büyük harfe çevirme JavaScript'te ve dile duyarlı yapılır.** React
Native'in `textTransform: "uppercase"` özelliği dil bilmiyor ve Türkçede
"i" harfini "I" yapıyor — "Senin durumun" → "SENIN" (doğrusu "SENİN"). Web'de
bu sorun yok çünkü CSS `text-transform` `<html lang>` değerine bakıyor;
mobilde o bilgi yok, biz vermek zorundayız: `children.toLocaleUpperCase(locale)`
(`mobile/components/receipt.tsx` içindeki `Cap`). Hermes'in bunu desteklediği
simülatörde doğrulandı — "SENİN DURUMUN", "ÖDEDİĞİN".

**Fişin görsel unsurları için ölçülmüş teknikler** (Faz 18.4, hiçbiri tahmin
değil, tek kullanımlık bir deneme ekranında simülatörde görüldü):

| Unsur | Çalışan | Çalışmayan |
|---|---|---|
| Noktalı ayraç | tekrarlanan `·` + `ellipsizeMode="clip"` | `borderStyle: "dotted"` — **üç ayrı yazımda da**; biri hiç çizilmiyor, ikisi düz çizgiye dönüyor |
| Perfore çizgi | `borderStyle: "dashed"` | — (`dashed` çalışıyor, `dotted` çalışmıyor; ikisi aynı davranmıyor) |
| Yırtık kenar | border üçgen hilesi | — |

`react-native-svg` **gerekmedi**. Kâğıt greni ise yok: web'de SVG filtresi,
React Native'de CSS filtresi olmadığı için karşılığı bir PNG döşemek olurdu ve
%5 opaklıkta bir doku telefonda zaten görünmüyor.

**Saf modüller sınırı geçer, React bileşenleri GEÇMEZ.** Web'in
`src/lib/i18n.tsx`'ini mobilden import etmek `Cannot read property
'useContext' of null` ile düştü: o dosya mobil ağacın dışında olduğu için
oradan `react` çözülünce kökteki kopya bulunuyor — mobilinkinden farklı bir
sürüm (19.2.4 / 19.2.3). İki React kopyası, kanca çağrılarının boş bir
dispatcher'a gitmesi demek.

Bundler'ı tek React'e zorlamak mümkündü ama yapılmadı: o kapı açılsaydı web
bileşenlerini paylaşmanın yolu da açılırdı, oysa onlar `<div>` kullanıyor ve
React Native'de `<div>` yok. Mobil kendi 20 satırlık sağlayıcısını taşıyor
(`mobile/lib/i18n.tsx`); paylaşılan şey değerli olanı — **sözlüğün kendisi**
(`@/lib/messages`, 700+ satır) ve `translate()`.

**Oturum belirteci `expo-secure-store`'da saklanır**, `AsyncStorage`'da
değil — orası düz metin.

**Paylaşılan saf modüller `@/lib/...` ile import edilir.** Takma ad
`mobile/tsconfig.json`'daki `paths` alanından çözülüyor; Metro depo kökünü
`watchFolders` ile izliyor (`mobile/metro.config.js`). Mobil tarafın kendi
kodu göreli yolla import edilir — `@/` yalnızca web ile paylaşılanı gösterir.

## Bağımlılıklar

- Yeni paket eklemeden önce mevcut bağımlılıkların yeterli olup olmadığına
  bak (örn. webhook doğrulaması için ek paket gerekmedi).
- `src/components/ui/*` shadcn tarafından üretilir; **elle düzenlenmez**.
- Next.js/Prisma/Clerk sürümleri eğitim verisinden farklı olabilir —
  yazmadan önce `node_modules` içindeki tip tanımlarını veya dokümanı oku.
  Bu, `AGENTS.md`'de de yazılı bir kuraldır.

## Dokümantasyon güncelleme kuralı

Hafıza hiyerarşisi (kod > doküman > konuşma), `CURRENT_TASK.md`'nin baştan
yazılma kuralı ve "kullanıcının demesini bekleme" [AGENTS.md](../AGENTS.md)'de.
Bayatlık kontrolü komutu `CURRENT_TASK.md`'nin kendi başlık yorumunda.

Burada yalnızca hangi değişikliğin hangi dosyaya dokunduğu var:

| Dosya | Ne zaman |
|---|---|
| [CURRENT_TASK.md](CURRENT_TASK.md) | **Her** iş başlangıcında ve bitişinde |
| [PROGRESS.md](PROGRESS.md) | Faz durumu değişince |
| [DECISIONS.md](DECISIONS.md) | Mimari karar alınınca (yeni ADR) |
| [CHANGELOG.md](CHANGELOG.md) | Kullanıcıya görünen değişiklikte |
| [DATABASE.md](DATABASE.md) | Şema/migration değişince |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Katman/akış değişince |
| [CONVENTIONS.md](CONVENTIONS.md) | Yeni bir kural benimsenince |
