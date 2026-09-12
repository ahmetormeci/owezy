# CURRENT TASK

<!--
KURAL: Bu dosya gecmisi ANLATMAZ. Yalnizca su anki operasyonel durumu tasir.
- Yeni gorev basladiginda BASTAN YAZILIR, alta eklenmez.
- Biten isin ayrintisi CHANGELOG.md ve PROGRESS.md'ye tasinir.

BAYAT MI?

  git log --oneline $(git log -1 --format=%H -- docs/CURRENT_TASK.md)..HEAD -- src prisma mobile

Cikti bossa dosya guncel.

AMA BU KONTROL YALNIZCA KODU KAPSIYOR. "DIS DUNYA" maddeleri baska yerde:
DNS, Vercel, Sentry, App Store Connect, Expo, saglayici panelleri. Onlari
ne git ne de bir test goruyor.

BU DOSYA HER YENIDEN YAZILDIGINDA O MADDELER TEK TEK OLCULMELI:
    DNS      dig +short TXT _dmarc.owezy.net
    env      grep -oE '^[A-Z0-9_]+' .env.local   (ADLAR; degerleri okuma)
    canli    curl -sI https://owezy.net/support
    magaza   itunes.apple.com/lookup?bundleId=net.owezy.app
    CI       curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=3"
             (gh CLI YOK; depo herkese acik, yetki gerekmiyor)
    panel    olculemez - KULLANICIYA SOR, varsaymadan
-->

Updated: 2026-09-12

Current task:
  YOK. Faz 48 (fisten kalemler + kendi OCR modulumuz) BITTI - ADR-055.

  1.0.4 YAYINDA. Kullanici test ederken iki sey bildirdi, IKISI DE BITTI:
    1. Turkce placeholder bozuk ciziliyordu -> DUZELTILDI (11 Eylul)
    2. Fisteki kalemleri ayri ayri gorup secmek -> YAPILDI (Faz 48)

  AB MESELESI DE KAPANDI (12 Eylul): uygulama 27 AB magazasinin HEPSINDE
  geri geldi. Cozum tuccar beyani DEGIL, "tuccar degilim" beyaniydi -
  ayrintisi asagida.

  >>> 1.0.5'TE NE VAR: DORT SEY, HEPSI 1.0.4 GONDERILDIKTEN SONRA <<<
    1. Profil fotografi          (Faz 47, ADR-054)
    2. Placeholder cizimi        (11 Eylul - Turkce metin bozuluyordu)
    3. Fisten kalemler + kendi OCR modulumuz  (Faz 48, ADR-055)
    4. 12 Expo paketinin surum guncellemesi

    UCUNCUSU BIR HATA DUZELTMESI DE TASIYOR: 1.0.4'teki OCR, etiketle
    tutar ayri gozlemlere dustugunde toplam yerine odenen nakdi
    okuyabiliyor. Kullanici kendi fisinde dogru okudugunu bildirdi;
    kusur baska bir yerlesimde ortaya cikiyor.

  ADMIN PANELI: YAPILMAYACAK (12 Eylul, kullanici sordu, olculdu).
    "Kac kisi, hangi ulkeden" sorusunun cevabi ZATEN VAR: App Store
    Connect -> Analytics, ulkeye gore indirme/aktif cihaz/oturum, KOD
    GEREKTIRMEDEN. Yalnizca veri paylasimina izin verenlerden geldigi
    icin gercek sayinin altinda kalir - trend dogru, mutlak sayi degil.

    KENDIMIZ TOPLAYAMAYIZ: gizlilik politikasi iki yerde soz vermis -
    "Analitik ve reklam verisi. Uygulamada hicbir analiz veya reklam
    araci kurulu degil." ve oturum IP'si icin "Reklam ya da olcum icin
    kullanilmaz." Veritabaninda ulke sutunu da yok; locale var ama o
    kullanicinin sectigi ARAYUZ DILI, konum degil.

    Veritabani su an da cevapliyor: kac hesap ve ne zaman acildi, kaci
    aktif, kac grup, kac harcama. Bunun icin panel degil tek komutluk
    bir betik yeter - kullanici isterse yazilacak, HENUZ ISTEMEDI.

  FAZ 48 - EN ONEMLI SEY: OZELLIK ESKI MODULLE IMKANSIZDI, ZOR DEGIL.

    Apple Vision bir fisi satir satir vermiyor. Ad solda, fiyat sagda ve
    ikisi AYRI GOZLEM; dondurdugu sira da satira gore degil SUTUNA gore.
    "Hangi fiyat hangi ada ait" bilgisi METINDE YOK - konumda var.
    expo-text-extractor boundingBox'i ATIYORDU.

    AYNI KAYIP MEVCUT TOPLAM OKUMAYI DA BOZUYORDU: gercek bir fiste
    toplam 27,96 iken ODENEN NAKIT 28,00 okunuyordu. Faz 46'nin NOT_TOTAL
    korumasi hic atesenmiyordu cunku o testler etiketle tutarin AYNI
    SATIRDA oldugunu varsayiyordu.

  NE YAPILDI:
    - modules/receipt-ocr: PROJENIN ILK OZEL NATIVE MODULU. Ayni motor,
      konum da donuyor. YALNIZCA iOS (ADR-030).
    - src/lib/receipt-blocks.ts: parcalari gorsel satirlara topluyor.
      Sabit esik YOK - geometrik ortusme kurali (sebebi olculdu).
    - src/lib/receipt-items.ts: kalem cikarma, adet carpimi, "2x Kola".
    - src/lib/fixtures/: GERCEK fislerin GERCEK Vision ciktisi.
    - Ekranda kalem listesi: hicbiri secili degil, secilenlerin toplami
      tutar oluyor, FARK gosteriliyor.

  GERCEK FISLERDEKI SONUC: Isvicre fisi 4/4 kalem adetleriyle, toplam
  54,50 = fisin toplami. Officeworks 1/1, urun kodu yerine gercek adiyla.
  Sifir cop satir.

  TESTLER: kok 776 (+19) · mobil 103 jest (+7) · TAM E2E 64 GECTI
  (13.9 dk, 1 bilerek atlanan) - sonuc OKUNDU, tekrar kosmaya gerek yok.

  E2E ILK DENEMEDE BASLAYAMADI ve sebebi belgede yazili tuzakti: simulator
  icin acilan 3000'deki dev sunucusu kapatilmamisti. Playwright "webServer
  was not able to start" diyor, gercek satir bir ustte: "Another next dev
  server is already running."
  NEGATIF KONTROL: yedi tane. BIRI DUSMEDI ve bu kazanc oldu - ise
  yaramayan bir koruma bulunup silindi, asil korumanin baskasi oldugu
  olculdu.

  >>> ACIK KALAN: NATIVE TARAF HICBIR CIHAZDA DERLENMEDI <<<

  Saf katman gercek Vision ciktisiyla sinandi ama modulun KENDISI ancak
  bir EAS build'inde gorulecek. Expo Go'da native modul zaten calismiyor.

  BULUNAN AMA YAPILMAYAN IKI SEY:
    1. expo-text-extractor ARTIK KULLANILMIYOR ama package.json'da
       duruyor. Kaldirmak npm uninstall ister (package-lock degisir);
       ayri ve temiz bir degisiklik olsun diye yapilmadi.
    2. PAKET SURUMLERI - COZULDU AMA ONCE CI'YI KIRDI.

       12 paket SDK'nin bekledigi surumun gerisindeydi ve bu "sonra
       bakariz" diye not edildi. YANLISTI: CI expo-doctor'i bir KAPI
       olarak calistiriyor (.github/workflows/ci.yml) ve o kontrol
       dustugu icin main KIRMIZI oldu.

       DERS: "benim degisikligimden degil" bir seyi ERTELEMEK icin
       gecerli bir gerekce degil. Dogru soru "bunu ben mi bozdum" degil,
       "bu simdi kirik mi". Olculmesi kolaydi - npx expo-doctor - ve
       olculmedi.

       npx expo install --fix ile cozuldu; ardindan tip kontrolu, lint,
       103 test ve expo export (CI'nin son adimi) yeniden kosuldu.

>>> AB MESELESI KAPANDI (12 Eylul). Asagisi kaydi. <<<

  UYGULAMA 27 AB MAGAZASININ HEPSINDE GERI GELDI - olculdu, 27/27.
  Kontrol grubu (us gb tr no ch jp) 6/6.

  COZUM TUCCAR BEYANI DEGIL, "TUCCAR DEGILIM" BEYANIYDI.

  Uzun sure yalnizca tuccar yolu konusuldu ve bedeli agir gorunuyordu:
  bireysel hesapta adres/telefon/e-posta AB urun sayfasinda HERKESE ACIK
  yayimlaniyor, ustune ad-adres kanitlayan belge isteniyor.

  APPLE'IN KENDI BELGESI IKINCI BIR YOL TANIMLIYOR ve atlanmisti:
  "This is not a trader account" -> hicbir iletisim bilgisi istenmiyor,
  dogrulama yok, belge yok. Urun sayfasinda yalnizca bir cumle cikiyor:
  tuketici koruma haklari senin ile onlar arasindaki sozlesmelere
  uygulanmaz. Owezy ucretsiz, reklamsiz, uygulama ici satin almasiz -
  yani o cumlenin pratik karsiligi kucuk.

  DSA'nin tanimi ticari faaliyete bagli ("ticareti, isi, zanaati ya da
  meslegiyle ilgili amaclarla hareket eden") ve Apple'in rehberi hobi
  olarak, ticarilestirme niyeti olmadan gelistirilen uygulamalar icin
  tuccar sayilmayabilecegini soyluyor. KARARI KULLANICI VERDI.

  NEREDE: App Store Connect -> Business -> Agreements -> Compliance ->
  Digital Services Act -> Complete Compliance Requirements.
  Uygulama duzeyi: Apps -> Owezy -> App Information -> App Store
  Regulations and Permits -> Digital Services Act.

  APPLE HICBIR YERDE "KALDIRILMIS UYGULAMA GERI GELIR MI" DEMIYOR - dort
  ayri sayfasi da yazmiyor. Olcerek ogrenildi: beyan girildikten sonra
  AB magazalari BIR SAAT ICINDE acildi. Bir sonraki sefere tahmin
  etmeye gerek yok, cevap bu.

  YAPILANLAR:
    Faz 43  odeme hatirlatmasi   BITTI  (ADR-050)  cbfb887  CI yesil
    Faz 44  tekrarlayan harcama  BITTI  (ADR-051)  503ad2e  CI yesil
    Faz 45  kalem kalem bolusum  BITTI  (ADR-052)  b271e56
    Faz 46  fisten tutar okuma   BITTI  (ADR-053)  fb12a8a

  FIS OCR SONRADAN YAPILDI - sabah atlanmisti. Gerekce ("ucretli servis")
  YALNIZCA BULUT cozumu dusunuldugu icin dogruydu; cihaz uzerinde calisan
  bir yol bulununca uc maddesi birden dustu. Ayrintisi ADR-053.

  IKI YENI MOBIL EKRAN SIMULATORDE GORULDU (10 Eylul, acik ve koyu tema):
    - grup ekranindaki "Tekrarlayan harcamalar" bolumu
    - harcama ekleme ekranindaki DORT segment + kalem editoru
  Kalem kalem bir harcama telefondan KURULDU, DUZENLENDI ve kalemlerin
  duzenlemeden sonra da durdugu goruldu; sonra silindi (dev veritabani
  temiz birakildi).

  BUNU MUMKUN KILAN SEY: Expo Go'daki oturum onceki oturumdan KALMISTI
  (belirtec expo-secure-store'da). Kalmasaydi bakilamazdi - tek seferlik
  kod bir kimlik dogrulama kodudur ve forma yazilmasi yasak.

  >>> TAM E2E KOSTU VE GECTI: 61 passed, 1 bilerek atlanan (13.2 dk) <<<

  Kosu Faz 46 commit'lenirken arka planda suruyordu ve SONRADAN bitti;
  sonucu okundu. TEKRAR KOSMAYA GEREK YOK.

  Beklenen de buydu, sebebi olculmustu: web tarafinda HICBIR dosya
  degismedi. src/lib/receipt-amount.ts YENI ve web onu import ETMIYOR;
  src/lib/messages.ts 14 EKLEME 0 SILME. Yine de kosuldu, cunku bu proje
  "supheliyse tam kosu" diyor - ve olcmeden kabul etmek bugun uc kez
  hataya goturdu.

  PUSH EDILDI (10 Eylul, kullanici izin verdi): fb12a8a + 293df19 + be7c486
  origin/main'e gitti. Dal temiz, ileride commit yok.

  URETIME NE GITTI: pratikte hicbir sey. Web'in gordugu tek degisiklik
  src/lib/messages.ts'e eklenen uc anahtar (ui.reading_receipt,
  ui.amount_from_total, ui.amount_from_receipt) ve HICBIRINI web ekrani
  cagirmiyor - ucu de mobil icin. src/lib/receipt-amount.ts saf modul ve
  onu YALNIZCA mobile/app/groups/[groupId]/expenses/new.tsx import ediyor
  (olculdu: grep -rn "receipt-amount" src/ mobile/ e2e/). Yani Vercel
  deploy'u calisti ama kullanicinin gordugu arayuz ayni kaldi; OCR
  telefonda ve 1.0.4 build'i ile gelecek.

  DIKKAT (kural olarak duruyor): bu dosyaya yapilacak DOKUMAN commit'i
  otomatik push ediliyor (AGENTS.md) ve o push ALTINDA BEKLEYEN BIR KOD
  COMMIT'I VARSA ONU DA goturur. 10 Eylul'de tam boyle bir kaza oldu.
  Push edilmemis kod commiti varken dokuman commiti atmadan once
  git log --oneline origin/main..HEAD ile bak.

  PRE-PUSH KANCASI ONERILDI VE KULLANICI ISTEMEDI (10 Eylul). Bir daha
  onerme. Cozum kancada degil, yukaridaki tek satirlik kontrolde:
  dokuman commiti atmadan ONCE origin/main..HEAD'e bakilacak.

  >>> CRON_SECRET MADDESI KAPANDI (10 Eylul). Asagisi kaydi. <<<

  VERCEL'DE "CRON_SECRET" ORTAM DEGISKENI TANIMLANDI VE DOGRULANDI.

    Nerede: vercel.com -> owezy projesi -> Settings -> Environment Variables
    Ad    : CRON_SECRET
    Deger : 64 karakterlik RASTGELE bir metin. Uretmek icin KENDI
            terminalinde su komutu calistir ve CIKTIYI yapistir:

                openssl rand -hex 32

            DIKKAT - BU SATIR BIR KOMUT, DEGERIN KENDISI DEGIL. 10 Eylul'de
            komutun METNI dogrudan degere yazildi ve uc calisti (401 dondu),
            ama sir TAHMIN EDILEBILIR olmustu: bu depo HERKESE ACIK ve o
            metin tam da burada yaziyor. Ifade bu yuzden degistirildi.
    Ortam : Production (Preview de isaretlenebilir, zarari yok)
    Sonra : Deployments -> son deploy -> Redeploy

  NASIL GITTI - UC OLCUM, UCU DE GEREKLIYDI:

    1. Basta          -> 503   (degisken hic yok, uc kapali)
    2. Ilk tanimlama  -> 401   ama DEGER KOMUTUN METNIYDI ("openssl rand
                               -hex 32" birebir yazilmisti). Uc calisiyordu
                               ama sir TAHMIN EDILEBILIRDI: bu depo HERKESE
                               ACIK ve o metin bu dosyada yaziyordu.
    3. Rotasyondan sonra -> ESKI deger 401 doniyor.

  TEK GECERLI OLCUT BU UCUNCUSU: "401 doniyor" tek basina YETMEZ, cunku
  yanlis bir sirla da 401 donuyor. Sorulmasi gereken soru "eski deger hala
  geciyor mu".

    curl -s -o /dev/null -w '%{http_code}\n' \
      -H 'Authorization: Bearer <eski deger>' \
      https://owezy.net/api/cron/recurring

  ARADA BIR TUZAK CIKTI: degisken duzenlenip kaydedildigi halde eski deger
  gecmeye devam etti. Vercel'de ortam degiskeni degisikligi CALISAN deploy'a
  uygulanmiyor; degisken SILINIP yeniden eklenip REDEPLOY yapilinca gecti.

  SON HALKA DA KAPANDI (10 Eylul): Vercel -> Cron Jobs -> Run ile elle
  tetiklendi ve 200 dondu. Yani Vercel'in gonderdigi baslik ile sunucudaki
  CRON_SECRET birebir uyusuyor. Bunu disaridan olcmek MUMKUN DEGILDI - sir
  bize gonderilmedi, gonderilmemeli de; dogru sir ile yanlis sir disaridan
  ayni goruniyor (ikisi de 401).

  CEVABIN GOVDESI HICBIR YERDE GORUNMUYOR ve bu Vercel'in davranisi:
  Cron Jobs sekmesi yalnizca DURUM KODUNU gosteriyor. Runtime Logs'ta da
  cikmiyor, cunku uc cevabi donduruyor ama loga yazmiyor.

  KOSUNUN NE YAPTIGI ARTIK LOGA YAZILIYOR (10 Eylul, eklendi):
  route.ts sonunda "[cron/recurring] {...}" satiri. Icinde KISISEL VERI YOK,
  yalnizca uc sayi - push'a koymadigimizi (ADR-047) loga da koymuyoruz.
  Oncesinde basarili bir kosu arkasinda hicbir kayit birakmiyordu.

  FIS OCR ICIN ACIK KALAN: modul NATIVE, Expo Go'da CALISMIYOR. Gercek
  cihazda ilk kez bir sonraki build'de gorulecek; SDK 57 ile derlenip
  derlenmedigi o zaman belli olacak. Bugune kadar dogrulanan sey mantik
  (saf modul, 26 test) ve ekranin davranisi (6 ekran testi).
  expo-doctor: 21 kontrolun 20'si gecti, dusen tek kontrol bilinen
  CocoaPods maddesi - yeni paket bir sey bozmadi.

  BEKLEYEN TEK SEY KALDI: gercek bir sablonun gercekten uretim yaptigini
  gormek. Iki dakikalik yolu: web'de "Bunu tekrarla" ile bir harcama kur
  (baslangic BUGUN), sonra Cron Jobs -> Run. Ilk donem vadesinde oldugu
  icin harcama aninda dusmeli.

  SIRADAKI ADAYLAR: PROGRESS.md'deki liste. Fis OCR orada duruyor ve
  ATLANMA GEREKCESI yazili - yeniden gundeme gelirse once o okunmali.

  TELEFONDA BIRIKEN ALTI SEYIN LISTESI EN USTTE. Hepsi 1.0.3
  GONDERILDIKTEN SONRA girdi ve hepsi 46ffb9f ile 1.0.4'e bindi.

  YORUM - NE YAPILDI: ExpenseComment tablosu, uc uc (listele/yaz/sil),
  EXPENSE_COMMENTED bildirimi, web'de satirdan acilan diyalog, mobilde detay
  ekraninin altinda bolum + listede bakir sayi. Gizlilik politikasi da
  degisti (yeni veri kategorisi).

  YORUM HAKKINDA AKILDA TUTULACAK TEK SEY: butun kurallar "yorum finansal
  kayit degil" ayrimindan cikti. Yeni bir kural eklenecekse once ADR-049
  okunmali - orada hangi kuralin neden gecmedigi tek tek yaziyor.

  MOBIL TARAFI KULLANICIYA ULASMADI: yeni build + magaza gonderimi gerekiyor,
  o da 1.0.3'un arkasinda. Web push ile canliya cikti.

  SIMULATORDE BAKILDI ve IKI KUSUR CIKTI (ikisi de duzeltildi):
    1. Bolumun YATAY DOLGUSU YOKTU. Bu ekranda her blok kendi
       paddingHorizontal'ini tasiyor, ScrollView'da yatay dolgu YOK - bolum
       ekranin soluna yapisti, "Gonder" sagdan tasti.
    2. "Sil" zaman damgasinin yanina yapisiyordu: marginLeft:"auto" Text'e
       verilmisti ve hizalanacak kardesi olmadigi icin hicbir sey
       yapmiyordu. Pressable'a tasindi.
  Cihazda uctan uca yurutuldu (bos hal -> yazma 201 -> liste isareti ->
  silme onayi -> silme 200), acik ve koyu temada.

TASARIM YONU - NE YAPILDI (ADR-048)

  KAYNAK: kullanicinin Claude Design'daki projesi.
    proje  2f16cec7-532e-466b-8493-4cc5a7792d07  "Owezy mobil ve web tasarimi"
    dosya  design_handoff_owezy_kagit_petrol/Owezy Urun Tasarimi.dc.html
    UYGULANAN BOLUM id="5a". 2a/3a/3b/4a REDDEDILMIS alternatifler.
    Yanindaki README.md spec'in kendisi - her token, her olcu orada.
    OKUMA YOLU: DesignSync (get_file). /design-login BIR KEZ yapildi ve
    kaliyor. list_projects BOS doner - proje "design system" tipinde degil,
    dogrudan projectId ile get_project/list_files/get_file calisiyor.

  HANDOFF'UN ALTI ADIMI - HEPSI BITTI:
    1. web tokenlari          9e44613     4. mobil harcama ekleme  8ab8f58
    2. mobil tema + fontlar   9e44613/cf94a4e   5. web tanitim sayfasi  1379c6e
    3. mobil grup ekrani      ba8a515     6a. koyu tema             4ff3b1d
    6b. magaza ekran goruntuleri  BEKLIYOR (asagida)

  HANDOFF'UN CIZMEDIGI EKRANLAR - HEPSI YENI DILE TASINDI:
    mobil : harcama detayi 9f9e7f6 · odesmeler 70d6e4c · uyeler 5882446
            hesap 9c25910 · gruplar/bildirimler/giris 508e1fa
    web   : urun sayfalari 00833a2 · formlar+etiketler 2e1a608

  BUTUN MOBIL EKRANLAR SIMULATORDE ACIK VE KOYU TEMADA GORULDU.
  Web'in kimlikli sayfalari Playwright ile goruldu (yol asagida).

MAGAZA EKRAN GORUNTULERI - ARTIK ENGELI KALMADI
  Iki sebeple bekliyordu: (a) gercek bir build ister, Expo Go yetmez,
  (b) 1.0.3 ESKI tasarimi tasidigi icin oncesinde uretmenin anlami yoktu.
  1.0.4 build'i (e5371f69) IKISINI DE kaldiriyor: yeni tasarimi tasiyan
  gercek bir IPA var. Magazadaki UC gorsel hala eski tasarimi gosteriyor
  ve 1.0.4 yayina cikinca YANLIS hale gelecek.

BU OTURUMDA OGRENILEN - TEKRAR ARAMA:

  WEB'IN KIMLIKLI SAYFASINI GORMEK: giris gerekiyor ve ajan ne parola ne
    tek seferlik kod yazabilir. YOL: e2e/ altina gecici bir spec yazip
    pageAs(browser,"owner") ile girip page.screenshot() almak. Sekiz kez
    boyle bakildi; spec HER SEFERINDE silindi.
    TEMAYI SECMEK: page.emulateMedia({ colorScheme: "dark" }) yetiyor -
    next-themes defaultTheme="system" ile kuruldugu icin sistem tercihi
    dogrudan surukluyor, localStorage'a dokunmaya gerek yok.
    DIYALOG CEKERKEN screenshot({ animations: "disabled" }) SART. Diyalog
    fade-in + zoom ile aciliyor; baslik gorunur olur olmaz cekilen kare
    YARIM SAYDAM cikiyor ve her sey solgun/yanlis renkte gorunuyor. Bu
    oturumda tam olarak bu yasandi: ilk kare "renkler ucmus" gibi
    okundu, oysa yalnizca animasyon bitmemisti.

  MOBILI SIMULATORDE GORMEK: kurulu Owezy bir RELEASE build (preview
    profili), expo-dev-client bagimliligi YOK, yani Metro'ya HIC
    baglanmiyor - dev-client derin baglantisi sessizce hicbir sey yapiyor
    ve ekranda ESKI gomulu paket kaliyor. Yaniltici: uygulama aciliyor.
    CALISAN YOL: npx expo start --go -> Expo Go kendi kuruluyor ->
    xcrun simctl openurl booted "exp://127.0.0.1:8081".
    ONCE web dev sunucusu acilmali: mobil .env.local localhost:3000'e bakiyor.
    YEREL DEV BUILD ALINAMIYOR: CocoaPods kurulamadi - macOS'un Ruby'si
    2.6.10, ffi >= 3.0 istiyor. Hatanin kendi onerisi (gem install ffi -v
    1.17.4) DA calismiyor. Cozum Homebrew; kullanicinin parolasi gerekiyor.

  ARKA PLAN KOSUSUNUN "exit code 0"I SARMALAYICI betigin kodu olabilir,
    kosunun degil. Bu oturumda iki kez yasandi (eas build, sonra e2e).

  PLAYWRIGHT'TA getByText, BIR textarea'NIN DEGERINI DE METIN SAYIYOR.
    "Yazdigim yorum ekranda mi" diye aramak, gonderim HIC olmasa da geciyor -
    taslak alanda duruyor ve eslesiyor. Kanit, cizilmis satirin kendisinden
    okunmali (orn. yalnizca yorumda bulunan "Sil" dugmesi). Bu oturumda tam
    olarak bu yasandi ve yalnizca ekran goruntusu ortaya cikardi.

  SOZLUK ANAHTARINI SABLON DIZGIYLE YAZMA: messages.test.ts kaynagi
    TARAYARAK calisiyor; `t(\`ui.x_${...}\`)` kaynakta hic gecmiyor ve o
    kontrol onu goremiyor. Iki kez yasandi (web karsilama, mobil hesap).

  MOBILDE GIRISI AJAN YAPAMAZ - ve sebebi "TextInput odaklanmiyor" DEGIL.
    Odaklaniyor, yazi da giriyor (10 Eylul'de olculdu; yalnizca iOS otomatik
    duzeltmesi kelimeyi degistirebiliyor - "Fis" -> "Did"). GERCEK SEBEP:
    girisin iki yolu da KIMLIK BILGISI istiyor (parola ya da tek seferlik
    kod) ve ikisini de forma yazmak ajana yasak. Kullanici bir kez girmeli.
    HANGI HESAP: dev veritabaninda demo@owezy.net'in "Ev" grubu ve bir
    harcamasi var; ormeciahmet32@gmail.com'a da kod GIDIYOR (RESEND_API_KEY
    dev'de tanimli). appreview@owezy.net PRODUCTION'da, dev'de YOK - onunla
    denemek "e-posta ya da parola yanlis" veriyor ve yaniltiyor.
    DEV VERITABANINA BAKMANIN YOLU: npx prisma studio (kendi env'ini kendisi
    okuyor; .env.local'i elle okumaya gerek yok ve zaten engelli).

DIS DUNYA - 10 EYLUL OLCUMU (bu dosya her yazildiginda TEKRAR olculecek):
  DMARC    v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r
  CANLI    / , /support , /privacy , /.well-known/... -> hepsi 200
  AASA     Apple CDN 200
  ALAN ADI askIda degil
  MAGAZA   1.0.2 | 2026-09-07 | ['EN','TR']
           1.0.3 HENUZ YAYINDA DEGIL. Ama bu sorgu tek basina kanit DEGIL -
           yayin anini degil kendi onbelleginin tazelenmesini gosteriyor
           (8 Eylul'de hala "1.0" diyordu, kendiliginden duzeldi).
  CI       86295ae success
  PANEL    KULLANICIYA SORULDU (10 Eylul): 1.0.3 HALA "Waiting for Review".
           Bu, olculebilen degil SORULAN bir madde - her oturumda tekrar
           sorulmali.
  UCLAR    canlida /api/v1/.../comments -> 401 auth.not_signed_in (GET+POST).
           404 olsaydi rota yok, 500 olsaydi bir sey kirik demekti.
           MIGRATION DA GECTI ve kaniti dolayli ama kesin: vercel-build
           "prisma migrate deploy && prisma generate && next build" -
           goc dusseydi build tamamlanmaz, gizlilik metnindeki yeni cumle
           canlida olmazdi. Orada.

1.0.3 (build 20) - INCELEMEYE YENIDEN GONDERILDI (9 Eylul):
  Once Guideline 2.1 ile reddedildi: App Store Connect'teki "User name"
  alaninda demouser yaziyordu, oysa bu uygulamada kullanici adi YOK -
  giris e-posta ile. Sunucu hesaba bakmadan 400 INVALID_EMAIL donuyordu,
  yani hangi parola yazilirsa yazilsin inceleyici giremezdi.
  Alan appreview@owezy.net yapildi, Notes'a dort adimli giris yolu
  yazildi ("Send code'a basmayin"), ayni build 20 yeniden gonderildi.
  Kullanici gizli pencerede DOGRULADI: parolayla giriyor, 2FA kapali.
  10 EYLUL: INCELEMEDEN CIKTI VE YAYINLANDI - 06:23'te, olculdu
  (itunes lookup: us/gb/tr/ca/au/jp hepsi 1.0.3).

  BU RET ATLANMIS BIR KONTROLDEN CIKTI. CHANGELOG 4 Eylul'de tanimliyor:
  "gonderimden once appreview@ parolayla girebiliyor mu, ikinci adim
  istiyor mu". Kosulmadi. HER GONDERIMDEN ONCE KOSULACAK.

  SURUMLER:
    1.0.3  build 20, INCELEMEDE (9 Eylul, bir kez reddedilip yeniden
           gonderildi - ayrinti yukarida).
           push bildirim, uye cikarma + davet iptali, {amount} duzeltmesi,
           grup eylemleri fisin USTUNDE, basliktaki hesap simgesi, tema
           secimi, FIS FOTOGRAFI.
           build 16-19 da 1.0.3'tu; 20 hepsinin yerini aldi ve fis YALNIZCA
           20'de calisiyor.
    1.0.2  MAGAZADA CANLI (8 Eylul, telefonda guncelleme alinarak dogrulandi).
    1.0.1  build 11, TestFlight'ta KULLANILMADAN duruyor. ATLANDI.

  1.0.3 ONAYLANINCA IKI IS TETIKLENIYORDU:
    1. DESTEK SAYFASI - YAPILDI (10 Eylul). Madde SILINMEDI, SURUME GORE
       YENIDEN YAZILDI: 1.0.3 ve sonrasinda push geliyor (izin verilirse),
       daha eski surumde gelmiyor. Silmek yanlis olurdu - magazadaki 1.0.2'yi
       kullananda push GERCEKTEN yok, yani cumle onlar icin hala dogru.
       Iki dilde de degisti.
    2. KOPRU KALDIRILABILIR HALE GELIR - ama surum YAYGINLASINCA.
       Silinecekler "KOPRU" basliginda. HENUZ DEGIL.

  RET GELDI VE GEREKCESI OKUNDU - yukaridaki gorev ondan cikti.

EKRANDA HENUZ GORULMEYENLER - 1.0.3'un icinde ve HICBIRI bakilmadi:
  yerlesim (eylemler fisin ustunde), basliktaki hesap simgesi, tema secimi,
  fis akisi, listedeki fis ataci, tam ekran goruntuleyici.
  Push GERCEK TELEFONDA dogrulandi; bu alti sey dogrulanmadi.
  OZELLIKLE: TEK GRUBU OLAN hesapla ac. O hesap dogrudan grubun icine
  dusuyor, geri dugmesi hic dogmuyor ve hesaba giden tek yol o ekranin
  altindaki karttI - KALDIRILDI. Basliktaki simge onu karsilamiyorsa
  kullanici hesabina ulasamaz.

MOBILDE YONETIM EKSIKLERI - BITTI (8 Eylul). Uye cikarma ve davet iptali
  eklendi, 10 ekran testiyle. Sahiplik devri KAPSAM DISI kaldi: ayri bir uc
  yok, web'de de yok - devir yalnizca AYRILIRKEN var ve o mobilde zaten
  calisiyordu.

PUSH BILDIRIM - BITTI VE GERCEK TELEFONDA DOGRULANDI (8 Eylul, ADR-047).
  APNs anahtari kurulu (Portal ID 47KL3BM87C). App Privacy'ye "Identifiers ->
  Device ID" satiri girildi.

  DOGRULAMA YOLU (bir daha gerekirse):
    TestFlight'tan kur -> Bildirimler ekraninda izin ver -> IKINCI BIR
    HESAPLA ortak gruba harcama ekle -> telefonda bildirim dusmeli.
    TUTAR VE ISIM GORUNMEMELI.

YENI YETKI EKLERKEN APPLE PORTALI - IKI KEZ AYNI SEKILDE DUSTUK:
  Yeni bir iOS yetkisi (Associated Domains, Push Notifications) eklendiginde
  build su hatayla DUSUYOR:
      Provisioning profile ... doesn't include the X capability
  SEBEP: mevcut profil o yetkiyi tasimiyor ve EAS onu kendi basina
  YENILEMIYOR - ne --non-interactive ne de etkileşimli kosu duzeltti.
  COZUM: developer.apple.com/account/resources/identifiers/list -> App ID ->
  yetkiyi ISARETLE -> Save. Bu mevcut profilleri gecersiz kiliyor ve EAS
  bir sonraki build'de yenisini uretiyor (profil ID'si degisiyor - kontrol
  edilebilir: ZLPAAW529A -> ZR63Q74VG8).
  YETKI ILE ANAHTAR AYRI SEYLER: APNs anahtari GONDERMEK icin, App ID'deki
  kutu ALMAK icin. Ikisi de gerekiyor.

EAS BUILD BASARISIZ OLDUGUNDA DA 0 DONUYOR. Arka plan bildirimindeki
  "exit code 0" build'in gectigi anlamina GELMEZ; ciktiyi oku. Ayni sinif
  hata daha once kabuk seviyesinde de yasandi (asagida).

FIS FOTOGRAFI - BITTI VE GERCEK CIHAZDA YUKLENDI (8 Eylul, ADR-046).
  R2 kurulu (kova owezy-receipts, degiskenler .env.local + Vercel).
  App Privacy'ye "User Content -> Photos or Videos" satiri girildi.

  R2'YE YAZARKEN CONTENT-LENGTH ELLE VERILIYOR ve bu ZORUNLU. Node'un
  undici'si ArrayBuffer govdesi icin basligi kendisi koyuyor; VERCEL'IN
  CALISMA ZAMANI parcali aktarim kullanip HIC koymuyor ve R2 411
  MissingContentLength donuyor. Uc dagitim turu buna gitti - cunku ayni
  istek YERELDE 200 donuyordu. DERS: dogru seyi YANLIS ORTAMDA olcmek, hic
  olcmemekten kotu; insani emin yapiyor.

  DEPO HATALARI KENDI KODLARINI TASIYOR (ServiceError): not_configured,
  forbidden, bucket_not_found, bad_request. Oncesinde hepsi "beklenmeyen bir
  hata"ydi ve yapilandirma eksigiyle yazilim hatasi ayirt edilemiyordu.

  WEB'DE YUKLEME YOK, yalnizca goruntuleme. Bilincli kapsam karari; fis
  odeme aninda telefonla cekiliyor ve web'de eklemek ayrica TARAYICIDA
  kucultme demekti. Isteyen olursa ayri bir is.

  GERCEK KUCUK RESIM YOK - listede yalnizca bir atac. Kirk harcamalik bir
  liste kirk fotograf indirmek olurdu. Istenirse yukleme aninda ikinci bir
  kucuk kopya uretilip saklanir (sema degisikligi + eski fisler icin yedek
  yol).

  PINCH-ZOOM YOK: react-native-gesture-handler eklemek gerekirdi.

CI'A BAKILIYOR MU? - 8 EYLUL'DE DORT COMMIT BOYUNCA BAKILMADI.
  Yerel testlerin gecmesi CI'in gectigi anlamina GELMIYOR. expo-doctor
  kurulu surumleri SDK'nin CANLI gereksinimiyle karsilastiriyor; Expo yeni
  yama yayinlayinca CI, MOBILE HIC DOKUNMAYAN bir commit'te duser.
  Duzeltmesi: cd mobile && npx expo install --fix
  Durum sorgusu (gh yok, depo herkese acik):
    curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=3"

EAS BUILD KOTASI - UCRETSIZ PLANDA AYDA 15 iOS BUILD.
  8 Eylul: 12 kullanildi, besi tek oturumda. BUILD ALMADAN ONCE SOR;
  degisiklikleri biriktirip tek build almak dogrusu.

DORT MADDENIN HEPSI BITTI (10 Eylul) - bu blok artik bir KAYIT:
  odeme hatirlatmasi (Faz 43) · tekrarlayan harcama (Faz 44) ·
  kalem kalem bolusum (Faz 45) · fis OCR (Faz 46). Dordu de kodda,
  testleri yesil, 1.0.4 build'inde.

  CRON PAYLASIMI DOGRU CIKTI: hatirlatma ile tekrarlayan harcama ayni
  altyapiyi kullaniyor ve vercel.json ARTIK VAR (0 6 * * *).

  FIS OCR HAKKINDAKI TAHMIN YANLIS CIKTI: "dis servis demek, ucretli, ve
  gizlilik politikasi ile App Privacy anketi yeniden degisir" diye
  yazilmisti. Cihaz uzerinde calisan MIT lisansli bir modul bulununca uc
  gerekcenin ucu de dustu; ne politika ne anket degisti (ADR-053).
  Ders: gerekce tek bir cozumun ozelligiyse, gerekce degil o cozumdur.

  Destek sayfasindaki "bugunku sinirlar" listesi (src/content/legal/support.ts)
  KONTROL EDILDI: dort maddenin hicbiri o listeyi yanlis hale getirmiyor.
  EXACT bolusumun tutari mobilde HALA degistirilemiyor (isExact ->
  canEditAmount false), yani o madde dogru duruyor.

LISTEDEN DUSEN IKI MADDE - BIR DAHA "mobilde eksik" DIYE YAZILMASINLAR:
  odesme duzenleme    -> HICBIR YERDE UC YOK. Web de yalnizca iptal
                         edebiliyor ve mobil bunu ZATEN yapiyor.
  silineni geri alma  -> uc var (POST .../restore) ama WEB'DE DE ARAYUZ YOK.
  Ikisi de urun sinirı, mobil sinirı degil. Yapmak = iki tarafa birden yeni
  ozellik eklemek; AGENTS.md gorev verilmeden bunu yasakliyor.

UNIVERSAL LINK - YAPILDI (1.0.2, 4 Eylul). Uc parcasi da yerinde:
    1. owezy.net/.well-known/apple-app-site-association  (7 Eylul: 200)
    2. app.json'da associatedDomains + App ID'de Associated Domains yetkisi
    3. build 14
  Kalan tek soru yukarida ("TEK ACIK SORU"). EXPO GO'DA DENENEMEZ -
  development ya da production build sart.

MAGAZA METNI ARTIK REPODA: docs/STORE.md (10 Eylul).
  Aciklama ve surum notlari CANLI MAGAZADAN cekildi (itunes lookup ucu).
  Altyazi, anahtar kelimeler, tanitim metni ve TURKCE yerelestirme o uctan
  GELMIYOR - ASC'den yapistirilacak, dosyada bos duruyor.

  DOSYA TAM: aciklama (EN + TR), 1.0.2 ve 1.0.3 surum notlari, altyazi,
  anahtar kelimeler. Tanitim metni iki dilde de BILEREK bos.

  1.0.4 METINLERI HAZIR - docs/STORE.md "1.0.4 GONDERIMI" bolumu.
  Iceride: aciklama (EN + TR), surum notu (EN + TR), anahtar kelimeler.
  Dordu de 4000 karakter sinirinin cok altinda (en uzunu 1844).
  Anahtar kelimelerde ONERI SADECE EKLEME: EN 98/100, TR 95/100 - hicbir
  kelime cikarilmiyor, cunku "adda gecen kelimeyi tekrar yazmak yer
  harcar" varsayimi DOGRULANAMIYOR (Apple algoritmayi yayimlamiyor).

PRODUCTION'DAKI DEMO HESAPLAR - DIKKAT:
  appreview@owezy.net  inceleme hesabi. SILME, PAROLASINI DEGISTIRME -
                       sonraki gonderimlerde de Apple bunu kullanacak.
  demo@owezy.net       ICINDE VERI VAR (bir grup, harcamalar, ikinci uye).
                       Atilabilir DEGIL; 1 Eylul'de silinmek uzereyken
                       fark edildi. Bir demo hesabi gerekiyorsa YENI bir
                       adres ac.
  demo2, demo3         ekran kaydi icin yaratildi ve UYGULAMA ICINDEN
                       silindi. Cloudflare yonlendirmeleri duruyor.

  YENI BIR ADRES KULLANMADAN ONCE IKI SEY: Cloudflare Email Routing'de
  ekli mi, ve Resend'in suppressions listesinde DEGIL mi. Ikisi de bir
  oturumu ayri ayri durdurdu - ve arayuz her iki durumda da "Sent to ..."
  diyor, yani hicbir sey belli olmuyor.

GELISTIRME VERITABANINDA BIRAKILAN TEST VERISI:
  "Deniz'in evi" grubu ve davetci@ornek.test kullanicisi, davet kabulunu
  denemek icin uretildi. BILEREK BIRAKILDI: gelistirmedeki tek COK UYELI
  grup o, ve "senin payin" ile "kim odedi" ancak orada gercekten degisiyor.

BIR SONRAKI GONDERIM ICIN - SIRASI ONEMLI:
  1. eas build
  2. push        -> destek sayfasi yeni ozellikleri anlatiyorsa, o metin
                    ancak yeni build gonderildikten sonra dogru olur
  3. eas submit
  4. gerekirse ekran kaydi - FIZIKSEL CIHAZDA. Apple'in ret metninin 1.
     maddesi acikca "captured on a physical device" diyor; bu oturumda
     once simulator kaydi uretildi ve KULLANILAMADI.
  5. App Store Connect'te surumu yayina alma

  APP REVIEW INFORMATION DOLU ve oyle kalmali: demo hesap (appreview@)
  ve Notes alani. Notes'ta uygulamanin ne yaptigi, hesap silme yolu, izin
  istemi olmadigi, kullanilan dis servisler ve bolgesel fark olmadigi
  yaziyor - Apple bunu "for future submissions" diye istemisti.

  CEVAP VE NOTES METINLERI 4000 KARAKTERLE SINIRLI - IKISI DE.

MAGAZA KIMLIGI - COZULDU, DOKUNMA:
  TURKCE AD 1.0.4'TE DEGISIYOR: "Owezy" -> "Owezy: Masraf Paylasimi".
  KULLANICI 10 EYLUL'DE ACIKCA KARAR VERDI. Sebep olculdu: ad BOLGEYE
  DEGIL DILE gore seciliyor (lang=tr_tr -> "Owezy", lang=en_us ->
  "Owezy: Split Expenses"), yani Turkce ad tek basina hicbir arama
  karsilamiyordu.

  ESKI "DOKUNMA" NOTUNUN GECERLI OLDUGU YER: bu hesap bir kez KALICI
  olarak isim kaybetti - ama o olay isim DEGISTIRMEKTEN degil uygulamayi
  KALDIRMAKTAN cikti (Apple: "If you remove an app, you'll lose ownership
  of the app name"). Ad degisikligi bir SURUMLE gidiyor ve incelemeden
  geciyor; reddedilirse eskiye donulebilir. UYGULAMAYI KALDIRMA kurali
  aynen duruyor.

  net.wezy.app SILINEMEZ, silinmeye calisilmasin - build almis bir bundle ID
  ayni organizasyonda bir daha kullanilamiyor (Apple belgeliyor). Zararsiz.
  CANLI olan bundle net.owezy.app.

  TELEFONDAKI AD app.json'daki "name"den geliyor ve "Owezy" olarak kaldi.

BITEN VE OLCULEN ISLER (bir daha "yapilacak" diye yazilmasinlar):
  MAGAZA   1.0 canli, 4 Eylul   (itunes lookup ile)
  AASA     owezy.net/.well-known/apple-app-site-association -> 200
           Apple CDN (app-site-association.cdn-apple.com/a/v1/owezy.net) -> 200
  DNS      v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r   (dig ile)
  CANLI    owezy.net/ , /support , /privacy  -> 200   (curl ile)
           /terms yok ve gerekmiyor - Apple'in standart EULA'si kullaniliyor
  SENTRY   "Prevent Storing of IP Addresses" acik
  POSTA    destek@ VE appreview@owezy.net acik, kullanicinin kutusuna
           yonleniyor (Cloudflare Email Routing)
  DOGRULAMA appreview@owezy.net'te e-posta dogrulandi (28 Agustos)
  IKON     yeni isaretle uretildi; acilis gorseli de ayni iki path'ten
  EAS      eas.json'da ascAppId yazili (6805650395)

AKILDA TUTULACAKLAR:

  E2E DUSUNCE ONCE MAKINEYI TEMIZLE - METRO VE SIMULATOR DAHIL. 4 Eylul'de
  E2E kosarken Expo ile simulator acik birakildi; ucu ayni makinede yarisip
  60 saniyelik test sinirini kaybettirdi. Belirti yaniltici: testler CPU
  YEMIYOR, BEKLIYOR. Bir kosu 42 dakika surdu.

  KOSUYU ORTASINDAN KESME. pkill ile durdurulan bir kosu E2E veritabanini
  yarim birakiyor; sonraki kosuda kurulum "kullanici zaten var" (422) diye
  dusuyor ve sebep kodda aranmaya baslaniyor.

  "The destination stream closed early" TEK BASINA BIR SEY ANLATMIYOR. Gecen
  bir kosuda da bir tane gorulebiliyor. Belirti olan SAYISI: yediye ciktiysa
  gercekten bir sey bozuk.

  BIR DEGISIKLIGIN SUCLU OLDUGUNU KOSU SAYARAK KANITLA. 4 Eylul'de bir
  degisiklik once masum, sonra suclu, sonra yine belirsiz gorundu cunku
  kirli ve temiz kosular ayni kefeye konmustu. Yalnizca TEMIZ kosular sayilir
  ve degisiklikli/degisiksiz en az ikiser kez kosulmalidir.


  EXPO'NUN GELISTIRICI BALONCUGU BASLIGIN SAG USTUNU KAPATIYOR. 4 Eylul'de
  bildirim zili "hic cizilmemis" sanildi; balonu asagi surukleyince zil
  oradaydi. Baslikta bir sey aranirken ONCE balonu kenara cek.


  NEXT'IN ISTEGI KLONLANMAZ. "new Request(request, { headers })" URETIMDE
  PATLADI:
      TypeError: Cannot read private member #state from an object whose
      class did not declare it
  Next rotaya kendi NextRequest'ini veriyor; undici'nin Request yapicisi
  girdiyi gercek bir Request sanip ozel alanini okumaya calisiyor. Duz
  Node'da AYNI SATIR SORUNSUZ - once oyle olculdu ve yaniltti. Basligi
  degistirmek gerekiyorsa istegi PARCALARINDAN kur:
      new Request(request.url, { method: request.method, headers, body })

  BU HATANIN SINIFI, DUZELTMEYE CALISTIGIMIZ HATANIN AYNISI: dogru sey
  olculdu, YANLIS ORTAMDA. Bir satirin "Node'da calistigini" gormek, onun
  Next'in rota isleyicisinde calistigini GOSTERMEZ. Sunucu kodu sunucuda
  denenmeli - npm run dev + curl yetiyor.

  KOPRUYU UCTAN UCA DOGRULAMA YOLU (kopru durdukca gecerli):
    1. src/lib/better-auth.ts -> advanced'a: useSecureCookies: true
    2. e2e/two-factor.spec.ts -> ilgili test.skip'i test yap
    3. npx playwright test e2e/two-factor.spec.ts
    4. IKISINI DE GERI AL
  Olculdu (4 Eylul): kopru acikken 200 + set-auth-token, kapaliyken 401.
  NEGATIF KONTROL SART - gecen bir test, dusebildigi gosterilmedikce
  hicbir sey kanitlamaz.

  ARKA PLAN BILDIRIMINDEKI "exit 0" TESTLERIN GECTIGI ANLAMINA GELMEZ.
  Kabugun cikis kodu SON komuttan gelir. Yani:

      npm run test:e2e > log 2>&1
      echo "cikis: $?" >> log        <-- kabuk artik 0 doner (echo basarili)

  Playwright 1 donmusken bildirim "completed (exit code 0)" diyor. 4
  Eylul'de tam olarak bu oldu: kurulum adimi dusmustu ve neredeyse "E2E
  yesil" diye rapor edilecekti. LOGU OKU - "passed/failed" satirini ve
  dosyaya yazdirdigin gercek kodu. Bildirime guvenme.
  (Ayni aile: "| tail" ile boruya sokmak - cikis kodu tail'den gelir.)


  E2E BU HATA SINIFINI YAPISAL OLARAK YAKALAYAMAZ. Better Auth'un
  "__Secure-" onegini tetikleyen sey NODE_ENV ve E2E gelistirme modunda
  kosuyor - orada onek HIC olusmuyor. Yani https'e bagli her davranis
  (cerez adlari, Secure bayragi, SameSite etkileri) testlerin disinda
  kaliyor. Bir sey "cerez" ya da "protokol" ile ilgiliyse yesil E2E
  DELIL DEGIL.

  BIR OLCUM HANGI ORTAMDA ALINDIGIYLA BIRLIKTE ANLAM TASIYOR.
  two-factor-cookie.test.ts uydurma degildi; gercek bir sunucu yanitindan
  olculmustu - ama GELISTIRME sunucusundan, yani ayirt edici ozelligin
  (https) bulunmadigi yerden. "Olctum" demek yetmiyor, "nerede olctum"
  da yazilmali.


  KOYU TEMA AYRICA DENENMELI: xcrun simctl ui <udid> appearance dark
  Giris ekrani aylarca renklerini ELLE tasidi (#fff, #111) ve useTheme()'i
  hic cagirmadi; koyu temada butun uygulama koyulasirken o ekran beyaz
  kaliyordu. Kimse fark etmedi cunku kimse koyu temada bakmadi.

  "Intl CALISIYOR" DIYE BIR BUTUN YOK. Hermes'te Intl.NumberFormat ve
  Intl.DateTimeFormat var ama Intl.RelativeTimeFormat YOK - bildirim ekrani
  yazilinca uygulama "undefined cannot be used as a constructor" ile coktu.
  Faz 18.2'deki olcum yalnizca ilk ikisini kapsiyordu. PAYLASILAN BIR MODULE
  giren her Intl.X mobilde AYRICA denenmeli (ADR-044).

  TEK GRUPLU KULLANICI GRUPLAR LISTESINI HIC GORMUYOR: index.tsx onu
  Redirect ile dogrudan grubun icine dusuruyor ve Redirect YIGINI
  DEGISTIRIYOR - geri dugmesi DOGMUYOR. Grup ekranindan bir sey
  kaldirilirken "geri dugmesi karsilar" DENMEZ; o kullanici icin geri
  dugmesi yok. Hesap ve bildirim kartlari bu yuzden orada.

  BIR EKRANDAN DONULDUGUNDE O EKRANIN BUTUN SORGULARI TAZELENMELI. Grup
  ekraninda bir sure yalnizca ozet yenileniyordu; grup adi degistirilip geri
  donuldugunde baslik ESKISINI gosteriyordu. Bir ekrandan gidilen her yer
  oradaki verilerden birini degistirebiliyor ve "hangisi degisti" sorusunun
  cevabini ekran bilemez. useApiGet tazelerken eldeki veriyi koruyor, yani
  hepsini yenilemenin gorunur bir maliyeti yok.

  DERIN BAGLANTI Redirect'i TAKLIT ETMIYOR: exp://.../--/groups/<id> acinca
  expo-router ust rotayi da yigina koyuyor ve geri dugmesi CIKIYOR. Yigin
  davranisini olcmek icin gercek durumu uretmek gerekiyor.

  YESIL SINYALLER URUNUN IYI OLDUGUNU SOYLEMEZ. Uygulama tsc, lint ve 67
  test yesilken KULLANILAMAZ haldeydi: ekranlardan geri donulemiyordu.
  Mobilde bir sey degistiginde SIMULATORDE BAKILMALI - kod okuyarak degil.

  MOBILDE DEGISIKLIK YAPTIYSAN PAKETI DE URET:
      cd mobile && npx expo export --platform ios --clear
  tsc, lint ve testler UCU DE temizken paket kirik olabiliyor: app/ altina
  konan bir test dosyasi EAS build 6'yi dusurdu (expo-router app/'in
  TAMAMINI require.context ile uretim paketine aliyor; ".test.tsx" icin
  istisna YOK). Ekran testleri bu yuzden test/screens/ altinda.

  "--platform ios" SART, yoksa YANLIS ALARM alirsin. Duz "npx expo export"
  web'i de paketlemeye calisiyor ve react-native-web KURULU DEGIL - depoda
  hic bulunmadi (git log -S ile bakildi). Yani o komut bu depoda HIC
  calismadi ve calismayacak; cikis kodu 1, hata "Unable to resolve module
  react-native-web/dist/index". Degisiklikle ilgisi yok - stash'leyip
  olculdu, degisiklik olmadan da ayni sekilde dusuyor.

  expo-doctor'IN "peer dependency" KONTROLU GERCEK COKMELERI YAKALIYOR -
  tsc, lint, testler VE expo export'un DORDU DE goremedigi seyleri.
  4 Eylul'de @expo/vector-icons (bildirim zili icin kuruldu) expo-font'suz
  kaldi ve doctor "Your app may crash outside of Expo Go" dedi. Expo Go
  o paketi kendi tasidigi icin SIMULATORDE HER SEY NORMAL gorunuyordu;
  uretim paketinde cokerdi. Zili tasiyan build (59c40b94) bu eksikle
  alinmisti - gonderilmedigi icin kurtarildi.
  COZUM: npx expo install expo-font
  KURAL: yeni bir Expo paketi kurunca expo-doctor'i KOS ve "peer
  dependency" satirini oku. "Bilinen kararsiz kontrol" diye gecme.

  expo-doctor'IN YERELDEKI CIKTISI YANILTICI: tek sikayeti CocoaPods ise
  o kontrol Linux'ta HIC CALISMIYOR, yani CI'da baska bir kontrol dusuyor
  olabilir. Tam ciktiyi oku.

  BU KONTROL BIZ HICBIR SEY YAPMADAN DA KIRILIYOR - UC KEZ OLDU (29
  Agustos 433ff75, 1 Eylul 3ca668a, 4 Eylul 4fc6100 sonrasi). 4 Eylul'de
  expo-sharing AYNI GUN kuruldu ve birkac saat icinde geride kaldi. Expo, SDK 57 icin yama
  surumleri yayimliyor ve "packages match versions required by installed
  Expo SDK" kontrolu bizim paketlerimiz geride kaldigi anda dusuyor.
  Belirti yaniltici: CI, koda dokunmayan bir DOKUMAN commit'inde kirmizi
  oluyor ve suc son commit'te sanilyor. 1 Eylul'de fda5d60 13:50'de gecti,
  b45577a 22:21'de dustu, arada paketlere dokunan hicbir sey yoktu.

  COZUM TEK KOMUT:  cd mobile && npx expo install --fix
  Sonra dogrula (tsc, lint, npm test, expo export, expo-doctor) ve
  mobile/package.json ile mobile/package-lock.json'i commit'le.

  CI KOSUSUNU ELLE OKUMAK: depo GENEL, yani gh olmadan da bakilabiliyor -
    curl -s "https://api.github.com/repos/ahmetormeci/owezy/actions/runs?per_page=8"
  ve bir kosunun adimlari icin .../actions/runs/<id>/jobs

  FAST REFRESH EKRANI YENIDEN BAGLIYOR ve "ilk odaklanma" sayaclarini
  sifirliyor. Duzenleme yaptiktan sonra "tazelenmedi" gorunumu genelde bu -
  hata teshis etmeden once UYGULAMAYI BASTAN BASLAT.

  SIMULATORDE METIN ALANLARINA ODAKLANILAMIYOR (4 Eylul, olculdu).
  Baslik cubugundaki dokunuslar CALISIYOR - zile basildi, gitti - ama React
  Native'in TextInput'lari odaklanmiyor: klavye acilmiyor, uzun basmada
  yapistirma menusu de cikmiyor. Dort yontem denendi (duz dokunus, bekleyen
  dokunus, uzun basma, kucuk hareketli dokunus); hicbiri tutmadi.
  SONUC: veri girisi gerektiren dogrulamalarda KULLANICIYA yazdir, sonra
  devral. Zaman kaybetme.

  SIMULATORDE METIN YAZDIRMAK KARAKTER DUSURUYOR. Kisa parcalar hâlinde yaz
  ve HER ADIMDA ekran goruntusuyle dogrula; dokunuslarin da iskalayabildigini
  unutma (bu oturumda iskalayan dokunuslar olmayan bir hataya teshis
  konulmasina yol acti). Uzun metin icin: xcrun simctl pbcopy + yapistir.

  BIR ADRES BIR KEZ SERT SEKERSE RESEND ONU KALICI OLARAK SUSTURUR - ve
  arayuz yine "gonderildi" der (sendVerificationOTP hatayi bilerek
  yansitmiyor). Teshis sirasi: resend.com/emails -> durum "Suppressed" mi ->
  resend.com/emails/suppressions -> Cloudflare Email Routing kurallari.

  DOGRULANMAMIS HESAP + E-POSTA KODU = PAROLA SILINIYOR (ADR-041).

  UZAK ADRESLI GORSEL YUKLENMIYOR: CSP img-src 'self' data: blob:.

  NODE 24'UN fetch'i Sec-Fetch-* BASLIKLARI GONDERIYOR, bu da Better Auth'un
  origin dogrulamasini ZORLUYOR. Betikle /api/auth'a istek atarken Origin sart.

  DESTEKLENEN PARA BIRIMI YALNIZCA TRY VE USD (money.ts).

  ARTIK GERCEK KULLANICI OLABILIR. 1.0 canli; production veritabaninda
  yalnizca bizim demo hesaplarimiz oldugu VARSAYILAMAZ. Production'a
  dokunan her betik once OKUYUP saymali, sonra yazmali.

TESTLER - NE NEREDE (10 Eylul'de kosuldu):
  KOK      npm test                  742 birim (vitest, src/**)
  MOBIL    cd mobile && npm test      86 vitest + 83 jest
  E2E      npm run test:e2e           61 test, ~15 dk  (+1 BILEREK atlanan:
           two-factor.spec.ts'teki 2FA kopru testi, oteden beri skip)

  E2E SUNUCUSUNUN KENDI CRON_SECRET'I VAR: playwright.config.ts'te
  webServer.env icinde ("e2e-cron-secret"). .env.local'a KONMADI - o dosyayi
  yalnizca kullanici duzenliyor ve bu deger yalnizca test sunucusunu
  ilgilendiriyor.

  MOBILDE IKI KOSUCU VAR ve sinir DIZINE gore (ADR-042, ADR-043):
    lib/**                    -> vitest   (react-native'e dokunmuyor)
    components/**, test/screens/** -> jest (dokunuyor)
  Mobil testler KOKTEN kosmuyor: agacta iki ayri React kopyasi var.

E2E - getByRole'un ADI TURKCEDE ALT DIZIYE TAKILIYOR (10 Eylul, olculdu):

  getByRole("button", { name: "Hatirlat" }) BASLIKTAKI GRUP ADI dugmesini
  buldu ve "borclu hatirlat gormuyor" testi bu yuzden dustu - kodda bir
  kusur yoktu.

  SEBEP playwright-core'da OLCULDU (matchesAttributePart): name
  karsilastirmasi buyuk/kucuk harf duyarsizligini toUpperCase() ile yapiyor
  ve exact verilmediginde ALT DIZI ariyor ("*="). Turkcede noktali i ile
  noktasiz i BUYUK HARFTE ayni harfe cikiyor:

      "Hatirlat".toUpperCase()   -> "HATIRLAT"
      "hatirlatma".toUpperCase() -> "HATIRLATMA"   <- ilkini ICERIYOR

  Grup adi "[e2e] hatirlatma <zaman>" idi ve basliktaki grup degistirici
  dugmesinin ERISILEBILIR ADI o metin.

  KURAL: bu uygulamada baslik KULLANICININ YAZDIGI grup adini bir DUGME
  olarak tasiyor. Sayfa geneline yapilan her getByRole("button", {name})
  o adla carpisabilir. Turkce etiketlerde exact: true KULLAN - ya da
  aramayi main'e daralt.

  AYNI TUZAGIN IKINCI YUZU: "Hatirlatildi" metni "Hatirlat" ile BASLIYOR.
  Alt dizi aramasi ikisini ayirt etmiyor.

E2E - NASIL CALISIYOR:

  ILK KOSU SOGUK DERLEMEYLE YARISIYOR - VE KAYBEDEBILIYOR.
  Kaynak degistikten SONRAKI ILK kosuda Turbopack rotalari TALEP UZERINE
  derliyor. Test basina sinir 60 sn ve o yaris kaybedilebiliyor. BELIRTI
  YANILTICI: yazma istekleri asili kaliyor, dugme "Olusturuluyor..." de
  donup kaliyor - sanki bir mantik hatasi varmis gibi. Aslinda o uca ILK
  KEZ gidiliyor ve rota isleyicisi daha derleniyor.

  1 Eylul'de bu YANLIS TESHISE IKI KEZ goturdu: once "ortam kararsiz"
  denildi, sonra "sebep bende" denildi. Ikisi de yanlisti. OLCUM:
    kosu 1  degisiklikler, derlenmemis  -> DUSTU  (4.0 dk)
    kosu 2  stash (daha once derlenmis) -> 7 gecti (32.6 sn)
    kosu 3  degisiklikler, artik derli  -> 7 gecti (31.7 sn)
  Ayni kod, iki farkli sonuc. Belirleyici olan ONBELLEK.

  KURAL: E2E dusunce ONCE ISINDIRIP TEKRARLA. Ucuzu:
      npx playwright test e2e/auth.spec.ts
  Ayni sonuc iki kez ust uste cikiyorsa gercek bir kusurdur.
  (Dosya filtresi kurulumu ELEMEZ - chromium projesinin
  dependencies: ["setup"] bagi var. ELEYEN sey -g.)

  DEGISIKLIGIN SEBEP OLUP OLMADIGINI OLCMENIN YOLU: git stash push -u ile
  kaldirip kos, sonra pop'layip TEKRAR kos. Yalnizca stash'li kosuyu
  gormek YANILTIR - o icerik zaten derlenmis oluyor.

  - CIKTIYI "| tail" ILE BORUYA SOKMA. Cikis kodu tail'den gelir (hep 0) ve
    hata ayrintisi kirpilir. Dosyaya yaz, sonra oku.
  - Tam kosu ~10 dakika, 56 test. KOSU SURERKEN PROJE DOSYALARINA DOKUNMA.
  - 3000'deki dev sunucusu KAPALI OLMALI. (Kapattiktan sonra GERI ACMAYI
    unutma - unutuldugunda mobil uygulama "Something went wrong" veriyor.)
  - Sema degistiyse once: npm run db:migrate:e2e
  - Tek seferlik kodlar veritabanindan okunuyor (readOtpFromDatabase).

MOBILI SIMULATORDE ACMAK:
  xcrun simctl boot <udid> && open -a Simulator     (ikisi de sart)
  npm run dev                    (kokte, 3000)
  cd mobile && npx expo start --ios
  Giris: e-posta kodu yolu; kod GELISTIRME veritabanindan okunuyor
  (Verification tablosu, identifier "sign-in-otp-<email>"). Parola yazmaya
  gerek yok.

DIGER ADAYLAR: PROGRESS.md'deki liste - PLAN DEGIL, secenek listesi.
  Fis fotografi + profil fotografi TEK ADAY ve ARTIK BASLANABILIR (1.0
  yayinlandi): CSP'yi, gizlilik politikasini, Info.plist izinlerini ve App
  Privacy anketini birden degistiriyor - o yuzden gorev olarak verilmeli.
