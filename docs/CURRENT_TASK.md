# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI?

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel.

AMA BU KONTROL YALNIZCA KODU KAPSIYOR. "SENDE KALANLAR" maddeleri DIS
DUNYAYI anlatiyor: DNS, Vercel, Sentry, App Store Connect, Expo, saglayici
panelleri. Onlari ne git ne de bir test goruyor.

BU DOSYA HER YENIDEN YAZILDIGINDA O MADDELER TEK TEK OLCULMELI:
    DNS      dig +short TXT _dmarc.owezy.net
    env      grep -oE '^[A-Z0-9_]+' .env.local   (ADLAR; degerleri okuma)
    canli    curl -sI https://owezy.net/...
    magaza   itunes.apple.com/search?term=...&entity=software
    panel    olculemez - KULLANICIYA SOR, varsaymadan
-->

Updated: 2026-09-02

Current task:
  APPLE'IN INCELEMESI BEKLENIYOR. 1.0 (build 9) 2 Eylul'de yeniden
  gonderildi; yapilacak bir sey YOK, cevap gelene kadar beklenecek.

  KOD ISI BASLATMA. Ret gelirse gerekce yeni bir gorev tanimlar; onay
  gelirse asagidaki "SIRADAKI IS" listesi acilir. Ikisinden biri olmadan
  o listeden bir madde secip uygulama (AGENTS.md).

GONDERIM ZINCIRI - TAMAMI BITTI (2 Eylul):
  1. eas build      build 9, commit b45577a
  2. push           b45577a origin/main'de
  3. eas submit     App Store Connect'e yuklendi (submission 1b8bf705)
  4. EKRAN KAYDI    kullanici FIZIKSEL CIHAZDA cekti (iPhone 12, iOS 26.6.1)
  5. App Review'a cevap + Resubmit   yapildi

  APP REVIEW INFORMATION DOLU: demo hesap (appreview@owezy.net) ve Notes
  alani ikisi de dolduruldu. Notes'ta uygulamanin ne yaptigi, hesap silme
  yolu, izin istemi olmadigi, kullanilan dis servisler ve bolgesel fark
  olmadigi yaziyor - Apple bunu "for future submissions" diye istemisti,
  yani sonraki gonderimlerde ayni sorular tekrar sorulmasin diye. BIR DAHA
  SORMAYA GEREK YOK.

  APPLE FIZIKSEL CIHAZ ISTIYOR, SIMULATOR KAYDI KABUL DEGIL. Ret metninin
  1. maddesi acikca "captured on a physical device" diyor. Bu oturumda
  once simulator kaydi uretildi ve KULLANILAMADI; bir daha gerekirse
  dogrudan TestFlight + gercek cihaz.

  CEVAP VE NOTES METINLERI 4000 KARAKTERLE SINIRLI - IKISI DE. Cevap
  metni once 4383 karakter yazildi ve sigmadi.

NEDEN BURADAYIZ:
  1.0 once Guideline 2.1 ("Information Needed") ile reddedildi - hata
  degil, yedi maddelik bilgi talebi. Cevabi hazirlarken UYGULAMA ICI HESAP
  SILME eksigi cikti (Guideline 5.1.1(v) zorunlu kiliyor) ve yapildi
  (Faz 33).

  Sonra kullanici mobil uygulamayi ILK KEZ acti ve "dumduz bir metinler
  toplulugu" dedi. Gonderim durduruldu, arayuz elden gecirildi (Faz 34,
  on adim). O sirada BIR KUSUR DAHA cikti ve gonderimi dogrudan
  ilgilendiriyordu: tek grubu olan kullanici HESAP EKRANINA HIC
  ULASAMIYORDU, yani inceleyici silme akisini bulamazdi.

SIRADAKI IS - ANCAK INCELEME SONUCLANINCA:
  CSV disa aktarma (uc hazir ama telefonda paylasim sayfasi gerekiyor -
    expo-sharing + expo-file-system, YENI BAGIMLILIK)
  universal link (ERTELENDI, asagida)
  PUSH BILDIRIM (ERTELENDI): uygulama ici liste 1 Eylul'de geldi ama push
    ayri bir is - APNs sertifikasi, expo-notifications, izin istemi, yeni
    build ve App Privacy anketinde degisiklik. Destek sayfasi bunu ACIKCA
    yaziyor; oraya dokunmadan push eklenmemeli.

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

  BITEN: arama / kategori suzme / "yalnizca beni ilgilendirenler" ve liste
  satirindaki tekrarin temizlenmesi (1 Eylul, commit aa863b9). Kurallar
  src/lib/expense-list-view.ts'de ve WEB ILE MOBIL ORTAK - o dosyayi
  degistiren iki tarafi da gozden gecirsin.
  Daveti yapistirarak kabul etme (1 Eylul).
  Bildirimler - UYGULAMA ICI LISTE (1 Eylul).
  Tek gruplu kullanicinin hesap ekranina ulasamamasi (1 Eylul, asagida).
  Grup adi/aciklamasi duzenleme (1 Eylul, yalnizca SAHIBE gorunuyor).
  Uygulama icinden dil secimi (1 Eylul, Hesap ekraninda).
  Giris ekraninin temaya baglanmasi (1 Eylul, koyu temada bozuktu).

PRODUCTION'DAKI DEMO HESAPLAR - DIKKAT:
  appreview@owezy.net  inceleme hesabi. SILME, PAROLASINI DEGISTIRME.
  demo@owezy.net       ICINDE VERI VAR (bir grup, harcamalar, ikinci uye).
                       Atilabilir DEGIL; 1 Eylul'de silinmek uzereyken
                       fark edildi. Bir demo hesabi gerekiyorsa YENI bir
                       adres ac.
  demo2, demo3         ekran kaydi icin yaratildi ve UYGULAMA ICINDEN
                       silindi. Cloudflare yonlendirmeleri duruyor.

  YENI BIR ADRES KULLANMADAN ONCE IKI SEY: Cloudflare Email Routing'de
  ekli mi, ve Resend'in suppressions listesinde DEGIL mi. Ikisi de bu
  oturumda ayri ayri kosuyu durdurdu - ve arayuz her iki durumda da
  "Sent to ..." diyor, yani hicbir sey belli olmuyor.

GELISTIRME VERITABANINDA BIRAKILAN TEST VERISI:
  "Deniz'in evi" grubu ve davetci@ornek.test kullanicisi, davet kabulunu
  denemek icin uretildi. BILEREK BIRAKILDI: gelistirmedeki tek COK UYELI
  grup o, ve "senin payin" ile "kim odedi" ancak orada gercekten degisiyor.

GONDERIM ZINCIRI (mobil tamamlaninca, SIRASI ONEMLI):
  1. eas build   -> build 7 bu islerin HICBIRINI tasimiyor
  2. push        -> destek sayfasi artik yeni ozellikleri anlatiyor; o metin
                    ancak yeni build gonderildikten sonra dogru olur
  3. eas submit
  4. EKRAN KAYDI - SENDE. Fiziksel cihazda, uygulamayi acarak basla:
     parolayla giris -> gruba gir -> harcama ekle (bolusme turunu goster) ->
     odesme -> Hesap -> Hesabimi sil -> onay ekrani -> VAZGEC
     (Silmeyi tamamlama, demo hesap gider.)
  5. App Review'a cevap + Resubmit

  APPLE'A GIDECEK METIN HAZIR ve iki bosluk kullanicidan alindi:
     cihaz: iPhone 12, iOS 26.6
     appreview@owezy.net parolasi kullanicida
  Metnin taslagi bu oturumda uretildi; yeniden yazilmasi gerekirse Apple'in
  yedi maddesi App Review sayfasindaki mesajda duruyor.

MAGAZA KIMLIGI - COZULDU, DOKUNMA:
  Turkce     Owezy                  · Grup hesabi, kolay odesme
  Ingilizce  Owezy: Split Expenses  · Group bills, settled fast

  TURKCE AD ALANINA BIR DAHA DOKUNMA. Kilit YERELLESTIRME BASINA cikti.
  Bu hesap bu ismi bir kez KALICI olarak kaybetti (Apple: "If you remove an
  app, you'll lose ownership of the app name"); birakilirsa geri alinabilecegi
  garanti DEGIL.

  net.wezy.app SILINEMEZ, silinmeye calisilmasin - build almis bir bundle ID
  ayni organizasyonda bir daha kullanilamiyor (Apple belgeliyor). Zararsiz.

  TELEFONDAKI AD app.json'daki "name"den geliyor ve "Owezy" olarak kaldi.

BITEN VE OLCULEN ISLER (bir daha "yapilacak" diye yazilmasinlar):
  DNS      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r   (dig ile)
  SENTRY   "Prevent Storing of IP Addresses" acik
  POSTA    destek@ VE appreview@owezy.net acik, kullanicinin kutusuna
           yonleniyor (Cloudflare Email Routing)
  DOGRULAMA appreview@owezy.net'te e-posta dogrulandi (28 Agustos)
  IKON     yeni isaretle uretildi; acilis gorseli de ayni iki path'ten
  EAS      eas.json'da ascAppId yazili (6805650395)

AKILDA TUTULACAKLAR:

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
  konulmasina yol acti).

  BIR ADRES BIR KEZ SERT SEKERSE RESEND ONU KALICI OLARAK SUSTURUR - ve
  arayuz yine "gonderildi" der (sendVerificationOTP hatayi bilerek
  yansitmiyor). Teshis sirasi: resend.com/emails -> durum "Suppressed" mi ->
  resend.com/emails/suppressions -> Cloudflare Email Routing kurallari.

  DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).

  UZAK ADRESLI GORSEL YUKLENMIYOR: CSP img-src 'self' data: blob:.

  NODE 24'UN fetch'i Sec-Fetch-* BASLIKLARI GONDERIYOR, bu da Better Auth'un
  origin dogrulamasini ZORLUYOR. Betikle /api/auth'a istek atarken Origin sart.

  DESTEKLENEN PARA BIRIMI YALNIZCA TRY VE USD (money.ts).

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
  Fis fotografi + profil fotografi TEK ADAY ve 1.0 YAYINLANDIKTAN SONRA
  baslamali: CSP'yi, gizlilik politikasini, Info.plist izinlerini ve App
  Privacy anketini birden degistiriyor.
