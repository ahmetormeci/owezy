# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI?

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel.

AMA BU KONTROL YALNIZCA KODU KAPSIYOR. "DIS DUNYA" maddeleri baska yerde:
DNS, Vercel, Sentry, App Store Connect, Expo, saglayici panelleri. Onlari
ne git ne de bir test goruyor.

BU DOSYA HER YENIDEN YAZILDIGINDA O MADDELER TEK TEK OLCULMELI:
    DNS      dig +short TXT _dmarc.owezy.net
    env      grep -oE '^[A-Z0-9_]+' .env.local   (ADLAR; degerleri okuma)
    canli    curl -sI https://owezy.net/support
    magaza   itunes.apple.com/lookup?bundleId=net.owezy.app
    CI       curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=3"
             (gh CLI YOK; depo herkese acik, yetki gerekmiyor)
    panel    olculemez - KULLANICIYA SOR, varsaymadan
-->

Updated: 2026-09-09

Current task:
  KAGIT & PETROL TASARIM YONUNUN UYGULANMASI (ADR-048).

  KAYNAK: kullanicinin Claude Design'daki projesi.
    proje  2f16cec7-532e-466b-8493-4cc5a7792d07  "Owezy mobil ve web tasarimi"
    dosya  design_handoff_owezy_kagit_petrol/Owezy Urun Tasarimi.dc.html
    UYGULANACAK BOLUM id="5a". 2a/3a/3b/4a REDDEDILMIS alternatifler.
    Yanindaki README.md spec'in kendisi - her token, her olcu orada.
    OKUMA YOLU: DesignSync (list_files / get_file). /design-login yapildi.
    Kullanici ayni paketi zip olarak da verdi; ikisi BIREBIR AYNI.

  HANDOFF'UN KENDI SIRASI - NEREDE KALINDI:
    1. web tokenlari (globals.css)          BITTI  9e44613
    2. mobil tema (theme.tsx)               BITTI  9e44613
       + mobil fontlar (lib/fonts.ts)       BITTI  cf94a4e
    3. mobil GRUP EKRANI                    BITTI  ba8a515 + 67af879
    4. mobil harcama ekleme                 BITTI  8ab8f58 + 766d87c
    5. web tanitim sayfasi                  BITTI  1379c6e
    6a. koyu tema gozden gecirme            BITTI  4ff3b1d
    6b. magaza ekran goruntuleri            BEKLIYOR - gercek build ister VE
        1.0.3'un inceleme sonucu belli olmadan anlamsiz

  HANDOFF BITTI. BUNDAN SONRASI HANDOFF'TA YOK - yeni dilin kalan
  ekranlara TASINMASI. Handoff uc yuzey ciziyordu; digerleri renk ve yazi
  tipini aldi ama YERLESIM dili eski kaldi.
    harcama detayi      BITTI  9f9e7f6  (+ receipt-photo bileseni)
    odesmeler           BITTI  (bkz. son commit)
    uyeler              SIRADA
    hesap / gruplar listesi / bildirimler / giris
    web urun sayfalari  ((app)/groups/...) - handoff yalnizca karsilama
                        sayfasini kapsiyordu

  BU YONDE OLCULEN IKI SEY - TEKRAR ETME, KAYITLI:
    a. Handoff'un butun kontrast iddialari DOGRU cikti.
    b. AMA TURETILEN KOYU TEMADA KUSUR VARDI: acilmis petrol uzerinde
       beyaz metin 3.89:1, AA'yi gecmiyor. Birincil dugmenin metni koyu
       yapildi (4.78:1). onBrand token'i bu yuzden var.

  KOYU TEMA GOZDEN GECIRILDI (9 Eylul, simulatorde). Tasarimda hic
    cizilmemisti; asagidaki ekranlar tek tek acildi: grup, harcama ekleme,
    hesap, grup duzenleme, odesme. IKI KUSUR CIKTI, ikisi de ayni sinifta:
    "acik temada dogru, koyu temada bagiran" cizgiler.
      - Giris alt cizgileri DORT yerde theme.foreground'du (edit, composer,
        invite-joiner, group-creator) -> inputLine.
      - Harcama formunun kapanis cizgisi foreground'du -> muted.
    Kontrast orani iki yonde de ayni (~14.8:1); sorun oran degil, parlak
    cizginin koyu zeminde yayilmasi.

  KASITLI SABIT RENKLER - DOKUNMA, hepsinin gerekcesi kodda yazili:
    kirmizi silme dugmesi, tam ekran fotograf zemini (siyah), QR kodu
    (taranmasi icin siyah-beyaz olmak ZORUNDA), ve bakiye kartinin ici
    (kart iki temada da koyu petrol).

  WEB TANITIM SAYFASI - BITTI. Dil ve tema dugmeleri PublicControls'un
    sabit kosesinden BASLIK CUBUGUNA tasindi (o bilesenin kendi yorumu bunu
    zaten istiyordu). Giris/kayit sayfalari PublicControls'u kullanmaya
    devam ediyor. Tasarimdaki PROFIL FOTOGRAFI BLOGU YAPILMADI: var olmayan
    bir ozelligi anlatiyor, handoff da image-slot icin "uretime tasinmaz"
    diyor. E2E TAM KOSU YAPILDI: 57/57, 10.6 dk.

  DIKKAT - SOZLUK ANAHTARINI SABLON DIZGIYLE YAZMA:
    messages.test.ts kaynak kodu tarayip gecen her "ui.*" kodunu sozlukte
    ariyor - ADR-020'nin FIILEN isleyen hali (Translator duz string aldigi
    icin tip sistemi yakalamiyor). Sablon dizgiyle yazilan anahtar kaynakta
    HIC GECMIYOR, yani o kontrol onu goremiyor. Bu oturumda dokuz anahtar
    boyle yazildi, testler sessizce gecti; acik anahtara cevrilip negatif
    kontrolle dogrulandi.

  ARKA PLAN KOSUSUNUN CIKIS KODUNU OKURKEN: "exit code 0" SARMALAYICI
    betigin kodu olabilir, kosunun degil. Bu oturumda iki kez yasandi
    (once eas build, sonra e2e). Once hangi surecin kodu oldugunu dogrula.

  EKRANLARDA YAPILAN: GRUP EKRANI ve HARCAMA EKLEME. Digerlerinin (harcama
  detayi, odesmeler, uyeler, hesap, gruplar listesi) rengi ve yazi tipi
  yeni, YERLESIMI eski.

  HARCAMA EKLEME - IKI ADIMLI SIHIRBAZ KALDIRILDI:
    Gerekcesi gercekti (bolusme arayuzu TUTARA bagimli) ama onu saglayan
    sey adim SINIRI degil alanlarin SIRASI - tasarim tutari ilk alan
    yapiyor. Sinir kalkti, sira kaldi. Testteki "next" adimi da kalkti.
    Odeyen ve kategori CIP degil ACILIR SECIM artik (components/field.tsx,
    React Native'in kendi Modal'i - yeni bagimlilik yok).
    Esit bolusumde her satir PAYINI gosteriyor; hesap sunucuyla AYNI
    fonksiyondan (src/lib/split.ts), yani ekrandaki kurus kaydedilenle
    ayrisamiyor - kusuratin kime yazildigi dahil.

  TASARIMDA OLAN AMA YAPILMAYAN IKI ALAN:
    "Gruba not"  -> Expense'te NOT SUTUNU YOK (yalnizca Settlement'ta var).
                    Sema + migration + API + web demek: ozellik, restyle
                    degil. YAPILMADI.
    "Tarih"      -> sunucu kabul ediyor (web'de var) ama mobilde tarih
                    secici hic olmadi ve yeni bir bagimlilik ister.
                    Sunucu bugunu varsaymaya devam ediyor. YAPILMADI.

  SIMULATORDE GORULDU (9 Eylul, iPhone 17 Pro, acik VE koyu tema):
  baslik blogu, koyu bakiye karti, bakir bolum cizgileri, cipli harcama
  satiri, avatarli uye listesi, sabit alt cubuk. Koyu temada birincil
  dugmenin koyu metni de dogrulandi.

  SIMULATORE NASIL BAKILIR - BU OTURUMDA OGRENILDI:
    Kurulu Owezy bir RELEASE build (preview profili); expo-dev-client
    bagimliligi YOK, yani Metro'ya HIC baglanmiyor - "owezy://expo-
    development-client/?url=..." hicbir sey yapmiyor ve ekranda eski
    gomulu paket kaliyor. Yaniltici: uygulama aciliyor, sadece eski.
    YEREL DEBUG BUILD DA ALINAMIYOR: CocoaPods kurulu degil, Homebrew yok
    ve "gem install cocoapods" yetki istiyor - KULLANICININ PAROLASI
    GEREKIYOR, ajan yapamaz.
    CALISAN YOL: npx expo start --go  ->  Expo Go simulatore kendi
    kuruluyor  ->  xcrun simctl openurl booted "exp://127.0.0.1:8081".
    Bildirim uyarilari cikiyor (Expo Go'da push yok), gerisi calisiyor.
    AYRICA: mobil .env.local localhost:3000'e bakiyor, yani once web dev
    sunucusu acilmali - yoksa ekran "baglanti yok" diyor.

  DIKKAT - SABIT EYLEM CUBUGU 56c7a14'U GERI ALIYOR:
    3 gun once grup eylemleri fisin USTUNE tasindi (build 20'de, incelemede,
    ve HIC EKRANDA GORULMEDI). Tasarim onlari alta SABITLIYOR. Handoff bunu
    "bilincli bir degisiklik" diye yaziyor - yani kasitli, ama hic bakilmamis
    bir seyin uzerine yaziliyor.

  TASARIMDAN BILEREK SAPILAN IKI YER:
    1. GRADYAN MASKE YOK. Alt cubuk duz zemin + sac teli cizgi. Gradyan
       expo-linear-gradient (native modul) demek; uygulamada hic gradyan
       yok ve bu proje bir kez Expo surum kaymasindan CI kaybetti.
       Islevi opak cubuk zaten karsiliyor. Istenirse geri eklenir ama
       DEV BUILD YENIDEN ALINMALI - mevcut build'de o modul yok.
    2. BAKIYE KARTININ ETIKETI YONU SOYLUYOR ("sana borclular" /
       "borclusun" / "odestin"), tasarimdaki gibi sabit "Bakiyen" degil.
       Sebep: tasarimda muhur artik odeme SAYISINI yaziyor, yani yon
       yalnizca rakamin isaretinde kalirdi. ADR-015'in yururlukteki
       yarisi bunu yasakliyor.

  TASARIMIN CIZMEDIGI AMA KORUNAN DORT SEY: arama, filtreler, kategori
  kirilimi, sayfalama. Handoff "mevcut davranislar korunur" diyor.
  "Grup duzenle" de eski eylem satiriyla birlikte kaybolmadi - uye
  listesinin dibine, "Uyeleri yonet"in yanina tasindi.

  EAS KOTASI 12/15 - build ALMADAN once sor.

1.0.3 (build 20) - INCELEMEYE YENIDEN GONDERILDI (9 Eylul):
  Once Guideline 2.1 ile reddedildi: App Store Connect'teki "User name"
  alaninda demouser yaziyordu, oysa bu uygulamada kullanici adi YOK -
  giris e-posta ile. Sunucu hesaba bakmadan 400 INVALID_EMAIL donuyordu,
  yani hangi parola yazilirsa yazilsin inceleyici giremezdi.
  Alan appreview@owezy.net yapildi, Notes'a dort adimli giris yolu
  yazildi ("Send code'a basmayin"), ayni build 20 yeniden gonderildi.
  Kullanici gizli pencerede DOGRULADI: parolayla giriyor, 2FA kapali.
  Su an "Waiting for Review".

  BU RET ATLANMIS BIR KONTROLDEN CIKTI. CHANGELOG 4 Eylul'de tanimliyor:
  "gonderimden once appreview@ parolayla girebiliyor mu, ikinci adim
  istiyor mu". Kosulmadi. HER GONDERIMDEN ONCE KOSULACAK.

  SURUMLER:
    1.0.3  build 20, INCELEMEDE (9 Eylul, bir kez reddedilip yeniden
           gonderildi - ayrinti yukarida).
           push bildirim, uye cikarma + davet iptali, {amount} duzeltmesi,
           grup eylemleri fisin USTUNDE, basliktaki hesap simgesi, tema
           secimi, FIS FOTOGRAFI.
           build 16-19 da 1.0.3'tu; 20 hepsinin yerini aldi ve fis YALNIZCA
           20'de calisiyor.
    1.0.2  MAGAZADA CANLI (8 Eylul, telefonda guncelleme alinarak dogrulandi).
    1.0.1  build 11, TestFlight'ta KULLANILMADAN duruyor. ATLANDI.

  1.0.3 ONAYLANINCA IKI IS TETIKLENIYOR:
    1. DESTEK SAYFASI (src/content/legal/support.ts) - "bildirimler telefona
       GONDERILMIYOR" maddesi kalkacak. Su an DOGRU, yayinlandigi gun yanlis
       olacak. Bu tuzak bu projede iki kez yasandi.
    2. KOPRU KALDIRILABILIR HALE GELIR - ama surum YAYGINLASINCA.
       Silinecekler "KOPRU" basliginda.

  RET GELDI VE GEREKCESI OKUNDU - yukaridaki gorev ondan cikti.

  MAGAZA SORGUSU HALA "1.0" DIYOR (8 Eylul olcumu, hem TR hem US) - oysa
  1.0.2 canli ve telefona indi. itunes.apple.com/lookup yayin anini degil
  kendi onbelleginin tazelenmesini gosteriyor; asamali yayin (phased release)
  de olabilir. TEK BASINA KANIT SAYMA.

EKRANDA HENUZ GORULMEYENLER - 1.0.3'un icinde ve HICBIRI bakilmadi:
  yerlesim (eylemler fisin ustunde), basliktaki hesap simgesi, tema secimi,
  fis akisi, listedeki fis ataci, tam ekran goruntuleyici.
  Push GERCEK TELEFONDA dogrulandi; bu alti sey dogrulanmadi.
  OZELLIKLE: TEK GRUBU OLAN hesapla ac. O hesap dogrudan grubun icine
  dusuyor, geri dugmesi hic dogmuyor ve hesaba giden tek yol o ekranin
  altindaki karttI - KALDIRILDI. Basliktaki simge onu karsilamiyorsa
  kullanici hesabina ulasamaz.

MOBILDE YONETIM EKSIKLERI - BITTI (8 Eylul). Uye cikarma ve davet iptali
  eklendi, 10 ekran testiyle. Sahiplik devri KAPSAM DISI kaldi: ayri bir uc
  yok, web'de de yok - devir yalnizca AYRILIRKEN var ve o mobilde zaten
  calisiyordu.

PUSH BILDIRIM - BITTI VE GERCEK TELEFONDA DOGRULANDI (8 Eylul, ADR-047).
  APNs anahtari kurulu (Portal ID 47KL3BM87C). App Privacy'ye "Identifiers ->
  Device ID" satiri girildi.

  DOGRULAMA YOLU (bir daha gerekirse):
    TestFlight'tan kur -> Bildirimler ekraninda izin ver -> IKINCI BIR
    HESAPLA ortak gruba harcama ekle -> telefonda bildirim dusmeli.
    TUTAR VE ISIM GORUNMEMELI.

YENI YETKI EKLERKEN APPLE PORTALI - IKI KEZ AYNI SEKILDE DUSTUK:
  Yeni bir iOS yetkisi (Associated Domains, Push Notifications) eklendiginde
  build su hatayla DUSUYOR:
      Provisioning profile ... doesn't include the X capability
  SEBEP: mevcut profil o yetkiyi tasimiyor ve EAS onu kendi basina
  YENILEMIYOR - ne --non-interactive ne de etkileşimli kosu duzeltti.
  COZUM: developer.apple.com/account/resources/identifiers/list -> App ID ->
  yetkiyi ISARETLE -> Save. Bu mevcut profilleri gecersiz kiliyor ve EAS
  bir sonraki build'de yenisini uretiyor (profil ID'si degisiyor - kontrol
  edilebilir: ZLPAAW529A -> ZR63Q74VG8).
  YETKI ILE ANAHTAR AYRI SEYLER: APNs anahtari GONDERMEK icin, App ID'deki
  kutu ALMAK icin. Ikisi de gerekiyor.

EAS BUILD BASARISIZ OLDUGUNDA DA 0 DONUYOR. Arka plan bildirimindeki
  "exit code 0" build'in gectigi anlamina GELMEZ; ciktiyi oku. Ayni sinif
  hata daha once kabuk seviyesinde de yasandi (asagida).

FIS FOTOGRAFI - BITTI VE GERCEK CIHAZDA YUKLENDI (8 Eylul, ADR-046).
  R2 kurulu (kova owezy-receipts, degiskenler .env.local + Vercel).
  App Privacy'ye "User Content -> Photos or Videos" satiri girildi.

  R2'YE YAZARKEN CONTENT-LENGTH ELLE VERILIYOR ve bu ZORUNLU. Node'un
  undici'si ArrayBuffer govdesi icin basligi kendisi koyuyor; VERCEL'IN
  CALISMA ZAMANI parcali aktarim kullanip HIC koymuyor ve R2 411
  MissingContentLength donuyor. Uc dagitim turu buna gitti - cunku ayni
  istek YERELDE 200 donuyordu. DERS: dogru seyi YANLIS ORTAMDA olcmek, hic
  olcmemekten kotu; insani emin yapiyor.

  DEPO HATALARI KENDI KODLARINI TASIYOR (ServiceError): not_configured,
  forbidden, bucket_not_found, bad_request. Oncesinde hepsi "beklenmeyen bir
  hata"ydi ve yapilandirma eksigiyle yazilim hatasi ayirt edilemiyordu.

  WEB'DE YUKLEME YOK, yalnizca goruntuleme. Bilincli kapsam karari; fis
  odeme aninda telefonla cekiliyor ve web'de eklemek ayrica TARAYICIDA
  kucultme demekti. Isteyen olursa ayri bir is.

  GERCEK KUCUK RESIM YOK - listede yalnizca bir atac. Kirk harcamalik bir
  liste kirk fotograf indirmek olurdu. Istenirse yukleme aninda ikinci bir
  kucuk kopya uretilip saklanir (sema degisikligi + eski fisler icin yedek
  yol).

  PINCH-ZOOM YOK: react-native-gesture-handler eklemek gerekirdi.

CI'A BAKILIYOR MU? - 8 EYLUL'DE DORT COMMIT BOYUNCA BAKILMADI.
  Yerel testlerin gecmesi CI'in gectigi anlamina GELMIYOR. expo-doctor
  kurulu surumleri SDK'nin CANLI gereksinimiyle karsilastiriyor; Expo yeni
  yama yayinlayinca CI, MOBILE HIC DOKUNMAYAN bir commit'te duser.
  Duzeltmesi: cd mobile && npx expo install --fix
  Durum sorgusu (gh yok, depo herkese acik):
    curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=3"

EAS BUILD KOTASI - UCRETSIZ PLANDA AYDA 15 iOS BUILD.
  8 Eylul: 12 kullanildi, besi tek oturumda. BUILD ALMADAN ONCE SOR;
  degisiklikleri biriktirip tek build almak dogrusu.

SIRADAKI IS - SECILMEDI:
  (secilen dortlu + fis bitti; yeni aday yok)

  Destek sayfasindaki "bugunku sinirlar" listesi (src/content/legal/support.ts)
  bunlarla ORTAK. Bir madde bitince ORASI DA GUNCELLENMELI.

LISTEDEN DUSEN IKI MADDE - BIR DAHA "mobilde eksik" DIYE YAZILMASINLAR:
  odesme duzenleme    -> HICBIR YERDE UC YOK. Web de yalnizca iptal
                         edebiliyor ve mobil bunu ZATEN yapiyor.
  silineni geri alma  -> uc var (POST .../restore) ama WEB'DE DE ARAYUZ YOK.
  Ikisi de urun sinirı, mobil sinirı degil. Yapmak = iki tarafa birden yeni
  ozellik eklemek; AGENTS.md gorev verilmeden bunu yasakliyor.

UNIVERSAL LINK - YAPILDI (1.0.2, 4 Eylul). Uc parcasi da yerinde:
    1. owezy.net/.well-known/apple-app-site-association  (7 Eylul: 200)
    2. app.json'da associatedDomains + App ID'de Associated Domains yetkisi
    3. build 14
  Kalan tek soru yukarida ("TEK ACIK SORU"). EXPO GO'DA DENENEMEZ -
  development ya da production build sart.

PRODUCTION'DAKI DEMO HESAPLAR - DIKKAT:
  appreview@owezy.net  inceleme hesabi. SILME, PAROLASINI DEGISTIRME -
                       sonraki gonderimlerde de Apple bunu kullanacak.
  demo@owezy.net       ICINDE VERI VAR (bir grup, harcamalar, ikinci uye).
                       Atilabilir DEGIL; 1 Eylul'de silinmek uzereyken
                       fark edildi. Bir demo hesabi gerekiyorsa YENI bir
                       adres ac.
  demo2, demo3         ekran kaydi icin yaratildi ve UYGULAMA ICINDEN
                       silindi. Cloudflare yonlendirmeleri duruyor.

  YENI BIR ADRES KULLANMADAN ONCE IKI SEY: Cloudflare Email Routing'de
  ekli mi, ve Resend'in suppressions listesinde DEGIL mi. Ikisi de bir
  oturumu ayri ayri durdurdu - ve arayuz her iki durumda da "Sent to ..."
  diyor, yani hicbir sey belli olmuyor.

GELISTIRME VERITABANINDA BIRAKILAN TEST VERISI:
  "Deniz'in evi" grubu ve davetci@ornek.test kullanicisi, davet kabulunu
  denemek icin uretildi. BILEREK BIRAKILDI: gelistirmedeki tek COK UYELI
  grup o, ve "senin payin" ile "kim odedi" ancak orada gercekten degisiyor.

BIR SONRAKI GONDERIM ICIN - SIRASI ONEMLI:
  1. eas build
  2. push        -> destek sayfasi yeni ozellikleri anlatiyorsa, o metin
                    ancak yeni build gonderildikten sonra dogru olur
  3. eas submit
  4. gerekirse ekran kaydi - FIZIKSEL CIHAZDA. Apple'in ret metninin 1.
     maddesi acikca "captured on a physical device" diyor; bu oturumda
     once simulator kaydi uretildi ve KULLANILAMADI.
  5. App Store Connect'te surumu yayina alma

  APP REVIEW INFORMATION DOLU ve oyle kalmali: demo hesap (appreview@)
  ve Notes alani. Notes'ta uygulamanin ne yaptigi, hesap silme yolu, izin
  istemi olmadigi, kullanilan dis servisler ve bolgesel fark olmadigi
  yaziyor - Apple bunu "for future submissions" diye istemisti.

  CEVAP VE NOTES METINLERI 4000 KARAKTERLE SINIRLI - IKISI DE.

MAGAZA KIMLIGI - COZULDU, DOKUNMA:
  TURKCE AD ALANINA BIR DAHA DOKUNMA. Kilit YERELLESTIRME BASINA cikti.
  Bu hesap bu ismi bir kez KALICI olarak kaybetti (Apple: "If you remove an
  app, you'll lose ownership of the app name"); birakilirsa geri alinabilecegi
  garanti DEGIL. Simdi magazada duruyor - riske atilmasin.

  net.wezy.app SILINEMEZ, silinmeye calisilmasin - build almis bir bundle ID
  ayni organizasyonda bir daha kullanilamiyor (Apple belgeliyor). Zararsiz.
  CANLI olan bundle net.owezy.app.

  TELEFONDAKI AD app.json'daki "name"den geliyor ve "Owezy" olarak kaldi.

BITEN VE OLCULEN ISLER (bir daha "yapilacak" diye yazilmasinlar):
  MAGAZA   1.0 canli, 4 Eylul   (itunes lookup ile)
  AASA     owezy.net/.well-known/apple-app-site-association -> 200
           Apple CDN (app-site-association.cdn-apple.com/a/v1/owezy.net) -> 200
  DNS      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r   (dig ile)
  CANLI    owezy.net/ , /support , /privacy  -> 200   (curl ile)
           /terms yok ve gerekmiyor - Apple'in standart EULA'si kullaniliyor
  SENTRY   "Prevent Storing of IP Addresses" acik
  POSTA    destek@ VE appreview@owezy.net acik, kullanicinin kutusuna
           yonleniyor (Cloudflare Email Routing)
  DOGRULAMA appreview@owezy.net'te e-posta dogrulandi (28 Agustos)
  IKON     yeni isaretle uretildi; acilis gorseli de ayni iki path'ten
  EAS      eas.json'da ascAppId yazili (6805650395)

AKILDA TUTULACAKLAR:

  E2E DUSUNCE ONCE MAKINEYI TEMIZLE - METRO VE SIMULATOR DAHIL. 4 Eylul'de
  E2E kosarken Expo ile simulator acik birakildi; ucu ayni makinede yarisip
  60 saniyelik test sinirini kaybettirdi. Belirti yaniltici: testler CPU
  YEMIYOR, BEKLIYOR. Bir kosu 42 dakika surdu.

  KOSUYU ORTASINDAN KESME. pkill ile durdurulan bir kosu E2E veritabanini
  yarim birakiyor; sonraki kosuda kurulum "kullanici zaten var" (422) diye
  dusuyor ve sebep kodda aranmaya baslaniyor.

  "The destination stream closed early" TEK BASINA BIR SEY ANLATMIYOR. Gecen
  bir kosuda da bir tane gorulebiliyor. Belirti olan SAYISI: yediye ciktiysa
  gercekten bir sey bozuk.

  BIR DEGISIKLIGIN SUCLU OLDUGUNU KOSU SAYARAK KANITLA. 4 Eylul'de bir
  degisiklik once masum, sonra suclu, sonra yine belirsiz gorundu cunku
  kirli ve temiz kosular ayni kefeye konmustu. Yalnizca TEMIZ kosular sayilir
  ve degisiklikli/degisiksiz en az ikiser kez kosulmalidir.


  EXPO'NUN GELISTIRICI BALONCUGU BASLIGIN SAG USTUNU KAPATIYOR. 4 Eylul'de
  bildirim zili "hic cizilmemis" sanildi; balonu asagi surukleyince zil
  oradaydi. Baslikta bir sey aranirken ONCE balonu kenara cek.


  NEXT'IN ISTEGI KLONLANMAZ. "new Request(request, { headers })" URETIMDE
  PATLADI:
      TypeError: Cannot read private member #state from an object whose
      class did not declare it
  Next rotaya kendi NextRequest'ini veriyor; undici'nin Request yapicisi
  girdiyi gercek bir Request sanip ozel alanini okumaya calisiyor. Duz
  Node'da AYNI SATIR SORUNSUZ - once oyle olculdu ve yaniltti. Basligi
  degistirmek gerekiyorsa istegi PARCALARINDAN kur:
      new Request(request.url, { method: request.method, headers, body })

  BU HATANIN SINIFI, DUZELTMEYE CALISTIGIMIZ HATANIN AYNISI: dogru sey
  olculdu, YANLIS ORTAMDA. Bir satirin "Node'da calistigini" gormek, onun
  Next'in rota isleyicisinde calistigini GOSTERMEZ. Sunucu kodu sunucuda
  denenmeli - npm run dev + curl yetiyor.

  KOPRUYU UCTAN UCA DOGRULAMA YOLU (kopru durdukca gecerli):
    1. src/lib/better-auth.ts -> advanced'a: useSecureCookies: true
    2. e2e/two-factor.spec.ts -> ilgili test.skip'i test yap
    3. npx playwright test e2e/two-factor.spec.ts
    4. IKISINI DE GERI AL
  Olculdu (4 Eylul): kopru acikken 200 + set-auth-token, kapaliyken 401.
  NEGATIF KONTROL SART - gecen bir test, dusebildigi gosterilmedikce
  hicbir sey kanitlamaz.

  ARKA PLAN BILDIRIMINDEKI "exit 0" TESTLERIN GECTIGI ANLAMINA GELMEZ.
  Kabugun cikis kodu SON komuttan gelir. Yani:

      npm run test:e2e > log 2>&1
      echo "cikis: $?" >> log        <-- kabuk artik 0 doner (echo basarili)

  Playwright 1 donmusken bildirim "completed (exit code 0)" diyor. 4
  Eylul'de tam olarak bu oldu: kurulum adimi dusmustu ve neredeyse "E2E
  yesil" diye rapor edilecekti. LOGU OKU - "passed/failed" satirini ve
  dosyaya yazdirdigin gercek kodu. Bildirime guvenme.
  (Ayni aile: "| tail" ile boruya sokmak - cikis kodu tail'den gelir.)


  E2E BU HATA SINIFINI YAPISAL OLARAK YAKALAYAMAZ. Better Auth'un
  "__Secure-" onegini tetikleyen sey NODE_ENV ve E2E gelistirme modunda
  kosuyor - orada onek HIC olusmuyor. Yani https'e bagli her davranis
  (cerez adlari, Secure bayragi, SameSite etkileri) testlerin disinda
  kaliyor. Bir sey "cerez" ya da "protokol" ile ilgiliyse yesil E2E
  DELIL DEGIL.

  BIR OLCUM HANGI ORTAMDA ALINDIGIYLA BIRLIKTE ANLAM TASIYOR.
  two-factor-cookie.test.ts uydurma degildi; gercek bir sunucu yanitindan
  olculmustu - ama GELISTIRME sunucusundan, yani ayirt edici ozelligin
  (https) bulunmadigi yerden. "Olctum" demek yetmiyor, "nerede olctum"
  da yazilmali.


  KOYU TEMA AYRICA DENENMELI: xcrun simctl ui <udid> appearance dark
  Giris ekrani aylarca renklerini ELLE tasidi (#fff, #111) ve useTheme()'i
  hic cagirmadi; koyu temada butun uygulama koyulasirken o ekran beyaz
  kaliyordu. Kimse fark etmedi cunku kimse koyu temada bakmadi.

  "Intl CALISIYOR" DIYE BIR BUTUN YOK. Hermes'te Intl.NumberFormat ve
  Intl.DateTimeFormat var ama Intl.RelativeTimeFormat YOK - bildirim ekrani
  yazilinca uygulama "undefined cannot be used as a constructor" ile coktu.
  Faz 18.2'deki olcum yalnizca ilk ikisini kapsiyordu. PAYLASILAN BIR MODULE
  giren her Intl.X mobilde AYRICA denenmeli (ADR-044).

  TEK GRUPLU KULLANICI GRUPLAR LISTESINI HIC GORMUYOR: index.tsx onu
  Redirect ile dogrudan grubun icine dusuruyor ve Redirect YIGINI
  DEGISTIRIYOR - geri dugmesi DOGMUYOR. Grup ekranindan bir sey
  kaldirilirken "geri dugmesi karsilar" DENMEZ; o kullanici icin geri
  dugmesi yok. Hesap ve bildirim kartlari bu yuzden orada.

  BIR EKRANDAN DONULDUGUNDE O EKRANIN BUTUN SORGULARI TAZELENMELI. Grup
  ekraninda bir sure yalnizca ozet yenileniyordu; grup adi degistirilip geri
  donuldugunde baslik ESKISINI gosteriyordu. Bir ekrandan gidilen her yer
  oradaki verilerden birini degistirebiliyor ve "hangisi degisti" sorusunun
  cevabini ekran bilemez. useApiGet tazelerken eldeki veriyi koruyor, yani
  hepsini yenilemenin gorunur bir maliyeti yok.

  DERIN BAGLANTI Redirect'i TAKLIT ETMIYOR: exp://.../--/groups/<id> acinca
  expo-router ust rotayi da yigina koyuyor ve geri dugmesi CIKIYOR. Yigin
  davranisini olcmek icin gercek durumu uretmek gerekiyor.

  YESIL SINYALLER URUNUN IYI OLDUGUNU SOYLEMEZ. Uygulama tsc, lint ve 67
  test yesilken KULLANILAMAZ haldeydi: ekranlardan geri donulemiyordu.
  Mobilde bir sey degistiginde SIMULATORDE BAKILMALI - kod okuyarak degil.

  MOBILDE DEGISIKLIK YAPTIYSAN PAKETI DE URET:
      cd mobile && npx expo export --platform ios --clear
  tsc, lint ve testler UCU DE temizken paket kirik olabiliyor: app/ altina
  konan bir test dosyasi EAS build 6'yi dusurdu (expo-router app/'in
  TAMAMINI require.context ile uretim paketine aliyor; ".test.tsx" icin
  istisna YOK). Ekran testleri bu yuzden test/screens/ altinda.

  "--platform ios" SART, yoksa YANLIS ALARM alirsin. Duz "npx expo export"
  web'i de paketlemeye calisiyor ve react-native-web KURULU DEGIL - depoda
  hic bulunmadi (git log -S ile bakildi). Yani o komut bu depoda HIC
  calismadi ve calismayacak; cikis kodu 1, hata "Unable to resolve module
  react-native-web/dist/index". Degisiklikle ilgisi yok - stash'leyip
  olculdu, degisiklik olmadan da ayni sekilde dusuyor.

  expo-doctor'IN "peer dependency" KONTROLU GERCEK COKMELERI YAKALIYOR -
  tsc, lint, testler VE expo export'un DORDU DE goremedigi seyleri.
  4 Eylul'de @expo/vector-icons (bildirim zili icin kuruldu) expo-font'suz
  kaldi ve doctor "Your app may crash outside of Expo Go" dedi. Expo Go
  o paketi kendi tasidigi icin SIMULATORDE HER SEY NORMAL gorunuyordu;
  uretim paketinde cokerdi. Zili tasiyan build (59c40b94) bu eksikle
  alinmisti - gonderilmedigi icin kurtarildi.
  COZUM: npx expo install expo-font
  KURAL: yeni bir Expo paketi kurunca expo-doctor'i KOS ve "peer
  dependency" satirini oku. "Bilinen kararsiz kontrol" diye gecme.

  expo-doctor'IN YERELDEKI CIKTISI YANILTICI: tek sikayeti CocoaPods ise
  o kontrol Linux'ta HIC CALISMIYOR, yani CI'da baska bir kontrol dusuyor
  olabilir. Tam ciktiyi oku.

  BU KONTROL BIZ HICBIR SEY YAPMADAN DA KIRILIYOR - UC KEZ OLDU (29
  Agustos 433ff75, 1 Eylul 3ca668a, 4 Eylul 4fc6100 sonrasi). 4 Eylul'de
  expo-sharing AYNI GUN kuruldu ve birkac saat icinde geride kaldi. Expo, SDK 57 icin yama
  surumleri yayimliyor ve "packages match versions required by installed
  Expo SDK" kontrolu bizim paketlerimiz geride kaldigi anda dusuyor.
  Belirti yaniltici: CI, koda dokunmayan bir DOKUMAN commit'inde kirmizi
  oluyor ve suc son commit'te sanilyor. 1 Eylul'de fda5d60 13:50'de gecti,
  b45577a 22:21'de dustu, arada paketlere dokunan hicbir sey yoktu.

  COZUM TEK KOMUT:  cd mobile && npx expo install --fix
  Sonra dogrula (tsc, lint, npm test, expo export, expo-doctor) ve
  mobile/package.json ile mobile/package-lock.json'i commit'le.

  CI KOSUSUNU ELLE OKUMAK: depo GENEL, yani gh olmadan da bakilabiliyor -
    curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=8"
  ve bir kosunun adimlari icin .../actions/runs/<id>/jobs

  FAST REFRESH EKRANI YENIDEN BAGLIYOR ve "ilk odaklanma" sayaclarini
  sifirliyor. Duzenleme yaptiktan sonra "tazelenmedi" gorunumu genelde bu -
  hata teshis etmeden once UYGULAMAYI BASTAN BASLAT.

  SIMULATORDE METIN ALANLARINA ODAKLANILAMIYOR (4 Eylul, olculdu).
  Baslik cubugundaki dokunuslar CALISIYOR - zile basildi, gitti - ama React
  Native'in TextInput'lari odaklanmiyor: klavye acilmiyor, uzun basmada
  yapistirma menusu de cikmiyor. Dort yontem denendi (duz dokunus, bekleyen
  dokunus, uzun basma, kucuk hareketli dokunus); hicbiri tutmadi.
  SONUC: veri girisi gerektiren dogrulamalarda KULLANICIYA yazdir, sonra
  devral. Zaman kaybetme.

  SIMULATORDE METIN YAZDIRMAK KARAKTER DUSURUYOR. Kisa parcalar hâlinde yaz
  ve HER ADIMDA ekran goruntusuyle dogrula; dokunuslarin da iskalayabildigini
  unutma (bu oturumda iskalayan dokunuslar olmayan bir hataya teshis
  konulmasina yol acti). Uzun metin icin: xcrun simctl pbcopy + yapistir.

  BIR ADRES BIR KEZ SERT SEKERSE RESEND ONU KALICI OLARAK SUSTURUR - ve
  arayuz yine "gonderildi" der (sendVerificationOTP hatayi bilerek
  yansitmiyor). Teshis sirasi: resend.com/emails -> durum "Suppressed" mi ->
  resend.com/emails/suppressions -> Cloudflare Email Routing kurallari.

  DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).

  UZAK ADRESLI GORSEL YUKLENMIYOR: CSP img-src 'self' data: blob:.

  NODE 24'UN fetch'i Sec-Fetch-* BASLIKLARI GONDERIYOR, bu da Better Auth'un
  origin dogrulamasini ZORLUYOR. Betikle /api/auth'a istek atarken Origin sart.

  DESTEKLENEN PARA BIRIMI YALNIZCA TRY VE USD (money.ts).

  ARTIK GERCEK KULLANICI OLABILIR. 1.0 canli; production veritabaninda
  yalnizca bizim demo hesaplarimiz oldugu VARSAYILAMAZ. Production'a
  dokunan her betik once OKUYUP saymali, sonra yazmali.

TESTLER - NE NEREDE:
  KOK      npm test                  584 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      77 vitest + 18 jest
  E2E      npm run test:e2e           56 test, ~10 dk

  MOBILDE IKI KOSUCU VAR ve sinir DIZINE gore (ADR-042, ADR-043):
    lib/**                    -> vitest   (react-native'e dokunmuyor)
    components/**, test/screens/** -> jest (dokunuyor)
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.

E2E - NASIL CALISIYOR:

  ILK KOSU SOGUK DERLEMEYLE YARISIYOR - VE KAYBEDEBILIYOR.
  Kaynak degistikten SONRAKI ILK kosuda Turbopack rotalari TALEP UZERINE
  derliyor. Test basina sinir 60 sn ve o yaris kaybedilebiliyor. BELIRTI
  YANILTICI: yazma istekleri asili kaliyor, dugme "Olusturuluyor..." de
  donup kaliyor - sanki bir mantik hatasi varmis gibi. Aslinda o uca ILK
  KEZ gidiliyor ve rota isleyicisi daha derleniyor.

  1 Eylul'de bu YANLIS TESHISE IKI KEZ goturdu: once "ortam kararsiz"
  denildi, sonra "sebep bende" denildi. Ikisi de yanlisti. OLCUM:
    kosu 1  degisiklikler, derlenmemis  -> DUSTU  (4.0 dk)
    kosu 2  stash (daha once derlenmis) -> 7 gecti (32.6 sn)
    kosu 3  degisiklikler, artik derli  -> 7 gecti (31.7 sn)
  Ayni kod, iki farkli sonuc. Belirleyici olan ONBELLEK.

  KURAL: E2E dusunce ONCE ISINDIRIP TEKRARLA. Ucuzu:
      npx playwright test e2e/auth.spec.ts
  Ayni sonuc iki kez ust uste cikiyorsa gercek bir kusurdur.
  (Dosya filtresi kurulumu ELEMEZ - chromium projesinin
  dependencies: ["setup"] bagi var. ELEYEN sey -g.)

  DEGISIKLIGIN SEBEP OLUP OLMADIGINI OLCMENIN YOLU: git stash push -u ile
  kaldirip kos, sonra pop'layip TEKRAR kos. Yalnizca stash'li kosuyu
  gormek YANILTIR - o icerik zaten derlenmis oluyor.

  - CIKTIYI "| tail" ILE BORUYA SOKMA. Cikis kodu tail'den gelir (hep 0) ve
    hata ayrintisi kirpilir. Dosyaya yaz, sonra oku.
  - Tam kosu ~10 dakika, 56 test. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.
  - 3000'deki dev sunucusu KAPALI OLMALI. (Kapattiktan sonra GERI ACMAYI
    unutma - unutuldugunda mobil uygulama "Something went wrong" veriyor.)
  - Sema degistiyse once: npm run db:migrate:e2e
  - Tek seferlik kodlar veritabanindan okunuyor (readOtpFromDatabase).

MOBILI SIMULATORDE ACMAK:
  xcrun simctl boot <udid> && open -a Simulator     (ikisi de sart)
  npm run dev                    (kokte, 3000)
  cd mobile && npx expo start --ios
  Giris: e-posta kodu yolu; kod GELISTIRME veritabanindan okunuyor
  (Verification tablosu, identifier "sign-in-otp-<email>"). Parola yazmaya
  gerek yok.

DIGER ADAYLAR: PROGRESS.md'deki liste - PLAN DEGIL, secenek listesi.
  Fis fotografi + profil fotografi TEK ADAY ve ARTIK BASLANABILIR (1.0
  yayinlandi): CSP'yi, gizlilik politikasini, Info.plist izinlerini ve App
  Privacy anketini birden degistiriyor - o yuzden gorev olarak verilmeli.
