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

Updated: 2026-11-14

Current task:
  BIRDEN FAZLA ODEYEN (ADR-067). Tasarim: artifact
  https://claude.ai/artifact/P2N43hMBXgegW1zD9wcSxZ . Kullanici dort
  soruya da onerileni secti (S1 ayri ExpensePayer tablosu + paidById "ana
  odeyen" aynasi; S2 form yonu C, ilk satir kalani alir; S3 sablonlar tek
  odeyenli; S4 eski govde cok odeyenliyi guncelleyemez -> 409
  expense.multiple_payers). Ayrinti ADR-067, Faz 55a ve 55b.

  IKI KOD COMMIT'I PUSH EDILDI (14 Kasim, kullanicinin istegiyle):
    d41febe  sunucu + web (Faz 55a). Gocu 20261113195333_add_expense_payer
             production'da Vercel derlemesinde calisti.
    fcce126  mobil (Faz 55b)
    CI 43589944108 success (tek not: Ubuntu 26). Production deploy
    7786866336 success 2026-11-14T11:26:09Z. Canli: /support 200, /sign-in
    200, /api/v1/me oturumsuz 401.
    Dogrulama: kok 904 vitest, tam E2E 74/74 (21 dk); mobil 129 vitest +
    170 jest. Negatif kontroller ve simulator senaryolari ADR-067 sonunda.
    Simulatorde yaratilan test verisi: gelistirme veritabaninda "Coklu
    odeyen testi" grubu (cb484ede; iban-test-b + iban-test-c + misafir
    "Deniz", uc harcama). Zararsiz.
  SONRAKI ADIM: mobil telefonlara YENI iOS BUILD ile cikar - BUILD ALMADAN
  ONCE SOR (EAS kotasi). O build'in TestFlight'inda: iki odeyenli harcama
  ekle/duzenle, liste rengi, ASAGI CEKIP YENILEME ve geri donunce tazeleme
  (ADR-066), fis ve profil fotografi (Expo yamalari).
  1.0.7 (magazada) cok odeyenli harcamayi yalnizca ana odeyenin adiyla
  gosterir (bakiyeler dogru) ve duzenlemeye calisirsa ham kod
  "expense.multiple_payers" gorur - bilinen ve kabul edilen bedel.

  ONCEKI: IKI KOD COMMIT'I PUSH EDILDI (13 Kasim, kullanicinin istegiyle) - CI
  43492010771 success, Production 2026-11-13 19:26:00Z success. CI'daki
  Expo yamasi uyarisi KALKTI (kalan tek uyari Ubuntu 26 notu).
    a3d76a8  mobilde liste tazeleme (ADR-066, asagida)
    ea9d384  bes Expo SDK 57 yamasi (expo 57.0.33, expo-constants,
             expo-linking, expo-router, expo-sharing). Beraberinde gelen
             expo-modules-core 57.0.26 iOS'ta derleme yolunu degistiriyor
             (hazir xcframework yerine her zaman kaynaktan) -> simulatorde
             Release build: acilis, giris, 18 karakter tek seferde, gezinme,
             disa aktar (paylasim penceresi), asagi cekme. CHANGELOG 13 Kasim.
  SONRAKI ADIM: telefonlara cikmasi YENI iOS BUILD ister - BUILD ALMADAN
  ONCE SOR (EAS kotasi). Bu build'in TestFlight'inda ek olarak:
  ASAGI CEKIP YENILEME ve uygulamaya geri donunce liste tazeleniyor mu.

  ADR-066 (8 Kasim): Kullanici tasarim sorularina "a, a, a" dedi. Arka
  plandan donunce ve acikken bildirim gelince gorunen ekran tazeleniyor;
  gruplar/grup/bildirimler/odesme/uyeler ekranlarinda asagi cekip
  yenileme var; basarisiz tazeleme listeyi silmiyor (RefreshNotice);
  grup ekraninda aylar yerinde tazeleniyor. Form ekranlari bilerek disarida.
  Dosyalar: mobile/lib/{refresh-signal,screen-refresh,use-api}.ts,
  mobile/components/{refresh-notice,recurring-list}.tsx, app/_layout.tsx,
  lib/unread.tsx, bes ekran, src/lib/messages.ts (ui.refresh_failed - tek
  sunucu degisikligi). Yeni testler: lib/refresh-signal.test.ts,
  lib/use-api.test.tsx, test/screens/{foreground,group}-refresh.test.tsx.
  Dogrulama: mobil tsc + lint, 114 vitest + 154 jest; kok tsc + lint,
  851 birim - HEPSI GECTI. E2E kosulmadi: web akisinda degisen yok (yalnizca
  sozluk satiri). Simulatorde bes senaryo sunucu gunlugunden olculdu
  (ADR-066 sonu).

  ONCEKI (7 Kasim, hepsi YAYINDA): 563c336 (2FA cerez koprusu kaldirildi,
  ADR-045 eki), 0558fe0 (Bearer yalnizca imzali, ADR-065), 9e9c7a2 (tek
  seferlik kodlar sifreli, ADR-064), 396460e (harcama formu
  router.refresh). Ayrinti CHANGELOG.
  UBUNTU 26 (GitHub notu, dokunulmadi): ubuntu-latest 19 Ekim'den beri
    kademeli olarak Ubuntu 26'ya geciyor (actions/runner-images#14748).
    Adimlar kendi Node'unu kuruyor ve yalnizca npm kullaniyor - risk dusuk.
    Kosu bir gun bu yuzden duserse tek satirlik cikis: runs-on: ubuntu-24.04.

  1.0.7 YAYINDA (lookup 6 Kasim: us/tr 1.0.7, 2026-11-05T06:09Z). Build
  28: EAS 73244045, commit 6910d2f, Xcode 26.6 (17F113). Icerik: Faz 54
  (ADR-061, ADR-052 eki) + 21 Ekim'deki 9 Expo yamasi.
  SIRADAKI SURUMDE DENENECEK: 6 Kasim Expo yamalarinda expo-image-picker
  ve expo-image-manipulator da vardi (NATIVE). Fotograf secme/isleme
  simulatorde DENENMEDI (giris gerektiriyor) - bir sonraki surumun
  TestFlight'inda fis ve profil fotografi denenmeli.

  EXPO - 13 KASIM OLCUMU:
    - npm dist-tags: latest 58.0.25, sdk-57 57.0.33 - SDK 57'nin en yenisi
      13 Kasim'da alindi. 21 Ekim'de EAS'ta Xcode 27.0 ve 27.1 imajlari
      vardi. Sabitleme (Xcode 26.6) bilerek duruyor (ADR-058) - kaldirmak
      SDK 58 isinin parcasi.

  SIMULATORDE GIRISLI KONTROL - NASIL YAPILIR (5, 21 Ekim ve 8 Kasim):
    Kullanici izin verdi: yerel build'de, yerel gelistirme sunucusuna bagli
    bir TEST hesabiyla giris. Production'a dokunulmadi.
    - Build: YEREL RELEASE BUILD yolu (MOBIL bolumu), ama
      EXPO_PUBLIC_API_BASE_URL=http://localhost:3000. Paket Hermes bytecode;
      adresi dogrulamak icin uretilen main.jsbundle'da strings | grep
      localhost:3000.
    - Sunucu: RESEND_API_KEY="" npm run dev  (kod e-postasi GITMEZ)
    - Kod: gelistirme veritabani Verification "sign-in-otp-<email>".
      7 Kasim'dan beri SIFRELI (ADR-064): readOtpFromDatabase'in yaptigi
      gibi better-auth/crypto symmetricDecrypt + BETTER_AUTH_SECRET.
      Betik proje DISINDA (scratchpad) duruyorsa "Cannot find module
      better-auth/crypto" verir: createRequire("<proje>/package.json")
      .resolve("better-auth/crypto") ile cozup dinamik import et.
      SCRATCHPAD /tmp ALTINDA - gunler sonra SILINMIS olabilir (13 Kasim'da
      8 Kasim'in betikleri gitmisti); betigi yeniden yaz, var sayma.
    - Tazeleme olcumu (ADR-066): sunucu gunlugunu dosyaya yaz, islemden
      once satir sayisini al, sonra tail -n +<sayi+1>. Denetim Merkezi:
      sag ust koseden asagi kaydir. ASAGI CEKMEYI YAVAS YAP: Xcode 27.2
      derlemesinde ~300 nokta / ~400 ms'lik hizli touch_path tetiklemiyor,
      10 noktalik 100'er ms araliklari + 600 ms bekleme tetikliyor. Yamasiz
      surum de AYNI davrandi (13 Kasim, ayni Xcode ile karsilastirildi) -
      uygulamanin degil, simulator/SDK'nin farki. Bildirim perdesi iOS 27'de uygulamayi
      ARKA PLANA atiyor (tazeleme olur - dogru). Acikken bildirim:
      xcrun simctl push <udid> net.owezy.app <json>. Uygulamanin bildirim
      izni yoksa simctl "UNErrorDomain 2003 ... not authorized" der AMA
      bildirim uygulamaya YINE teslim ediliyor - kanit simulatorun
      gunlugunde: xcrun simctl spawn <udid> log show --last 2m
      --predicate 'subsystem == "com.apple.UserNotifications"' ->
      "willPresentNotification delivery succeeded".
    - iOS Simulator araci TAM UDID istiyor (28E27032-334C-4D36-9D0A-
      F161F93703FB); kisa onek "No simulator" der.
    - Test verisi: uygulamanin KENDI servis fonksiyonlariyla (createGroup,
      createGroupInvite + acceptGroupInvite, createExpense) - tsx ile
      --env-file=.env.local --tsconfig tsconfig.json, NODE_OPTIONS
      --conditions=react-server
      createExpense'e govdeyi expenseBodySchema.parse(...)'tan GECIREREK
      ver: servis dogrulanmis girdi bekliyor (tarih Date olmali); ham
      "2026-11-12" Prisma'da "premature end of input" verir.
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
      "open -a Simulator" bu makinede (Xcode 27.1; 13 Kasim'da 27.2) uygulamayi bulamiyor;
      panel icin aracin attach'i yetiyor.
      Aracin "detach"i device verilse bile TUM akislari kapatiyor (14
      Kasim'da 68DF61C6'nin paneli de kapandi; cihaz kendisi calismaya
      devam etti). Baska projenin simulatoru acikken detach CAGIRMA;
      kendi cihazini xcrun simctl shutdown <TAM UDID> ile kapat.
    - Imzasiz build'de Keychain kalici degil: uygulamayi YENIDEN BASLATMA
      ya da yeniden KURMA oturumu dusurur - giris tekrar gerekir.
    GELISTIRME VERITABANINDA KALAN TEST VERISI: iban@ / iba@ / iban-te@ /
    iban-test-b@ / iban-test-c@owezy.test ve "IBAN testi: ..." gruplari.
    8 Kasim: "IBAN testi: odeyecegim" grubuna (572f02b4) uc harcama
    eklendi - "Kira (otomatik)", "Su faturasi (cekme testi)", "Internet
    (bildirim testi)". Zararsiz, istenirse silinebilir.

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
  1. (KAPANDI 7 Kasim) TEKRARLAYAN HARCAMA canlida URETTI: kullanici
     sablon kurdu, Vercel -> Cron Jobs -> Run, harcama dustu. Mobilde
     listeye "3-5 dk sonra" dustu - sebep cron DEGIL: ilk donem cron
     kosunca HEMEN yaziliyor (recurring.ts createRecurringExpense), mobil
     grup ekrani ise yalnizca uygulama ICINDE ekrana donulunce tazeleniyor
     (useFocusEffect); uygulamaya geri gelince ya da asagi cekince
     tazelenmiyordu. 8 Kasim'da kodda duzeltildi (ADR-066, Current task) -
     yeni iOS build'iyle magazaya cikar.
  2. (KAPANDI 7 Kasim) 2FA KOPRUSU kaldirildi (ADR-045 eki). Yol, benzer
     sorular icin: App Store Connect Analytics kucuk uygulamada surume gore
     sayamiyor; production'da Neon SQL Editor'de sayilir (kullanici yapar)
     ve Session.userAgent cihazi soyler - iOS'ta "Owezy/<build>
     CFNetwork/...", 1.0 = build 9, 1.0.7 = build 28.
  3. DMARC RAPORLARI - 4 KASIM'DA BAKILDI (Cloudflare -> Email -> DMARC
     Management, son 7 gun): tek kayit, 3 Kasim. Kaynak Microsoft
     20.110.252.109 (Azure, Virginia, ters DNS YOK - Outlook'un kendi
     posta sunucusu degil), envelope from "<>", SPF ve DKIM fail,
     raporlayan Outlook.com. BIZIM DEGIL: bizim postalarimiz yalnizca
     Amazon SES'ten (send.owezy.net) cikiyor. Buyuk olasilikla sahte posta
     denemesi; p=reject isini yapti. 7 gunde bizim postamiz HIC
     gorunmedi (az posta; oturum acik kalan kullaniciya kod gitmiyor).
     7 Kasim: aralik 30 gune cekildi, YINE TEK KAYIT. Rapor yalnizca
     postamizi alan VE rapor gonderen saglayicidan gelir (Gmail, Outlook
     evet; iCloud hayir) - az posta, rapor yok. Daha hizli yol: owezy.net'te
     e-posta koduyla giris iste (2FA acik olsa da kod GIDER, engel kod
     girilince), Gmail'de postayi ac -> sag ustteki uc nokta -> "Orijinali
     goster": SPF, DKIM, DMARC uclu PASS ise madde kapanir.
     KAPANDI (7 Kasim): kullanicinin kutusu Microsoft (Mac Mail'de),
     Authentication-Results mx.microsoft.com: spf=pass
     (smtp.mailfrom=send.owezy.net), dkim=pass header.d=owezy.net VE
     header.d=amazonses.com, dmarc=pass, compauth=pass reason=100. KIMLIK
     DOGRU. Posta YINE Junk'ta; Mac Mail'in "gereksiz" seridi yok -> postayi
     Microsoft'un sunucusu tasidi. Sebep kimlik degil, Microsoft'un spam
     suzgeci (itibar/icerik). Nedeni ayni postadaki X-Forefront-Antispam-
     Report (SCL, SFV, CAT) ve X-Microsoft-Antispam (BCL) satirlari soyler.
     Mac Mail'de basliklar: Goruntu -> Ileti -> Tum Basliklar (shift-cmd-H).
     DMARC RAPORU JUNK'A DUSMEYI GOSTERMEZ - yalnizca kimlik kontrolunu.
     Ekrandaki "SPF policy: Fail" kokteki "v=spf1 -all" (kokten kimse
     gondermiyor - ayar, hata degil); "BIMI: No/Fail" bilerek kurulmadi
     (ADR-060).
  4. SDK 58: artik "latest" (4 Kasim). Ayri is (ADR-058). Son tarih
     NISAN 2027 (Apple, iOS 27 SDK). Xcode 27'ye gecilen gun uygulama
     yeniden boyutlandirilabilir oluyor - duzen farkli genisliklerde
     denenmeli.

DIS DUNYA - 13 KASIM OLCUMU (8 Kasim'dakiyle ayni):
  DMARC    v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r;
           rua=mailto:...@dmarc-reports.cloudflare.net   (Cloudflare raporlari)
  CANLI    / , /support , /privacy , /.well-known/apple-app-site-association -> 200
           Apple CDN AASA -> 200
  MAGAZA   1.0.7 | 2026-11-05 | (us ve tr)
  CI       ea9d384 success (kosu 43492010771, 13 Kasim) - onceki
           972dc84, fb59f28 de success
  YAYIN    ea9d384 Production success 2026-11-13 19:26:00Z - dokuman commit'leri de
           production'a yayinlaniyor (her commit'in Production kaydi var)
  ENV      15 ad: DATABASE_URL, E2E_DATABASE_URL, E2E_USER_1..3_EMAIL/PASSWORD,
           RESEND_API_KEY, BETTER_AUTH_SECRET/URL, R2_ACCOUNT_ID,
           R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
  PANEL    olculemez: Resend takibi KAPALI, Cloudflare DMARC ACIK - kullanici
           27 Eylul'de yapti ve DMARC'taki rua bunu dogruluyor.

CANLIDA OLAN: web ve mobil (1.0.7) esit. MOBILDE BEKLEYEN (sonraki build):
ADR-066 liste tazeleme (a3d76a8) + 13 Kasim Expo yamalari.

AKILDA TUTULACAKLAR - URUN (ayrinti ADR'lerde):
  - MISAFIR (ADR-057): isGuest isaretli, tek gruba bagli User; giris
    YAPAMAZ. Sahiplenme GUEST_REFERENCE_POLICY'den (29 User alani).
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
  0. Expo yamalari (ADR-062 - CI artik bunun icin kirmizi YANMIYOR, sari
     uyari veriyor): cd mobile && npx expo install --check. Eskiyse
     npx expo install --fix -> tsc + lint + npm test + expo-doctor +
     expo export + native parca degistiyse simulatorde Release build.
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
    Expo yama yayinlayinca CI artik KIRILMIYOR (ADR-062): son adim "Expo
    yamalari (uyari, durdurmaz)" SARI uyari verir. Uyariyi gormek:
      .../actions/runs/<id>/jobs -> check_run_url -> /annotations
    Yamalar build oncesi alinir (GONDERIM KONTROL LISTESI 0). CI yine de
    kirmiziysa sebep GERCEK bir sey - adimlarina bak.
  - <SHA> TAM 40 KARAKTER OLMALI: kisa SHA ile hem runs?head_sha= hem
    deployments?sha= HATA VERMEDEN BOS doner (0 / []) - "kosu yok",
    "yayin yok" sanilir. Tam hali: git rev-parse <kisa>.
  - YETKISIZ GITHUB API'SI SAATTE 60 ISTEK (IP basina). 30 sn'de bir soran
    bekleme dongusu + kontroller iki push'u dogrularken butceyi bitirdi;
    sonraki istek "API rate limit exceeded" doner, sifirlanma ~1 saat.
    Dongude 60 sn+ bekle, kontrolleri tek istekte topla. Kalan butce:
      curl -s https://api.github.com/rate_limit   (bu uc butceden yemez)
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
  - Tam kosu ~17-23 dk, 74 test (13 Kasim), atlanan yok (2FA kopru testi 7 Kasim'da
    kopruyle birlikte silindi).
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
  - YENI GOC: npx prisma migrate dev --create-only, sonra migration.sql'de
    "ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;"
    satirini SIL (uretilmis kolon - Prisma her seferinde sahte bir fark
    goruyor). Gelistirme veritabanina "migrate dev" ile DEGIL
    "npx prisma migrate deploy" ile uygula (sifirlama sorusu cikmaz).
    E2E: npm run db:migrate:e2e - P1001 verirse Neon uyaniyordur, bir kez
    daha dene.
  - LINT "preserve-manual-memoization" (React Compiler): useMemo'nun
    bagimliligi olan bir degeri (parseMoney sonucu gibi) memo'dan ONCE bir
    fonksiyona verme - derleyici duz sayi oldugunu bilmiyor, "degismis
    olabilir" sayiyor. Hesabi memo'dan sonraya tasi (expense-form.tsx).
  - E2E YAVASSA ONCE MAKINEYE BAK: uptime + ps -A -o %cpu,comm | sort -rn.
    7 Kasim'da oyun acikti: ayni kod 71/2 dustu (60 sn butce), formu hic
    kullanmayan testler de 2-3 kat yavasladi. Dusen testi tek basina kostur;
    gecerse sebep ortam. Iki kosunun test surelerini karsilastirmak en
    hizli ayirac: herkes yavasladiysa ortam, yalnizca biri ise kod.
  - E2E'DE 500 + P2028 "Unable to start a transaction in the given time":
    transaction'in BASLAMA bekleme sinirini (Prisma varsayilani 2 sn) E2E
    veritabaninin (Neon us-east-1, uzak) yavas anlari asiyor. Toplam sure
    siniri (5 sn, groups.ts/guests.ts'deki 15 sn) BASKA bir sey. 7 Kasim'da
    ARKA ARKAYA IKI tam kosuda birer kez: notifications.spec:59 (baslama,
    2 sn) ve expenses.spec:106 (toplam, 5560 ms, harcama duzenleme). Ikisi
    de tek basina gecti. Production'da uygulama ve veritabani ayni bolgede.
    Tekrarlamaya devam ederse sinirlar ya da E2E veritabaninin yeri
    konusulur - karar yok.
  - BAGIMLILIK GUNCELLEMESINDEN SONRA TAM E2E SART: better-auth 1.7.18
    tsc/lint/861 birim testi/build'den GECTI, yalnizca E2E kurulumu
    yakaladi (kayit 500). npm audit fix "guvenli" sayilmaz.
  - CI/YAYIN OLCERKEN SHA'YI ESLESTIR: actions/runs listesinden en
    yeniyi degil, head_sha'si commit'inki olani al; deployments?sha= tam
    SHA ister. Bir izleyici eski bir kosuyu "bu commit" diye okudu (6 Kasim).
  - IZLEYICI BETIGI: bu makinenin python3'u 3.9 - f-string icinde ters
    bolu (x[\"id\"]) SyntaxError veriyor. Hata stderr'e gidiyor, dongu
    bos degerlerle donup "exit 0" ile bitiyor: "bitti" bildirimi OLCUM
    DEGIL. Ciktiyi oku; python'u heredoc ile ver, tek tirnakli satir ici
    kod yazma. Kimliksiz API saatte 60 istek - her tur 2+ istek harciyor.
  - ARKA PLAN GOREVININ "failed/completed" DURUMU = ZINCIRDEKI SON KOMUTUN
    KODU, testlerin sonucu DEGIL. 7 Kasim: 73/73 gecen E2E "failed" gorundu
    (son komut grep -c "P2028" -> 0 eslesme -> kod 1); testi dusen kosular
    "completed" gorundu (son komut tail). Sonucu ciktidan oku; yeni betikte
    zinciri gercek kodla bitir (ornek: ...; exit $KOD).
  - ARKA PLAN GOREVI CALISMA KOPYASI (.claude/worktrees/...) proje
    klasorunun ICINDE: varken "npm run lint" o kopyayi da tariyor ve
    oradan hata veriyor. Bizim kodu olcmek icin:
      npx eslint --ignore-pattern '.claude/**' .
    (.claude/ gitignore'da - CI gormuyor.)
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
  - SIMULATORLER: 4FC4379D ve 68DF61C6 BASKA PROJENIN - dokunma. Bizimkiler
    28E27032 ("Owezy Test iOS 27" - girisli kontrol icin bunu kullan) ve
    FCD7F36E (iPhone 17 Pro, iOS 26.5 - klavye cikmiyor). Ekran: xcrun
    simctl io <udid> screenshot. Koyu tema: xcrun simctl ui <udid>
    appearance dark.
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
  - BIR EKRANDAN DONULDUGUNDE O EKRANIN BUTUN SORGULARI TAZELENMELI - ve
    one gelince / asagi cekince de ayni fonksiyon (ADR-066, CONVENTIONS
    "Liste gosteren bir ekran uc yoldan tazelenir"). Otomatik tazelemede
    refresh() (hatada veri kalir); hata sayfasindaki "Tekrar dene" ve
    islem sonrasi yenileme reload().
  - HERMES'TE Intl.RelativeTimeFormat YOK (ADR-044). Paylasilan modulden
    gelen her Intl.X mobilde ayrica denenmeli.
  - KOYU TEMA AYRICA DENENMELI - giris ekrani aylarca renklerini elle
    tasidi ve kimse fark etmedi.
  - YESIL SINYALLER URUNUN IYI OLDUGUNU SOYLEMEZ: mobilde bir sey
    degistiginde SIMULATORDE BAK.
  - PUSH'U DOGRULAMA (gercek telefon, ADR-047): TestFlight'tan kur ->
    Bildirimler ekraninda izin ver -> IKINCI BIR HESAPLA ortak gruba
    harcama ekle -> bildirim dusmeli; TUTAR VE ISIM GORUNMEMELI.

  TASARIM KAYNAGI (ADR-048): kullanicinin Claude Design projesi
    2f16cec7-532e-466b-8493-4cc5a7792d07 "Owezy mobil ve web tasarimi",
    dosya design_handoff_owezy_kagit_petrol/Owezy Urun Tasarimi.dc.html,
    uygulanan bolum id="5a" (2a/3a/3b/4a reddedilmis). Yanindaki README.md
    spec'in kendisi. Okuma: DesignSync get_file, dogrudan projectId ile
    (list_projects BOS doner).

TESTLER - NE NEREDE (13 Kasim):
  KOK      npm test                  904 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      129 vitest + 170 jest
  E2E      npm run test:e2e           74, ~17-23 dk
  Mobilde IKI KOSUCU, sinir dizine gore (ADR-042, ADR-043):
    lib/** -> vitest · components/**, test/screens/** -> jest.
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.
