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
  Yok. Aktif gorev bulunmuyor.

Status:
  IDLE

Completed in this task:
  - docs/ hafiza sistemi kuruldu (8 dosya)
  - AGENTS.md okuma sirasi ve guncelleme protokolu ile guncellendi

Next action:
  Kullanicidan yeni gorev bekleniyor.
  PROGRESS.md'deki "siradaki adaylar" listesi bir plan DEGILDIR;
  kullanici secmeden hicbiri baslatilmaz.

Blocked by:
  Yok.

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 342
  npm run test:e2e  # beklenen: 24, ~5 dk, kosarken dosyalara dokunma
