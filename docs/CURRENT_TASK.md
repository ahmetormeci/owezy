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

Updated: 2026-08-25 (2)

Current task:
  FAZ 20 - CI MOBILI DE DOGRULUYOR. BITTI.
  Mevcut CI isine dort adim eklendi: mobil "npm ci", tsc, expo-doctor,
  expo export. Ayri job DEGIL (mobil tsc kokun Prisma client'ina bagli),
  kosullu DEGIL (src/lib degisikligi mobili kirabiliyor).

Hemen sonraki adim:
  @clerk/expo GECISI.
  Kullanici uc isi SU SIRAYLA yapmayi onayladi:
    1. Optimistic locking          BITTI (51bc3c4)
    2. CI mobili dogrulasin        BITTI (bu commit)
    3. @clerk/expo gecisi          SIRADA
  Bu sira KULLANICININ VERDIGI bir plandir - PROGRESS.md'deki aday
  listesinden farkli, oradan bir sey kendiliginden baslatilmaz.

  AYRICA: Apple Developer hesabi ONAYLANDI (25 Agustos). Yayin adimlari
  asagida "YAYIN DURUMU" altinda, sirasiyla.

  3. ADIMIN DURUMU - ENGEL KALKTI (25 Agustos'ta dogrulandi):
    @clerk/clerk-expo DEPRECATED, uygulama acilista uyari basiyor. Gecis
    denenmis ve GERI ALINMISTI: @clerk/expo'nun her surumu dolayli olarak
    @clerk/shared@^4.30.0 istiyordu ama npm'de en yenisi 4.29.3'tu, yani
    paket kurulamiyordu. Sebep bizde degildi.
    ARTIK: @clerk/shared 4.30.0 yayinlandi. "npm install @clerk/expo
    --dry-run" temiz cozuluyor (11 paket, cakisma yok).
    ONEMI KOZMETIK DEGIL - surum ayrismasi:
      web    @clerk/nextjs@7.5.22 -> @clerk/react@^6   = Core 3
      mobil  @clerk/clerk-expo@2  -> @clerk/clerk-js@5 = Core 2
      yenisi @clerk/expo@4.5.3    -> @clerk/clerk-js@^6 = Core 3
    Gecis ayrisma YARATMAZ, var olani KAPATIR.
    IS: 6 dosyada import yolu (_layout, sign-in, index, groups/index,
    groups/[id]/index, lib/use-api) + paket degisimi. AMA major surum
    atlamasi (core-3 gocu): ClerkProvider'in token saklama sozlesmesi ya da
    getToken davranisi degismis olabilir. tsc bunu GOSTERMEZ - bu oturumda
    iki kez tam olarak boyle oldu. Dogrulama simulatorde giris yapmakla.

MOBILDE BUGUN NE VAR:
  giris (e-posta + kod), grup listesi / tek grupta dogrudan gruba
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
  - @clerk/clerk-expo deprecated (yukarida).

CI MOBILDE NE KOSUYOR (Faz 20):
  mobil npm ci -> tsc -> expo-doctor -> expo export --clear
  Ikisinin kirmiziya dusebildigi KANITLANDI: bagimlilik gecici kaldirilinca
  expo-doctor 1 dondu, bozuk import eklenince expo export 1 dondu.

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
  - Donanim klavyesi ayari test icin gecici kapatilip GERI ACILDI
    (defaults write com.apple.iphonesimulator ConnectHardwareKeyboard).

TEST VERISI (gelistirme veritabaninda duruyor):
  testuser1'in iki grubu. "Ev": iki uye, 28 harcama (2026-08/07/06,
  sonuncusunda 25 tane - sayfalama testi). "Bodrum tatili": tek uye, bir
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
       1. App Store Connect'te uygulama kaydi + "Owezy" adi rezervasyonu.
          Isimler ilk gelene. Bundle ID net.owezy.app KALICI (app.json).
       2. owezy.net'e gizlilik politikasi + destek sayfasi. IKISI DE
          ZORUNLU, IKISI DE BUGUN YOK.
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
  - owezy.net'te gizlilik politikasi ve destek sayfasi HALA YOK.

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
  npm run test:e2e  # beklenen: 37, ~6-7 dk, kosarken dosyalara dokunma

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

  NPM SURUM FARKI: npm 11.17 paketlerin kurulum betiklerini varsayilan
  olarak CALISTIRMIYOR. Sonuca bakildi, bugun bir sey kirmiyor. Gerekirse:
  "npm approve-scripts --allow-scripts-pending".
