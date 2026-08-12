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
  Faz 11 — Tasarim yenilemesi + iki dil destegi.
  Alti asamali plan icin PROGRESS.md'ye bak.

Status:
  IN_PROGRESS — 11.4'UN TAMAMI BITTI (11.4a/b/c/d-1/d-2). Sirada 11.5.
  11.4d-2 COMMITLENMEDI: calisma agacinda duruyor, kullanici onayi bekliyor.
  (11.2 = a125fc3, 11.3 = eb861af, 11.4a = 18abd81, 11.4b = 9b01802,
   11.4c = 79f1d10, 11.4d-1 = 648b558)

  DIKKAT - PUSH: 11.4d-2 bir migration iceriyor. Push, vercel-build icindeki
  "prisma migrate deploy" sayesinde onu PRODUCTION veritabanina uygular.
  Dev ve E2E veritabanlarina zaten uygulandi.

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
  - 11.4b ~190 arayuz metni sozluge tasindi; kodda gomulu metin kalmadi
  - 11.4b useTranslate() / getTranslate() kapilari kuruldu (ikisi de simdilik tr)
  - 11.4c Dil cerezden okunuyor; locale.ts cerez adini + dogrulamayi tasiyor
  - 11.4c formatMoney/formatBasisPoints/formatDate cagrilarina dil gecirildi
  - 11.4c Tarihler de dile duyarli oldu (dates.ts) - dort yerde "tr-TR" sabitti
  - 11.4c Basliga dil dugmesi; <html lang> artik gercek dili soyluyor
  - 11.4c 11.4b'den kacan uc gomulu metin bulundu ve sozluge tasindi
  - 11.4d-1 231 kodun Ingilizcesi yazildi; eksik ceviri artik derleme hatasi
  - 11.4d-1 Goreli zamanlar Intl.RelativeTimeFormat'a devredildi (cogul eki)
  - 11.4d-1 Dil + tema dugmeleri herkese acik dort sayfaya eklendi
  - 11.4d-1 Uc yazim hatasi duzeltildi (kisiden / cikarilsin / kullanildi)
  - 11.4d-2 User.locale kolonu (nullable) + PATCH /api/v1/me
  - 11.4d-2 Okuma sirasi cerez -> hesap -> tr; ek sorgu maliyeti sifir
  - Testler: 408 birim, 27 E2E, tsc + lint temiz

Faz disi (ayni gunlerde yapildi, Faz 11'in parcasi degil):
  - GitHub Actions CI kuruldu (09d0e91): tsc + lint + birim testleri.
    E2E bilerek disarida. Ilk kosu yesil.
  - .claude/settings.json ile .env.local ve package-lock.json yazmaya
    kapatildi. Bu dosya gitignore'da, yani yeni bir klonda YOKTUR.
  - .claude/settings.local.json'dan iki riskli izin kaldirildi
    (git push, python -c). Bilinen sinir: mevcut izin kipi zaten hic
    sormadigi icin bu temizligin gozlenebilir bir etkisi yok.

Next action:
  11.5 — Grup sayfasi hiyerarsisi.

  Karar ZATEN ALINDI ve yazildi: ADR-016. Uygulanmadi.
  Ozet: "senin durumun" panelinin gorsel agirligi digerlerinden belirgin
  buyuk olacak, bakiyenin isareti sayfanin tonunu belirleyecek. Bugun bes
  ozdes kart var; "Senin durumun" ile "Kaydedilen odemeler" goze esit
  onemde ve hicbiri duyulmuyor.

  Dosya: src/app/(app)/groups/[groupId]/page.tsx

  Tasarim onerisi ONCE sunulmali - ADR-016 NE yapilacagini soyluyor ama
  duzenin kendisi (hangi kart nerede, mobilde nasil siralanacak)
  kararlastirilmadi.

  Sonra: 11.6 Karsilama, formlar, bos durumlar, mobil.

  Dikkat: E2E testleri Turkce metin ve mevcut secicilere dayaniyor.
  Grup sayfasi 11 testin ugradigi yer - duzen degisiminde en cok orasi
  kirilir. Degisiklikten sonra npm run test:e2e sart.

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
  npm test          # beklenen: 408
  npm run test:e2e  # beklenen: 27, ~5 dk, kosarken dosyalara dokunma

  E2E notu: ~5 dk'dan cok daha uzun suren bir kosuda hatalara guvenme.
  net::ERR_NETWORK_IO_SUSPENDED gibi isletim sistemi seviyesi hatalar makine
  uykuya girdiginde cikar ve kodla ilgisi yoktur. Once hatanin TURUNE bak,
  supheli testleri tek basina tekrar kosturarak dogrula.
