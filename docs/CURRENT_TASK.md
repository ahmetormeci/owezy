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
  IN_PROGRESS — 11.1, 11.2, 11.3 bitti. 11.4 baslamadi.
  11.3 COMMITLENMEDI: calisma agacinda duruyor, kullanici onayi bekliyor.
  (11.2 commitlendi: a125fc3, HENUZ PUSH EDILMEDI.)

Completed in this task:
  - 11.1 Yazi tipi hatasi duzeltildi (site Times New Roman'da calisiyordu)
  - 11.1 Koyu tema baglandi (ThemeProvider + tema dugmesi)
  - 11.2 Kobalt kimlik + --credit/--debt anlam tokenlari (globals.css)
  - 11.2 formatSignedMoney + "money" sinifi (esit genislikli rakamlar)
  - 11.2 Marka isareti, yapiskan baslik, karsilama sayfasi
  - 11.3 formatMoney + formatBasisPoints dil parametresi aldi (varsayilan tr)
  - 11.3 parseMoney'ye DOKUNULMADI; ADR-017'nin gerekcesi olcume gore duzeltildi
  - Testler: 360 birim, tsc + lint temiz

Next action:
  11.4 — API hata kodlari + ceviri altyapisi.
  Iki parcasi var, sirasi onemli:
    a) /api/v1 altindaki ~40 hata MESAJI yerine KOD dondurecek
       (ornek: "group.not_found"). Metni istemci uretecek.
    b) Dil degeri cerezden + hesap tercihinden okunacak ve
       formatMoney/formatBasisPoints'e GECIRILECEK.
       Bugun her cagri varsayilani (tr) kullaniyor - tesisat yok.

  Dikkat: formatMoney sunucu bileseninde de cagriliyor
  (groups/[groupId]/page.tsx). Dil hem sunucuda hem istemcide okunabilmeli;
  cerez bu yuzden secildi (ADR-017).

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
