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

Updated: 2026-08-13

Current task:
  Faz 13 - Grup sayfasi 100 harcamada.
  13.1 + 13.2 (ay basliklari + ozet blogu) BITTI, commitlenmedi.
  13.3 (arama + filtre + CSV) yapilmadi.

Hemen sonraki adim:
  13.1+13.2 commitlenir (kullanici isteyince), push ayrica sorulur.

  Sonra 13.3: arama + filtre. DIKKAT - filtre SUNUCUDA olmali. Yuklenmis 20
  satiri suzmek "sonuc yok" derken sonraki sayfadaki kaydi gizler.
  listExpenses'e filtre parametreleri ve /api/v1 ucuna karsiliklari gerekiyor.
  Ayrintili notlar PROGRESS.md "Faz 13" bolumunde.

Status:
  Faz 12 tamam ve PUSH EDILDI (`fea2fb9`'a kadar).
  Production migration dogrulandi.

  13.1+13.2 commitlendi: `b301e85`. PUSH EDILMEDI - push Vercel'de production
  deploy tetikliyor, kullanicinin onayi bekleniyor.

  Testler: 447 birim / 29 E2E, tsc + lint temiz, tam E2E kosusu yapildi.

  12.1 (`3578386`) ve 12.2 (`d18997f`) push edildi.
  DOGRULANDI (canlida): 12.1'in migration'i
  (add_expense_participant_basis_points) production veritabanina uygulandi -
  Vercel deploy log'unda "All migrations have been successfully applied".

  Testler: 434 birim / 28 E2E, tsc + lint temiz.
  12.3 ve 12.4 sonrasi tam E2E kosulari yapildi, ikisi de 28/28.

  Migration 20260812214219_add_expense_participant_basis_points gelistirme ve
  E2E veritabanlarina UYGULANDI. Production'a push aninda vercel-build ile
  gidecek - push edildikten sonra Vercel build log'undan dogrulanmali.

  Testler: 428 birim / 28 E2E, tsc + lint temiz (hepsi 12.1 sonrasi kosuldu).

CANLIYA ACILMANIN ONUNDEKI ENGEL:
  Uygulama Clerk'in DEVELOPMENT anahtarlariyla calisiyor (Faz 8'den beri
  bilinen sinir). Alan adi isini KULLANICI ustlendi; karar verince Squarespace'ten
  alinip Cloudflare'e verilecek ve gecis o zaman konusulacak.

  Alan adi hazir oldugunda kalan adimlar - hepsi PANEL isi, kod degisikligi yok:
    1. Alan adi Vercel'e baglanir
    2. Clerk'te production instance olusturulur
    3. Clerk'in verdigi DNS kayitlari alan adina eklenir
    4. pk_live_ / sk_live_ anahtarlari Vercel env'ine konur
    5. Webhook ucu production instance'ta yeniden tanimlanir
       (/api/webhooks/clerk) ve yeni imza sirri Vercel'e eklenir

  NOT: Clerk formunda gorunen uygulama adi su an "split-app" (Clerk
  panelindeki uygulama adindan geliyor, kodda degil). Isim netlesince orasi
  da guncellenmeli - "Giris yap / split-app ile devam etmek icin" yaziyor.

Blocked by:
  Yok.

Verify with:
  npx tsc --noEmit
  npm run lint
  npm test          # beklenen: 428
  npm run test:e2e  # beklenen: 28, ~6 dk, kosarken dosyalara dokunma

  Prisma 7'de postinstall YOK: sema degistiginde "npx prisma generate"
  calistirilmadan tsc eski tipleri gorur ve var olmayan hatalar uretir.

  E2E notu: ~6 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur.

  DUZEN HATALARINI E2E YAKALAMAZ (metnin varligina bakiyor, sayfanin
  kaydigina degil). Yatay kayma olcumu:
    document.documentElement.scrollWidth > window.innerWidth
  390 ve 768 px'te olculmeli; panel gercek viewport'u kucultmuyorsa olcum
  bir iframe icinde yapilir (medya sorgulari viewport'a bakar).
