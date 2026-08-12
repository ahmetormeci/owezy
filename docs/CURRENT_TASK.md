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
  Faz 12 - Acilis oncesi duzeltmeler. Dort kucuk is; hicbiri yeni yetenek
  getirmiyor, dordu de bugun yanlis olan bir seyi duzeltiyor.

    12.1  DONE          Yuzdeli harcamayi duzenlemek yuzdeleri siliyordu
    12.2  DONE          Clerk giris/kayit formu Turkce modda Ingilizce
    12.3  SIRADAKI      createGroupSchema desteklenmeyen para birimini kabul ediyor
    12.4  BEKLIYOR      middleware.ts -> proxy.ts (Next 16 deprecation'i)

  Faz 12'den sonra Faz 13 (grup sayfasi 100 harcamada) geliyor; yonu
  onaylandi, uygulamadan once okunacak notlar PROGRESS.md'de.

Hemen sonraki adim:
  12.3 - createGroupSchema'daki "currency: z.string().length(3)" desteklenen
  listeye daraltilir (TRY, USD). Bugun API'den JPY ile grup acilabiliyor ve o
  grupta tutarlar 100 kat kucuk gorunuyor, cunku formatMoney/parseMoney her
  para biriminin iki ondalik basamagi oldugunu varsayiyor. ISO 4217 exponent
  tablosu GEREKSIZ - urunun kapsami iki para birimi.
  Dikkat: mevcut gruplarda desteklenmeyen bir currency varsa (elle ya da eski
  istekle olusmus olabilir) daraltma onlari OKUNAMAZ yapmamali - once
  veritabanindaki dagilim kontrol edilmeli.

Status:
  12.1 (`3578386`) ve 12.2 (`d18997f`) commitlendi ama **PUSH EDILMEDI** -
  push Vercel'de production deploy tetikliyor, kullanicinin onayi bekleniyor.
  Ikisi birlikte gidecek.

  Push edilince DOGRULANACAK: 12.1'in migration'i
  (add_expense_participant_basis_points) production veritabanina vercel-build
  ile uygulanir; Vercel build log'undan teyit edilmeli.

  Testler: 428 birim / 28 E2E, tsc + lint temiz.

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
