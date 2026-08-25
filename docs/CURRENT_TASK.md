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

Updated: 2026-08-25 (9)

Current task:
  FAZ 25 - CLERK'TEN BETTER AUTH'A GEC. Karar kullanicinin: 2FA Clerk'te bir
  PRO ozelligi ($25/ay) ve uygulamanin henuz kullanicisi/geliri yok. Ama asil
  soru "2FA nereden" degil, "kimlik dogrulamayi kim sahiplenecek" idi.
  Yayindan ONCE yapiliyor cunku production'da SIFIR kullanici var; sonra
  yapmak herkese parola sifirlatmak demek (Clerk parola hash'i disari vermiyor).

  ADIMLAR (her biri kendi basina dogrulanabilir; CLERK 25.7'YE KADAR AYAKTA):
    25.1  Sema ve iskelet                    BITTI  aa6f6cb
    25.2  Resend + sendVerificationOTP       BITTI  (commit bekliyor)
    25.3  Sunucu kimligi (auth.ts, /api/v1)
    25.4  Web arayuzleri (giris/kayit/hesap)
    25.5  Mobil (bearer + ekranlar)
    25.6  2FA (TOTP + yedek kod + trustDevice)
    25.7  Clerk'in sokulmesi
    25.8  E2E yeniden kurulur

  25.1'DE NE YAPILDI:
    - better-auth 1.7.1 kuruldu. Peer'ler olculdu, hepsi uyumlu:
      next ^16, prisma ^7, react ^19, vitest ^4.
    - src/lib/better-auth.ts: Prisma adaptoru + emailOTP + bearer.
    - BIZIM User TABLOMUZ DEVRALINDI (modelName + fields). Bu gocun en buyuk
      kazanci: Expense/Settlement/GroupMember/Notification'in tamami
      User.id'ye bagli ve HICBIRI TASINMIYOR.
    - Yeni tablolar: Session, Account, Verification.
    - User: clerkId NULLABLE oldu, email UNIQUE oldu, emailVerified eklendi.
    - /api/auth/[...all] route handler.
    - DOGRULANDI (derleme degil, CALISMA): get-session 200 + null,
      send-verification-otp 200 + {"success":true}, uretilen kod sunucu
      loguna dustu, Verification satiri uuid id ile veritabanina yazildi.

  25.2'DE NE YAPILDI:
    - resend 6.22.1 kuruldu. src/lib/email.ts: sendOtpEmail().
    - Metinler sozlukte (email.otp_*), iki dilde. ADR-020 garantisi burada
      da gecerli olmali - kullanicinin gordugu EN KRITIK metin bu, cunku
      giremezse uygulamayi hic gormuyor.
    - KOD KONUYA YAZILMIYOR. Cogu servis yaziyor (kilit ekrani bildiriminde
      gorunsun diye). Tam o yuzden yazmiyoruz: telefona yandan bakan biri
      giris kodunu okuyabilir.
    - DUZ METIN SURUMU DE gonderiliyor: yalnizca HTML tasiyan postalar spam
      puani aliyor ve giris kodunun spam'e dusmesi = kullanici hic giremiyor.
    - Dil, ISTEGIN CEREZINDEN okunuyor. Hesap tercihi BILEREK okunmuyor:
      kod, kimligi henuz kanitlanmamis birine gidiyor; "bu adresin hesap dili
      ne" diye sormak, adresin kayitli olup olmadigini sizdirmanin yolu olurdu.
    - GONDERIM BEKLENMIYOR ve after() ile yapiliyor. Iki sebep birden:
      (1) beklemek zamanlama sizintisi yaratiyor - kayitli/kayitsiz adres
      arasindaki sure farki olculebilir hale geliyor; (2) sadece "await etme"
      Vercel'de yetmiyor, yanit donunce islem olebilir ve posta hic gitmez.
      after() ikisini birden cozuyor.

    DOGRULANDI - UCTAN UCA, GERCEK POSTA KUTUSU:
      destek@owezy.net'e gonderildi, GELEN KUTUSUNA dustu (spam'e degil),
      gonderen "Owezy <noreply@owezy.net>". Yani Resend + SPF + DKIM +
      DMARC + Cloudflare Email Routing zincirinin tamami calisiyor.

  25.2'DE CIKAN SURPRIZ - CSRF KORUMASI:
    BETTER_AUTH_URL tanimlaninca Better Auth ORIGIN kontrolu yapmaya basladi:
    basliksiz istek 403 MISSING_OR_NULL_ORIGIN doniyor. Bu iyi bir sey.
    AMA 25.5'TE SORUN OLACAK: mobil istemci Origin basligi gondermiyor.
    Cozum betterAuth({ trustedOrigins: [...] }) - sirasi gelince.

  25.1'DE OLCULEN IKI SEY - BELGELER YANILDI:
    1. "Better Auth varsayilan olarak UUID uretir" YANLIS. Gercek uretici
       createRandomStringGenerator("a-z","0-9","A-Z","-_") - nanoid tarzi
       metin. Sutunlari @db.Uuid yazip buna guvenseydik ilk INSERT patlardi.
       Cozum: advanced.database.generateId = "uuid" + sutunlarda
       @default(uuid()). Postgres'te "uuid" demek "id'yi ben gondermem,
       sutun doldursun" demek - tip tanimi boyle yaziyor.
    2. "prisma migrate diff" ciktisi OLDUGU GIBI ALINAMAZ. Her seferinde
       fazladan su satiri uretiyor:
           ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
       descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024);
       Prisma semasi uretilmis kolonu ifade edemedigi icin farki "default
       kaldirilmali" saniyor. BUNDAN SONRAKI MIGRATION'LARDA DA ATILMALI.

  BEKLEYEN - KULLANICI YAPACAK:
    1. .env.local'a iki degisken (BEN YAZAMAM):
         BETTER_AUTH_SECRET=<openssl rand -base64 32 ciktisi>
         BETTER_AUTH_URL=http://localhost:3000
       Ikincisi olmadan Better Auth her istekte "Base URL is not set" uyarisi
       basiyor ve origin'i istekten cikariyor.
    2. E2E veritabanindaki UC OKSUZ kullanici satirinin silinmesi. Silme
       komutu izin katmaninda ENGELLENDI; kullanici kendi calistiracak.
       Yedegi: scratchpad/e2e-orphan-users-backup.json
       Silinmeden E2E veritabanina migration UYGULANAMAZ (email UNIQUE duser).
    3. Resend: hesap + domain dogrulamasi YAPILDI (DNS kontrol edildi).
       RESEND_API_KEY .env.local'a yazilacak (25.2'de gerekecek).

  DNS DURUMU (25 Agustos, dig ile dogrulandi):
    Email Routing (kok MX)   : route1/2/3.mx.cloudflare.net    ACIK
    Resend bounce (MX)       : feedback-smtp.ap-northeast-1.amazonses.com
    Resend SPF               : send.owezy.net -> include:amazonses.com
    Resend DKIM              : resend._domainkey.owezy.net     GECERLI
    DMARC                    : p=reject; adkim=s; ASPF=S

    ASPF=S RISKLI VE KULLANICIYA SOYLENDI: Resend zarfi send.owezy.net'ten
    yolluyor, From ise owezy.net olacak - strict hizalamada SPF HER ZAMAN
    dusecek. Posta yine gidiyor cunku DMARC "SPF ya da DKIM" diyor ve DKIM
    hizaliyor. Ama tek bacak uzerindeyiz ve p=reject yuzunden bir DKIM
    aksamasi = kimse giris yapamiyor. ONERI: aspf=s -> aspf=r.

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

    BITTI (devami):
      - App Review Information -> Contact Information telefonu girildi
        (o telefon KULLANICININ, demo hesabin degil; hicbir yerde
        yayinlanmiyor, yalnizca App Review ekibi goruyor)

    ACIK:
      - destek@owezy.net kutusu ACILMADI (Cloudflare Email Routing).
        Adres hem /privacy hem /support sayfasinda YAZILI; kutu yoksa
        yazan adres calismiyor demektir.
      - Ornek veri: kullanici "birkac harcama ve odeme ekledim" dedi;
        GOZLE DOGRULANMADI (production'a girmek parola girmek demek, o
        yapilmiyor). Kullanici kendisi kontrol edecek.

  EXPORT COMPLIANCE: BITTI.
    app.json -> ios.infoPlist.ITSAppUsesNonExemptEncryption = false
    Yalnizca HTTPS kullandigimiz icin dogru deger bu; boylece her yuklemede
    sifreleme sorusu SORULMUYOR. Cozumlenmis prebuild yapilandirmasindan
    dogrulandi: deger BOOLEAN false (string "false" olsaydi Apple kabul
    etmezdi).
    NOT: ios/ klasoru repoda YOK (managed workflow); Info.plist derleme
    aninda app.json'dan uretiliyor. Dogru yer burasi.

Hemen sonraki adim:
  YOK - KULLANICIDAN GOREV BEKLENIYOR.

  ONERILEN SIRADAKI IS (kullanici daha once onaylamisti, sirasi geldi):
  GUVENLIK BASLIKLARI + HIZ SINIRI.
    - next.config.ts'te HIC guvenlik basligi yok: Strict-Transport-Security,
      X-Content-Type-Options, CSP.
    - /api/v1 icin hiz siniri HIC yok.
    Gizlilik politikasindaki "makul teknik tedbirler" cumlesini gercek
    yapan is bu - ve MFA'nin aksine UCRETSIZ.

2FA - NEREDE DURUYOR (Faz 24 bitti):
  KOD HAZIR VE SIMULATORDE DOGRULANDI. Mobil giris ekrani ikinci faktoru
  yurutuyor: TOTP, e-posta kodu, yedek kod. SMS dali BILEREK YOK.

  PANEL DURUMU:
    development : authenticator_app + backup_code ACIK, ISTEGE BAGLI
                  (second_factors: ["backup_code","totp"])
    production  : KAPALI. Clerk'te MFA bir PRO ozelligi - $25/ay
                  ($20/ay yillik). Kullanici acmama karari verdi:
                  uygulamanin henuz kullanicisi ve geliri yok.
    Acmak istendiginde: panelden iki anahtar, KOD DEGISIKLIGI GEREKMIYOR.

  DEV TEST KULLANICISI: mfa+clerk_test@example.com
    Ilk faktor e-posta kodu 424242 (gercek posta kutusu yok).
    TOTP gizli anahtari ve yedek kodlar REPOYA YAZILMADI; oturumun
    scratchpad'inde. Kaybolursa panelden 2FA kaldirilip yeniden kurulur.

  SINANMADI: needs_client_trust (Device Trust) dali. O durum PAROLAYLA
  giriste tetikleniyor; parola forma yazilmadigi icin denenemedi. Kod yolu
  ayni metotlari kullaniyor (mfa.*) ama bu bir CIKARIM, olcum degil.

DEVICE TRUST - DEMO HESAP ICIN MUAFIYET HALA GEREKLI:
  DIKKAT: bu dosyada bir ara "ikinci faktor isi bypass_client_trust'a
  bagimliligi azaltiyor" yaziyordu. YANLISTI ve duzeltildi.
  Device Trust ekraninin istedigi sey E-POSTA KODU; App Review
  inceleyicisinin demo hesabin posta kutusuna erisimi YOK. Yani ikinci
  faktor ekrani o hesabi KURTARMIYOR - yalnizca olu ekrani konusan bir
  ekrana ceviriyor (gercek kullanicilar icin degerli, inceleyici icin
  degil).

  MUAFIYET DURUYOR ve HER GONDERIMDEN ONCE DOGRULANMALI:
    1. GET https://api.clerk.com/v1/users/user_3IPH520z2gWytNtqkHrg1xP1kYP
       -> bypass_client_trust hala true mu
    2. GIZLI PENCEREDE owezy.net'e demo bilgileriyle gir. Gizli pencere
       Clerk icin YENI ISTEMCI demek, yani Device Trust'i tetikleyecek kosul.
       Kod istenmeden giriyorsan muafiyet calisiyor.
  Bozulursa yedek plan: Protect -> Rules -> Device Trust -> Enable kapat.

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
  - IKINCI FAKTOR ARTIK ELE ALINIYOR (Faz 24). Geriye yalnizca
    DESTEKLENMEYEN yollar web'e yonlendiriliyor: SMS ikinci faktoru ve
    needs_new_password gibi tamamlanmamis durumlar.
  - CIKIS HATASI BULUNDU VE DUZELTILDI (Faz 24). Iki sebep birden vardi:
    token-cache clearToken'i uygulamiyordu (belirtec Keychain'de kaliyordu)
    ve "/" disinda hicbir ekranin oturum korumasi yoktu. Ders yine ayni:
    mobilde bir yolu DENEMEDIYSEN o yol calismiyor olabilir.

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
  - "expo start --ios" ACTIGI Simulator.app kapaninca CIHAZI DA DUSURUYOR
    ve ekran goruntusu araci son kareyi doner - yani calisiyormus gibi
    gorunur. GUVENILIR YOL: once "xcrun simctl boot <udid>" (bassiz),
    sonra "npx expo start" (--ios YOK), sonra uygulamayi
    "open_url exp://127.0.0.1:8081" ile ac.
  - OTURUMU SIFIRLAMAK: Expo Go'yu kaldirip yeniden kurmak yetiyor.
      xcrun simctl uninstall <udid> host.exp.Exponent
      xcrun simctl install <udid> ~/.expo/ios-simulator-app-cache/Expo-Go-*.app
    Indirmeye gerek yok, onbellekte duruyor.
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
