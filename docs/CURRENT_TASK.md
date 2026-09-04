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
    panel    olculemez - KULLANICIYA SOR, varsaymadan
-->

Updated: 2026-09-04

Current task:
  1.0.1 ICIN SECILEN DORT ISTEN IKISI BITTI.

  UNIVERSAL LINK - ZINCIRIN HER OLCULEBILIR HALKASI DOGRU, SON ADIM
  SIMULATORDE DOGRULANAMADI.

  OLCULDU VE DOGRU:
    AASA bizde        200, application/json, SIFIR YONLENDIRME
    AASA Apple CDN'de https://app-site-association.cdn-apple.com/a/v1/owezy.net
                      -> 200, icerik bizimkiyle BIREBIR AYNI
    entitlement       ikilide "applinks:owezy.net" var (strings ile bakildi)
    iOS swcd          domaini taniyor, CDN'den cekiyor, 200 + 903 bayt,
                      "finished successfully"
    /join ekrani      gecersiz kod -> cevrilmis hata + cikis yolu
    GIRIS YAPILMAMIS  AuthGuard atlamiyor, "once giris yap" ciziliyor

  DOGRULANAMADI: https adresinin uygulamaya devri. "xcrun simctl openurl
  https://..." SAFARI'yi aciyor - temiz kurulumdan ve CDN dolduktan sonra
  da. simctl'in universal link cozumlemesini tetikleyip tetiklemedigi
  BELIRSIZ; swcutil simulatorde YOK, yani sahiplenmenin onaylanip
  onaylanmadigi okunamiyor.

  SONRAKI ADIM: 1.0.2 TestFlight'a yuklendi -> KULLANICI iPhone 12'sinde
  denesin. Davet baglantisina dokununca Safari mi uygulama mi aciliyor?

  TESTFLIGHT NEDEN YETIYOR: eas submit build'i App Store Connect'e YUKLUYOR,
  incelemeye GONDERMIYOR. Hesap sahibi zaten internal tester, yani Beta App
  Review de gerekmiyor. Mağaza surumunu beklemeye gerek yok.

  1.0.1 HALA INCELEMEDE ve App Store Connect ayni anda iki surumu incelemeye
  almiyor. 1.0.2'yi incelemeye gonderme 1.0.1 ciktiktan SONRA.

  RISK YENIDEN DEGERLENDIRILDI - ONCE SANILDIGINDAN KUCUK: sahiplenme
  CALISMAZSA baglantilar Safari'de acilir, yani BUGUNKU davranis surer -
  gerileme degil. Tehlikeli olan "sahiplenme calisir ama uygulama kotu
  karsilar" hali ve o taraf artik dogrulandi (gecersiz kod + giris
  yapilmamis).

  1.0.1 GONDERILDI (4 Eylul) - build 11, gonderim 8b62ced9. APPLE'IN
  INCELEMESI BEKLENIYOR.

  ONAY GELINCE ILK IS: KOPRUYU KALDIR. Silinecekler asagida "KOPRU GECICI"
  basliginda. Ama once 1.0.1'in YAYGINLASMASINI bekle - erken kaldirilirsa
  guncellemeyi almamis her telefon yeniden kirilir.

  RET GELIRSE: gerekce yeni bir gorev tanimlar.

  SILINENI GERI ALMA EKRANDA DOGRULANDI (4 Eylul): silinmis satir soluk ve
  ustu cizili, RESTORE calisiyor. Ayrica CIKISSIZ BIR DURUM bulundu ve
  duzeltildi - tek harcamasini silen kullanici geri alamiyordu.

  SIMULATORDE KUCUK METIN HEDEFLERI DOKUNUS ALMIYOR. "Delete", "Manage
  members" gibi tek satirlik metin dugmeleri yanit vermiyor; kartlar,
  satirlar ve hitSlop'u olan zil calisiyor. Sebep BULUNAMADI - taze
  simulatorde ve dusuk yukte de surdu, yani ortam degil.

  COZUM: DOKUNMA, DERIN BAGLANTIYLA GIT.
    grep -oE "groups/[0-9a-f-]{36}" <dev sunucusu logu>
    xcrun simctl openurl <udid> "exp://127.0.0.1:8081/--/groups/<id>/members"
  Ekran dogrudan aciliyor ve ORADAKI dokunuslar calisiyor. 4 Eylul'de
  gruptan ayrilma boyle dogrulandi. Saatlerce dokunus denemeden ONCE bunu
  dene.

  SECILEN DORT IS (kullanici 4 Eylul'de secti):
    CSV disa aktarma        BITTI  (6f924a8)
    silineni geri alma      BITTI, ikisi de ekranda dogrulandi
    gruptan ayrilma (mobil) BITTI, ekranda dogrulandi
    universal link          BASLANMADI - development build sart
    push bildirim           BASLANMADI - APNs + App Privacy anketi

  GONDERIM DORDU DE BITINCE. Kullanici "diger islerimizi de yapip app'e
  guncellemeyi oyle atalim" dedi.

  KOSAN BUILD 59c40b94 ESKIDI: 1.0.1 + zil iceriyor ama CSV ve geri almayi
  icermiyor. Gonderilmeyecek; yeni build alinacak.

  1.0.1 SIMDIYE KADAR SUNLARI TASIYOR:
    2FA cerezi duzeltmesi   mobile/lib/two-factor-cookie.ts
    dil beyani              CFBundleLocalizations: ["en", "tr"]
    bildirim zili           baslik cubugunda, tum ekranlarda (Faz 37)
    CSV disa aktarma        filtre satirinda (Faz 38)
    silineni geri alma      web bitti, mobil dogrulanacak (Faz 39)

  NE OLDU: 2FA acik hesaplar iOS 1.0'a HIC GIREMIYORDU. Better Auth cerez
  adina https'te "__Secure-" onegi ekliyor; mobil 1.0 cerezi metin
  aramasiyla buluyor ve arama onekli adin ICINDE de eslesip onegi
  dusuruyor. Sunucu adi birebir ariyor, bulamiyor, "Dogrulama suresi
  doldu" cikiyor. Tam anlatim ADR-045'te.

  YAPILDI (4 Eylul):
    sunucu koprusu   src/lib/two-factor-cookie-bridge.ts + route.ts
                     CANLIDA (04d8ed5). Magazadaki 1.0 artik calisiyor.
    mobil ayristirici mobile/lib/two-factor-cookie.ts duzeltildi; kural
                     artik onegi TANIMIYOR, adin nerede bittigini biliyor.
                     Testlere production bicimi eklendi (6 yeni).

  KOPRU GECICI VE KALDIRILMALI. 1.0.1 yayilip yayginlasinca:
      src/lib/two-factor-cookie-bridge.ts        SIL
      src/lib/two-factor-cookie-bridge.test.ts   SIL
      src/app/api/auth/[...all]/route.ts         eski haline dondur
                                                 (yalnizca toNextJsHandler)

  KOPRUYU ERKEN KALDIRMA: kaldirildigi anda GUNCELLEMEYI ALMAMIS her
  telefon yeniden kirilir. Olcut "1.0.1 gonderildi" degil, "eski surum
  pratikte kalmadi".

1.0 CANLIDA - 4 EYLUL 2026 (olculdu, varsayim degil):
  TR   Owezy                  apps.apple.com/tr/app/owezy/id6805650395
  US   Owezy: Split Expenses  ayni id, /us/app/owezy-split-expenses/
  surum 1.0 · 36 MB · iOS 16.4+ · 127 cihaz · Finance · 4+
  trackId 6805650395 (eas.json'daki ascAppId ile ayni)

  IKI ADLI KIMLIK TUTTU. Yerellestirme basina ad ayrimi magazada gorunur
  halde: Turkce arayuzde "Owezy", Ingilizce'de "Owezy: Split Expenses".
  Turkce aciklama da yerinde.

  OLCMENIN YOLU (App Store Connect'e girmeden):
    curl -s "https://itunes.apple.com/lookup?bundleId=net.owezy.app&country=tr&lang=tr_tr"

MAGAZA "YALNIZCA INGILIZCE" DIYOR - GERCEK AMA KUCUK BIR KUSUR:
  languageCodesISO2A alani yalnizca EN donuyor. Sebep: app.json'da
  CFBundleLocalizations YOK ve Expo paketi varsayilan olarak tek bir
  en.lproj ile cikiyor. Uygulama tamamen iki dilli - ceviri JS tarafinda,
  bundle'da degil - yani ISLEYIS DOGRU, magaza sayfasindaki "Languages"
  satiri yaniltici.

  Duzeltmesi app.json'a bir dizi eklemek ve YENI BUILD almak. 1.0.1
  adayi; tek basina build almaya degmez, baska bir degisiklikle birlikte
  gitsin.

SIRADAKI IS - ARTIK ACIK, AMA SECILMEDI:
  universal link (asagida - Expo Go'da denenemiyor, development build sart)
  PUSH BILDIRIM (APNs sertifikasi, expo-notifications, izin istemi, yeni
    build ve App Privacy anketinde degisiklik)
  CFBundleLocalizations (yukarida)

  Bu liste destek sayfasinda da yazili (src/content/legal/support.ts,
  "bugunku sinirlar"). ORASI DA GUNCELLENMELI - bir madde bitince.

LISTEDEN DUSEN IKI MADDE - BIR DAHA "mobilde eksik" DIYE YAZILMASINLAR:
  odesme duzenleme    -> HICBIR YERDE UC YOK. Web de yalnizca iptal
                         edebiliyor ve mobil bunu ZATEN yapiyor.
  silineni geri alma  -> uc var (POST .../restore) ama WEB'DE DE ARAYUZ YOK.
  Ikisi de urun sinirı, mobil sinirı degil. Yapmak = iki tarafa birden yeni
  ozellik eklemek; AGENTS.md gorev verilmeden bunu yasakliyor.

UNIVERSAL LINK - NEDEN ERTELENDI:
  Davet baglantisi (owezy.net/join/<kod>) uygulamada acilmiyor; kullanici
  onu "Gruba katil" alanina YAPISTIRIYOR. Acilmasi icin uc sey gerekiyor:
    1. owezy.net/.well-known/apple-app-site-association (yeni web ucu)
    2. app.json'da associatedDomains + App ID'de Associated Domains yetkisi
    3. YENI BUILD
  Ve belirleyici olan: EXPO GO'DA CALISMIYOR, yani simulatorde acip
  bakilamiyor. Development build sart.

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
