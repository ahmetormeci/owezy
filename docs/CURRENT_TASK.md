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

Updated: 2026-08-26 (23)

Current task:
  FAZ 27 - IKI ADIMLI DOGRULAMA. Karar ve gerekcesi ADR-040'ta.
    27.1  Sema (TwoFactor + User.twoFactorEnabled)  BITTI  98d79b5
    27.2  Sunucu (eklenti + email-otp kapisi)       BITTI  98d79b5
    27.3  Web arayuzu + PAROLA KURTARMA             BITTI
    27.5  Dokumanlar (ADR-040)                      BITTI
    27.4  MOBIL ARAYUZ                              SIRADA

27.4 - MOBIL IKINCI FAKTOR. YAPILMADAN ONCE BILINMESI GEREKENLER:

  0. BUGUN 2FA ACAN BIR KULLANICI MOBILDE GIREMIYOR - koddan olculdu, ve
     mesaj onu YAPAMAYACAGI SEYE yonlendiriyor:
       e-posta kodu -> kancamiz reddediyor -> "Parolanla giris yap" diyor
       parola       -> sunucu 200 donuyor ama set-auth-token BASLIGI YOK
                       (mobile/lib/auth.tsx:166) -> "Bir seyler ters gitti"
     Yani birincisi ikincisini oneriyor, ikincisi de calismiyor. 27.4 bu
     yuzden bir "aday" degil, 27.3'un actigi bir bosluk.

  1. MEYDAN OKUMA CEREZLE TASINIYOR (verify-two-factor.mjs) ve mobil bilerek
     credentials:"omit" kullaniyor (ADR-038). Gereken sira:
       Set-Cookie'yi yakala -> bir sonraki istekte geri gonder ->
       Origin basligi ekle -> sunucuda trustedOrigins.
     25.5'te kaldirilan cerez makinesi YALNIZCA iki cagri icin geri geliyor:
     /sign-in/email ve /two-factor/verify-totp | verify-backup-code.

  2. "BU CIHAZI HATIRLA" MOBILDE OLMAYACAK - ayni sebep, ve bu ADR-040'ta
     bilincli bir asimetri olarak yaziyor.

  3. MOBILDE PAROLA KURTARMA DA YOK ve 27.3'ten sonra bu bir BOSLUK:
     2FA acan kullanici mobilde parolayla girmek zorunda, parolasini
     unutursa mobilde yapabilecegi hicbir sey yok. En ucuz cozum web'e
     yonlendirmek (owezy.net/reset-password) - ama karar 27.4'un isi.

  4. Mobilde KAYIT EKRANI yok ve bu bir eksiklik degil: e-posta kodu akisi
     adres kayitli degilse kullaniciyi kendisi yaratiyor.

27.3'TE OLCULENLER - 27.4'te de gecerli:
  - signIn.email, 2FA acikken HATA DONDURMUYOR. error null; bilgi
    data.twoFactorRedirect'te. Yalnizca error'a bakan istemci kullaniciyi
    OTURUMSUZ halde ana ekrana gonderir. Mobilde de ayni tuzak var.
  - /two-factor/enable 2FA'yi ACMIYOR; acan sey verify-totp. enable yalnizca
    gizli anahtari ve yedek kodlari uretiyor (verified=false).
  - verify-totp OTURUMU DONDURUYOR (yeni oturum + eskisini sil). Mobilde bu,
    SecureStore'daki belirtecin YENILENMESI gerektigi anlamina gelir -
    yenilenmezse kullanici bir sonraki istekte 401 alir.
  - createOTP(secret).url(...) anahtari URI'ye BASE32'LEYEREK yaziyor.
    Ekranda gorunen deger HAM ANAHTAR DEGIL.
  - Eklentinin kendi hiz siniri: /two-factor/* -> 10 saniyede 3 istek.
  - allowPasswordless ACILMAMALI: parolasiz biri 2FA acar, sonra e-posta
    kodu kapali + parola yok = kendini tamamen disarida birakir.

APP STORE - ACIK IS KALMADI (26 Agustos, kullanici dogruladi):
  App Review Information'da appreview@owezy.net yazili ve o bilgilerle giris
  yapilabiliyor. Hesap uctan uca calisiyor: "example" grubu, davet linkiyle
  ikinci hesap, harcamalar ve odemeler girildi. Gizlilik anketi de gozden
  gecirildi.

  DIKKAT - INCELEME BITENE KADAR: appreview@owezy.net'te (ve kendi
  hesabinda) IKI ADIMLI DOGRULAMAYI ACMA. 27.4 bitene kadar 2FA acik bir
  hesap MOBILDE GIREMIYOR - olculdu, ayrintisi asagida.

SENDE KALANLAR (uygulama tarafinda bir isi yok, ama unutulmasin):

  1. TEMIZLIK - Vercel ve .env.local BITTI (kullanici sildi, dogrulandi:
     .env.local'de yalnizca 11 gerekli degisken kaldi). Kalanlar:
       mobile/.env.local : EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (HALA DURUYOR)
       Clerk paneli      : Webhooks -> Endpoints'teki olu kayit
       Clerk hesabi      : development ornegi de dahil kapatilabilir
       git               : better-auth dali birlesti, silinebilir
                           (git push origin --delete better-auth)
     E2E ARTIK CLERK'E BAGLI DEGIL - kurulum test kullanicilarini kendisi
     yaratiyor.

  2. SENTRY - "Prevent Storing of IP Addresses" (istege bagli).
     Sentry -> Settings -> Security & Privacy -> Data Scrubbing.

  3. DNS - ASPF=S RISKLI. Resend zarfi send.owezy.net'ten yolluyor, From ise
     owezy.net; strict hizalamada SPF HER ZAMAN dusuyor. Posta yine gidiyor
     cunku DMARC "SPF ya da DKIM" diyor ve DKIM hizaliyor. Ama tek bacak
     uzerindeyiz ve p=reject yuzunden bir DKIM aksamasi = KIMSE GIRIS
     YAPAMIYOR. ONERI: aspf=s -> aspf=r.

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
  giris (e-posta kodu, ya da parolayla - ikincil), grup listesi / tek grupta
  dogrudan gruba yonlendirme, grup olusturma (satir ici), uyeler + davet
  linki, fis ekrani, satir ici harcama girisi, harcama detayi.

MOBILDE HENUZ YOK (bilincli kapsam disi):
  - IKINCI FAKTOR (27.4'un isi)
  - PAROLA KURTARMA (yukarida, 27.4 maddesi 3)
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

DIGER ADAYLAR: PROGRESS.md'deki liste (fis gorseli, mobilde otomatik test,
silineni geri alma arayuzu, ...) - o liste bir PLAN DEGIL, secenek listesi.
