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
  IN_PROGRESS — 11.1, 11.2, 11.3, 11.4a, 11.4b, 11.4c bitti. 11.4d baslamadi.
  11.4c COMMITLENMEDI: calisma agacinda duruyor, kullanici onayi bekliyor.
  (11.2 = a125fc3, 11.3 = eb861af, 11.4a = 18abd81, 11.4b = 9b01802)

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
  - Testler: 389 birim, 24 E2E, tsc + lint temiz

Faz disi (ayni gunlerde yapildi, Faz 11'in parcasi degil):
  - GitHub Actions CI kuruldu (09d0e91): tsc + lint + birim testleri.
    E2E bilerek disarida. Ilk kosu yesil.
  - .claude/settings.json ile .env.local ve package-lock.json yazmaya
    kapatildi. Bu dosya gitignore'da, yani yeni bir klonda YOKTUR.
  - .claude/settings.local.json'dan iki riskli izin kaldirildi
    (git push, python -c). Bilinen sinir: mevcut izin kipi zaten hic
    sormadigi icin bu temizligin gozlenebilir bir etkisi yok.

Next action:
  11.4d — Ingilizce sozluk + hesap tercihi.

  Yapilacak, SIRASIYLA:
    1. MESSAGES_EN sozlugu (src/lib/messages.ts). ~190 ui.* + ~48 hata kodu.
       DICTIONARIES.en su an MESSAGES_TR'yi gosteriyor; orasi degisecek.
       Tip zaten hazir: eksik birakilan kod derlemede gorunmez ama
       Partial<Record<...>> oldugu icin calisma zamaninda Turkceye duser.
    2. User.locale migration - UC veritabanina birden (dev, e2e, production).
    3. getLocale(): cerez yoksa hesap tercihine bak. Sira: cerez -> hesap -> tr.
    4. Dil degisince /api/v1/me'ye yazilsin ki cihaz degisince tercih kalsin.
       Cerez hizli yol olarak kalir (ADR-019).
    5. Karsilama sayfasina dil dugmesi - AsAGIDAKI BOSLUK bunu gerektiriyor.

  BOSLUK (11.4c'den kalan, bilerek): dil dugmesi yalnizca (app) basliginda.
  Karsilama, giris ve kayit sayfalarinda YOK - o sayfalarin basligi da yok
  ve tema dugmesi de orada degil. Bugun zararsiz cunku iki sozluk de Turkce;
  11.4d Ingilizce metni getirdigi anda, giris yapmamis bir kullanici
  Ingilizce ekrani gorup dili degistiremez hale gelir. 11.4d'den once
  kapatilmali.

  Dikkat: E2E testleri Turkce metin bekliyor. Varsayilan dil Turkce kaldigi
  surece 24 test degismeden gecmeli - 11.4c'de gecti.

  Dikkat: migration UC veritabanina uygulanacak. E2E_DATABASE_URL ile
  DATABASE_URL asla ayni olmamali.

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
  npm test          # beklenen: 389
  npm run test:e2e  # beklenen: 24, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
