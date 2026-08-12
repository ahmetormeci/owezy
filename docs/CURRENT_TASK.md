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
  IN_PROGRESS — 11.1, 11.2, 11.3, 11.4a, 11.4b bitti. 11.4c baslamadi.
  Hepsi commitlendi ve push edildi, calisma agaci temiz.
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
  - Testler: 370 birim, 24 E2E, tsc + lint temiz

Faz disi (ayni gunlerde yapildi, Faz 11'in parcasi degil):
  - GitHub Actions CI kuruldu (09d0e91): tsc + lint + birim testleri.
    E2E bilerek disarida. Ilk kosu yesil.
  - .claude/settings.json ile .env.local ve package-lock.json yazmaya
    kapatildi. Bu dosya gitignore'da, yani yeni bir klonda YOKTUR.
  - .claude/settings.local.json'dan iki riskli izin kaldirildi
    (git push, python -c). Bilinen sinir: mevcut izin kipi zaten hic
    sormadigi icin bu temizligin gozlenebilir bir etkisi yok.

Next action:
  11.4c — Dil degeri gercekten okunur ve her yere gecirilir.

  Yapilacak, SIRASIYLA:
    1. src/lib/i18n-server.ts icindeki getLocale() cerezi okusun
       (cookies() -> "locale"; yoksa "tr"). Dosyanin geri kalani degismiyor.
    2. Kok layout okudugu dili <LocaleProvider locale={...}> ile versin.
       useTranslate() zaten context'ten okuyor - bilesenler degismeyecek.
    3. formatMoney / formatBasisPoints cagrilarina dil GECIRILSIN.
       Bugun hepsi varsayilani kullaniyor; tesisat burada baglaniyor.
    4. Basliga dil dugmesi. Cerezi yazip router.refresh() cagirmali.

  Dikkat: formatMoney sunucu bileseninde de cagriliyor
  (groups/[groupId]/page.tsx). Dil hem sunucuda hem istemcide okunabilmeli;
  cerez bu yuzden secildi (ADR-017).

  Dikkat: cerez okumak sayfayi dinamik hale getirir. Statik render bekleyen
  bir yer varsa build ciktisinda gorunur.

  Sonra:
    11.4d Ingilizce sozluk + User.locale migration (UC veritabanina birden).

  Dikkat: varsayilan dil Turkce kaldigi surece 24 E2E testi degismeden
  gecmeli. Gecmiyorsa tesisat bir yerde varsayilani ezmis demektir.

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
  npm test          # beklenen: 370
  npm run test:e2e  # beklenen: 24, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
