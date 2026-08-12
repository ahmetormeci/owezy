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
  YOK. Faz 11 (tasarim yenilemesi + iki dil) bitti, push edildi, canlida.
  Aktif bir kod gorevi yok; kullanici yeni gorev vermedi.

Status:
  Calisma agaci temiz, push edilmemis commit yok.
  Testler: 410 birim / 27 E2E, tsc + lint temiz.

Bekleyen adaylar (hicbiri planlanmis is DEGIL, kullanici secmedi):

  1. npm audit — 10 acik (1 orta, 9 yuksek).
     INCELENDI: hepsi derleme/gelistirme aracinda, hicbiri calisan
     uygulamaya ulasmiyor. sharp yalnizca next/image ile cagriliyor,
     next/image hic kullanilmiyor. postcss derleme zamaninda calisiyor.
     "npm audit fix" 5 tanesini kapatiyor (surum araliklari icinde).
     Kalan ikisi (postcss, sharp) "--force" ve next 16.2.11 -> 16.3.0
     yukseltmesi istiyor - ayri bir gorev olmali.
     GEREKCE: aciklarin kendisi acil degil, ama liste hep 10 gorununce
     11'incisi gercek bir acik oldugunda kimse fark etmez.
     NOT: package-lock.json .claude/settings.json ile yazmaya kapali (A2).

  2. createGroupSchema desteklenmeyen para birimini kabul ediyor.
     Ayrinti PROGRESS.md teknik borc listesinde.

  3. PublicControls konumunu "fixed" ile belirliyor; dar ve kisa ekranda
     ustteki kartla cakisabilir. 11.6'nin listesindeydi, yapilmadi.

  4. ClerkProvider'a "localization" prop'u yok: giris/kayit formu Turkce
     modda da Ingilizce. Ayni ekranda iki dil.

  5. middleware.ts -> proxy.ts (Next 16 deprecation'i, tek dosyalik is).

CANLIYA ACILMANIN ONUNDEKI ENGEL:
  Uygulama Clerk'in DEVELOPMENT anahtarlariyla calisiyor (Faz 8'den beri
  bilinen sinir). Gercek kullanicilara acilmadan once, hepsi PANEL isi:

    1. Alan adi alinip Vercel'e baglanir
    2. Clerk'te production instance olusturulur
    3. Clerk'in verdigi DNS kayitlari alan adina eklenir
    4. pk_live_ / sk_live_ anahtarlari Vercel env'ine konur
    5. Webhook ucu production instance'ta yeniden tanimlanir
       (/api/webhooks/clerk) ve yeni imza sirri Vercel'e eklenir

  Bu adimlar kod degisikligi gerektirmiyor.

Blocked by:
  Yok.

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 410
  npm run test:e2e  # beklenen: 27, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur.

  DUZEN HATALARINI E2E YAKALAMAZ (metnin varligina bakiyor, sayfanin
  kaydigina degil). Yatay kayma olcumu:
    document.documentElement.scrollWidth > window.innerWidth
  390 ve 768 px'te olculmeli; panel gercek viewport'u kucultmuyorsa olcum
  bir iframe icinde yapilir (medya sorgulari viewport'a bakar).
