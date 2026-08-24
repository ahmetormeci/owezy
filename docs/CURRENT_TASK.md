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

Updated: 2026-08-24 (19)

Current task:
  FAZ 18 - MOBIL UYGULAMA. 18.0-18.8 bitti (18.6, 18.7 ve 18.8 plana sonradan
  eklendi). Oncelik iOS (ADR-030); Android bilerek ertelendi.

Hemen sonraki adim:
  YOK - KULLANICIDAN GOREV BEKLENIYOR.
  Faz 18 planinda kalan is yok. PROGRESS.md'deki aday listesi bir plan
  DEGIL, secenek listesidir - oradan bir sey kendiliginden baslatilmaz.

  MOBILDE BUGUN NE VAR:
    giris (e-posta + kod), grup listesi / tek grupta dogrudan gruba
    yonlendirme, GRUP OLUSTURMA (satir ici), UYELER + DAVET LINKI
    (iOS paylasim sayfasi), fis ekrani (harcama satirlari, ay
    perforasyonlari, ay ara toplamlari, sayfalama, cift cizgi +
    toplamlar, yirtik kenar), satir ici harcama girisi, harcama detayi
    (duzenleme + silme).

  ROTA YAPISI (18.7'de degisti):
    /                       YALNIZCA yonlendirme (0 / 1 / 2+ karari)
    /groups                 liste - HER ZAMAN gorunur
    /groups/[id]            fis
    /groups/[id]/members    uyeler + davet
    /groups/[id]/settlements  odeme kaydi + gecmis + iptal
    /groups/[id]/expenses/[id]  harcama detayi
    Giris ile listenin AYRILMA sebebi bir hataydi: ikisi ayni dosyadayken
    grup ekranindaki "Gruplarim" tek gruplu kullanicida hicbir sey
    yapmiyordu ("/" gruba geri yonlendiriyordu) ve o kullanici listeye,
    dolayisiyla "grup olustur"a hic ulasamiyordu.

  MOBILDE HENUZ YOK (bilincli kapsam disi, 18.x'te not edildi):
    - bildirimler
    - EXACT/PERCENTAGE bolusumun mobilde duzenlenmesi (bilincli:
      tutari degistirmek paylarla celisirdi)
    - silinen harcamayi GERI ALMA (restore ucu VAR ama hicbir arayuz
      kullanmiyor - WEB'DE DE YOK)
    - DAVETI KABUL ETME (link owezy.net/join/<kod>'a gidiyor; uygulama
      icinde acmak universal link ister, o da ONAYLANMIS Apple hesabi
      gerektiriyor - bekleniyor). Davet edilen web'den katiliyor.
    - odeme DUZENLEME (API'de de yok, yalnizca iptal var)
    - odemede tarih secimi (bugune sabit - tarih secici yeni bagimlilik)
    - odesme planinda avatarlar (mobilde kisi gorseli hic yok)
    - daveti iptal etme, uye cikarma, sahiplik devri
    - grup adi/aciklamasi duzenleme (aciklama mobilde HIC girilemiyor)
    - dil secimi (cihaz dili okunuyor, kullanici degistiremiyor)
    - marka isareti (web'de SVG; RN'de react-native-svg gerekirdi)

  MOBILIN BILINEN ACIKLARI:
    - CI mobil tarafi HIC dogrulamiyor (kok CI mobile/ bagimliliklarini
      kurmuyor). Ekran sayisi artti, artik bakilmaya deger.
    - Mobilin otomatik testi YOK. Dogrulama simulatorde elle yapiliyor.
    - @clerk/clerk-expo DEPRECATED (asagida).

  18.5 NE YAPTI:
    mobile/components/expense-composer.tsx - fisin son satiri bir giris.
    Esit bolusum, odeyen sen, tarih bugun; KATEGORI GONDERILMIYOR,
    sunucu aciklamadan tahmin ediyor (ADR-028). Varsayimlar gizlenmiyor.
    TOAST YOK: hatalar satirin ALTINDA, basarinin teyidi satirin fiste
    belirmesi. RN'de toast, modal Alert ya da ek paket demekti.
    KLAVYE: KeyboardAvoidingView, simulatorde yazilim klavyesi acilarak
    dogrulandi.
    GET /api/v1/me eklendi - paidById ic kimligimizi istiyor.
    useApiGet ARTIK TAZELEMEDE VERIYI KORUYOR: ayni adres yeniden
    cekilirken eldeki veri duruyor, yoksa harcama ekledikten sonra butun
    ekran spinner'a duserdi.

  SIMULATOR NOTU: donanim klavyesi ayarini test icin gecici kapatip GERI
  ACTIM (defaults write com.apple.iphonesimulator ConnectHardwareKeyboard).
  Yazilim klavyesini gormek gerekirse ayni komut -bool false ile.

  TEST VERISI (gelistirme veritabaninda duruyor):
    testuser1'in iki grubu. "Ev": iki uye, 28 harcama
    (2026-08/07/06, sonuncusunda 25 tane - sayfalama testi).
    "Bodrum tatili": tek uye, bir harcama (18.5'te eklendi).
    Uretme yolu: playwright chromium + e2e/.auth/owner.json + sayfa
    icinden fetch (storage state'teki __session kisa omurlu; ciplak
    request context ile 401 doner, gercek tarayicida Clerk taziliyor).

  BEKLEYEN IS - @clerk/expo GECISI (KULLANICI ONAYLADI, YAPILAMADI):
    Gecis DENENDI ve GERI ALINDI. Sebep bizde degil: @clerk/expo'nun
    yayinlanmis her surumu (4.5.1 / 4.5.2 / 4.5.3, latest dahil) dolayli
    olarak @clerk/shared@^4.30.0 istiyor ama npm'deki en yeni surum
    4.29.3. Surum sabitlemesiyle asilmiyor - zincir @clerk/react ve
    @clerk/clerk-js uzerinden de ayni yere cikiyor, yani kirik bir yayin
    penceresinin etrafina buyuyen bir override listesi gerekirdi.
    TEKRAR DENEME KOSULU - tek satir:
      npm view @clerk/shared version
    4.30.0 ya da ustunu gosterdiginde:
      cd mobile && npm uninstall @clerk/clerk-expo && npm install @clerk/expo
      sonra 4 dosyada import yolunu degistir (_layout, sign-in, index,
      token-cache) ve simulatorde giris yaparak dogrula.
    O ana kadar @clerk/clerk-expo@2.20.0 CALISIYOR, yalnizca uyari basiyor.

  ESKI NOT (gecerliligini koruyor):
    @clerk/clerk-expo DEPRECATED. Uygulama acilista uyari basiyor.
    Onemi kozmetik degil, SURUM AYRISMASI:
      web    @clerk/nextjs@7.5.22 -> @clerk/react@^6      = Core 3
      mobil  @clerk/clerk-expo@2  -> @clerk/clerk-js@5    = Core 2
      yenisi @clerk/expo@4.5.2    -> @clerk/clerk-js@^6   = Core 3
    Yani gecis bir ayrisma YARATMAZ, var olani KAPATIR.
    KARAR VERILDI (kullanici onayladi) - engel yalnizca yukaridaki kirik
    npm yayini.

  DIKKAT - E2E ILE MOBIL DEV SUNUCUSU AYNI ANDA CALISMAZ:
    Next 16 ayni dizinde IKINCI bir dev sunucusuna izin vermiyor (port
    farkli olsa bile). Mobil icin acilan "npm run dev" (3000) acikken
    "npm run test:e2e" kendi sunucusunu (3100) baslatamiyor ve
    "Another next dev server is already running" ile dusuyor.
    E2E'den once mobil dev sunucusunu KAPAT.

  CALISTIRMA (dogrulandi, calisiyor):
    1. Kokte:          npm run dev          (port 3000, ayakta olmali)
    2. mobile/ icinde: npx expo start --ios
    Mobil pk_test_ kullaniyor, dolayisiyla CANLIYI DEGIL yereli cagirmali -
    canli pk_live_ bekliyor ve test orneginin Bearer'ina 401 doner.
    mobile/.env.local DOLDURULDU (yayimlanabilir anahtar + localhost:3000).

  UCTAN UCA DOGRULANDI: simulatorde test kullanicisiyla
  (e2e+clerk_test@example.com, kod 424242) giris yapildi. Clerk oturumu
  acildi, getToken() calisti, GET /api/v1/me Bearer ile 200 dondu, ekranda
  kullanicinin adi ve money.ts'in bicimlendirdigi tutar gorundu.

  YAKALANAN HATA (duzeltildi): useAuth() her render'da YENI bir getToken
  donduruyor. Onu useCallback bagimliligina koymak sonsuz dongu uretti -
  "Maximum update depth exceeded" - ve giris sonrasi ekrani kilitledi.
  Hicbir statik kontrol gostermedi; tsc temizdi. Kural CONVENTIONS.md
  "Mobil" bolumune yazildi. 18.3 ve 18.4'te ayni tuzak var.

  SIMULATOR NOTLARI:
    - Xcode 26.6 + iOS 26.5 runtime kurulu, iPhone 17 Pro calisti.
    - "simctl list runtimes" indirmeden HEMEN SONRA bos gorunebilir:
      update_dyld_sim_shared_cache surerken cihazlar listelenmiyor. Bekle.
    - Iki disk imaji var, biri "Unusable - Duplicate" (~8 GB bosa).
      Temizlenebilir: xcrun simctl runtime delete <UUID>
    - MCP simulator araci CALISMIYOR: acik xcode-select kaydi
      (/var/db/xcode_select_link) yok. Gereken (parola ister):
        sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
    - MCP simulator araci ARTIK CALISIYOR (kullanici sudo xcode-select
      calistirdi). Dokunma, yazma ve ekran goruntusu mumkun. UYARI: o komut
      CoreSimulator'i yeniden baslatir ve ACIK simulatoru kapatir.
    - YAZMA HIZI: uzun bir metni tek seferde yazmak karakter dusuruyor
      (kontrollu TextInput). 8-10 karakterlik parcalar halinde yaz.

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

  CALISMA ANI DA OLCULDU: uygulama iPhone 17 Pro / iOS 26.5'te
  calistirildi. formatMoney ciktisi web'in birim testlerinin pinledigi
  degerlerle BIREBIR ayni:
    formatMoney(123456789)            -> 1.234.567,89 + lira isareti
    formatMoney(123456789,"USD","en") -> $1,234,567.89
    formatBasisPoints(3333,"tr")      -> %33,33
  Hermes'in Intl.NumberFormat destegi bizim kullandigimiz kadariyla V8 ile
  ayrismiyor. Olcum GECICI bir kod parcasiyla yapildi ve GERI ALINDI.

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

  SILME METNI GERCEGE UYDURULDU (karar verildi): eskiden "Kayit tamamen
  yok olmaz; gerekirse geri yuklenebilir" diyordu ama restore ucunu cagiran
  hicbir arayuz YOK - web'de de yok. Artik "Bu islem geri alinamaz." diyor.
  Yikici bir dokunustan once kullanicinin ihtiyaci olan tek bilgi bu;
  yumusak silme ve denetim kaydi bir uygulama ayrintisi ve o anda
  soylenmesi "o zaman nasil geri alirim" sorusunu doguruyordu.

  HALA GECERLI: restore ucu (POST .../expenses/[id]/restore) sunucuda VAR
  ama HICBIR ARAYUZ kullanmiyor - ne web ne mobil. Artik yanlis bir vaat
  degil, ama kullanilmayan bir uc. Geri alma arayuzu istenirse once web'de
  yapilmali.

  BILINEN IMLA PURUZU (IKI ISTEMCIDE DE): odeme kaydinda karsi taraf
  basligi her iki yonde de "Kime odedin?" diyor; "Bana odendi" seciliyken
  teknik olarak yanlis. Secilen kisi her iki durumda da karsi taraf oldugu
  icin kullaniciyi yanlis yonlendirmiyor - duzeltmek iki ayri anahtar
  ister, deger mi diye bakilmadi.

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
  Faz 18.1 ve 18.2 canlida (b6643ca, 3f24a3d).
  Mobil uygulama iOS Simulator'da CALISIYOR ve gozle dogrulandi.

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
