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

Updated: 2026-08-24 (9)

Current task:
  FAZ 18 - MOBIL UYGULAMA. 18.0, 18.1 ve 18.2 bitti. Onceligi iOS
  (ADR-030); Android bilerek ertelendi.

Hemen sonraki adim:
  18.3 - Grup listesi ekrani (ilk dikey dilim). GET /api/v1/groups zaten var.

  ONCE SUNLAR YAPILMALI - 18.2 DOGRULANMASI YARIM KALDI:
    1. iOS Simulator RUNTIME'i kurulu degil. Xcode 26.6 kuruldu ama
       "xcrun simctl list runtimes" BOS. Gereken:
         xcodebuild -downloadPlatform iOS      (birkac GB, uzun surer)
       Gerekirse once: sudo xcodebuild -runFirstLaunch
    2. mobile/.env.local YOK. Kullanici dolduracak - ornegi
       mobile/.env.local.example. Iki degisken:
         EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY  (kok .env.local'daki pk_test_ ile AYNI)
         EXPO_PUBLIC_API_BASE_URL           (http://localhost:3000)
    3. Yerel dev sunucusu ayakta olmali (npm run dev). Mobil pk_test_
       kullaniyor, dolayisiyla CANLIYI DEGIL yereli cagirmali - canli
       pk_live_ bekliyor ve test orneginin Bearer'ina 401 doner.

  18.2 NE KURULDU:
    Expo SDK 57 + expo-router + @clerk/clerk-expo 2.20 + expo-secure-store.
    mobile/app/_layout.tsx  ClerkProvider + tokenCache
    mobile/app/sign-in.tsx  e-posta + dogrulama kodu (kendi ekranimiz)
    mobile/app/index.tsx    /api/v1/me cagrisi + money.ts olcumu
    mobile/lib/token-cache.ts  expo-secure-store (Keychain), AsyncStorage DEGIL
    mobile/lib/api.ts       Bearer'li fetch sarmalayicisi
    Bundle ID / paket adi: net.owezy.app (KALICI)

  GIRIS NEDEN E-POSTA KODU: Clerk'in Expo tarafinda web'deki <SignIn />
  dengi YOK, ekrani kendimiz yaziyoruz. E-posta kodu hicbir yonlendirme
  yapilandirmasi istemiyor ve development orneginin +clerk_test
  kullanicilari ile sabit 424242 kodu burada da calisiyor. Google/GitHub
  (useSSO) sonraki bir is.

  ADR-029'UN DAYANAGI OLCULDU: src/lib/money.ts mobil ekranda import
  ediliyor ve iOS paketinin ICINDE dogrulandi (expo export --no-bytecode
  ciktisinda formatBasisPoints, DEFAULT_LOCALE ve \u20ba var). Metro depo
  kokunu izliyor (watchFolders) ve "@/" takma adini tsconfig'ten cozuyor.

  AMA CALISMA ANI HENUZ GORULMEDI: formatMoney, Intl.NumberFormat
  kullaniyor. Hermes'in Intl davranisi calisan uygulamada denenmedi.
  Paket dogru, cikti gozle gorulmedi. 18.3'te ilk is bu.

  KOK DOGRULAMAYI KIRMAMAK ICIN YAPILANLAR (mobile/ acilinca kirilirdi):
    tsconfig.json      exclude'a "mobile" eklendi
    eslint.config.mjs  globalIgnores'a "mobile/**" eklendi
    .gitignore         mobile/.env.local.example istisnasi (.env* onu
                       yakaliyordu; o dosya SIR ICERMIYOR ve commit edilmeli)
  mobile/ kendi .gitignore'u, kendi tsconfig'i ve kendi node_modules'u ile
  duruyor - kok kurallar tekrarlanmadi.

  BILINEN BOSLUK: CI mobil tarafi dogrulamiyor (kok CI "npm ci" + tsc + lint
  kosuyor, mobile/ bagimliliklarini kurmuyor). Tek ekranli bir uygulama icin
  CI'a ikinci kurulum adimi eklemek erken - ekran sayisi artinca donulecek.

  ARDINDAN (sirasiyla):
    18.4  Fis ekrani
    18.5  Satir ici harcama girisi

  18.4 ICIN BILINEN ZORLUK: React Native'de CSS yok. Fisin noktali ayraci
  (border-bottom: 1px dotted), perfore cizgisi ve yirtik kenari web'deki
  tekniklerle kurulamaz - baska turlu cozulmeleri gerekecek. 18.2'de
  BILEREK tasarim yapilmadi: ekranlar sade, cunku 18.2'nin sorusu
  "guzel mi" degil "oturum ve API calisiyor mu"ydu.

  YAYIN DURUMU (ayrinti: PROJECT.md "Yayinlama", kararlar: ADR-030/031):
    - Apple Developer Program basvurusu ONAY BEKLIYOR.
    - Xcode 26.6 kuruldu (24 Agustos). Simulator runtime'i HENUZ YOK.
    - Android BILEREK ERTELENDI.
    - HESAP SILME KARARA BAGLANDI (ADR-031), HENUZ UYGULANMADI:
        DELETE /api/v1/me yazilacak. Isin zor kismi ZATEN YAZILI:
        markUserDeletedFromClerk (src/lib/clerk-sync.ts).
        SIRALAMA DUZELTMESI: Clerk panelindeki "kullanicilar hesabini
        silebilir" anahtari SU AN ACIK ve silme uctan uca calisiyor.
        ADR-031 "kapali tutulacak" derken SON DURUMU tarif ediyor.
        Anahtar, DELETE /api/v1/me yayina girene kadar ACIK KALMALI -
        simdi kapatmak calisan tek silme yolunu kaldirirdi.
    - SIGN IN WITH APPLE: EKLENMEYECEK (simdilik). Clerk'te e-posta ile
      giris ACIK oldugu dogrulandi, yani Guideline 4.8'in istedigi
      alternatif mevcut. Risk sifir degil - 4.8'in metni alternatifin
      "e-postayi gizli tutmaya izin vermesi"ni de istiyor ve duz e-posta
      kaydi bunu sunmuyor - ama reddedilirsek bedeli bir tur, oysa simdi
      eklersek CIFT HESAP riskini her kullanici icin ustlenirdik:
      Hide My Email xxxx@privaterelay.appleid.com veriyor, Google ile
      kaydolmus biri Apple ile girince eslesme olmuyor, Clerk ikinci
      hesap aciyor ve ayni insan grupta iki kez gorunuyor.
    - owezy.net'te gizlilik politikasi ve destek sayfasi HALA YOK.

  ACIK KALANLAR (yeni gorev degil, akilda tutulacaklar):

  KATEGORI TAHMIN LISTESI CANLI VERIYLE SINANMADI: anahtarlar elle secildi
  ve yalnizca birim testleriyle dogrulandi. Isabetsiz cikarsa cozum listeyi
  buyutmek olmayabilir - yaygin kelimelerle cakisan anahtar, olmayan
  anahtardan kotudur.

  FIS TASARIMI CANLIDA GOZLE BAKILMADI: butun dogrulama E2E'nin urettigi
  gruplarda ve ekran goruntusuyle yapildi.

  FOTOGRAF EKLEME: karar verilebilir durumda. Fotograf VERITABANINA
  KONMAYACAK - nesne deposu (Vercel Blob ya da Cloudflare R2), veritabani
  yalnizca anahtar/boyut/tip tutar.

Status:
  COMMIT EDILMEMIS DEGISIKLIK VAR (Faz 18.2 + dokumanlar). Kod commit'i
  oldugu icin PUSH AYRICA SORULACAK.

  Faz 18.1 canlida (b6643ca).

  CANLIDA: Faz 15, 16 ve 17 ile bagimlilik bakiminin tamami.
  https://owezy.net - Clerk production (pk_live_), GitHub + Google kendi
  OAuth uygulamalarimizla, webhook 200 donuyor, Next 16.3.2.

  Testler: 518 birim / 36 E2E.

  DERLEME AYRICA KOSULDU cunku E2E "next dev" kullaniyor, Vercel ise
  "next build" - cerceve yukseltmesinde ikisi ayri ayri kirilabilir.
  24 rotanin tamami dinamik (f) cikti; Clerk kullanan bir uygulamada
  dogru olan bu, hicbir sayfa yanlislikla statik uretime kaymamis.

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
  npm test          # beklenen: 518
  npm run test:e2e  # beklenen: 36, ~5-6 dk, kosarken dosyalara dokunma

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
