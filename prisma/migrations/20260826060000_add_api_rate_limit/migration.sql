-- /api/v1 YAZMA uclarinin hiz siniri sayaclari.
--
-- NEDEN BETTER AUTH'UN RateLimit TABLOSU KULLANILMIYOR: o tablo kendi
-- kendini buduyor ve budama esigini YALNIZCA Better Auth'un kendi
-- pencerelerinden hesapliyor (rate-limiter/index.mjs, deleteExpiredRows).
-- Bizim penceremiz daha uzun oldugu icin satirlarimiz sessizce silinirdi -
-- yani sinir zaman zaman hic uygulanmazdi.
--
-- BUDAMA GEREKMIYOR: anahtar kullaniciya bagli, satir sayisi kullanici
-- sayisiyla sinirli. Better Auth'unki "IP + yol" oldugu icin sinirsiz
-- buyuyebiliyor.
--
-- windowStart BIGINT: deger Date.now(), yani milisaniye. INTEGER 32 bittir
-- ve bu sayi oraya SIGMAZ (ayni gerekce 20260826040000'de de yazili).

-- CreateTable
CREATE TABLE "ApiRateLimit" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" BIGINT NOT NULL,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiRateLimit_key_key" ON "ApiRateLimit"("key");

-- NOT: "prisma migrate diff" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024).
