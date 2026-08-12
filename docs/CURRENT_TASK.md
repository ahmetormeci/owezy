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
  ISIM + CANLIYA ACILMA HAZIRLIGI.

  Faz 11 (tasarim + iki dil) BITTI ve push edildi. Kod tarafinda planlanmis
  is yok. Su an konusulan sey urunun adi ve gercek kullanicilara acilmasi.

Status:
  IN_PROGRESS — isim henuz SECILMEDI.

Isim arastirmasi (yapildi, tekrarlanmasin):
  Kriterler akademik kaynaklardan tureti|di, ozet:
    - AKICILIK en buyuk kaldirac. Telaffuzu zor isim "riskli" algilaniyor
      (Song & Schwarz 2009). Para tutan bir uygulamada bu en pahali hata.
      Bu yuzden "Duodue" elendi - okunusu belirsiz.
    - Zirvedeki markalarda patlamalilar (t,k,p,b,d), surtunmeliler (s,z,v)
      ve "posh"taki arka o sesi FAZLA temsilli (Pogacar ve ark. 2015).
      DIKKAT: patlamali avantaji dile ozgu, Ingilizce disi markalar dahil
      edilince tersine donuyor.
    - On unluler (i,e) kucuk/hafif/hizli; arka unluler (o,u,a) buyuk/agir
      cagristiriyor (Klink 2000, Yorkston & Menon 2004).
    - 1-2 hece hatirlanmayi, uzunluk ayirt edilmeyi kolaylastiriyor.
    - Abercrombie spektrumu: "split/share/bill" iceren isim TANIMLAYICI,
      yani hem hukuken zayif hem kalabalik rafin icinde. Keyfi/uydurma isim
      en guclu konum.

  ARANAN PROFIL: 1-2 hece, patlamali baslangic, icinde arka unlu, unsuz
  kumesi yok (Turkce ve Ingilizce ikisinde de akici), Ingilizcede anlamsiz.

  OLCUM: alan adi musaitligi DNS ile bakilmaz - yaniltiyor. RDAP kullan:
    curl -s -L -o /dev/null -w "%{http_code}" https://rdap.org/domain/X
    404 = kayitli degil, 200 = kayitli. rdap.org ~10 istekten sonra 429
    veriyor, partiler halinde sor.

  SONUC: 25+ aday tarandi. Basit kelimelerin hepsi kayitli
  (kova/toka/payda/dues .com ve .app dahil). Iki musait cikti:
    - torka.app  <- ONERILEN
    - kolda.app  (kolda.com dolu, hikayesi yok)

  TORKA neden: iki patlamali + arka "o", 2 hece, iki dilde akici,
  Ingilizcede anlamsiz (guclu marka konumu), ve Turkcede "tokalasmak"
  cagrisimini tasiyor - anlasmanin kapandigi an.

  DOGRULANMADI: RDAP "kayitli degil" diyor ama ".app"te premium/rezerve
  isimler olabilir. Kayit sitesinden teyit sart. Ayrica alan adi musaitligi
  MARKA TESCILI demek degil (TURKPATENT / EUIPO ayrica bakilmali).

Next action:
  Kullanicinin torka.app'i kayit sitesinde dogrulamasi bekleniyor.

  Isim kesinlesince yapilacak is KUCUK:
    - ui.app_name  -> MESSAGES_TR ve MESSAGES_EN'de birer satir
    - src/components/brand-mark.tsx  -> marka isareti
    - README / docs'ta gecen "SplitApp" adlari

  Sonra CANLIYA ACILMA (kod isi degil, panel isi - kullanici yapmali):
    1. Alan adi alinir ve Vercel'e baglanir
    2. Clerk'te PRODUCTION instance olusturulur
    3. Clerk'in verdigi DNS kayitlari alan adina eklenir
    4. pk_live_/sk_live_ anahtarlari Vercel env'ine konur
    5. Webhook ucu production instance'ta yeniden tanimlanir
       (/api/webhooks/clerk) ve yeni imza sirri Vercel'e eklenir

  Bu bes adim tamamlanana kadar uygulama GERCEK KULLANICIYA ACILAMAZ -
  su an Clerk'in development anahtarlariyla calisiyor.

Blocked by:
  Kullanicinin isim karari.

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
