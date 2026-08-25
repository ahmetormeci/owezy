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

Updated: 2026-08-25 (6)

Current task:
  YOK - KULLANICIDAN GOREV BEKLENIYOR.

  BUGUN BITENLER (sirasiyla):
    Faz 19  Optimistic locking                    51bc3c4
    Faz 20  CI mobili de dogruluyor               f9c8ef6
    Faz 21  @clerk/expo gecisi                    30b2ecf
    Faz 22  /privacy ve /support (ADR-034)        63154ff
    Faz 23  Mobilde parolayla giris (ADR-035)     856b034
            Device Trust bulgusu (dokuman)        07ab975
            Dil degisince Clerk menusu duzeltmesi ab80386

  APP STORE HAZIRLIGI - NEREDE KALDIK:
    BITTI (kullanici dogruladi):
      - Apple Developer hesabi onaylandi
      - App Store Connect uygulama kaydi + "Owezy" adi
      - Privacy Policy URL + Support URL girildi
      - App Privacy anketi dolduruldu
      - Clerk production'da PAROLA ACIK (demo hesapla giris yapildi)
      - Demo kullanici var ve CALISIYOR: bypass_client_trust=true sayesinde
        kod istenmeden giris yapildi (gorsel: profil menusu, "demo user")
      - App Review Information -> "Sign-in required" isaretli
      - En az bir grup olusturuldu ("NEW GROU..." gorseldeydi)

    DURUMU BILINMIYOR (kullaniciya sorulacak, VARSAYILMAYACAK):
      - destek@owezy.net kutusu acildi mi (Cloudflare Email Routing)
      - Ornek veri YETERLI mi: birkac harcama + bir odesme var mi
      - App Review Information -> Contact Information telefonu girildi mi
        (o telefon KULLANICININ, demo hesabin degil; hicbir yerde
        yayinlanmiyor, yalnizca App Review ekibi goruyor)

  BENIM YARIM KALAN TEK ISIM:
    Export compliance. app.json'a su eklenmeli:
        ios.infoPlist.ITSAppUsesNonExemptEncryption = false
    Yalnizca HTTPS kullandigimiz icin dogru deger bu; eklenmezse her
    yuklemede sifreleme sorusu tekrar soruluyor. Kullaniciya teklif edildi,
    CEVAP GELMEDI, o yuzden yapilmadi.

  DEVICE TRUST ENGELI CIKTI VE ASILDI (25 Agustos):
  Clerk'in Device Trust korumasi, dogru paroladan sonra bile ek dogrulama
  istiyordu (needs_client_trust) ve o dogrulama e-posta koduyla yapiliyor -
  yani demo hesap kilitleniyordu. Cozum kullanici bazinda muafiyet:

    PATCH https://api.clerk.com/v1/users/user_3IPH520z2gWytNtqkHrg1xP1kYP
    { "bypass_client_trust": true }        -> true dondu, calisti

  Boylece Device Trust HERKESTE ACIK KALDI; ornek genelinde kapatmadik.

  AMA BU ALAN BELGELENMEMIS. Sessizce calismayi birakabilir ve sonucu, bir
  sonraki incelemede inceleyicinin iceri girememesi olur.
  HER GONDERIMDEN ONCE DOGRULA:
    1. GET .../v1/users/<id> -> bypass_client_trust hala true mu
    2. GIZLI PENCEREDE owezy.net'e demo bilgileriyle gir. Gizli pencere
       Clerk icin YENI ISTEMCI demek, yani Device Trust'i tetikleyecek kosul.
       Kod istenmeden giriyorsan muafiyet calisiyor.
  Bozulursa yedek plan: Protect -> Rules -> Device Trust -> Enable kapat.

Hemen sonraki adim:
  2FA - MOBIL IKINCI FAKTOR ADIMI, SONRA PANELDEN ACMA.
  Kullanici sirayi boyle onayladi: once sayfalar (bitti), sonra 2FA.

  BU IS ARTIK IKI SEY BIRDEN COZUYOR. Ikinci faktor adimi mobile gelince
  needs_client_trust de tamamlanabilir hale geliyor - yani demo hesabin
  BELGELENMEMIS bypass_client_trust alanina bagimliligimiz azaliyor.
  O alan sessizce bozulursa yedegimiz olur.

  NEDEN ONCE MOBIL: mobil giris ekranini BIZ yazdik ve ikinci faktoru ELE
  ALMIYOR. Bugunku kod:
      if (signIn.status !== "complete") { setError(...); return; }
  2FA acilirsa Clerk "needs_second_factor" donuyor ve ekran orada duruyor -
  yani 2FA'yi etkinlestiren her kullanici mobilden KILITLENIR.
  Yeni @clerk/expo API'si gerekli her seyi veriyor:
      mfa.verifyTOTP, mfa.verifyBackupCode,
      mfa.sendEmailCode / verifyEmailCode,
      mfa.sendPhoneCode / verifyPhoneCode
  Is: app/sign-in.tsx'e ucuncu bir adim ("email" | "code" | "mfa").

  SONRA PANELDEN: TOTP + yedek kodlar ISTEGE BAGLI olarak acilir.
  - ZORUNLU YAPILMAYACAK: para tasimayan bir defter uygulamasinda zorunlu
    2FA kullanici kaybettirir.
  - SMS KAPALI KALSIN: mesaj basina maliyeti var ve SIM-swap'a acik.
  - Clerk'in ucretsiz planinda TOTP'nin dahil oldugunu KULLANICI teyit
    edecek (fiyatlandirma sayfasindan).

  ARDINDAN (kullanici onayladi, sirasi gelmedi): guvenlik basliklari
  (Strict-Transport-Security, X-Content-Type-Options, CSP - next.config.ts'te
  HIC YOK) ve /api/v1 icin hiz siniri (HIC YOK). Gizlilik politikasindaki
  "makul teknik tedbirler" cumlesini gercek yapan is bu.

FAZ 21'DEN AKILDA TUTULACAKLAR:
  - useSignIn'in SOZLESMESI DEGISTI ve tsc yakaladi:
      eski: { signIn, setActive, isLoaded }
      yeni: { signIn, fetchStatus }, signIn "future" API'si
    Giris ekrani yeniden yazildi ve KISALDI: create() + faktor arama +
    prepareFirstFactor yerine tek emailCode.sendCode({emailAddress});
    setActive yerine finalize(). Hatalar FIRLATILMIYOR, { error } doniyor.
  - app.json'a CONFIG PLUGIN eklendi ("@clerk/expo"). Eski pakette boyle
    bir sey YOKTU. Yazilmasaydi eksik yapilandirmayla derlenirdi ve bu
    ancak native derlemede, yani TestFlight'ta gorunurdu.
  - getToken() CEVRIMDISIYKEN ARTIK HATA FIRLATIYOR (clerk_offline).
    Tek yerde (lib/use-api.ts) yakalanip { ok:false, status:0,
    code:"server.offline" } sozlesmesine cevriliyor - ekranlar degismedi.
  - KENDI token-cache'imiz KORUNDU. Yeni paket @clerk/expo/token-cache
    veriyor ama bizimkinin yorumlarinda gercek kararlar yazili.
  - ERTELENDI: react-dom, expo-web-browser, expo-auth-session yeni surumde
    OPSIYONEL peer oldu (eskisinde ikisi zorunluydu). Ayni commit'te
    silmek, bir sey bozulunca hangisinin bozdugunu bilinmez yapardi.

MOBILDE BUGUN NE VAR:
  giris (e-posta + kod, ya da parolayla - ikincil), grup listesi / tek grupta dogrudan gruba
  yonlendirme, grup olusturma (satir ici), uyeler + davet linki (iOS
  paylasim sayfasi), fis ekrani (harcama satirlari, ay perforasyonlari, ay
  ara toplamlari, sayfalama, cift cizgi + toplamlar, yirtik kenar), satir
  ici harcama girisi, harcama detayi (duzenleme + silme + cakisma uyarisi).

ROTA YAPISI:
  /                           YALNIZCA yonlendirme (0 / 1 / 2+ karari)
  /groups                     liste - HER ZAMAN gorunur
  /groups/[id]                fis
  /groups/[id]/members        uyeler + davet
  /groups/[id]/settlements    odeme kaydi + gecmis + iptal
  /groups/[id]/expenses/[id]  harcama detayi
  Giris ile listenin AYRILMA sebebi bir hataydi: ikisi ayni dosyadayken
  grup ekranindaki "Gruplarim" tek gruplu kullanicida hicbir sey yapmiyordu
  ("/" gruba geri yonlendiriyordu) ve o kullanici listeye, dolayisiyla
  "grup olustur"a hic ulasamiyordu. BIRLESTIRME.

MOBILDE HENUZ YOK (bilincli kapsam disi):
  - bildirimler
  - EXACT/PERCENTAGE bolusumun mobilde duzenlenmesi (bilincli: tutari
    degistirmek paylarla celisirdi)
  - silinen harcamayi GERI ALMA (restore ucu VAR ama hicbir arayuz
    kullanmiyor - WEB'DE DE YOK)
  - DAVETI KABUL ETME (link owezy.net/join/<kod>'a gidiyor; uygulama icinde
    acmak universal link ister, o da ONAYLANMIS Apple hesabi gerektiriyor).
    Davet edilen web'den katiliyor.
  - odeme DUZENLEME (API'de de yok, yalnizca iptal var)
  - odemede tarih secimi (bugune sabit - tarih secici yeni bagimlilik)
  - odesme planinda avatarlar (mobilde kisi gorseli hic yok)
  - daveti iptal etme, uye cikarma, sahiplik devri
  - grup adi/aciklamasi duzenleme (aciklama mobilde HIC girilemiyor)
  - dil secimi (cihaz dili okunuyor, kullanici degistiremiyor)
  - marka isareti (web'de SVG; RN'de react-native-svg gerekirdi)

MOBILIN BILINEN ACIKLARI:
  - Mobilin DAVRANIS testi YOK. CI artik derleniyor mu diye bakiyor ama
    ekranlarin ne yaptigina bakan hicbir sey yok; dogrulama simulatorde
    elle yapiliyor.
  - Bir hata bu oturumda simulatorde bulundu ve duzeltildi: CIKIS YAPAN
    kullanicinin uygulamasi DONUYORDU (app/index.tsx once "yukleniyor mu"
    sonra "girisli mi" diye bakiyordu; cikista istek hic atilmadigi icin
    durum sonsuza kadar "loading" kaliyordu). Ders: mobilde bir yolu
    denemediysen o yol CALISMIYOR olabilir - tsc de CI de gostermez.
  - IKINCI FAKTOR HALA ELE ALINMIYOR. Giris ekrani "complete" disindaki her
    durumda (needs_second_factor, needs_client_trust) kullaniciyi web'e
    yonlendiriyor - ham durum adi basmiyor ama adimi da yurutmuyor.
    2FA acilmadan once bu yapilmali (siradaki is).

CI MOBILDE NE KOSUYOR (Faz 20):
  mobil npm ci -> tsc -> expo-doctor -> expo export --clear
  Ikisinin kirmiziya dusebildigi KANITLANDI: bagimlilik gecici kaldirilinca
  expo-doctor 1 dondu, bozuk import eklenince expo export 1 dondu.

  GERCEK RUNNER'DA DOGRULANDI (f9c8ef6, 25 Agustos): dort adim da gecti.
  Sureler: kurulum 61 sn (onbellek SOGUKTU - cache-dependency-path yeni
  eklendigi icin anahtar degismisti), tsc 3, doctor 4, export 20.
  Kosunun tamami 2 dk 22 sn.

  YAYIN DERLEMESI ICIN ONEMLI BULGU: EXPO_PUBLIC_* degerleri pakete
  GOMULUYOR ve Metro'nun onbellegi env degisikligini GORMUYOR - ayni komut,
  .env.local varken ve yokken BIREBIR AYNI paket hash'ini uretti. Yani
  yanlis API adresi gomulmus bir derleme sessizce cikabilir.
  TestFlight derlemesinde "--clear" SART.

CALISTIRMA (dogrulandi):
  1. Kokte:          npm run dev          (port 3000, ayakta olmali)
  2. mobile/ icinde: npx expo start --ios
  Mobil pk_test_ kullaniyor, dolayisiyla CANLIYI DEGIL yereli cagirmali -
  canli pk_live_ bekliyor ve test orneginin Bearer'ina 401 doner.
  mobile/.env.local DOLDURULDU (yayimlanabilir anahtar + localhost:3000).

DIKKAT - E2E ILE MOBIL DEV SUNUCUSU AYNI ANDA CALISMAZ:
  Next 16 ayni dizinde IKINCI bir dev sunucusuna izin vermiyor (port farkli
  olsa bile). "npm run dev" (3000) acikken "npm run test:e2e" kendi
  sunucusunu (3100) baslatamaz ve "Another next dev server is already
  running" ile duser. E2E'den once mobil dev sunucusunu KAPAT.

SIMULATOR NOTLARI:
  - Xcode 26.6 + iOS 26.5 runtime kurulu, iPhone 17 Pro calisiyor.
  - MCP simulator araci CALISIYOR (kullanici sudo xcode-select calistirdi).
    UYARI: o komut CoreSimulator'i yeniden baslatir ve ACIK simulatoru
    kapatir.
  - "simctl list runtimes" indirmeden HEMEN SONRA bos gorunebilir:
    update_dyld_sim_shared_cache surerken cihazlar listelenmiyor. Bekle.
  - YAZMA HIZI: uzun metni tek seferde yazmak karakter dusuruyor (kontrollu
    TextInput). 8-10 karakterlik parcalar halinde yaz.
  - ARTI ISARETI YAZILAMIYOR. "e2e+clerk_test@example.com" yazmaya calisinca
    alan "e2e_test@example.com" oldu - metin enjeksiyonu "+" gorunce kesiyor
    ve SESSIZCE devam ediyor. Clerk test kullanicilari tam da o desene bagli.
    COZUM - pano:
      printf 'e2e+clerk_test@example.com' | xcrun simctl pbcopy <UDID>
    sonra alana UZUN BAS -> Select All -> Paste.
  - Donanim klavyesi ayari test icin gecici kapatilip GERI ACILDI
    (defaults write com.apple.iphonesimulator ConnectHardwareKeyboard).

TEST VERISI (gelistirme veritabaninda duruyor):
  25 Agustos'ta simulatorde UC grup gorundu: "Ofis", "Bodrum tatili", "Ev".
  Asagidaki not ikisini tarif ediyor; "Ofis" sonradan olusmus (buyuk olasilikla
  bir E2E kosusundan), icerigi dogrulanmadi.
  "Ev": iki uye, 28 harcama (2026-08/07/06, sonuncusunda 25 tane -
  sayfalama testi). "Bodrum tatili": tek uye, bir
  harcama. Uretme yolu: playwright chromium + e2e/.auth/owner.json + sayfa
  icinden fetch (storage state'teki __session kisa omurlu; ciplak request
  context ile 401 doner, gercek tarayicida Clerk taziliyor).

YAYIN DURUMU (ayrinti: PROJECT.md "Yayinlama", kararlar: ADR-030/031):
  - APPLE DEVELOPER HESABI ONAYLANDI (25 Agustos 2026).
  - Android BILEREK ERTELENDI.

  SIRA - NEYIN NEYI BEKLEDIGI:
    TestFlight INTERNAL'i hicbiri bloke etmiyor (100 kisi, inceleme yok,
    dakikalar). Asagidakiler ancak APP STORE INCELEMESINDE kapi oluyor.

    A) Kod beklemeyenler, bekleme suresi olanlar:
       1. App Store Connect kaydi + "Owezy" adi   -> BITTI (25 Agustos).
       2. owezy.net'e gizlilik politikasi + destek sayfasi. IKISI DE
          ZORUNLU, IKISI DE BUGUN YOK. -> ACIK

    XCODE'DA YENI PROJE ACILMAYACAK. Bir kez yanlis anlasildi: "App Store
    Connect'te kayit ac" bir WEB SITESI isi (appstoreconnect.apple.com),
    Xcode isi degil. Xcode'un "New Project"i sifirdan bir NATIVE SWIFT
    uygulamasi yaratir - bizimki Expo/React Native ve zaten mobile/ altinda
    duruyor. Expo'da native proje elle yazilmaz: ya "npx expo prebuild"
    app.json'dan uretir ya da EAS bulutta uretir. Hangisi olacagi bir MIMARI
    KARAR, sirasi gelince tasarimi yazilip onay alinacak.
    B) Kod isteyenler:
       3. Hesap silme (DELETE /api/v1/me) - Guideline 5.1.1. Karar
          ADR-031'de, uygulanmadi. Zor kismi zaten yazili (asagida).
       4. Demo hesap + icinde ornek grup ve harcamalar (App Review
          Information). Inceleyici giris duvarini asamazsa hicbir sey
          goremez.
    C) Sonra: EAS build -> TestFlight Internal -> (istenirse) External
       (Beta App Review ~1 gun) -> App Store gonderimi (ekran
       goruntuleri, aciklama, App Privacy formu, yas siniri, kategori).

    DERLEME ONCESI ZORUNLU AYAR: mobile/.env.local bugun pk_test_ ve
    localhost:3000 kullaniyor. Bu ayarla cikan bir TestFlight derlemesinde
    HICBIR SEY YUKLENMEZ - cihazin localhost'u kendisidir. Uretim anahtari
    ve https://owezy.net gerekiyor. Degerleri KULLANICI girer.
    Ayrica "--clear" SART (yukaridaki Metro onbellek bulgusu).

    EAS derlemesi Expo'nun sunucularinda calisiyor, yani kodu disari
    gonderiyor - oraya gelmeden kullaniciya SORULACAK.

  - HESAP SILME KARARA BAGLANDI (ADR-031), HENUZ UYGULANMADI:
      DELETE /api/v1/me yazilacak. Isin zor kismi ZATEN YAZILI:
      markUserDeletedFromClerk (src/lib/clerk-sync.ts).
      SIRALAMA: Clerk panelindeki "kullanicilar hesabini silebilir" anahtari
      SU AN ACIK ve silme uctan uca calisiyor. ADR-031 "kapali tutulacak"
      derken SON DURUMU tarif ediyor. Anahtar, DELETE /api/v1/me yayina
      girene kadar ACIK KALMALI - simdi kapatmak calisan tek silme yolunu
      kaldirirdi.
  - SIGN IN WITH APPLE: EKLENMEYECEK (simdilik). Clerk'te e-posta ile giris
    ACIK, yani Guideline 4.8'in istedigi alternatif mevcut. Risk sifir degil
    - 4.8 alternatifin "e-postayi gizli tutmaya izin vermesi"ni de istiyor -
    ama reddedilirsek bedeli bir tur; simdi eklersek CIFT HESAP riskini her
    kullanici icin ustlenirdik (Hide My Email privaterelay adresi veriyor,
    Google ile kaydolmus biri Apple ile girince eslesmiyor).
  - Gizlilik politikasi ve destek sayfasi VAR (Faz 22): owezy.net/privacy ve
    owezy.net/support. Ikisi de giris gerektirmiyor. App Store Connect'teki
    "Privacy Policy URL" ve "Support URL" alanlarina bu adresler yazilacak.
    AMA destek@owezy.net KUTUSU HENUZ ACILMADI - o olmadan sayfa ise yaramaz.

ACIK KALANLAR (yeni gorev degil, akilda tutulacaklar):
  - RESTORE UCU KULLANILMIYOR: POST .../expenses/[id]/restore sunucuda VAR
    ama ne web ne mobil cagiriyor. Silme metni artik "Bu islem geri
    alinamaz." diyor, yani yanlis bir vaat yok - ama uc de olu duruyor.
  - IMLA PURUZU (IKI ISTEMCIDE DE): odeme kaydinda karsi taraf basligi her
    iki yonde de "Kime odedin?" diyor; "Bana odendi" seciliyken teknik
    olarak yanlis. Secilen kisi iki durumda da karsi taraf oldugu icin
    yaniltmiyor - duzeltmek iki ayri anahtar ister.
  - KATEGORI TAHMIN LISTESI CANLI VERIYLE SINANMADI: anahtarlar elle secildi.
    Isabetsiz cikarsa cozum listeyi buyutmek olmayabilir - yaygin kelimelerle
    cakisan anahtar, olmayan anahtardan kotudur.
  - FIS TASARIMI CANLIDA GOZLE BAKILMADI: dogrulama E2E'nin urettigi
    gruplarda ve ekran goruntusuyle yapildi.
  - FOTOGRAF EKLEME: karar verilebilir durumda. Fotograf VERITABANINA
    KONMAYACAK - nesne deposu (Vercel Blob / Cloudflare R2), veritabani
    yalnizca anahtar/boyut/tip tutar.

CANLI DURUM:
  Adres      : https://owezy.net (apex birincil, www 307 ile yonleniyor)
  DNS        : Cloudflare, Vercel ve Clerk kayitlari PROXY KAPALI (ADR-026)
  Kimlik     : Clerk production instance, pk_live_ -> clerk.owezy.net
  Sosyal     : GitHub + Google, kendi OAuth uygulamalarimizla
  Webhook    : https://owezy.net/api/webhooks/clerk, test olayi 200 dondu
  Surum      : Next 16.3.2

  PRODUCTION VERITABANI SIFIRLANDI (24 Agustos 2026): butun veri tablolari
  TRUNCATE ile bosaltildi ve Clerk production kullanicilari silindi. Icerideki
  her kayit test verisiydi; uygulama hic gercek kullaniciya acilmamisti.
  _prisma_migrations'a DOKUNULMADI. BU BIR KURAL DEGISIKLIGI DEGIL:
  "finansal kayitlar fiziksel olarak silinmez" uygulamanin CALISMA ANINDAKI
  davranisini baglar. Acilis oncesi tek seferlik temizlik emsal degildir.

  DEVELOPMENT INSTANCE SILINMEYECEK: E2E testleri onun +clerk_test
  kullanicilarina ve sabit 424242 koduna bagli.

  NOT: Clerk panelindeki uygulama adi "owezy" (kucuk harf), arayuzdeki
  ui.app_name "Owezy". Giris formundaki yazi Clerk'ten geldigi icin ikisi
  ayrisik - Clerk panelinden duzeltilmesi bekleniyor.

  MIGRATION DURUMU: 8 migration var; sonuncusu 20260825090000_add_expense_version.
  Gelistirme ve E2E veritabanlarina uygulandi. Production'a vercel-build'in
  "prisma migrate deploy" adimiyla gidecek - bu bir CIKARIM degil beklenti;
  DEPLOY SONRASI Vercel log'undaki migrate ciktisina BAKILMALI, cunku bu
  migration NOT NULL bir kolon ekliyor (DEFAULT 1 ile, yani guvenli).

Blocked by:
  Yok.

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 535
  npm run test:e2e  # beklenen: 43, ~7 dk, kosarken dosyalara dokunma

  Mobil (CI de AYNISINI kosuyor, Faz 20'den beri):
    cd mobile
    npm ci                  # ~9 sn
    npx tsc --noEmit        # ~1 sn
    npx expo-doctor         # ~2 sn
    npx expo export --platform ios --clear --output-dir /tmp/x   # ~7 sn

  Prisma 7'de postinstall YOK: sema degistiginde "npx prisma generate"
  calistirilmadan tsc eski tipleri gorur ve var olmayan hatalar uretir.

  TAM KOSU SART - OLCULDU: 16.3'te hedefli kosular temiz gorunurken tam kosu
  19 test dusurdu. Sebep satir ici girisin erisilebilir adlarinin (Aciklama /
  Tutar) sayfadaki mevcut adlarla cakismasiydi. Dar kapsamli kosu bunu
  gostermez cunku cakisma baska spec dosyalarindaki akislarda cikiyor.

  E2E notu: beklenenden cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur.

  DUZEN HATALARINI E2E VARSAYILAN OLARAK YAKALAMAZ (metnin varligina bakiyor,
  sayfanin kaydigina degil). Olcum ozet testinin icinde:
    document.documentElement.scrollWidth > window.innerWidth
  390 ve 768 px'te olculuyor. Yeni bir duzen eklendiginde ayni olcum oraya da
  konmali.

  IZLENECEK - ARALIKLI E2E HATASI (macOS'ta bes tam kosu temiz gecti, yani
  tekrarlamadi): Faz 14 sonrasi ardarda uc tam kosudan BIRINDE bir test
  "toBeVisible" ile dustu. Hangi test oldugu belirlenemedi, cunku sonraki
  kosu test-results'i temizliyor. Tekrarlarsa: kosuyu dosyaya al
  (npm run test:e2e > out.txt), hangi test oldugunu bul, sonra ya o iddiayi
  daha kesin bir sinyale bagla ya da timeout'u YALNIZCA orada yukselt.
  Suite'in tamamina timeout eklemek gercek yavaslamalari gizler.

  KURULUM ADIMI DA DUSEBILIYOR - 25 Agustos'ta yasandi: global.setup
  "test kullanicilarinin oturumlarini hazirla" adimi dustu, hemen ardindan
  ayni komut 43/43 temiz gecti. O sirada SIMULATORDE ayni test kullanicisiyla
  arka arkaya giris yapilmisti; Clerk'in hiz sinirlamasi en olasi aciklama
  (kosu log'unda hiz sinirina isaret eden satirlar vardi). Yani: simulatorde
  giris denemelerinden HEMEN SONRA tam E2E kosma, birkac dakika bekle.

  NPM SURUM FARKI: npm 11.17 paketlerin kurulum betiklerini varsayilan
  olarak CALISTIRMIYOR. Sonuca bakildi, bugun bir sey kirmiyor. Gerekirse:
  "npm approve-scripts --allow-scripts-pending".
