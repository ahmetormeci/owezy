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

Updated: 2026-08-26 (22)

MAIN'E ALINDI VE CANLIDA (26 Agustos, 069523e). Faz 25 ve 26 yayinda.
CLERK ARTIK KODDA HIC YOK. Paketler de kalkti.

  MERGE SONRASI DOGRULANDI - gercek isteklerle, canlida:
    basliklar          CSP + Permissions-Policy + Referrer-Policy +
                       X-Content-Type-Options + X-Frame-Options
    x-clerk-*          YOK
    x-powered-by       YOK
    /api/webhooks/clerk 404 (rota silinmis)
    /api/auth/get-session 200 + null (Better Auth ayakta)
    /groups oturumsuz  307 -> /sign-in
    VERITABANI TURU    olmayan hesapla giris -> 401 INVALID_EMAIL_OR_PASSWORD
                       (User tablosuna gercek sorgu; clerkId dusurulmus
                        semayla saglam calisiyor)
    /privacy           Clerk gecen satir sayisi 0, Resend beyan edilmis

Current task:
  FAZ 27 - IKI ADIMLI DOGRULAMA (2FA). SECENEK A: 2FA aciksa giris PAROLAYLA.
    27.1  Sema (TwoFactor + User.twoFactorEnabled)  BITTI  98d79b5
    27.2  Sunucu (eklenti + email-otp kapisi)       BITTI  98d79b5
    27.3  Web arayuzu                               SIRADA
    27.4  Mobil arayuzu                             KALDI
    27.5  Dokumanlar (ADR dahil)                    KALDI

  KARARLAR (27.1'de kullaniciya soruldu, cevaplandi):
    - E-POSTA IKINCI FAKTOR OLARAK YOK. Sadece TOTP + yedek kod. Ilk faktor
      zaten parola; ustune e-posta kodu koymak gucu posta kutusuna baglardi.
    - "BU CIHAZI HATIRLA" YALNIZCA WEB'DE (30 gun). Ozellik cerez tabanli,
      mobil cerez tasimiyor (ADR-038). Asimetri bilincli: mobil oturum
      belirteci uzun omurlu, orada zaten nadiren giris yapiliyor.

  27.2'DE OLCULEN (sunucuda, gercek isteklerle):
    2FA kapali + e-posta kodu -> INVALID_OTP            (kanca susuyor)
    2FA acik  + e-posta kodu -> TWO_FACTOR_REQUIRES_PASSWORD
    2FA acik  + parola       -> INVALID_EMAIL_OR_PASSWORD
    Ucuncusu onemli: kanca, 2FA kullanicisinin girmek ZORUNDA oldugu yolu
    kazara kapatmiyor.

  27.3'TE YAPILACAKLAR:
    - Hesap/guvenlik bolumu (kullanici menusunun icinde, ayri ekran ACMADAN):
      2FA'yi ac (QR + gizli anahtar), dogrula, yedek kodlari GOSTER, kapat
    - Giris formunda ikinci faktor adimi + "bu cihazi hatirla"
    - /two-factor/enable PAROLA ISTIYOR; parolasiz kullanici (e-posta koduyla
      girmis) 2FA acamaz. Bu, secenek A ile TUTARLI - ama arayuzde ANLASILIR
      sekilde soylenmeli, "dugme calismiyor" gibi gorunmemeli.

  27.4'TE DIKKAT: meydan okuma CEREZLE tasiniyor (verify-two-factor.mjs) ve
  mobil credentials:"omit" kullaniyor. Mobil icin: Set-Cookie'yi yakala ->
  geri gonder -> Origin basligi ekle -> sunucuda trustedOrigins. 25.5'te
  kaldirilan cerez makinesi YALNIZCA bu iki cagri icin geri geliyor.

  FAZ 26 (guvenlik basliklari ve hiz siniri) BITTI:
    26.1  /api/auth hiz siniri gercekten sayiyor   BITTI  ee9e32e
    26.2  Guvenlik basliklari                      BITTI  abb6697
    26.3  CSP (nonce'suz, ADR-039)                 BITTI  fbfed02
    26.4  /api/v1 yazma butcesi                    BITTI  c698eaa

  SIRADAKI IS: 2FA - ve SECENEK ARTIK SECILDI.
    Kullanici App Store gonderimini once halletmeyi tercih etti; 2FA ondan
    sonra. Secenek A: 2FA aciksa giris PAROLAYLA olur. Gerekce asagida.

  DIGER ADAYLAR: PROGRESS.md'deki liste (fis gorseli, mobilde otomatik test,
  silineni geri alma arayuzu, ...)

  FAZ 26'DAN AKILDA TUTULACAKLAR:
    - /api/v1 YAZMA BUTCESI: kullanici basina dakikada 60. Kural 15 dosyaya
      ELLE konuldu; koruyan sey src/app/api/v1/write-limit.test.ts - yeni bir
      yazma ucu sinirsiz eklenirse o test dusuyor. Testin kendisi, bir uctan
      sinir kasten cikarilarak dogrulandi.
    - APIRateLimit TABLOSU AYRI VE AYRI KALMALI: Better Auth kendi RateLimit
      tablosunu buduyor ve esigi yalnizca KENDI pencerelerinden hesapliyor.
      Ayni tabloya yazsaydik satirlarimiz altimizdan silinirdi.
    - HIZ SINIRI HER ORTAMDA ACIK (kutuphane yalnizca production'da aciyor).
      Oyle birakilsaydi mekanizmanin ILK GERCEK KOSUSU CANLIDA olurdu.
    - E2E kurulumu sinirin tavanina TAM oturuyordu (kosu sonrasi sayac 3'te
      kaldi). Cozum sinirdan degil kurulumdan geldi: hazirlik kendi harcadigi
      sayaci siliyor (e2e/db-cleanup.ts). TEST KULLANICISI SAYISI ARTIRILIRSA
      burasi yine bakilmali.
    - PRODUCTION'DA DOGRULANACAK: hiz siniri anahtari "IP + yol" ve IP
      cozulemezse anahtar "no-trusted-ip" oluyor - yani BUTUN KULLANICILAR
      TEK KOVAYA duser, uygulama 10 saniyede 3 girise kapanir. getIP,
      trustedProxies verilmediginde x-forwarded-for'u yalnizca TEK bir IP
      tasiyorsa kabul ediyor (core/utils/ip.mjs:188). Cloudflare proxy'miz
      kapali (ADR-026), yani tek IP bekleniyor - ama bu BIR BEKLENTI,
      OLCUM DEGIL.
    - HSTS'e DOKUNULMADI: Vercel zaten gonderiyor (max-age iki yil). Kendi
      basligimizi eklersek ayni baslik iki kez gidebilir ve bu deploy
      etmeden olculemez. Vercel'inki "includeSubDomains" tasimiyor; bugun
      HTTP konusan alt alan adimiz yok, o yuzden acil degil.

  FAZ 25 (Clerk -> Better Auth) uygulama tarafinda BITTI:
    25.1  Sema ve iskelet                    BITTI  aa6f6cb
    25.2  Resend + sendVerificationOTP       BITTI  6dbb997
    25.3  Sunucu kimligi (auth.ts, /api/v1)  BITTI  bd9ae88
    25.4  Web arayuzleri (giris/kayit/menu)  BITTI  0952ad2, e8163e6, c4107b2
    25.5  Mobil                              BITTI  b3156e9
    25.8  E2E Better Auth'a gecti            BITTI  fb4e167
    25.7  Clerk'in sokulmesi                 BITTI  d10146f, c9a8869,
                                                    eddace3, 980c76d, a23dc5a
    25.6  IKINCI FAKTOR                      ERTELENDI - asagida

  SIRA DEGISTI, karar kullanicinin: 25.6 (2FA) 25.7/25.8'den SONRAYA alindi.
  Sebep asagidaki iki olcum - 2FA "eklentiyi tak" isi degil, uc ayri karar
  isiymis; oysa 25.7 ve 25.8 dali main'e alinabilir hale getiren adimlardi.

SONRAKI BUYUK IS - 2FA, VE ONCE BIR KARAR GEREKIYOR:

  OLCULDU 1 - BETTER AUTH'UN 2FA'SI BIZIM ANA GIRIS YOLUMUZU GORMUYOR.
    Eklentinin sign-in kancasinin eslestiricisi (two-factor/index.mjs:245):
        context.path === "/sign-in/email"
     || context.path === "/sign-in/username"
     || context.path === "/sign-in/phone-number"
    "/sign-in/email-otp" LISTEDE YOK ve email-otp eklentisinin kaynaginda
    "twoFactor" diye bir iz yok (grep bos). Yani kullanici 2FA'yi acar, her
    zamanki gibi e-posta koduyla girer ve IKINCI FAKTOR HIC SORULMAZ.
    TwoFactorOptions'da bu yolu ekleyecek bir secenek de yok.

  OLCULDU 2 - MEYDAN OKUMA CEREZLE TASINIYOR.
    verify-two-factor.mjs bekleyen 2FA durumunu IMZALI BIR CEREZTEN okuyor,
    trustDevice de oyle. Mobil ise bilerek "credentials: omit" (ADR-038).
    Yani mobilde ikinci faktor adimi, cerezi elle yakalayip geri gondermek +
    Origin basligi + trustedOrigins olmadan TAMAMLANAMAZ.

  UCUNCUSU: 2FA'yi acacak ekran yok. /two-factor/enable oturum + PAROLA
  istiyor; hesap/guvenlik ekranimiz ise 25.4'te bilerek yazilmadi.

  SECILEN: A. (26 Agustos, kullanici karari - "hangisi daha mantikli"
  sorusunun cevabi olarak sunuldu ve kabul edildi.)
    A) 2FA aciksa giris PAROLAYLA olur. Desteklenen yol; Better Auth'un ic
       API'lerine dokunulmuyor; faktor karisimi da ders kitabina uygun
       (bilgi + sahiplik). Bedeli: 2FA acan kullanici parolasiz giris
       kolayligini kaybediyor.
    B) /sign-in/email-otp yolunu kendimiz 2FA'ya baglariz. Kolaylik korunur
       ama kod internalAdapter / createAuthCookie / HMAC / setNewSession
       uzerine yaslanir ve bir surum yukseltmesinde SESSIZCE bozulur -
       bozulma sekli de "2FA artik sorulmuyor", yani en kotusu.
    C) Hic yapmamak.

MERGE SONRASI BULUNAN VE DUZELTILEN HATA (833b3e5):
  DAVET LINKI, GIRISI OLMAYAN BIRI ICIN CALISMIYORDU. /join/<token> sayfasi
  ziyaretciyi /sign-in?redirect_url=... adresine gonderiyor ama giris formu o
  parametreyi OKUMUYORDU; giris calisiyor, kullanici ana ekrana dusuyor ve
  "Gruba katil" dugmesini hic gormuyordu. Gruba katilmanin baska yolu yok.

  NE ZAMAN GIRDI: 25.4. Clerk'in <SignIn /> bileseni redirect_url'i kendisi
  hallediyordu; kendi formumuzu koyduk ve davranis tasinmadi.

  TESTLER NEDEN KACIRDI: butun davet testleri daveti ZATEN GIRISLI bir
  tarayiciyla aciyordu (storageState). "Cikisken tikla -> giris yap -> geri
  don" yolunu hicbiri yurumuyordu. Artik yuruyen bir test var
  (collaboration.spec.ts) ve duzeltme geri alinarak dogrulandi: uretimdeki
  belirtinin aynisiyla dustu.

  PARAMETRE DOGRULANIYOR (lib/safe-redirect.ts, 16 birim testi): oldugu gibi
  kullanilsaydi ACIK YONLENDIRME olurdu - kullanici GERCEK owezy.net'te giris
  yapar, sonra saldirganin sayfasina dusurulurdu.

  KULLANICI BULDU. Bu ders kayda deger: uretimde ilk gercek kullanim, otuz
  uc test dosyasinin gormedigi yolu ilk denemede yurudu.

MERGE BITTI - GERIYE KALANLAR:

  1. APP REVIEW DEMO HESABI - SENDE, VE ACIL.
     Eski demo hesap Clerk production'daydi ve ARTIK CALISMIYOR. Yenisi
     https://owezy.net/sign-up adresinden PAROLAYLA kurulmali (kod akisi
     inceleyiciye posta kutusu gerektirir - ADR-035). Sonra App Store
     Connect -> App Review Information'daki kullanici adi/parola
     guncellenmeli. YAPILMAZSA INCELEYICI UYGULAMAYA GIREMEZ.
     Ardindan hesaba birkac harcama/odeme girilmeli (bos ekran gosteren
     uygulama incelemede soru aliyor).

  2. APP PRIVACY ANKETI GOZDEN GECIRILMELI - SENDE.
     /privacy 25.7'de degisti: parola artik BIZIM sunucumuza geliyor ve
     hash'lenip veritabanimizda duruyor; Resend yeni bir veri isleyici.
     Anket eski metne bakilarak doldurulmustu.

  3. TEMIZLIK (aceleye gerek yok, ama unutulmasin):
       Vercel            : CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
       .env.local        : ayni ikisi
       mobile/.env.local : EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
       Clerk paneli      : Webhooks -> Endpoints'teki kayit (adres zaten olu:
                           split-app-mauve.vercel.app 404 donuyor)
       Clerk hesabi      : development ornegi de dahil kapatilabilir
     E2E ARTIK CLERK'E BAGLI DEGIL - kurulum test kullanicilarini kendisi
     yaratiyor, yani development ornegi de gerekmiyor.

  4. better-auth DALI birlesti; silinebilir (git push origin --delete
     better-auth). Aceleye gerek yok.

25.7'DE ACILAN VE KAPATILAN BOSLUK:
  Clerk gidince gorunen adi degistirmenin HICBIR yolu kalmiyordu - o is
  Clerk'in profil arayuzu + webhook ile yapiliyordu (ADR-011). E-posta
  koduyla giren birinin adi e-postasi olarak kaliyor ve uye listesinde,
  bakiyelerde, fiste oyle gorunuyordu. PATCH /api/v1/me artik displayName
  de kabul ediyor; duzenleme baslikta, kullanici menusunun icinde.
  E-POSTA HALA DEGISTIRILEMEZ ve bu kasitli: adres degistirmek yeni adresin
  dogrulanmasini gerektirir.

25.7'DE ACIK BIRAKILAN IKI SEY (ikisi de "sokme" isi degil):
  1. DIL DUGMESI hala tam sayfa yeniden yukluyor (ADR-023). Gerekcesi
     "Clerk bileseni localization'i yalnizca mount'ta okuyor"du ve o gerekce
     dustu. Ama tam yenilemenin kendi basina dogru olup olmadigi OLCULMEDI;
     olcmeden degistirmek 12.2'de kapatilan "ayni ekranda iki dil" hatasini
     geri acabilir.
  2. avatarUrl ve hasImage sutunlarini YAZAN KIMSE YOK. Clerk gitti, yeni
     kayit akisi fotograf sormuyor. Sutunlar duruyor; bir profil fotografi
     ozelligi geldiginde ayni ayrim yine gerekecek.

FAZ 25'IN OLCUM DEFTERI - dokuman/uretici uc kez yanildi, calisma zamani
haklı cikti. Ayni yontem 2FA'da da kullanilacak:
  1. "Better Auth varsayilan olarak UUID uretir" YANLIS. Gercek uretici
     nanoid tarzi metin. Cozum: advanced.database.generateId = "uuid" +
     sutunlarda @default(uuid()).
  2. "prisma migrate diff" ciktisi OLDUGU GIBI ALINAMAZ. Her seferinde
     fazladan su satiri uretiyor ve HER MIGRATION'DA ATILMALI:
         ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
     descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024).
  3. "@better-auth/cli" ESKI BIR SURUMUN semasini uretti (kurulurken
     "Package no longer supported" dedi ve gecildi); Account.issuer atlandi ve
     kayit formu ilk gercek denemede dustu. DOGRU KAYNAK CALISMA ZAMANI:
     @better-auth/core'daki getAuthTables() KENDI ayarlarimizla cagrilip alan
     listesi semayla karsilastirilmali.

E2E - 25.8'DEN SONRA NASIL CALISIYOR:
  - Kurulum test kullanicilarini KENDISI yaratiyor (/api/auth/sign-up/email)
    ve giris UYGULAMANIN KENDI FORMUNDAN yapiliyor. E2E veritabani ELLE
    HAZIRLIK ISTEMIYOR.
  - db-cleanup artik User'i da truncate ediyor.
  - .env.local'de E2E_USER_1..3_EMAIL / _PASSWORD (adlarindan "CLERK" cikti).
  - playwright.config.ts BETTER_AUTH_URL'i 3100'e EZIYOR. Ezilmezse
    .env.local'daki 3000 degeri gecerli olur ve tarayicidan giden her giris
    403 INVALID_ORIGIN alir - olculdu.
  - Tam kosu ~8 dakika. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.

APP STORE HAZIRLIGI - NEREDE KALDIK:
  BITTI (kullanici dogruladi):
    - Apple Developer hesabi onaylandi
    - App Store Connect uygulama kaydi + "Owezy" adi
    - Privacy Policy URL + Support URL girildi
    - App Privacy anketi dolduruldu
    - App Review Information -> "Sign-in required" + telefon girildi
    - En az bir grup olusturuldu
  BITTI (26 Agustos, merge sonrasi - kullanici dogruladi):
    - YENI DEMO HESAP KURULDU: appreview@owezy.net, PAROLAYLA (ADR-035).
      Eski Clerk hesabinin e-postasi kullanilamadi: satir veritabaninda
      duruyor ama PAROLASI Clerk'teydi ve gocte gelmedi - "sonra yapmak
      herkese parola sifirlatmak demek" cumlesinin fiilen yasandigi tek
      hesap bu oldu.
    - "example" grubu olusturuldu, davet linkiyle ikinci bir hesap katildi,
      harcamalar ve odemeler girildi. UCTAN UCA CALISIYOR.

  ACIK:
    - APP STORE CONNECT -> App Review Information: kullanici adi/parola
      YENI hesabin bilgileriyle guncellenmeli. Eskisi calismiyor.
    - GIZLILIK ANKETI GOZDEN GECIRILMELI: /privacy degisti (25.7). Parola
      artik BIZIM sunucumuza geliyor ve hash'lenip veritabanimizda duruyor;
      Resend yeni bir veri isleyici. App Privacy anketi eski metne bakilarak
      doldurulmustu.

  EXPORT COMPLIANCE: BITTI.
    app.json -> ios.infoPlist.ITSAppUsesNonExemptEncryption = false
    Yalnizca HTTPS kullandigimiz icin dogru deger bu. Cozumlenmis prebuild
    yapilandirmasindan dogrulandi: deger BOOLEAN false.

DNS DURUMU (25 Agustos, dig ile dogrulandi):
  Email Routing (kok MX)   : route1/2/3.mx.cloudflare.net    ACIK
  Resend bounce (MX)       : feedback-smtp.ap-northeast-1.amazonses.com
  Resend SPF               : send.owezy.net -> include:amazonses.com
  Resend DKIM              : resend._domainkey.owezy.net     GECERLI
  DMARC                    : p=reject; adkim=s; aspf=s

  ASPF=S RISKLI VE KULLANICIYA SOYLENDI: Resend zarfi send.owezy.net'ten
  yolluyor, From ise owezy.net - strict hizalamada SPF HER ZAMAN duser. Posta
  yine gidiyor cunku DMARC "SPF ya da DKIM" diyor ve DKIM hizaliyor. Ama tek
  bacak uzerindeyiz ve p=reject yuzunden bir DKIM aksamasi = KIMSE GIRIS
  YAPAMIYOR. ONERI: aspf=s -> aspf=r.

MOBILDE BUGUN NE VAR:
  giris (e-posta kodu, ya da parolayla - ikincil), grup listesi / tek grupta
  dogrudan gruba yonlendirme, grup olusturma (satir ici), uyeler + davet
  linki, fis ekrani, satir ici harcama girisi, harcama detayi.

MOBILDE HENUZ YOK (bilincli kapsam disi):
  - IKINCI FAKTOR (25.5'te silindi, 2FA fazinda donecek)
  - KAYIT EKRANI ve bu bir eksiklik DEGIL: e-posta kodu akisi, adres kayitli
    degilse kullaniciyi kendisi yaratiyor
  - GORUNEN ADI DUZENLEME (web'de var, mobilde yok)
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
