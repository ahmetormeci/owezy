# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI?

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel. Commit listeliyorsa once repository'nin gercek
durumunu dogrula, sonra bu dosyayi duzelt.

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

Updated: 2026-08-27

Current task:
  APP STORE'A ILK GONDERIM. Kod tarafinda tikanan bir sey yok; kalan is
  agirlikla App Store Connect'te ve KULLANICIDA.

BEKLEYEN TEK ENGEL - UYGULAMA ADI:
  "Owezy" adi App Store Connect'te alinamiyor. Olculdu: App Store'da o adda
  YAYINLANMIS bir uygulama yok (itunes arama, TR ve dunya: 0 sonuc). Yani
  adi baska bir gelistirici tutmuyor - kullanicinin KENDI sildigi kaydin
  rezervasyonu tutuyor.

  NEDEN IKI KAYIT VARDI: eski kayit YANLIS bundle ID ile acilmis
  (net.wezy.app - "o" eksik). eas submit o kimlige ait bir kayit bulamayinca
  yenisini yaratti ve ad dolu oldugu icin sonuna ek koydu.
  DOGRU KAYIT: Apple ID 6805650395, bundle net.owezy.app.

  YAPILACAK (kullanicida): developer.apple.com/contact/app-store uzerinden
  "App Name Availability" konusuyla adin serbest birakilmasi isteniyor.
  Yeniden adlandirma ve silme denendi, ikisi de birakmadi.

  ACELE DEGIL: ad, listenin EN SON ihtiyac duyulan parcasi. Telefonda gorunen
  ad app.json'dan geliyor ve zaten "Owezy"; TestFlight magaza adina bakmiyor.

DERLEME VE GONDERIM - HAT CALISIYOR:
  eas.json yazildi (production + preview profilleri).
  EXPO_PUBLIC_API_BASE_URL uretim profilinde https://owezy.net'e SABITLENDI -
  o satir olmadan TestFlight'taki uygulama localhost:3000'e baglanmaya
  calisir ve belirtisi "sunucu kapali" gibi gorunur.
  Ilk derleme gecti, eas submit binary'yi App Store Connect'e yukledi.

  DIKKAT: IKON O DERLEMEDEN SONRA DEGISTI. Gonderimden once BIR KEZ DAHA
  derlenmeli:
      cd mobile && npx eas-cli build --platform ios --profile production
      cd mobile && npx eas-cli submit --platform ios --latest

  Ilk derleme bir bagimlilik cakismasinda dusmustu ve sebebi kayda deger:
  expo-router, react-native-reanimated'i JOKER (*) yaziyor; npm en yenisini
  (4.6.0) sectii, o da worklets 0.12'yi getirdi ve expo-modules-core en fazla
  0.10 ile derleniyor. Ikisi de artik DOGRUDAN bagimlilik ve SABIT
  (reanimated 4.5.1, worklets 0.10.1) - sabitlenmeseydi ayni hata her
  npm install'da geri gelirdi. Expo Go'da gorunmuyordu: o, native kodu hazir
  tasiyor, derlemiyor.

SENDE KALANLAR:

  1. UYGULAMA ADI - yukarida.

  2. E-POSTA DOGRULAMA - IKI HESAPTA YAPILMALI (yayindan sonra):
     appreview@owezy.net VE kendi hesabin.
       parolayla gir -> kullanici menusu -> Iki adimli dogrulama ->
       kirmizi uyaridaki "Dogrulama kodu gonder" -> gelen kodu gir
     YAPILANA KADAR O HESAPLARDA "Kod gonder" YOLUNU KULLANMA: dogrulanmamis
     bir hesapta e-posta koduyla giris PAROLAYI SILIYOR (ADR-041). App Review
     Information'daki parola boyle olurse inceleyici giremez.
     NOT: 2FA acip kapatmak dogrulama SAYILMIYOR - emailVerified'a dokunmuyor.

  3. APP STORE CONNECT - "1.0 Prepare for Submission" doldurulacak:
     ekran goruntuleri, Description, Keywords, Promotional Text, Category
     (Finance / Utilities), Age Rating (hepsi None -> 4+), Support URL.
     App Privacy'de 7 veri turunun her biri "Set Up" ile yapilandirilip
     Publish edilecek: Purpose hepsinde App Functionality, Linked ilk beste
     Yes / Crash+Diagnostic No, Tracking hepsinde No.

  4. CLERK'IN SON IZLERI (aceleye gerek yok): panelin webhook kaydi, Clerk
     hesabi, better-auth dali (git push origin --delete better-auth).

BITEN VE OLCULEN ISLER (bir daha "yapilacak" diye yazilmasinlar):
  DNS      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r   (dig ile)
  SENTRY   "Prevent Storing of IP Addresses" acik
  POSTA    destek@owezy.net acik, kullanicinin kutusuna yonleniyor
  TEMIZLIK Vercel, .env.local, mobile/.env.local'de CLERK adi gecen hicbir
           sey kalmadi (degisken ADLARI okunarak dogrulandi)
  IKON     assets/icon.png degistirildi: kilavuz cizgileri vardi ve uygulama
           kimligiyle alakasizdi. Yenisi uygulamanin kendi BrandMark
           SVG'sinden, marka rengi --brand token'indan (#065ac0),
           1024x1024, alfa kanalsiz.

AKILDA TUTULACAKLAR:

  DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).
    Better Auth'un revokeUnprovenAccountAccess'i, emailVerified=false bir
    satira e-posta koduyla ulasildiginda butun hesap baglarini siliyor.
    Gerekcesi DOGRU; eksik olan bizim e-postayi hic dogrulamamamizdi.
    Artik kayitta kod gidiyor ve arayuz iki yerde uyariyor. Giris
    dogrulamaya BAGLANMADI - o, ADR-035'i geri acardi.

  NODE 24'UN fetch'i Sec-Fetch-* BASLIKLARI GONDERIYOR, bu da Better Auth'un
    origin dogrulamasini ZORLUYOR. Betikle /api/auth'a istek atarken Origin
    basligi sart; yoksa MISSING_OR_NULL_ORIGIN.

  EXPO GO ILE MAGAZA EKRAN GORUNTUSU ALINAMIYOR (dil): uygulama dili cihaz
    dilinden okunuyor ama Expo Go'nun kendi yerellestirmesi araya giriyor ve
    Intl "en" donduruyor. Turkce kare icin ya gercek bir derleme ya da
    _layout.tsx'te gecici bir sabit gerekiyor.

  SIMULATOR TUZAKLARI: simctl boot pencere ACMIYOR (open -a Simulator de
    gerekli), ve uzun metin tek seferde yazdirilinca KARAKTER DUSUYOR.
    Ayrintisi AGENTS.md'de.

E2E - NASIL CALISIYOR:
  - Tam kosu ~10 dakika, 56 test. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.
  - 3000'deki dev sunucusu KAPALI OLMALI.
  - Sema degistiyse once: npm run db:migrate:e2e
  - Tek seferlik kodlar veritabanindan okunuyor (readOtpFromDatabase).

MOBILDE HENUZ YOK (bilincli kapsam disi):
  2FA acma/kapatma (web'de kaliyor, ADR-040), "bu cihazi hatirla",
  parola kurtarma ekrani (web'e yonlendiriyor), gorunen adi duzenleme,
  bildirimler, EXACT/PERCENTAGE duzenleme, silineni geri alma,
  daveti kabul etme, odeme duzenleme, uye cikarma, grup adi duzenleme.

DIGER ADAYLAR: PROGRESS.md'deki liste - PLAN DEGIL, secenek listesi.
