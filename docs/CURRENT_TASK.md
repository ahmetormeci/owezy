# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI? Dosyaya hash yazmiyoruz (bir dosya kendi commit'inin hash'ini
iceremez). Bunun yerine git'e soruyoruz - bu dosya son guncellendikten sonra
kod degisti mi:

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel. Commit listeliyorsa once repository'nin gercek
durumunu dogrula, sonra bu dosyayi duzelt. (mobile de listede: Faz 27.4'ten
sonra kimlik dogrulama kodunun bir parcasi orada yasiyor.)

AMA BU KONTROL YALNIZCA KODU KAPSIYOR - ve staleness'in asil saklandigi yer
orasi degil. "SENDE KALANLAR" maddeleri DIS DUNYAYI anlatiyor: DNS kayitlari,
Vercel degiskenleri, Sentry ayarlari, App Store Connect, saglayici panelleri.
Onlari ne git ne de bir test goruyor; kullanici sessizce halletmis olabilir.

BU DOSYA HER YENIDEN YAZILDIGINDA O MADDELER TEK TEK OLCULMELI, ustteki
listeden kopyalanmamali. Olcum yollari:
    DNS      dig +short TXT _dmarc.owezy.net
    env      grep -oE '^[A-Z0-9_]+' .env.local   (ADLAR; degerleri okuma)
    canli    curl -sI https://owezy.net/...
    panel    olculemez - KULLANICIYA SOR, varsaymadan

26 Agustos'ta tam bu hata yapildi: aspf=s -> aspf=r isi coktan bitmisti,
dosya "yapilacak" diye tasidi ve kullaniciya ikinci kez anlatildi.
-->

Updated: 2026-08-26 (25)

FAZ 27 BITTI - IKI ADIMLI DOGRULAMA WEB'DE VE MOBILDE.
Karar ve butun gerekceler ADR-040'ta.
  27.1  Sema (TwoFactor + User.twoFactorEnabled)  BITTI  98d79b5
  27.2  Sunucu (eklenti + email-otp kapisi)       BITTI  98d79b5
  27.3  Web arayuzu + parola kurtarma             BITTI  e9f3de1
  27.4  Mobil ikinci faktor                       BITTI
  27.5  Dokumanlar (ADR-040)                      BITTI

Current task:
  YOK. Siradaki isi kullanici secmedi. PROGRESS.md'deki aday listesi bir
  PLAN DEGIL, secenek listesi - oradan biri kendiliginden baslatilmaz.

2FA ARTIK ACILABILIR. 27.4'ten once acilmamasi gerekiyordu (2FA acan hesap
mobilde giremiyordu); o kisit KALKTI.

FAZ 27'DEN AKILDA TUTULACAKLAR:

  MOBILDE CEREZ MAKINESI TAM IKI UC ICIN VAR:
    /two-factor/verify-totp ve /two-factor/verify-backup-code.
    credentials:"omit" DEGISMEDI (ADR-038 duruyor). Cerez bir kez yakalanip
    elle konuyor, YALNIZCA BELLEKTE duruyor (sunucudaki omru 600 saniye).
    Origin YALNIZCA cerez tasiyan cagrilara ekleniyor - her cagriya koymak
    formCsrfMiddleware'i tetikleyip bugun calisan giris akisini kirilgan
    yapardi.

  trustedOrigins'E DOKUNULMADI ve bu bir OLCUM: varsayilan liste
  BETTER_AUTH_URL'i iceriyor, gonderdigimiz Origin ise apiBaseUrl() - dev'de
  localhost:3000, uretimde owezy.net, ikisi de ayni. Bu dosya 25.5'ten beri
  "sunucuda trustedOrigins" diye bir adim tasiyordu; gerekmiyormus.

  YANITTA UC Set-Cookie SATIRI VAR (ikisi oturum cerezlerini SILEN bos
  satirlar, biri meydan okuma). Ayristirma ADA GORE yapiliyor.

  verify-totp OTURUMU DONDURUYOR (yeni oturum + eskisini sil). Mobilde bu,
  SecureStore'daki belirtecin yenilenmesi demek - accept() zaten yapiyor.

  createOTP(secret).url(...) anahtari URI'ye BASE32'LEYEREK yaziyor. Ekranda
  gorunen deger HAM ANAHTAR DEGIL; testler once base32 cozuyor.

  FORM GIRDISI TUZAGI (cihazda olculdu, testte gorunmuyordu):
    Yedek kodlar buyuk/kucuk harfe DUYARLI ve iOS Safari metin girdilerinde
    ilk harfi kendiliginden BUYUTUYOR. autoCapitalize="none" olmadan
    kullanici dogru kodu yazdigi halde giremiyor. Playwright'in fill()'i bunu
    taklit etmedigi icin testi AKIS degil OZNITELIK koruyor.

  MOBILIN OTOMATIK TESTI YOK. Playwright web'e bagli (aday listesinde).
  27.4 once curl ile sunucu sozlesmesi, sonra iOS simulatorunde gercek akis
  olarak dogrulandi.

SENDE KALAN TEK IS - CLERK'IN SON IZLERI (aceleye gerek yok):
    Clerk paneli : Webhooks -> Endpoints'teki olu kayit
    Clerk hesabi : development ornegi de dahil kapatilabilir
    git          : better-auth dali birlesti, silinebilir
                   (git push origin --delete better-auth)
  E2E ARTIK CLERK'E BAGLI DEGIL - kurulum test kullanicilarini kendisi
  yaratiyor, yani development ornegi de gerekmiyor.

BITEN VE OLCULEN ISLER (26 Agustos - burada duruyorlar ki bir daha
"yapilacak" diye yazilmasinlar):

  APP STORE - App Review Information'da appreview@owezy.net yazili ve o
    bilgilerle giris yapilabiliyor (kullanici dogruladi). Hesap uctan uca
    calisiyor. Gizlilik anketi de gozden gecirildi.

  DNS - DMARC hizalamasi duzeltilmis. dig ile dogrulandi:
      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r
    aspf RELAXED, yani SPF de DKIM de hizaliyor. adkim=s bilerek strict.

  SENTRY - "Prevent Storing of IP Addresses" acik.

  destek@owezy.net - acik, kullanicinin kendi kutusuna yonleniyor.

  TEMIZLIK - Vercel, .env.local ve mobile/.env.local'de CLERK ADI GECEN
    hicbir sey kalmadi (degisken ADLARI okunarak dogrulandi).

E2E - NASIL CALISIYOR:
  - Kurulum test kullanicilarini KENDISI yaratiyor (/api/auth/sign-up/email)
    ve giris UYGULAMANIN KENDI FORMUNDAN yapiliyor. Elle hazirlik yok.
  - Tam kosu ~10 dakika, 55 test. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.
  - 3000'deki dev sunucusu KAPALI OLMALI: Next 16 ayni dizinden ikinci bir
    next dev'i reddediyor, farkli port olsa bile.
  - Sema degistiyse once: npm run db:migrate:e2e
  - two-factor.spec.ts ve password-reset.spec.ts KENDI kullanicilarini
    yaratiyor. Paylasilan uc test kullanicisi KULLANILAMAZ - verify-totp
    oturumu donduruyor ve diske yazilmis storageState gecersizlesirdi.
  - Tek seferlik kodlar veritabanindan okunuyor (readOtpFromDatabase).
    Baska yolu yok: test posta kutusunu okuyamiyor.

MOBILDE BUGUN NE VAR:
  giris (e-posta kodu, parola, ve IKINCI FAKTOR - uygulama kodu ya da yedek
  kod), parola kurtarma icin web'e yonlendirme, grup listesi / tek grupta
  dogrudan gruba yonlendirme, grup olusturma (satir ici), uyeler + davet
  linki, fis ekrani, satir ici harcama girisi, harcama detayi.

MOBILDE HENUZ YOK (bilincli kapsam disi):
  - 2FA ACMA/KAPATMA (ADR-040, secenek B1: kurulum web'de kaliyor)
  - "BU CIHAZI HATIRLA" (ADR-040, bilincli asimetri)
  - PAROLA KURTARMA EKRANI (web'e yonlendiriyor - secenek A1)
  - GORUNEN ADI DUZENLEME (web'de var)
  - bildirimler
  - EXACT/PERCENTAGE bolusumun mobilde duzenlenmesi
  - silinen harcamayi GERI ALMA (restore ucu VAR ama arayuz yok - web'de de)
  - DAVETI KABUL ETME (universal link onaylanmis Apple hesabi gerektiriyor)
  - odeme DUZENLEME, odemede tarih secimi
  - odesme planinda avatarlar
  - daveti iptal etme, uye cikarma, sahiplik devri
  - grup adi/aciklamasi duzenleme

ROTA YAPISI (mobil):
  /                           YALNIZCA yonlendirme (0 / 1 / 2+ karari)
  /groups                     liste - HER ZAMAN gorunur
  /groups/[id]                fis
  /groups/[id]/members        uyeler + davet
  /groups/[id]/settlements    odeme kaydi + gecmis + iptal
  /groups/[id]/expenses/[id]  harcama detayi
