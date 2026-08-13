# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI? Dosyaya hash yazmiyoruz (bir dosya kendi commit'inin hash'ini
iceremez). Bunun yerine git'e soruyoruz - bu dosya son guncellendikten sonra
kod degisti mi:

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma

Cikti bossa dosya guncel. Commit listeliyorsa once repository'nin gercek
durumunu dogrula, sonra bu dosyayi duzelt.
-->

Updated: 2026-08-13

Current task:
  YOK. Faz 14 (acilis oncesi borc kapatma) bitti ve canlida.
  Kullanici yeni gorev vermedi.

Hemen sonraki adim:
  Kullanicinin secmesi bekleniyor.

  DOGRULANACAK (canlida): 14.4'un migration'i
  (20260813120000_add_expense_description_fold) production veritabanina
  vercel-build ile uygulandi mi - Vercel deploy log'undan teyit edilmeli.
  Kolon GENERATED ALWAYS oldugu icin mevcut production kayitlari kendiliginden
  dolar; ayri bir backfill adimi YOK.

  FOTOGRAF EKLEME: kullanici Cloudflare'e gecene kadar ASKIDA. Karar
  verildiginde fotograf VERITABANINA KONMAYACAK - nesne deposu (Vercel Blob
  ya da Cloudflare R2), veritabani yalnizca anahtar/boyut/tip tutar
  (~100 bayt/fotograf). Gerekce ve sayilar konusuldu; bytea'ya koymak
  yedekleri ve baglanti limitini vurur.

Status:
  Calisma agaci temiz, push edilmemis commit yok.
  Faz 14'un tamami canlida (`c5ab3d2`'ye kadar).

  Testler: 493 birim / 32 E2E, tsc + lint temiz, tam E2E kosusu yapildi.

  IZLENECEK - ARALIKLI E2E HATASI: Faz 14 sonrasi ardarda uc tam kosudan
  BIRINDE bir test "toBeVisible" ile dustu; digerlerinde 32/32 gecti.
  Hangi test oldugu belirlenemedi, cunku sonraki kosu test-results'i
  temizliyor. Iki muhtemel sebep var ve ikisi de tahmin:
    1. Neon'a ag gecikmesi (her zaman vardi; expect varsayilani 5 sn)
    2. 14.5 ile sayfa basina paralel sorgu sayisi 2'den 4'e cikti
  Tekrarlarsa: kosuyu dosyaya alip (npm run test:e2e > out.txt) hangi test
  oldugunu bul, sonra ya o iddiayi daha kesin bir sinyale bagla ya da
  timeout'u yalnizca orada yukselt. Suite'in tamamina timeout eklemek
  gercek yavaslamalari gizler.

  MIGRATION VAR: 20260813120000_add_expense_description_fold
  (Expense.descriptionFold, GENERATED ALWAYS). Gelistirme ve E2E
  veritabanlarina UYGULANDI. Push edilince production'a vercel-build ile
  gidecek - Vercel deploy log'undan teyit edilmeli.

  CANLIDA GOZLE BAKILMADI: ozet blogu ve ay basliklari yalnizca E2E'nin
  urettigi 2-3 harcamalik gruplarda gorundu. Gercek bir grupta cok aylik
  grafik ve yedi kategorili kirilim ilk kez orada gorunecek. Kategori
  varsayilani OTHER oldugu icin gecmis harcamalarda kirilim tek cubuk
  "Diger" cikabilir - hata degil ama blogu ise yaramaz gosterir.

CANLIYA ACILMANIN ONUNDEKI ENGEL:
  Uygulama Clerk'in DEVELOPMENT anahtarlariyla calisiyor (Faz 8'den beri
  bilinen sinir). Alan adi isini KULLANICI ustlendi; karar verince
  Squarespace'ten alinip Cloudflare'e verilecek, gecis o zaman konusulacak.

  Alan adi hazir oldugunda kalan adimlar - hepsi PANEL isi, kod degisikligi yok:
    1. Alan adi Vercel'e baglanir
    2. Clerk'te production instance olusturulur
    3. Clerk'in verdigi DNS kayitlari alan adina eklenir
    4. pk_live_ / sk_live_ anahtarlari Vercel env'ine konur
    5. Webhook ucu production instance'ta yeniden tanimlanir
       (/api/webhooks/clerk) ve yeni imza sirri Vercel'e eklenir

  NOT: Clerk formunda gorunen uygulama adi su an "split-app" (Clerk
  panelindeki uygulama adindan geliyor, kodda degil). Isim netlesince orasi
  da guncellenmeli - "Giris yap / split-app ile devam etmek icin" yaziyor.

Blocked by:
  Yok.

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 493
  npm run test:e2e  # beklenen: 32, ~7-8 dk, kosarken dosyalara dokunma

  Prisma 7'de postinstall YOK: sema degistiginde "npx prisma generate"
  calistirilmadan tsc eski tipleri gorur ve var olmayan hatalar uretir.

  E2E notu: beklenenden cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur.

  DUZEN HATALARINI E2E VARSAYILAN OLARAK YAKALAMAZ (metnin varligina bakiyor,
  sayfanin kaydigina degil). Olcum artik ozet testinin icinde:
    document.documentElement.scrollWidth > window.innerWidth
  390 ve 768 px'te olculuyor. Yeni bir duzen eklendiginde ayni olcum oraya da
  konmali.
