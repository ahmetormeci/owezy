# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.
- "Tuzaklar ve yollar" bolumu tarihce DEGIL: her oturumda gecerli olan
  yontem bilgisi. Hikaye yazma, kurali yaz; hikayesi CHANGELOG'da.

BAYAT MI?

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel.

AMA BU KONTROL YALNIZCA KODU KAPSIYOR. "DIS DUNYA" maddeleri baska yerde:
DNS, Vercel, Sentry, App Store Connect, Expo, saglayici panelleri. Onlari
ne git ne de bir test goruyor.

BU DOSYA HER YENIDEN YAZILDIGINDA O MADDELER TEK TEK OLCULMELI:
    DNS      dig @1.1.1.1 +short TXT _dmarc.owezy.net
             (@1.1.1.1 SART: bu makinenin varsayilan cozucusu TXT'ye BOS doner)
    env      grep -oE '^[A-Z0-9_]+' .env.local   (ADLAR; degerleri okuma)
    canli    curl -sI https://owezy.net/support
    yayin    api.github.com/repos/ahmetormeci/owezy/deployments?sha=<SHA>
             -> "Production" -> .../deployments/<id>/statuses (asagida)
    magaza   itunes.apple.com/lookup?bundleId=net.owezy.app&country=us
    CI       curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=3"
             (gh CLI YOK; depo herkese acik, yetki gerekmiyor)
    panel    olculemez - KULLANICIYA SOR, varsaymadan
-->

Updated: 2026-11-06

Current task:
  1.0.7 YAYINDA (lookup 6 Kasim: us/tr 1.0.7, 2026-11-05T06:09Z). Build
  28: EAS 73244045, commit 6910d2f, Xcode 26.6 (17F113). Icerik: Faz 54
  (ADR-061, ADR-052 eki) + 21 Ekim'deki 9 Expo yamasi. Siradaki surum
  icin bekleyen bir is YOK.

  6 KASIM - COMMIT'LENDI VE PUSH'LANDI (kullanicinin istegiyle):
    - EXPO YAMALARI (4 Kasim'da alinan set): expo 57.0.31,
      expo-notifications 57.0.24, expo-router 57.0.29, expo-sharing
      57.0.24 (alt paketlerde react-native-gesture-handler 3.2.1 -> 3.4.0
      - NATIVE). expo-doctor 21/21 (4 Kasim), tsc, lint, 98 vitest + 145
      jest, expo export temiz. Simulatorde Release build (iOS 27): acilis,
      kapaliyken owezy://join/... davet ekrani, dokunus/gecis, 31 karakter
      tek seferde.
    - YORUM E2E TESTINE test.slow() (e2e/comments.spec.ts): yalnizca o
      testin butcesi 60 -> 180 sn. Tam kosu 73 gecti 1 atlandi (22.5 dk);
      bu kosuda yorum testi 72 SN surdu - eski sinirla kod saglamken
      dusecekti.
  CI YINE KIRMIZI KALACAK: 6 Kasim'da Expo 8 pakete daha yama yayinladi
  (expo 57.0.32, expo-build-properties 57.0.23, expo-constants 57.0.23,
  expo-image-manipulator 57.0.22, expo-image-picker 57.0.21,
  expo-notifications 57.0.25, expo-router 57.0.30, expo-sharing 57.0.25).
  Almak KULLANICI KARARI; alinirsa ayni dogrulama (simulator dahil).

  EXPO - 4 KASIM OLCUMU:
    - SDK 58 ARTIK "latest" (npm dist-tags: latest 58.0.23, sdk-57
      57.0.31). 21 Ekim'de EAS'ta Xcode 27.0 ve 27.1 imajlari vardi.
      Sabitleme 1.0.7'de de bilerek duruyor (ADR-058) - kaldirmak SDK 58
      isinin parcasi.

  SIMULATORDE GIRISLI KONTROL - NASIL YAPILIR (5 ve 21 Ekim'de boyle):
    Kullanici izin verdi: yerel build'de, yerel gelistirme sunucusuna bagli
    bir TEST hesabiyla giris. Production'a dokunulmadi.
    - Sunucu: RESEND_API_KEY="" npm run dev  (kod e-postasi GITMEZ)
    - Kod: gelistirme veritabani Verification "sign-in-otp-<email>"
      (e2e/db-cleanup.ts readOtpFromDatabase ile ayni ayristirma)
    - Test verisi: uygulamanin KENDI servis fonksiyonlariyla (createGroup,
      createGroupInvite + acceptGroupInvite, createExpense) - tsx ile
      --env-file=.env.local --tsconfig tsconfig.json, NODE_OPTIONS
      --conditions=react-server
    - SIMULATOR TUZAKLARI: "yazma karakter dusuruyor" UYGULAMANIN hatasiydi
      (ADR-061), simulatorun degil - 21 Ekim'den sonra 31 karakter tek
      seferde geliyor. Klavye acilirken yer degistiren dugmeye HEMEN
      dokunma (dokunus bosa gidiyor); yazar yazmaz "Kaydet"e basmak
      otomasyon hizinda yazidan once islenebiliyor. Aracin kendi ekran
      goruntusu olayin GERISINDE kaliyor - "xcrun simctl io <udid>
      screenshot" ile 1-2 sn sonra al. iOS 26.5 simulatorunde (FCD7F36E)
      klavye CIKMIYOR - iOS 27 simulatoru kullan ("Owezy Test iOS 27",
      28E27032). iOS Simulator aracinda HER KOMUTTA device VER: verilmeyince
      21 Ekim'de bir dokunus BASKA projenin simulatorune (4FC4379D) gitti.
      "open -a Simulator" bu makinede (Xcode 27.1) uygulamayi bulamiyor;
      panel icin aracin attach'i yetiyor.
    - Imzasiz build'de Keychain kalici degil: uygulamayi YENIDEN BASLATMA
      ya da yeniden KURMA oturumu dusurur - giris tekrar gerekir.
    GELISTIRME VERITABANINDA KALAN TEST VERISI: iban@ / iba@ / iban-te@ /
    iban-test-b@ / iban-test-c@owezy.test ve "IBAN testi: ..." gruplari.
    Zararsiz, istenirse silinebilir.

>>> BUILD YOLU (her surumde) <<<
    eas build --platform ios --profile production --non-interactive --no-wait
    (eas global degil: npx --yes eas-cli ...)
    -> build log'undan Xcode 26.6 (17F113) oldugunu DOGRULA (eas.json'da
       image sabit - ADR-058).
    -> submit ISTENIRSE eas submit (1.0.7'de yarim dakika, 1.0.5'te ~55 dk;
       ikisi de normal). eas submit YALNIZCA App Store Connect'e YUKLER ->
       TestFlight'ta gorunur. INCELEMEYE GONDERME ayri adim: kullanici
       panelde, TestFlight kontrolunden SONRA.
  Surum app.json'da elle artirilir; build numarasi EAS'ta (remote,
  autoIncrement). Surum notu iki dilde STORE.md.
  >>> INCELEMEYE GONDERMEDEN ONCE TESTFLIGHT - SART (Faz 51) <<<
    Telefonda: (1) aciliyor mu, (2) uygulama KAPALIYKEN davet linkine
    dokununca davet ekrani geliyor mu, (3) bildirime dokununca grup
    aciliyor mu. Simulatorde olculemeyen tam bu uc. "Gecti" yalnizca
    kullanici O BUILD'de denedikten sonra yazilir.

ACIK KALANLAR - KULLANICIDAN CEVAP YA DA KARAR BEKLEYENLER:
  0. EXPO'NUN 6 KASIM YAMALARI (yukarida) - alinsin mi.
  1. TEKRARLAYAN HARCAMA canlida gercekten uretim yaptigi HIC GORULMEDI.
     CRON_SECRET TANIMLI VE DOGRULANDI (10 Eylul: Vercel -> Cron Jobs ->
     Run -> 200) - soru o DEGIL. Eksik olan gercek bir sablonun
     uretmesini gormek. Iki dakikalik yol: web'de "Bunu tekrarla" ile
     baslangici BUGUN olan bir harcama kur -> Vercel -> Cron Jobs -> Run
     -> harcama dusmeli. Kosu ozeti Runtime Logs'ta "[cron/recurring]".
  2. 2FA KOPRUSU (ADR-045): mobil 1.0 icin gecici sunucu yamasi. 1.0'da
     kimse kalmadiysa kaldirilir - kullanici App Store Connect ->
     Analytics'te surume gore oturumlara bakacak. Dogrulama yolu asagida.
  3. DMARC RAPORLARI - 4 KASIM'DA BAKILDI (Cloudflare -> Email -> DMARC
     Management, son 7 gun): tek kayit, 3 Kasim. Kaynak Microsoft
     20.110.252.109 (Azure, Virginia, ters DNS YOK - Outlook'un kendi
     posta sunucusu degil), envelope from "<>", SPF ve DKIM fail,
     raporlayan Outlook.com. BIZIM DEGIL: bizim postalarimiz yalnizca
     Amazon SES'ten (send.owezy.net) cikiyor. Buyuk olasilikla sahte posta
     denemesi; p=reject isini yapti. 7 gunde bizim postamiz HIC
     gorunmedi (az posta; oturum acik kalan kullaniciya kod gitmiyor).
     Istege bagli: araligi 30 gune cekip Amazon SES "pass" gormek.
     DMARC RAPORU JUNK'A DUSMEYI GOSTERMEZ - yalnizca kimlik kontrolunu.
     Ekrandaki "SPF policy: Fail" kokteki "v=spf1 -all" (kokten kimse
     gondermiyor - ayar, hata degil); "BIMI: No/Fail" bilerek kurulmadi
     (ADR-060).
  4. SDK 58: artik "latest" (4 Kasim). Ayri is (ADR-058). Son tarih
     NISAN 2027 (Apple, iOS 27 SDK). Xcode 27'ye gecilen gun uygulama
     yeniden boyutlandirilabilir oluyor - duzen farkli genisliklerde
     denenmeli.

DIS DUNYA - 4 KASIM OLCUMU:
  DMARC    v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r;
           rua=mailto:...@dmarc-reports.cloudflare.net   (Cloudflare raporlari)
  CANLI    / , /support , /privacy , /.well-known/apple-app-site-association -> 200
           Apple CDN AASA -> 200
  MAGAZA   1.0.7 | 2026-11-05 | (6 Kasim, us ve tr)
  CI       636a2cb failure - YALNIZCA expo-doctor (Expo yamalari)
  ENV      15 ad: DATABASE_URL, E2E_DATABASE_URL, E2E_USER_1..3_EMAIL/PASSWORD,
           RESEND_API_KEY, BETTER_AUTH_SECRET/URL, R2_ACCOUNT_ID,
           R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
  PANEL    olculemez: Resend takibi KAPALI, Cloudflare DMARC ACIK - kullanici
           27 Eylul'de yapti ve DMARC'taki rua bunu dogruluyor.

CANLIDA OLAN: web ve mobil (1.0.7) esit - mobilde bekleyen ozellik yok.

AKILDA TUTULACAKLAR - URUN (ayrinti ADR'lerde):
  - MISAFIR (ADR-057): isGuest isaretli, tek gruba bagli User; giris
    YAPAMAZ. Sahiplenme GUEST_REFERENCE_POLICY'den (28 User alani).
    YENI BIR TABLO User'a baglanirsa orada siniflanmali - yoksa
    guests.test.ts'teki sema testi duser. Onay SUNUCUDA (confirmGuestId).
  - IBAN (ADR-059): ortak gruptaki herkes goruyor; kayit bicimi tek
    (bosluksuz, buyuk harf, src/lib/iban.ts); degisince sahibine maskeli
    posta; son 7 gunde degismisse odeyene uyari. Misafirde ve silinmis
    hesapta IBAN yok - veritabani zorluyor.
  - DESTEKLENEN PARA BIRIMI YALNIZCA TRY VE USD (money.ts).
  - UYGULAMA YALNIZCA iPhone ICIN (supportsTablet: false): iPad'de ya da
    Mac'te magaza aramasinda CIKMAZ - "bulamiyorum" sikayetinde once
    cihazi sor. Arama olcumu gercek sayfayla:
    apps.apple.com/<cc>/iphone/search?term=owezy (iTunes Search API
    gercek aramayi YANSITMIYOR).
  - PRODUCTION'DA GERCEK KULLANICI VAR. Production'a dokunan her betik once
    OKUYUP saymali, sonra yazmali. Production DATABASE_URL bu makineye
    GETIRILMEZ.
  - DEMO HESAPLAR (production):
      appreview@owezy.net  inceleme hesabi - SILME, PAROLASINI DEGISTIRME.
      demo@owezy.net       ICINDE VERI VAR, atilabilir degil. Yeni demo
                           gerekiyorsa YENI adres.
  - YENI BIR ADRES KULLANMADAN ONCE: Cloudflare Email Routing'de ekli mi
    ve Resend suppressions listesinde DEGIL mi. Iki durumda da arayuz
    "gonderildi" der.
  - GELISTIRME VERITABANI: "Deniz'in evi" grubu ve davetci@ornek.test
    BILEREK duruyor - dev'deki tek cok uyeli grup. demo@owezy.net'in "Ev"
    grubu da dev'de. appreview@ dev'de YOK. Dev'e bakmak: npx prisma studio.

GONDERIM KONTROL LISTESI (her surum):
  1. eas build (imaj Xcode 26.6 - log'dan dogrula). EAS ucretsiz plan AYDA
     15 iOS build: BUILD ALMADAN ONCE SOR, degisiklikleri biriktir.
  2. eas submit -> TestFlight -> kullanicinin telefonunda kontrol.
  3. appreview@ gizli pencerede PAROLAYLA giriyor mu, ikinci adim istemiyor
     mu - 1.0.3 bu kontrol atlandigi icin reddedildi (Guideline 2.1).
  4. App Privacy anketi degisti mi (yeni veri turu = yeni satir). Girili
     olanlar: Identifiers -> Device ID (push), User Content -> Photos or
     Videos (fis, profil); 1.0.6'da eklendi: misafir ADLARI ve Financial
     Info -> Other Financial Info (IBAN).
  5. Incelemeye gonder. Ekran kaydi gerekirse FIZIKSEL CIHAZDA (Apple'in
     ret metni acikca istiyor; simulator kaydi kullanilamadi).
  App Review Information dolu ve oyle kalmali (demo hesap + Notes; Notes
  ve cevaplar 4000 karakterle sinirli).
  MAGAZA KIMLIGI: uygulamayi ASLA KALDIRMA (ad kalici kaybedilir; bir kez
  oldu). net.wezy.app silinemez, zararsiz; canli bundle net.owezy.app.
  YENI iOS YETKISI eklenince build "Provisioning profile ... doesn't
  include the X capability" ile duser: developer.apple.com -> Identifiers
  -> App ID -> yetkiyi isaretle -> Save; EAS bir sonraki build'de yeni
  profil uretir. APNs anahtari (gondermek) ile App ID kutusu (almak) AYRI.

TUZAKLAR VE YOLLAR - her oturumda gecerli (hikayeleri CHANGELOG'da):

  PUSH VE CI
  - HER PUSH'TAN SONRA CI'A BAK - dokuman push'u dahil:
      curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=5&head_sha=<SHA>"
    Main HIC commit atilmadan da kirilabiliyor: Expo yama yayinlayinca
    expo-doctor kapisi duser. Cozum: cd mobile && npx expo install --fix,
    sonra tsc + lint + npm test + expo-doctor, package.json + lock commit.
  - DOKUMAN COMMIT'I OTOMATIK PUSH EDILIR ve altinda bekleyen kod
    commit'ini de goturur. Dokuman commit'inden once:
      git log --oneline origin/main..HEAD
    Pre-push kancasi ONERILDI VE KULLANICI ISTEMEDI - bir daha onerme.
  - CANLIYA CIKTI MI: gorunur bir metin degistiyse curl yeter (ornegin
    gizlilik sayfasi). Degilse (yalnizca akista gorunen metin, posta)
    Vercel'in GitHub'a yazdigi yayin durumu: deployments?sha=<SHA> ->
    environment "Production" -> statuses -> "success". Yontem sinandi
    (ef501a5: success 21:55:53, metin canlida 21:56:04). Istemci
    paketinde curl ile metin aramak GECERSIZ - eski metin de bulunmuyor.
    Veritabani gocu olan commit'te "success" = goc da gecti
    (vercel-build once "prisma migrate deploy" calistiriyor).
  - ARKA PLAN BILDIRIMINDEKI "exit 0" KOSUNUN KODU OLMAYABILIR (sarmalayan
    betigin ya da son komutun kodu). LOGU OKU - passed/failed satirini.
    Ciktiyi "| tail"e boruyla sokma: kod tail'den gelir. EAS build
    basarisizken de 0 donuyor.

  E2E
  - Tam kosu ~17-23 dk, 74 test (73 + 1 bilerek atlanan 2FA kopru testi).
    KOSU SURERKEN PROJE DOSYALARINA DOKUNMA. Sema degistiyse once
    npm run db:migrate:e2e. Tek seferlik kodlar veritabanindan okunuyor.
  - ONCE MAKINEYI TEMIZLE: 3000'deki dev sunucusu, Metro, simulatorler.
    Yarisip 60 sn sinirini kaybettiriyorlar (bir kosu 42 dk surdu).
  - KOSUYU ORTASINDAN KESME: E2E veritabani yarim kalir, sonraki kurulum
    "kullanici zaten var" (422) diye duser.
  - ILK KOSU SOGUK DERLEMEYLE YARISIR: kaynak degistikten sonraki ilk
    kosuda Turbopack rotalari talep uzerine derliyor. Duserse once
    isindirip tekrarla (npx playwright test e2e/auth.spec.ts). Bir
    degisikligi suclamak icin: git stash push -u -> kos -> pop -> kos;
    yalnizca TEMIZ kosular sayilir, ikiser kez.
  - "The destination stream closed early" tek basina bir sey anlatmaz;
    SAYISI yediye cikarsa bir sey bozuk.
  - getByRole name KUCUK/BUYUK HARF DUYARSIZ ve ALT DIZI ariyor; Turkcede
    "i".toUpperCase() tuzagi var ve baslik kullanicinin yazdigi grup
    adini dugme olarak tasiyor. Turkce etiketlerde exact: true.
  - getByText bir textarea'nin DEGERINI de metin sayar - kanit cizilmis
    satirdan okunmali.
  - https'e bagli davranis (cerez onekleri, Secure) E2E'de GORUNMEZ -
    E2E gelistirme modunda kosuyor. Cerez/protokol isinde yesil E2E delil
    degil.
  - SOZLUK ANAHTARINI SABLON DIZGIYLE YAZMA: messages.test.ts kaynagi
    tariyor, t(`ui.x_${...}`) goremez.
  - E2E KULLANICILARI: "outsider"in hic grubu yok (auth.spec varsayiyor);
    kalici durum birakan test kendi temizligini yapsin (iban.spec gibi).
    E2E sunucusunun kendi CRON_SECRET'i playwright.config.ts webServer.env.

  WEB
  - KIMLIKLI SAYFAYI GORMEK: e2e/ altina GECICI bir spec -> pageAs(browser,
    "owner") -> page.screenshot(). Diyalogda screenshot({ animations:
    "disabled" }) - yoksa kare yari saydam. Koyu tema: page.emulateMedia(
    { colorScheme: "dark" }). Spec'i HER SEFERINDE SIL.
  - NEXT'IN ISTEGI KLONLANMAZ: new Request(request, {...}) uretimde
    patliyor. Parcalarindan kur: new Request(request.url, { method,
    headers, body }). Duz Node'da calismasi kanit DEGIL.
  - NODE 24 fetch'i Sec-Fetch-* gonderiyor -> betikle /api/auth'a istekte
    Origin SART.
  - R2'YE YAZARKEN Content-Length ELLE: Vercel calisma zamani parcali
    aktarimla gonderiyor, R2 411 donuyor. Yerelde 200 donmesi kanit degil.
  - CSP img-src 'self' data: blob: - uzak adresli gorsel yuklenmez.
  - DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).
  - RESEND: bir kez sert seken adres KALICI susturulur, arayuz yine
    "gonderildi" der. Teshis: resend.com/emails -> "Suppressed" mi ->
    suppressions -> Cloudflare Email Routing kurallari.

  MOBIL
  - HER DEGISIKLIKTEN SONRA PAKETI URET: cd mobile && npx expo export
    --platform ios --clear. "--platform ios" SART (react-native-web yok).
    app/ altina test dosyasi KOYMA - uretim paketine giriyor (EAS build
    6'yi dusurdu); ekran testleri test/screens/ altinda.
  - YENI EXPO PAKETINDEN SONRA expo-doctor'i kos ve "peer dependency"
    satirini oku - tsc/lint/test/export'un goremedigi cokmeyi yakaliyor.
  - YEREL RELEASE BUILD (simulator, EAS kotasi harcamadan, ~3 dk):
      export EXPO_PUBLIC_API_BASE_URL=https://owezy.net LANG=en_US.UTF-8
      cd mobile && npx expo prebuild --platform ios --clean --no-install
        (prebuild package.json'daki "ios"/"android" betiklerini degistiriyor
         - GERI AL: "expo start --ios" / "expo start --android")
      (cd ios && pod install)       (LANG olmadan CocoaPods cokuyor)
      xcodebuild -workspace ios/Owezy.xcworkspace -scheme Owezy
        -configuration Release -sdk iphonesimulator
        -destination 'generic/platform=iOS Simulator'
        -derivedDataPath <scratch>/dd CODE_SIGNING_ALLOWED=NO build
    Bu makinede YALNIZCA Xcode 27 var; sahne acik oldugu icin build iOS 27
    ve 26.5 simulatorlerinde aciliyor. Imzasiz build'de UNIVERSAL LINK
    CALISMAZ - owezy:// semasi calisir (simctl openurl).
  - SIMULATORLER: 4FC4379D ve 68DF61C6 BASKA PROJENIN - dokunma. Bizimki
    FCD7F36E (iPhone 17 Pro, iOS 26.5). Ekran: xcrun simctl io <udid>
    screenshot. Koyu tema: xcrun simctl ui <udid> appearance dark.
  - EXPO GO YOLU (JS degisikligini hizli gormek): once kokte npm run dev
    (mobil .env.local localhost:3000'e bakiyor), sonra cd mobile && npx
    expo start --go ve xcrun simctl openurl booted "exp://127.0.0.1:8081".
    Native modul (fis OCR) Expo Go'da CALISMAZ.
  - MOBILDE GIRIS: kimlik bilgisi forma yazilmaz. TEK ISTISNA kullanicinin
    o is icin verdigi izin: yerel build + yerel sunucu + gelistirme
    veritabanindaki TEST hesabi (yukaridaki yol). Production ya da gercek
    hesap ASLA.
  - TEK GRUPLU KULLANICI gruplar listesini hic gormuyor (Redirect) ve GERI
    DUGMESI YOK. Grup ekranindan bir sey kaldirirken "geri dugmesi
    karsilar" denmez.
  - BIR EKRANDAN DONULDUGUNDE O EKRANIN BUTUN SORGULARI TAZELENMELI.
  - HERMES'TE Intl.RelativeTimeFormat YOK (ADR-044). Paylasilan modulden
    gelen her Intl.X mobilde ayrica denenmeli.
  - KOYU TEMA AYRICA DENENMELI - giris ekrani aylarca renklerini elle
    tasidi ve kimse fark etmedi.
  - YESIL SINYALLER URUNUN IYI OLDUGUNU SOYLEMEZ: mobilde bir sey
    degistiginde SIMULATORDE BAK.
  - PUSH'U DOGRULAMA (gercek telefon, ADR-047): TestFlight'tan kur ->
    Bildirimler ekraninda izin ver -> IKINCI BIR HESAPLA ortak gruba
    harcama ekle -> bildirim dusmeli; TUTAR VE ISIM GORUNMEMELI.

  2FA KOPRUSU - DOGRULAMA YOLU (kopru durdukca gecerli, ADR-045):
    1. src/lib/better-auth.ts -> advanced'a: useSecureCookies: true
    2. e2e/two-factor.spec.ts -> ilgili test.skip'i test yap
    3. npx playwright test e2e/two-factor.spec.ts
    4. IKISINI DE GERI AL
  Olculdu (4 Eylul): kopru acikken 200 + set-auth-token, kapaliyken 401.

  TASARIM KAYNAGI (ADR-048): kullanicinin Claude Design projesi
    2f16cec7-532e-466b-8493-4cc5a7792d07 "Owezy mobil ve web tasarimi",
    dosya design_handoff_owezy_kagit_petrol/Owezy Urun Tasarimi.dc.html,
    uygulanan bolum id="5a" (2a/3a/3b/4a reddedilmis). Yanindaki README.md
    spec'in kendisi. Okuma: DesignSync get_file, dogrudan projectId ile
    (list_projects BOS doner).

TESTLER - NE NEREDE (21 Ekim):
  KOK      npm test                  861 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      98 vitest + 145 jest
  E2E      npm run test:e2e           73 + 1 bilerek atlanan, ~17-23 dk
  Mobilde IKI KOSUCU, sinir dizine gore (ADR-042, ADR-043):
    lib/** -> vitest · components/**, test/screens/** -> jest.
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.
