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
  2FA CEREZ HATASI - KOPRU CANLIDA, MOBIL DUZELTMESI SIRADA.

  HEMEN SONRAKI ADIM: mobile/lib/two-factor-cookie.ts'deki ayristiriciyi
  duzelt, testlerine onekli fixture ekle, sonra 1.0.1 build'i.

  NE OLDU: 2FA acik hesaplar iOS 1.0'a HIC GIREMIYORDU. Better Auth cerez
  adina https'te "__Secure-" onegi ekliyor; mobil 1.0 cerezi metin
  aramasiyla buluyor ve arama onekli adin ICINDE de eslesip onegi
  dusuruyor. Sunucu adi birebir ariyor, bulamiyor, "Dogrulama suresi
  doldu" cikiyor. Tam anlatim ADR-045'te.

  YAPILDI (4 Eylul, canlida): sunucu koprusu -
  src/lib/two-factor-cookie-bridge.ts + route.ts. Magazadaki 1.0 artik
  calisiyor.

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
  CSV disa aktarma (uc hazir; telefonda paylasim sayfasi gerekiyor -
    expo-sharing + expo-file-system, YENI BAGIMLILIK)
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

  MOBILDE DEGISIKLIK YAPTIYSAN "npx expo export" DE KOS. tsc, lint ve
  testler UCU DE temizken paket kirik olabiliyor: app/ altina konan bir test
  dosyasi EAS build 6'yi dusurdu (expo-router app/'in TAMAMINI require.context
  ile uretim paketine aliyor; ".test.tsx" icin istisna YOK). Ekran testleri
  bu yuzden test/screens/ altinda.

  expo-doctor'IN YERELDEKI CIKTISI YANILTICI: tek sikayeti CocoaPods ise
  o kontrol Linux'ta HIC CALISMIYOR, yani CI'da baska bir kontrol dusuyor
  olabilir. Tam ciktiyi oku.

  BU KONTROL BIZ HICBIR SEY YAPMADAN DA KIRILIYOR - IKI KEZ OLDU (29
  Agustos 433ff75, 1 Eylul 3ca668a sonrasi). Expo, SDK 57 icin yama
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
  KOK      npm test                  574 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      62 vitest + 14 jest
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
