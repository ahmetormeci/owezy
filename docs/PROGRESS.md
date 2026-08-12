# İlerleme Durumu

> Bu dosya **faz durumunun tek kaynağıdır**. Şu an ne yapıldığı için
> [CURRENT_TASK.md](CURRENT_TASK.md).
>
> **Numaralandırma notu:** Fazlar, işlerin **fiilen tamamlanma sırasına** göre
> numaralandırılmıştır (git geçmişinden doğrulanabilir). İlk plandaki
> numaralarla birebir örtüşmeyebilir — bu eşleşme doğrulanamadığı için
> numaralar burada yalnızca sıra belirtir.

**Özet:** 10 faz tamamlandı, Faz 11 devam ediyor. Uygulama canlıda ve
`main`'e giden her değişiklik CI'dan geçiyor.

| Test | Sayı | Son durum |
|---|---|---|
| Birim (Vitest) | 370 | ✅ tümü geçiyor |
| E2E (Playwright) | 24 | ✅ tümü geçiyor |
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

## Faz 11 — Tasarım yenilemesi + iki dil · **IN_PROGRESS**

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
| 11.4c | TODO | Dil çerezden okunur, `formatMoney`'e geçirilir, dil düğmesi |
| 11.4d | TODO | İngilizce sözlük + `User.locale` migration |
| 11.5 | TODO | Grup sayfası hiyerarşisi |
| 11.6 | TODO | Karşılama, formlar, boş durumlar, mobil |

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

**Test:** 370 birim / 24 E2E.
**Commit:** `a125fc3` (11.2), `eb861af` (11.3), `18abd81` (11.4a),
`9b01802` (11.4b) — dördü de push edildi.

**Sıra neden böyle:** Para biçimlendirmesi (11.3) çeviriden (11.4) önce
geliyor — yanlış okunan bir tutar, yanlış çevrilmiş bir etiketten pahalıdır.

---

## Faz dışı düzeltmeler

| İş | Commit |
|---|---|
| Playwright E2E altyapısı + bulduğu iki gerçek hata (kullanıcı oluşturmada yarış durumu, silinen harcamanın ekranda kalması) | `0248d4d` |
| Arayüz metinlerinin Türkçe karakterlerle yazılması | `e5e69dd` |
| Migration'ların havuzsuz bağlantıya alınması (PgBouncer'da asılı kalan advisory lock) | `1f68d5c` |
| GitHub Actions CI: `main`'e giden her değişiklikte tip kontrolü, lint ve birim testleri (E2E hariç, gerekçesi ADR-018) | `09d0e91` |

---

## Sıradaki adaylar (henüz karar verilmedi)

Aşağıdakiler **planlanmış iş değildir**; kullanıcı hangisinin yapılacağına
karar vermemiştir.

| Aday | Neden önemli |
|---|---|
| **Alan adı + Clerk production instance** | Gerçek kullanıcılara açmanın önündeki tek engel |
| **`middleware.ts` → `proxy.ts`** | Next.js 16 deprecation'ı; tek dosyalık iş |
| **Bildirim saklama politikası** | Kayıtlar sonsuza kadar birikiyor |

## Bilinen teknik borç

- `createGroup` ve `acceptGroupInvite` için birim testi yok (E2E dolaylı kapsıyor)
- PERCENTAGE düzenleme formunda yüzdeler boş başlıyor (yüzdeler saklanmıyor,
  paylardan geri hesaplanmıyor)
- Optimistic locking yok (ADR-010, mobil aşamasına ertelendi)
- `schema.prisma` başındaki yorum bloğu güncel değil
- **Üç yazım hatası** (`e5e69dd`'deki Türkçe karakter dönüşümünden kalmış):
  "kisiden" → kişiden, "cikarilsin" → çıkarılsın, "kullanildi" → kullanıldı.
  `messages.ts` içinde `DIKKAT` yorumuyla işaretli. 11.4b çıktıyı bilerek
  değiştirmediği için düzeltilmedi; tek satırlık ayrı bir iş.
- Vitest'te iki zararsız uyarı (CJS config yükleme, `vite-tsconfig-paths`
  artık Vite'a gömülü) — kullanıcı bunlara dokunulmamasını istedi
- **`npm audit`: 10 açık (1 orta, 9 yüksek).** Temiz bir `npm ci` sırasında
  görüldü. Henüz incelenmedi; kullanıcı bilerek erteledi. Hangi paketten
  geldiği ve gerçekten çalışma zamanına ulaşıp ulaşmadığı belirsiz —
  `npm audit fix --force` çalıştırmadan önce bakılmalı, çünkü `--force`
  büyük sürüm atlayabilir.
- `.claude/settings.json` (`.env.local` ve `package-lock.json` yazma koruması)
  **git'te değil** — `.claude/` gitignore'da. Yeni bir klonda bu koruma
  bulunmaz; elle yeniden oluşturulması gerekir.
