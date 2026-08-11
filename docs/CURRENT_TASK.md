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
  Tasarim onerisi onaylandi (kobalt kimlik, bakiye odakli hiyerarsi,
  defter tipografisi). Alti asamali plan icin PROGRESS.md'ye bak.

Status:
  IN_PROGRESS — 11.1 bitti, 11.2 baslamadi.

Completed in this task:
  - 11.1 Yazi tipi hatasi duzeltildi (site Times New Roman'da calisiyordu)
  - 11.1 Koyu tema baglandi (ThemeProvider + tema dugmesi)
  - Testler: 342 birim, 24 E2E, tsc + lint temiz

Next action:
  11.2 — Tasarim tokenlari: kobalt kimlik rengi, alacak/borc renkleri,
  tipografi olcegi. Iki tema icin de ayarlanacak.
  Dosya: src/app/globals.css

Blocked by:
  Yok.

Onaylanmis kararlar (Faz 11 icin):
  - API hata MESAJI degil KOD dondurecek (11.4)   -> mobil ve iki dil icin
  - Dil cerezde + hesap tercihinde, URL'de degil  -> mevcut linkler bozulmaz
  - Para bicimlendirmesi (11.3) ceviriden (11.4) ONCE gelir

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 342
  npm run test:e2e  # beklenen: 24, ~5 dk, kosarken dosyalara dokunma
