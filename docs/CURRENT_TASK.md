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

Updated: 2026-08-11

Current task:
  Faz 11 — Tasarim yenilemesi + iki dil destegi.
  Alti asamali plan icin PROGRESS.md'ye bak.

Status:
  IN_PROGRESS — 11.1, 11.2, 11.3, 11.4a bitti. 11.4b baslamadi.
  11.4a COMMITLENMEDI: calisma agacinda duruyor, kullanici onayi bekliyor.
  (11.2 = a125fc3 ve 11.3 = eb861af push edildi.)

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
  - Testler: 369 birim, 24 E2E, tsc + lint temiz

Next action:
  11.4b — Arayuzdeki gomulu metinler sozluge tasinir.
  Su an JSX icinde dogrudan yazili: buton etiketleri, baslıklar, bos durum
  metinleri, toast mesajlari, istemci tarafi dogrulama uyarilari
  ("Aciklama bos olamaz", "Harcama silinemedi", "Odestin" ...).
  Halen tek dil (tr) - gorunur degisiklik yine olmayacak.

  Bilinen dokunma noktalari:
    src/components/*.tsx (toast.error fallback metinleri)
    src/app/(app)/groups/[groupId]/page.tsx (kart basliklari, durum metinleri)
    src/lib/expense-labels.ts, src/lib/notification-text.ts

  Sonra:
    11.4c Dil cerezden okunur ve formatMoney/formatBasisPoints'e GECIRILIR.
          Dikkat: formatMoney sunucu bileseninde de cagriliyor
          (groups/[groupId]/page.tsx). Dil hem sunucuda hem istemcide
          okunabilmeli; cerez bu yuzden secildi (ADR-017).
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
  npm test          # beklenen: 347
  npm run test:e2e  # beklenen: 24, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
