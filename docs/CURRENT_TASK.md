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

Updated: 2026-11-07

Current task:
  MOBIL 1.0 ICIN 2FA CEREZ KOPRUSU KALDIRILDI (7 Kasim, kullanicinin
  onayiyla) - YAYINDA: 563c336, CI 42365542267 success, Production
  2026-11-07 10:49:45Z success. Canlida hesapsiz kontrol: / 200,
  /api/auth/get-session 200 (null), verify-totp cerezsiz 401. Olcut: production'da 2FA acik tek
  hesap kullanicinin kendisi (Neon SQL Editor, kullanici saydi), o da
  1.0.7'de. route.ts eski haline (toNextJsHandler) dondu; kopru dosyasi,
  10 birim testi, atlanan E2E testi silindi. ADR-045 eki.
  Dogrulama: tsc, lint, 851 birim GECTI (861 - 10). TAM E2E 73/73 GECTI
  (16,5 dk, atlanan yok, sunucu kaydinda P2028 yok).
  SONRAKI ADIM: yok - kullanicinin yeni gorevi bekleniyor.

  ONCEKI (7 Kasim): veritabani sizintisina karsi iki duzeltme -
  9e9c7a2 (tek seferlik kodlar sifreli, ADR-064) ve 0558fe0 (Bearer yalnizca
  imzali, ADR-065); CI 42321905971, yayin 01:04:07Z success. Kullanici
  telefonda dogruladi: oturum acik, gruplar yukleniyor. Ondan once
  396460e (harcama formu router.refresh). Ayrinti CHANGELOG.
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

  EXPO - 4 KASIM OLCUMU:
    - SDK 58 ARTIK "latest" (npm dist-tags: latest 58.0.23, sdk-57
      57.0.31). 21 Ekim'de EAS'ta Xcode 27.0 ve 27.1 imajlari vardi.
      Sabitleme 1.0.7'de de bilerek duruyor (ADR-058) - kaldirmak SDK 58
      isinin parcasi.

  SIMULATORDE GIRISLI KONTROL - NASIL YAPILIR (5 ve 21 Ekim'de boyle):
    Kullanici izin verdi: yerel build'de, yerel gelistirme sunucusuna bagli
    bir TEST hesabiyla giris. Production'a dokunulmadi.
    - Sunucu: RESEND_API_KEY="" npm run dev  (kod e-postasi GITMEZ)
    - Kod: gelistirme veritabani Verification "sign-in-otp-<email>".
      7 Kasim'dan beri SIFRELI (ADR-064): readOtpFromDatabase'in yaptigi
      gibi better-auth/crypto symmetricDecrypt + BETTER_AUTH_SECRET
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
  1. (KAPANDI 7 Kasim) TEKRARLAYAN HARCAMA canlida URETTI: kullanici
     sablon kurdu, Vercel -> Cron Jobs -> Run, harcama dustu. Mobilde
     listeye "3-5 dk sonra" dustu - sebep cron DEGIL: ilk donem cron
     kosunca HEMEN yaziliyor (recurring.ts createRecurringExpense), mobil
     grup ekrani ise yalnizca uygulama ICINDE ekrana donulunce tazeleniyor
     (useFocusEffect); uygulamaya geri gelince ya da asagi cekince
     tazelenmiyor. PROGRESS teknik borc.
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

DIS DUNYA - 6 KASIM OLCUMU:
  DMARC    v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r;
           rua=mailto:...@dmarc-reports.cloudflare.net   (Cloudflare raporlari)
  CANLI    / , /support , /privacy , /.well-known/apple-app-site-association -> 200
           Apple CDN AASA -> 200
  MAGAZA   1.0.7 | 2026-11-05 | (us ve tr)
  CI       563c336 success (kosu 42365542267, 7 Kasim) - onceki
           0558fe0, 396460e de success
  YAYIN    563c336 Production success 2026-11-07 10:49:45Z - dokuman commit'leri de
           production'a yayinlaniyor (her commit'in Production kaydi var)
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
  - Tam kosu ~17-23 dk, 73 test, atlanan yok (2FA kopru testi 7 Kasim'da
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

  TASARIM KAYNAGI (ADR-048): kullanicinin Claude Design projesi
    2f16cec7-532e-466b-8493-4cc5a7792d07 "Owezy mobil ve web tasarimi",
    dosya design_handoff_owezy_kagit_petrol/Owezy Urun Tasarimi.dc.html,
    uygulanan bolum id="5a" (2a/3a/3b/4a reddedilmis). Yanindaki README.md
    spec'in kendisi. Okuma: DesignSync get_file, dogrudan projectId ile
    (list_projects BOS doner).

TESTLER - NE NEREDE (21 Ekim):
  KOK      npm test                  851 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      98 vitest + 145 jest
  E2E      npm run test:e2e           73, ~17-23 dk
  Mobilde IKI KOSUCU, sinir dizine gore (ADR-042, ADR-043):
    lib/** -> vitest · components/**, test/screens/** -> jest.
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.
