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
  YOK. Faz 13 (grup sayfasi 100 harcamada) bitti, uc asama da tamam.
  Kullanici yeni gorev vermedi.

Hemen sonraki adim:
  Kullanicinin secmesi bekleniyor. Adaylar PROGRESS.md'de "Sıradaki adaylar"
  ve "Faz 13'ten kalan borç" basliklari altinda.

Status:
  Faz 12 ve Faz 13'un 13.1-13.3a kismi canlida (`b75322d`'ye kadar).
  PUSH EDILMEMIS: `35c7fee` (13.3b CSV) ve bu dokuman commit'i.

  Testler: 465 birim / 31 E2E, tsc + lint temiz, tam E2E kosusu yapildi.

  Faz 13'te MIGRATION YOK - ozet salt okuma, filtre ve disa aktarma sorgu
  isi. 12.1'deki gibi bir veritabani dogrulamasi gerekmiyor.

  CANLIDA GOZLE BAKILMADI: ozet blogu ve ay basliklari yalnizca E2E'nin
  urettigi 2-3 harcamalik gruplarda gorundu. Gercek bir grupta cok aylik
  grafik ve yedi kategorili kirilim ilk kez orada gorunecek. Kategori
  varsayilani OTHER oldugu icin gecmis harcamalarda kirilim tek cubuk
  "Diger" cikabilir - hata degil ama blogu ise yaramaz gosterir.

CANLIYA ACILMANIN ONUNDEKI ENGEL:
  Uygulama Clerk'in DEVELOPMENT anahtarlariyla calisiyor (Faz 8'den beri
  bilinen sinir). Alan adi isini KULLANICI ustlendi; karar verince
  Squarespace'ten alinip Cloudflare'e verilecek, gecis o zaman konusulacak.

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
  npm test          # beklenen: 465
  npm run test:e2e  # beklenen: 31, ~6-7 dk, kosarken dosyalara dokunma

  Prisma 7'de postinstall YOK: sema degistiginde "npx prisma generate"
  calistirilmadan tsc eski tipleri gorur ve var olmayan hatalar uretir.

  E2E notu: beklenenden cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur.

  DUZEN HATALARINI E2E VARSAYILAN OLARAK YAKALAMAZ (metnin varligina bakiyor,
  sayfanin kaydigina degil). Olcum artik ozet testinin icinde:
    document.documentElement.scrollWidth > window.innerWidth
  390 ve 768 px'te olculuyor. Yeni bir duzen eklendiginde ayni olcum oraya da
  konmali.
