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

Updated: 2026-08-12

Current task:
  Faz 11 — Tasarim yenilemesi + iki dil destegi.
  Alti asamali plan icin PROGRESS.md'ye bak.

Status:
  IN_PROGRESS — 11.1 ... 11.5 bitti. Geriye yalnizca 11.6 kaldi.
  11.6'nin GORSEL YONU onaylandi (ADR-021), uygulama baslamadi.
  (11.2 = a125fc3, 11.3 = eb861af, 11.4a = 18abd81, 11.4b = 9b01802,
   11.4c = 79f1d10, 11.4d-1 = 648b558, 11.4d-2 = 2289e0f)

  DIKKAT - PUSH BEKLIYOR: 2289e0f (11.4d-2) commitlendi ama PUSH EDILMEDI.
  Icinde bir migration var; push, vercel-build icindeki
  "prisma migrate deploy" sayesinde onu PRODUCTION veritabanina uygular.
  Dev ve E2E veritabanlarina zaten uygulandi.

  Ara durum guvenli: production'da calisan surum locale kolonunu hic
  sormuyor. Push sirasi da dogru - once migrate deploy, sonra build.

Completed in this task:
  - 11.1 Yazi tipi hatasi duzeltildi (site Times New Roman'da calisiyordu)
  - 11.1 Koyu tema baglandi (ThemeProvider + tema dugmesi)
  - 11.2 Kobalt kimlik + --credit/--debt anlam tokenlari (globals.css)
  - 11.2 formatSignedMoney + "money" sinifi (esit genislikli rakamlar)
  - 11.2 Marka isareti, yapiskan baslik, karsilama sayfasi
  - 11.3 formatMoney + formatBasisPoints dil parametresi aldi (varsayilan tr)
  - 11.3 parseMoney'ye DOKUNULMADI; ADR-017'nin gerekcesi olcume gore duzeltildi
  - 11.4a 54 throw noktasi kod tasiyor; sozluk src/lib/messages.ts
  - 11.4a Cevap sekli { ok:false, code, params? }; Turkce metin sunucuda kalmadi
  - 11.4b ~190 arayuz metni sozluge tasindi; kodda gomulu metin kalmadi
  - 11.4b useTranslate() / getTranslate() kapilari kuruldu (ikisi de simdilik tr)
  - 11.4c Dil cerezden okunuyor; locale.ts cerez adini + dogrulamayi tasiyor
  - 11.4c formatMoney/formatBasisPoints/formatDate cagrilarina dil gecirildi
  - 11.4c Tarihler de dile duyarli oldu (dates.ts) - dort yerde "tr-TR" sabitti
  - 11.4c Basliga dil dugmesi; <html lang> artik gercek dili soyluyor
  - 11.4c 11.4b'den kacan uc gomulu metin bulundu ve sozluge tasindi
  - 11.4d-1 231 kodun Ingilizcesi yazildi; eksik ceviri artik derleme hatasi
  - 11.4d-1 Goreli zamanlar Intl.RelativeTimeFormat'a devredildi (cogul eki)
  - 11.4d-1 Dil + tema dugmeleri herkese acik dort sayfaya eklendi
  - 11.4d-1 Uc yazim hatasi duzeltildi (kisiden / cikarilsin / kullanildi)
  - 11.4d-2 User.locale kolonu (nullable) + PATCH /api/v1/me
  - 11.4d-2 Okuma sirasi cerez -> hesap -> tr; ek sorgu maliyeti sifir
  - 11.5 Grup sayfasi alti esit bloktan uc kademeli dort bloga indi
  - 11.5 Oneriler filtrelendi; fiil basliga tasindi (Turkce ek sorunu)
  - 11.5 Mobilde yatay kayma duzeltildi (grid cocuklarina min-w-0)
  - Testler: 408 birim, 27 E2E, tsc + lint temiz

Faz disi (ayni gunlerde yapildi, Faz 11'in parcasi degil):
  - GitHub Actions CI kuruldu (09d0e91): tsc + lint + birim testleri.
    E2E bilerek disarida. Ilk kosu yesil.
  - .claude/settings.json ile .env.local ve package-lock.json yazmaya
    kapatildi. Bu dosya gitignore'da, yani yeni bir klonda YOKTUR.
  - .claude/settings.local.json'dan iki riskli izin kaldirildi
    (git push, python -c). Bilinen sinir: mevcut izin kipi zaten hic
    sormadigi icin bu temizligin gozlenebilir bir etkisi yok.

Next action:
  11.6 — Gorsel dilin uygulanmasi.

  YON ONAYLANDI: ADR-021. Mockup uc denemede bulundu ve ucuncusu kabul
  edildi. Kurallar ADR'de; burasi SIRAYI tasiyor.

  Ozet kural: renk yalnizca tutarin isaretinde ve doygunlugu dusuk; kobalt
  uc yerde (marka, birincil dugme, baglanti); olcek kucuk ve yogun; kutu
  yerine 1 px cizgi; kose 8 px; hareket 180 ms; sayilar mono.

  Yapilacak, SIRASIYLA:

    1. TOKEN KATMANI - src/app/globals.css.
       Notrler neredeyse tam gri (cok hafif mavi meyil), panel katmanlari
       (--panel / --panel-2), cizgi renkleri (--line / --line-soft),
       --credit ve --debt doygunlugu ~0,10'a iner, radius olcegi kucultulur.
       "money" yardimci sinifi mono yazi tipine gecer.
       Burada hicbir SAYFA degismiyor - yalnizca degiskenler. Once bu
       commitlenirse, sonraki adimlarda neyin token neyin duzen oldugu
       ayirt edilebilir kalir.

    2. TIPOGRAFI OLCEGI - gövde 14 px, etiket 11 px buyuk harf + harf
       araligi, sayfa basligi 17 px, tutar mono 38 px.

    3. CARD DESENININ TERK EDILMESI. En pahali adim.
       Sirayla: grup sayfasi -> gruplar listesi -> uyeler -> davet ->
       harcama formu -> odeme penceresi -> karsilama -> giris/kayit.
       Her sayfadan sonra mobil OLCUMU (asagiya bak).

    4. AVATARLAR - karar gerekiyor, bkz. "Acik karar" asagida.

    5. BOS DURUMLAR - metinleri var, gorsel olarak duz. Sozlukte zaten
       kayitli; yalnizca sunumlari degisiyor.

    6. PublicControls konumu. Su an "fixed" ile kendi konumunu belirliyor;
       dar ve kisa ekranda ustteki kartla cakisabilir.

  ACIK KARAR - avatar kaynagi:
    Tesisat HAZIR. User.avatarUrl kolonu var, Clerk'ten doluyor
    (auth.ts), webhook guncelliyor (clerk-sync.ts), hesap silinince
    null'a cekiliyor, ve getGroupBalances + listGroupMembers ikisi de
    donduruyor. Eksik olan tek sey ekranda <img> basmak.

    SORUN: Clerk, fotograf YUKLEMEMIS kullaniciya da bir imageUrl
    veriyor - kendi urettigi bas-harf gorseli. Dogrudan basarsak
    fotografi olanlar gercek yuz, olmayanlar Clerk'in tasarimiyla
    gorunur; bizim bas-harf dairelerimizle iki ayri gorsel sistem
    yan yana durur.

    SECENEKLER:
      a) User.hasImage (nullable boolean) eklenir; fotograf varsa
         fotograf, yoksa BIZIM dairemiz. Tek satirlik migration, uc
         veritabani. Gorsel tutarlilik tam.  <- onerilen
      b) Her zaman Clerk'in imageUrl'i basilir. Migration yok, ama
         iki ayri gorsel sistem.
      c) Avatar hic gosterilmez, yalnizca bizim daireler. Var olan
         veri kullanilmaz.

    Kullanici SECMEDEN bu adima baslanmaz.

    NOT: next/image kullanilacaksa next.config'e img.clerk.com icin
    remotePatterns eklemek gerekiyor. Duz <img> ile gerek yok.

  Dikkat: E2E testleri Turkce metin ve mevcut secicilere dayaniyor.
  Formlara dokunulursa harcama testleri (6 test) en cok etkilenen yer.
  Grup sayfasi 11 testin ugragi.

  Dikkat: YATAY KAYMA gibi duzen hatalarini E2E YAKALAMAZ - metnin
  varligina bakiyor, sayfanin kaydigina degil. 11.5'te bu ekran
  goruntusuyle yakalandi.
  OLCUM YONTEMI (her sayfa icin, her genislikte):
    document.documentElement.scrollWidth > window.innerWidth  -> kayma var
  390 px ve 768 px'te olculmeli. Panel gercek viewport'u kucultmuyorsa
  olcum bir iframe icinde yapilir (medya sorgulari viewport'a bakar).

Blocked by:
  Yok.

Onaylanmis kararlar (Faz 11 icin):
  - API hata MESAJI degil KOD dondurecek (11.4)   -> mobil ve iki dil icin
  - Dil cerezde + hesap tercihinde, URL'de degil  -> mevcut linkler bozulmaz
  - Para bicimlendirmesi (11.3) ceviriden (11.4) ONCE gelir
  - Kimlik kobalt, borc kiremit (ADR-015)         -> yesil/kirmizi anlam tasiyor

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 408
  npm run test:e2e  # beklenen: 27, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
