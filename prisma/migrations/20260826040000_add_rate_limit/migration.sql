-- Hiz siniri sayaclari. Better Auth yaziyor, biz hic dokunmuyoruz.
--
-- NEDEN BIR TABLO GEREKIYOR: kutuphanenin varsayilan depolamasi "memory" ve
-- Vercel'de her serverless ornegi kendi bellegini tasiyor. Sayac her yeni
-- ornekte sifirdan basliyordu, yani "10 saniyede 3 giris denemesi" kurali
-- pratikte cok daha fazlasina izin veriyordu. Kural degil, SAYDIGI YER
-- yanlisti.
--
-- lastRequest BIGINT VE BU ZORUNLU: deger Date.now(), yani milisaniye
-- (~1,77 x 10^12). INTEGER 32 bittir ve bu sayi oraya SIGMAZ.
--
-- "id" sutununda DEFAULT YOK, digerlerinde de yoktu (bkz.
-- 20260825170000_add_better_auth). Prisma'nin @default(uuid())'si ISTEMCI
-- tarafinda calisiyor: satiri Prisma yaziyor ve id'yi o dolduruyor.

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- NOT: "prisma migrate diff" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- semasi uretilmis kolonu ifade edemedigi icin farki "default kaldirilmali"
-- saniyor. Uygulansaydi arama katlamasi bozulurdu.
