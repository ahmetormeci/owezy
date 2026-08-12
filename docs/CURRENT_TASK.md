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
  IN_PROGRESS — 11.1 ... 11.4c ve 11.4d-1 bitti. 11.4d-2 baslamadi.
  11.4d-1 COMMITLENMEDI: calisma agacinda duruyor, kullanici onayi bekliyor.
  (11.2 = a125fc3, 11.3 = eb861af, 11.4a = 18abd81, 11.4b = 9b01802,
   11.4c = 79f1d10)

  11.4d NEDEN IKIYE BOLUNDU: tek commit olsaydi 231 metin cevirisi + bir
  veritabani migration'i + yeni bir API metodu ayni pakette olurdu. Bir test
  kirildiginda sebebi ucunun arasinda aramak gerekirdi. 11.4'un dorde
  bolunme gerekcesiyle ayni.

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
  - Testler: 396 birim, 26 E2E, tsc + lint temiz

Faz disi (ayni gunlerde yapildi, Faz 11'in parcasi degil):
  - GitHub Actions CI kuruldu (09d0e91): tsc + lint + birim testleri.
    E2E bilerek disarida. Ilk kosu yesil.
  - .claude/settings.json ile .env.local ve package-lock.json yazmaya
    kapatildi. Bu dosya gitignore'da, yani yeni bir klonda YOKTUR.
  - .claude/settings.local.json'dan iki riskli izin kaldirildi
    (git push, python -c). Bilinen sinir: mevcut izin kipi zaten hic
    sormadigi icin bu temizligin gozlenebilir bir etkisi yok.

Next action:
  11.4d-2 — Dil tercihi hesapta da saklanir.

  Yapilacak, SIRASIYLA:
    1. User.locale kolonu: String? (NULLABLE, varsayilansiz).
       @default("tr") YAZMA - mevcut her kullanicinin Turkce SECTIGINI iddia
       ederdi. Tercihin yoklugu gercek bir bilgi.
    2. Migration UC veritabanina:
         dev        -> npx prisma migrate dev --name add_user_locale
         e2e        -> npm run db:migrate:e2e
         production -> OTOMATIK, vercel-build icinde "prisma migrate deploy"
       Yani elle iki komut; ucuncusu push ile kendiliginden gidiyor.
    3. getLocale(): cerez yoksa hesap tercihine bak. Sira cerez -> hesap -> tr.

       TEHLIKE: getOrCreateCurrentUser() KAYIT OLUSTURUYOR. Kok layout'tan
       cagrilirsa karsilama sayfasinin render'i kullanici satiri yaratir.
       Salt-okuma sorgusu kullan: auth() -> clerkId -> findUnique, yalnizca
       locale alani. Ve YALNIZCA cerez yoksa - cikis yapmis ziyaretcide
       hic sorgu olmamali.
    4. PATCH /api/v1/me - govde { locale: "tr" | "en" }, Zod ile dogrulanir.
       Dil dugmesi once cerezi yazar (aninda calisir, cikista da calisir),
       sonra bu ucu cagirir. Uc basarisiz olursa gorunur bir sey bozulmaz;
       hata yutulur, toast gosterilmez (bkz. ADR-019).

  Dikkat: E2E testleri Turkce metin bekliyor. Varsayilan Turkce kaldigi
  surece 26 test degismeden gecmeli.

  Dikkat: E2E_DATABASE_URL ile DATABASE_URL asla ayni olmamali.

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
  npm test          # beklenen: 396
  npm run test:e2e  # beklenen: 26, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
