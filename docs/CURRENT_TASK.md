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

Updated: 2026-08-26 (17)

DAL: better-auth. YEREL main = origin/main = CANLIDAKI HAL.
CLERK ARTIK KODDA HIC YOK. Paketler de kalkti.

Current task:
  FAZ 26 - GUVENLIK BASLIKLARI VE HIZ SINIRI. Uc adim bitti, biri kaldi.
    26.1  /api/auth hiz siniri gercekten sayiyor   BITTI  ee9e32e
    26.2  Guvenlik basliklari                      BITTI  abb6697
    26.3  CSP (nonce'suz, ADR-039)                 BITTI  fbfed02
    26.4  /api/v1 hiz siniri                       KALDI

  26.4 HENUZ TASARLANMADI ve gercek bir karar iceriyor:
    - NEYE GORE sinirliyoruz? IP mi, kullanici mi? /api/v1'in tamami oturum
      istiyor, yani tehdit anonim sel degil; hesap acip yazma uclarini
      dovmek. Kullanici kimligi daha dogru anahtar gibi duruyor - IP
      operatorler ve NAT arkasinda paylasiliyor ve masumu cezalandirir.
    - NEREDE duruyor? 15 yazma ucunun basinda bir yardimci mi, yoksa proxy
      mi? proxy 25.7'de silindi ve ADR-039 onu CSP icin de geri getirmedi;
      ucuncu kez gundeme gelirse karar bilincli verilmeli.
    - HANGI UCLAR? Okuma uclari oturumla korunuyor ve ucuz; yazma uclari hem
      veri buyutuyor hem bildirim yayiyor. 21 route dosyasinin 15'i yazma.

  FAZ 26'DAN AKILDA TUTULACAKLAR:
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

  UC SECENEK VAR, HICBIRI SECILMEDI:
    A) 2FA aciksa giris PAROLAYLA olur. Desteklenen yol; Better Auth'un ic
       API'lerine dokunulmuyor; faktor karisimi da ders kitabina uygun
       (bilgi + sahiplik). Bedeli: 2FA acan kullanici parolasiz giris
       kolayligini kaybediyor.
    B) /sign-in/email-otp yolunu kendimiz 2FA'ya baglariz. Kolaylik korunur
       ama kod internalAdapter / createAuthCookie / HMAC / setNewSession
       uzerine yaslanir ve bir surum yukseltmesinde SESSIZCE bozulur -
       bozulma sekli de "2FA artik sorulmuyor", yani en kotusu.
    C) Hic yapmamak.

MAIN'E GECIS KONTROL LISTESI - SIRA ONEMLI:
  Canlidaki uygulama hala main'i kosuyor ve main CLERK'IN TA KENDISI. Adimlar
  bu sirayla yapilmali; ortasinda durulursa uygulama coker.

  1. VERCEL'E EKLE (dal main'e girmeden ONCE):
       BETTER_AUTH_SECRET   (openssl rand -base64 32)
       BETTER_AUTH_URL      https://owezy.net
       RESEND_API_KEY
     Neden once: betterAuth() secret yoksa MODUL YUKLENIRKEN firlatiyor
     ("BETTER_AUTH_SECRET is missing", kaynakta dogrulandi) ve src/lib/auth.ts
     neredeyse her sayfa tarafindan import ediliyor. Anahtarsiz push =
     UYGULAMANIN TAMAMI 500.

  2. APP REVIEW DEMO HESABI YENIDEN KURULMALI. Su an Clerk production'da;
     Better Auth tarafinda karsiligi YOK. Merge sonrasi /sign-up'tan
     parolayla yeniden yaratilacak ve App Store Connect'teki bilgiler
     guncellenecek. YAPILMAZSA INCELEYICI UYGULAMAYA GIREMEZ.

  3. MERGE + DEPLOY. Iki migration canliya gidiyor: Better Auth tablolari ve
     clerkId'nin dusurulmesi. Production'da SIFIR kullanici oldugu icin veri
     riski yok (dogrulandi).

  4. SONRA SILINEBILIR:
       Vercel      : CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
       .env.local  : ayni ikisi
       mobile/.env.local : EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
       Clerk hesabi: development ornegi de dahil kapatilabilir
     ONCE DEGIL: Clerk panelinde bir seye bakmak gerekirse secret key lazim.

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
  ACIK:
    - DEMO HESAP YENIDEN KURULACAK (yukaridaki gecis listesi, madde 2).
      Mevcut demo hesap Clerk production'da ve merge'den sonra ise yaramaz.
    - Ornek veri GOZLE DOGRULANMADI; kullanici kendisi kontrol edecek.
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
