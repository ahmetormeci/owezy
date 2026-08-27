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

Updated: 2026-08-28

Current task:
  APP STORE'A ILK GONDERIM, ADI APPLE'DA BEKLIYOR.
  Kod tarafinda tikanan bir sey YOK.

  Beklerken Faz 29 yapildi: mobilde ilk otomatik testler (53 test, ADR-042).
  GONDERILEN IKILIGE DOKUNMADI - expo export ciktisi ayni, yeni derleme
  gerekmiyor. Ayrintisi PROGRESS.md.

TIKANAN TEK SEY - UYGULAMA ADI:
  "Owezy" adi App Store Connect'te alinamiyor. Kullanici Apple destege yazdi,
  cevap bekleniyor.

  OLCULDU: App Store'da o adda YAYINLANMIS uygulama yok (itunes arama, TR ve
  dunya: 0 sonuc). Yani adi baska bir gelistirici tutmuyor - kullanicinin
  KENDI sildigi kaydin rezervasyonu tutuyor. Yeniden adlandirma ve silme
  denendi, ikisi de birakmadi.

  NEDEN IKI KAYIT VARDI: eski kayit YANLIS bundle ID ile acilmisti
  (net.wezy.app - "o" eksik). eas submit o kimlige ait kayit bulamayinca
  yenisini yaratti. DOGRU KAYIT: Apple ID 6805650395, bundle net.owezy.app.

GONDERIM DURUMU - NEREDEYSE HAZIR:
  BITTI:
    - Build 3 (yeni ikonla) App Store Connect'e yuklendi, eas submit basarili
    - Ekran goruntuleri verildi: 7 kare, 1284x2778 (6.5"), TR + EN
    - Magaza metinleri verildi (Description, Keywords, Promotional, Subtitle)
    - App Privacy dolduruldu ve yayinlandi
    - App Review Information: appreview@owezy.net, 2FA KAPALI (kapatilmali
      idi - inceleyicide authenticator yok)
    - Kullanici kendi hesabinda e-postayi dogruladi
    - appreview@owezy.net'te de E-POSTA DOGRULAMA YAPILDI (28 Agustos).
      Once Resend'in susturma listesinden cikarilmasi gerekti - asagida.

  ACIK:
    - Uygulama adi (yukarida)
    - Build 3, "1.0 Prepare for Submission" sayfasindaki Build alanindan
      SECILMELI (Apple'in islemesi bittikten sonra gorunur).

  IKON YA DA app.json DEGISIRSE yeniden derlenmeli:
      cd mobile && npx eas-cli build --platform ios --profile production
      cd mobile && npx eas-cli submit --platform ios --latest

SENDE KALAN DIGER ISLER (aceleye gerek yok):
  Clerk'in son izleri: panelin webhook kaydi, Clerk hesabi,
  better-auth dali (git push origin --delete better-auth).

BITEN VE OLCULEN ISLER (bir daha "yapilacak" diye yazilmasinlar):
  DNS      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r   (dig ile)
  SENTRY   "Prevent Storing of IP Addresses" acik
  POSTA    destek@owezy.net VE appreview@owezy.net acik, kullanicinin
           kutusuna yonleniyor (Cloudflare Email Routing)
  TEMIZLIK Vercel, .env.local, mobile/.env.local'de CLERK adi gecen hicbir
           sey kalmadi (degisken ADLARI okunarak dogrulandi)
  IKON     assets/icon.png degisti: kilavuz cizgileri vardi ve uygulamanin
           kendi kimligiyle alakasizdi. Yenisi kendi BrandMark SVG'sinden,
           marka rengi --brand token'indan (#065ac0), 1024x1024, alfasiz.
  EAS      eas.json yazildi, imzalama Expo'da, hat calisiyor.

AKILDA TUTULACAKLAR:

  BIR ADRES BIR KEZ SERT SEKERSE RESEND ONU KALICI OLARAK SUSTURUR - ve
  ARAYUZ YINE "GONDERILDI" DER. Ikisi bir araya gelince teshis edilmesi cok
  zor bir sessizlik cikiyor; 28 Agustos'ta bir tur kaybettirdi.

    Olan sira: appreview@owezy.net hesabi acildi -> kayit kodu gitti ->
    o anda Cloudflare'de O ADRES ICIN KURAL YOKTU -> kalici ret (hard
    bounce) -> Resend adresi susturma listesine aldi. Kural sonradan
    eklendi AMA SUSTURMA KALDI, yani posta Cloudflare'e hic ulasmiyordu.

    Belirtisi yok: sendVerificationOTP'nin hatasi bilerek kullaniciya
    YANSITILMIYOR (zamanlama sizintisi, better-auth.ts'te yazili) ve
    yalnizca sunucu loguna dusuyor.

    TESHIS SIRASI - kod ve DNS'i kurcalamadan once:
      1. https://resend.com/emails - o adrese giden satirin DURUMU ne?
         "Suppressed" ise gonderim hic denenmemistir.
      2. https://resend.com/emails/suppressions - satirin ... menusunden
         "Remove email address". ONCE yonlendirme kuralinin var oldugundan
         emin ol, yoksa aninda yeniden susturulur.
      3. dash.cloudflare.com -> owezy.net -> Email -> Email Routing ->
         Routing rules: adres ekli mi VE anahtari acik mi?

    Bu makineden 25. porta cikilamiyor, yani SMTP ile alici sinamasi
    YAPILAMAZ. dig calisiyor; alici testi calismiyor.

  DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).
    Better Auth'un revokeUnprovenAccountAccess'i, emailVerified=false bir
    satira e-posta koduyla ulasildiginda butun hesap baglarini siliyor.
    Gerekcesi DOGRU; eksik olan bizim e-postayi hic dogrulamamamizdi.
    Artik kayitta kod gidiyor ve arayuz iki yerde uyariyor.

  BIR OLCUM, OLCULDUGU ANIN DOGRUSUDUR. 27 Agustos'ta iki kere isirdi:
    ADR-039 "hasImage=true olan tek kullanici bile yok" diye yaziyordu ve
    kullanicinin kendi hesabi oyleydi -> kirik avatar. CURRENT_TASK da DNS
    isini "yapilacak" diye tasiyordu, oysa bitmisti. Gerekce "su an sifir
    satir var" diyorsa, o cumle zamanla yalan olabilir.

  UZAK ADRESLI GORSEL YUKLENMIYOR: CSP img-src 'self' data: blob:.
    canRenderAvatar bunu kodda sabitliyor ve testi var. Bir fotograf
    ozelligi gelirse IKISI BIRLIKTE degismeli.

  NODE 24'UN fetch'i Sec-Fetch-* BASLIKLARI GONDERIYOR, bu da Better Auth'un
    origin dogrulamasini ZORLUYOR. Betikle /api/auth'a istek atarken Origin
    basligi sart; yoksa MISSING_OR_NULL_ORIGIN.

  EXPO GO ILE MAGAZA EKRAN GORUNTUSU: uygulama dili cihaz dilinden okunuyor
    ama Expo Go'nun kendi yerellestirmesi araya giriyor ve Intl "en"
    donduruyor. Turkce kare icin _layout.tsx'te GECICI bir sabit gerekiyor
    (kullanildi ve geri alindi).

  SIMULATOR TUZAKLARI: simctl boot pencere ACMIYOR (open -a Simulator de
    gerekli), ve metin tek seferde yazdirilinca KARAKTER DUSUYOR - 5 karakterlik
    parcalar bile guvenli degil, her adimda ekran goruntusuyle dogrula.

  DESTEKLENEN PARA BIRIMI YALNIZCA TRY VE USD (money.ts). EUR ile grup
    acilmiyor.

TESTLER - NE NEREDE:
  KOK      npm test                  538 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      53 birim (vitest, RN'e dokunmayan katman)
  E2E      npm run test:e2e           56 test, ~10 dk

  MOBIL TESTLER KOKTEN KOSMUYOR ve kosmamali: agacta IKI AYRI REACT kopyasi
  var (kokte 19.2.4, mobilde 19.2.3). Mobilin provider'ini kokun React'iyle
  render etmek "useContext of null" demek - lib/i18n.tsx bunu zaten anlatiyor.
  Gerekce ADR-042.

  MOBIL KODU HICBIR LINT GORMUYOR. Kokun eslint'i mobile/**'i yok sayiyor;
  gerekce olarak gosterilen mobile/eslint.config.js HIC VAR OLMADI (olculdu).
  Aday olarak PROGRESS.md'de.

E2E - NASIL CALISIYOR:
  - Tam kosu ~10 dakika, 56 test. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.
  - 3000'deki dev sunucusu KAPALI OLMALI.
  - Sema degistiyse once: npm run db:migrate:e2e
  - Tek seferlik kodlar veritabanindan okunuyor (readOtpFromDatabase).
  - RESEND_API_KEY bos geciliyor: testler kodu veritabanindan okuyor, ucuncu
    tarafa istek atmanin kapsama katkisi yok.

MOBILDE HENUZ YOK (bilincli kapsam disi):
  2FA acma/kapatma (web'de kaliyor, ADR-040), "bu cihazi hatirla",
  parola kurtarma ekrani (web'e yonlendiriyor), gorunen adi duzenleme,
  bildirimler, EXACT/PERCENTAGE duzenleme, silineni geri alma,
  daveti kabul etme, odeme duzenleme, uye cikarma, grup adi duzenleme.

DIGER ADAYLAR: PROGRESS.md'deki liste - PLAN DEGIL, secenek listesi.
  Kullanici 27 Agustos'ta bir tanesini birlestirdi: profil fotografi ve fis
  fotografi ARTIK TEK ADAY (ayni depo, ayni yukleme arayuzu, ayni beyan
  guncellemeleri).
