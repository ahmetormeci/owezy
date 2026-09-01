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

Updated: 2026-08-29

Current task:
  MOBIL UYGULAMAYI TAMAMLAMAK. App Store gonderimi BILEREK BEKLETILIYOR -
  kullanici "iyice tamamlayalim, oyle cekeriz ekran kaydini" dedi.

NEDEN BURADAYIZ:
  1.0 Apple tarafindan reddedildi (Guideline 2.1, "Information Needed" -
  hata degil, yedi maddelik bilgi talebi). Cevabi hazirlarken hesap silme
  eksigi cikti ve yapildi (Faz 33).

  Sonra kullanici mobil uygulamayi ILK KEZ acti ve "dumduz bir metinler
  toplulugu" dedi. Gonderim orada durduruldu; arayuz elden geciriliyor
  (Faz 34). Kullanici 29 Agustos'ta tekrar bakti: "sorun yok gibi duruyor".

SIRADAKI IS - MOBILDE KALANLAR:
  arama / kategori suzme / "yalnizca beni ilgilendirenler"
  bildirimler (mobilde hic yok)
  daveti kabul etme (olusturma var, kabul web'de)
  odesme duzenleme, silineni geri alma, grup adi duzenleme
  uygulama icinden dil secimi (su an cihaz dilinden okunuyor)

  Bu liste destek sayfasinda da yazili (src/content/legal/support.ts,
  "bugun eksik olanlar"). ORASI DA GUNCELLENMELI - bir madde bitince.

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
  KOK      npm test                  554 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      53 vitest + 14 jest
  E2E      npm run test:e2e           56 test, ~10 dk

  MOBILDE IKI KOSUCU VAR ve sinir DIZINE gore (ADR-042, ADR-043):
    lib/**                    -> vitest   (react-native'e dokunmuyor)
    components/**, test/screens/** -> jest (dokunuyor)
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.

E2E - NASIL CALISIYOR:
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
