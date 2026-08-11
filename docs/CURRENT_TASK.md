# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.
- "Reflects" satiri, bu dosyanin yazildigi andaki commit'tir. Yeni oturumda
  `git log --oneline -1` ile karsilastir: tutmuyorsa dosya bayat olabilir,
  once repository'nin gercek durumunu dogrula.
-->

Reflects: fec69c7
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
