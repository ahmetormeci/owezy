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

Updated: 2026-10-04

Current task:
  1.0.6 (BUILD 25) APP STORE CONNECT'E YUKLENDI (4 Ekim) - KULLANICININ
  TESTFLIGHT KONTROLU BEKLENIYOR, SONRA INCELEMEYE GONDERIM (kullanici).
    EAS build fd32d5ed, commit 9451131, 6 dk. Build kaydinda olculdu:
    "Xcode 26.6 (17F113)", VM "macos-tahoe-26.5-xcode-26.6".
    Submit e15d2104 "finished" (bir dakikadan kisa; 1.0.5'teki 55 dk Expo
    kesintisiydi). Apple isliyor - TestFlight'ta 10-30 dk icinde gorunur.
    Build numarasi 25: 23 ve 24, 27 Eylul'de kota dolunca reddedilen
    denemelerde harcandi - sorun degil, numara yalnizca artmali.
  Build'den once Expo'nun 29 Eylul yamalari alindi (9451131): expo
  57.0.26, expo-constants 57.0.20, expo-router 57.0.24 - ucu de "kullaniciya
  gorunen degisiklik yok"; expo'nun ios/build/src klasorleri 57.0.25 ile
  BIREBIR AYNI (sahne olcumleri gecerli). CI yesil.
  EXPO'DA YENI: EAS'ta Xcode 27.0 ve 27.1 imajlari VAR; SDK 58.0.x
  yayinda ama "latest" hala 57. Sabitleme 1.0.6'da bilerek duruyor
  (ADR-058) - kaldirmak SDK 58 isinin parcasi.

  FAZ 52b - IBAN MOBIL: KOD HAZIR, "iban-mobil" DALINDA, COMMIT ONAYI
  BEKLIYOR. 1.0.6'da duzeltme gerekirse diye main temiz: dal 1.0.6
  onaylaninca main'e alinir (merge), 1.0.7 ondan sonra.
    Hesap ekrani IBAN bolumu, bakiye kartinda kopyalama + "IBAN ekle"
    ipucu, odeme ekraninda alicinin IBAN'i; expo-clipboard (yeni native).
    Testler: iban.test.tsx 14 (negatif kontrol 4 dusurdu), mobil 98 + 134,
    tsc, lint, expo-doctor 21/21, expo export temiz.
    SIMULATORDE GORULMEDI - uc ekran da giris istiyor (ajan giris kodu
    yazmiyor). Gorsel kontrol: kullanici simulatorde girerse ya da 1.0.7
    TestFlight'ta.
  DIKKAT - DAL VARKEN DOKUMAN COMMIT'I: main'deki dokuman degisikligi
  main'de, 52b dokumanlari dalda. Merge'te docs/ catisabilir - elle birlestir.

>>> 1.0.6 - BUILD ALINDI (4 Ekim), KALAN ADIMLAR <<<
  (Hatirlatma gorevi 1 Ekim'de uygulama kapali oldugu icin 4 Ekim'de
  calisti.) Build icin kullanilan yol, bir sonraki surumde de aynisi:
    eas build --platform ios --profile production --non-interactive --no-wait
    -> build log'undan Xcode 26.6 (17F113) oldugunu DOGRULA (eas.json'da
       image sabit - ADR-058).
    -> submit ISTENIRSE eas submit (1.0.5'te ~55 dk surdu, normaldi).
       eas submit YALNIZCA App Store Connect'e YUKLER -> TestFlight'ta
       gorunur. INCELEMEYE GONDERME ayri adim: kullanici panelde,
       TestFlight kontrolunden SONRA.
  Surum app.json'da ZATEN 1.0.6. Surum notu iki dilde STORE.md.
  1.0.6'da: misafir (50a) + sahiplenme (50b) + degerlendirme istegi (49)
  + buyuk yazida dugme kirpilmasi + sahne yasam dongusu (51) + davet
  ekraninda Turkce karakterler + kod ekraninda "spam klasorune bak" (53).
  >>> INCELEMEYE GONDERMEDEN ONCE TESTFLIGHT - SART (Faz 51) <<<
    Telefonda: (1) aciliyor mu, (2) uygulama KAPALIYKEN davet linkine
    dokununca davet ekrani geliyor mu, (3) bildirime dokununca grup
    aciliyor mu. Simulatorde olculemeyen tam bu uc.
  GONDERIMDE KULLANICI: App Privacy anketi (misafir ADLARI - kategoriyi
  panelde sec, tahmin etme) + appreview@ parola kontrolu.

ACIK KALANLAR - KULLANICIDAN CEVAP YA DA KARAR BEKLEYENLER:
  1. TEKRARLAYAN HARCAMA canlida gercekten uretim yaptigi HIC GORULMEDI.
     CRON_SECRET TANIMLI VE DOGRULANDI (10 Eylul: Vercel -> Cron Jobs ->
     Run -> 200) - soru o DEGIL. Eksik olan gercek bir sablonun
     uretmesini gormek. Iki dakikalik yol: web'de "Bunu tekrarla" ile
     baslangici BUGUN olan bir harcama kur -> Vercel -> Cron Jobs -> Run
     -> harcama dusmeli. Kosu ozeti Runtime Logs'ta "[cron/recurring]".
  2. BES ULKEDE (us/ca/gb/au/nz) ARAMADA YOK. Apple'a bildirim
     (developer.apple.com/contact -> Distribution) gonderildi mi
     BILINMIYOR. 1.0.6 yayina cikinca yeniden olc - gercek arama sayfasiyla:
     apps.apple.com/<cc>/iphone/search?term=owezy (iTunes Search API
     gercek aramayi YANSITMIYOR). Uygulama YALNIZCA iPhone icin
     (supportsTablet: false) - iPad'de ya da Mac'te aramada zaten CIKMAZ;
     sikayet gelirse once cihazi sor.
  3. YORUM E2E TESTI 60 sn butcenin sinirinda (43-46 sn). test.slow()
     onerildi - KULLANICI KARARI.
  4. 2FA KOPRUSU (ADR-045): mobil 1.0 icin gecici sunucu yamasi. 1.0'da
     kimse kalmadiysa kaldirilir - kullanici App Store Connect ->
     Analytics'te surume gore oturumlara bakacak. Dogrulama yolu asagida.
  5. DMARC RAPORLARI (Cloudflare -> Email -> DMARC Management) birkac gun
     icinde dolacak: junk sorununu hangi servis cikariyor (ADR-060).
  6. SDK 58: kararli cikinca ayri is (ADR-058). Son tarih NISAN 2027
     (Apple, iOS 27 SDK). Xcode 27'ye gecilen gun uygulama yeniden
     boyutlandirilabilir oluyor - duzen farkli genisliklerde denenmeli.

DIS DUNYA - 27 EYLUL OLCUMU:
  DMARC    v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r;
           rua=mailto:...@dmarc-reports.cloudflare.net   (Cloudflare raporlari)
  CANLI    / , /support , /privacy , /.well-known/apple-app-site-association -> 200
           Apple CDN AASA -> 200
  MAGAZA   1.0.5 | 2026-09-26 | puan 0   (us ve tr)
  CI       da03c4c success
  ENV      15 ad: DATABASE_URL, E2E_DATABASE_URL, E2E_USER_1..3_EMAIL/PASSWORD,
           RESEND_API_KEY, BETTER_AUTH_SECRET/URL, R2_ACCOUNT_ID,
           R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
  PANEL    olculemez: Resend takibi KAPALI, Cloudflare DMARC ACIK - kullanici
           27 Eylul'de yapti ve DMARC'taki rua bunu dogruluyor.

CANLIDA OLAN (web) - MOBIL KARSILIGI 1.0.6'DA:
  Faz 49 degerlendirme istegi (yalnizca mobil) · Faz 50a/50b misafir ·
  Faz 51 sahne (yalnizca mobil) · Faz 53 posta. Faz 52a IBAN web'de
  canli (ef501a5); mobili 52b / 1.0.7.

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
     Videos (fis, profil). 1.0.6'da misafir ADLARI, 1.0.7'de Financial
     Info -> Other Financial Info (IBAN) eklenecek.
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
  - Tam kosu ~17 dk, 73 test (72 + 1 bilerek atlanan 2FA kopru testi).
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
  - MOBILDE GIRISI AJAN YAPAMAZ: iki yol da kimlik bilgisi istiyor
    (parola ya da tek seferlik kod) ve forma yazmak yasak. Kullanici bir
    kez girmeli. Metin yazdirmak karakter dusurebiliyor - kisa parcalar,
    her adimda ekran goruntusu.
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

TESTLER - NE NEREDE (27 Eylul):
  KOK      npm test                  857 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      98 vitest + 120 jest
  E2E      npm run test:e2e           72 + 1 bilerek atlanan, ~17 dk
  Mobilde IKI KOSUCU, sinir dizine gore (ADR-042, ADR-043):
    lib/** -> vitest · components/**, test/screens/** -> jest.
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.
