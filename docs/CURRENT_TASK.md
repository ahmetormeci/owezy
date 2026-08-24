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

Updated: 2026-08-24 (3)

Current task:
  YOK. Faz 16 (fis tasarimi) bes asamasiyla bitti ve dogrulandi.
  Kullanici yeni gorev vermedi.

Hemen sonraki adim:
  Kullanicinin secmesi bekleniyor.

  ACIK URUN RISKI - BUYUDU: satir ici giris her zaman OTHER kategorisi
  kullaniyor. "Kategori varsayilani OTHER, kirilim tek cubuk Diger cikiyor"
  riski Faz 13'ten beri yaziliydi; hizli giris bunu artik daha da besliyor.
  Cozum muhtemelen kirilimin kendisinde, hizli girise kategori secimi
  koymakta degil - satiri sisirir.

  FIS TASARIMI CANLIDA GOZLE BAKILMADI: butun dogrulama E2E'nin urettigi
  gruplarda ve ekran goruntusuyle yapildi. Gercek bir grupta cok aylik
  katlama ve uzun aciklamalarin noktali ayracla nasil durdugu ilk kez orada
  gorunecek.

  FOTOGRAF EKLEME: Cloudflare'e gecildi, karar artik verilebilir. Karar
  verildiginde fotograf VERITABANINA KONMAYACAK - nesne deposu (Vercel Blob
  ya da Cloudflare R2), veritabani yalnizca anahtar/boyut/tip tutar
  (~100 bayt/fotograf). Gerekce ve sayilar konusuldu; bytea'ya koymak
  yedekleri ve baglanti limitini vurur.

Status:
  COMMIT EDILMEMIS DEGISIKLIK VAR (Faz 15). Kod: messages.ts (ui.app_name
  TR + EN -> "Owezy"), brand-mark.tsx (yorumlar). Dokuman: AGENTS.md,
  PROJECT.md, PROGRESS.md, DECISIONS.md (ADR-026), CHANGELOG.md ve bu dosya.
  Kod dosyasi icerdigi icin bu bir KOD commit'i - push kullaniciya sorulur.

  Faz 15 canlida: https://owezy.net, Clerk production (pk_live_),
  GitHub + Google kendi OAuth uygulamalarimizla, webhook 200 donuyor.

  Testler: 498 birim / 35 E2E. Faz 16 sonrasi hepsi kosuldu ve temiz:
  498 birim, tsc, lint ve TAM E2E KOSUSU - 35/35, 6,5 dakika.

  TAM KOSU SART - OLCULDU: 16.3'te hedefli kosular temiz gorunurken tam kosu
  19 test dusurdu. Sebep satir ici girisin erisilebilir adlarinin (Aciklama /
  Tutar) sayfadaki mevcut adlarla cakismasiydi. Dar kapsamli kosu bunu
  gostermiyor cunku cakisma baska spec dosyalarindaki akislarda ortaya
  cikiyor.

  ORTAM - YENI MAKINE (23 Agustos 2026): proje Windows'tan macOS'a tasindi,
  repo sifirdan klonlandi. Kurulum TAMAM ve dogrulandi: Node 24 (nvm ile),
  "npm ci", "npx prisma generate", .env.local dolduruldu (kullanici),
  Playwright chromium kuruldu, .claude/settings.json elle yeniden
  olusturuldu (.env.local + package-lock.json yazma korumasi; klasor
  gitignore'da oldugu icin klonla gelmiyor).

  NPM SURUM FARKI - BILINMESI GEREKEN: npm 11.17 paketlerin kurulum
  betiklerini varsayilan olarak CALISTIRMIYOR; 7 paket beklemede
  (@prisma/engines, sharp, @sentry/cli, fsevents, unrs-resolver, prisma).
  Sonuca bakildi: prisma client yine uretildi, 493 birim ve 32 E2E gecti,
  yani bugun bir sey kirmiyor. Tek beklenen etki: fsevents kurulmadigi icin
  dev sunucusunda dosya izleme macOS'un yerel API'si yerine yoklamaya
  dusebilir. Gerekirse: "npm approve-scripts --allow-scripts-pending".

  IZLENECEK - ARALIKLI E2E HATASI (macOS'ta bes tam kosu temiz gecti, yani
  tekrarlamadi): Faz 14 sonrasi ardarda uc tam kosudan
  BIRINDE bir test "toBeVisible" ile dustu; digerlerinde 32/32 gecti.
  Hangi test oldugu belirlenemedi, cunku sonraki kosu test-results'i
  temizliyor. Iki muhtemel sebep var ve ikisi de tahmin:
    1. Neon'a ag gecikmesi (her zaman vardi; expect varsayilani 5 sn)
    2. 14.5 ile sayfa basina paralel sorgu sayisi 2'den 4'e cikti
  Tekrarlarsa: kosuyu dosyaya alip (npm run test:e2e > out.txt) hangi test
  oldugunu bul, sonra ya o iddiayi daha kesin bir sinyale bagla ya da
  timeout'u yalnizca orada yukselt. Suite'in tamamina timeout eklemek
  gercek yavaslamalari gizler.

  MIGRATION DURUMU: 20260813120000_add_expense_description_fold
  (Expense.descriptionFold, GENERATED ALWAYS) gelistirme ve E2E
  veritabanlarina uygulandi. Production'a da uygulanmis OLMALI: vercel-build
  her deploy'da "prisma migrate deploy" kosuyor ve Faz 15'te birden fazla
  deploy basariyla gecti. Bu bir CIKARIM, gozle dogrulama degil; kesin teyit
  Vercel deploy log'undaki migrate ciktisinda.

  CANLIDA GOZLE BAKILMADI: ozet blogu ve ay basliklari yalnizca E2E'nin
  urettigi 2-3 harcamalik gruplarda gorundu. Gercek bir grupta cok aylik
  grafik ve yedi kategorili kirilim ilk kez orada gorunecek. Kategori
  varsayilani OTHER oldugu icin gecmis harcamalarda kirilim tek cubuk
  "Diger" cikabilir - hata degil ama blogu ise yaramaz gosterir.

CANLI DURUM (Faz 15 sonrasi):
  Adres      : https://owezy.net (apex birincil, www 307 ile yonleniyor)
  DNS        : Cloudflare, Vercel ve Clerk kayitlari PROXY KAPALI (ADR-026)
  Kimlik     : Clerk production instance, pk_live_ -> clerk.owezy.net
  Sosyal     : GitHub + Google, kendi OAuth uygulamalarimizla
  Webhook    : https://owezy.net/api/webhooks/clerk, test olayi 200 dondu

  PRODUCTION VERITABANI SIFIRLANDI (24 Agustos 2026): butun veri tablolari
  TRUNCATE ile bosaltildi ve Clerk production kullanicilari silindi.
  Icerideki her kayit kullanicinin ve arkadaslarinin test verisiydi; uygulama
  hic gercek kullaniciya acilmamisti. _prisma_migrations'a DOKUNULMADI.
  BU BIR KURAL DEGISIKLIGI DEGIL: "finansal kayitlar fiziksel olarak
  silinmez" uygulamanin CALISMA ANINDAKI davranisini baglar (soft delete +
  ExpenseEdit audit log). Acilis oncesi tek seferlik temizlik ayri bir sey ve
  emsal degildir.

  DEVELOPMENT INSTANCE SILINMEYECEK: E2E testleri onun +clerk_test
  kullanicilarina ve sabit 424242 koduna bagli. Yerel .env.local pk_test_
  ile kaliyor; yalnizca Vercel'in Production kapsami pk_live_ kullaniyor.

  NOT: Clerk panelindeki uygulama adi "owezy" (kucuk harf). Arayuzdeki
  ui.app_name "Owezy". Giris formundaki yazi Clerk'ten geldigi icin
  ikisi ayrisik - Clerk panelinden duzeltilmesi bekleniyor.

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
