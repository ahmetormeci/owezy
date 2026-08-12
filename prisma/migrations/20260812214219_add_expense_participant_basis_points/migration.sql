-- AlterTable
ALTER TABLE "ExpenseParticipant" ADD COLUMN     "basisPoints" INTEGER;

-- Yuzde araligi kisiti. NULL bilerek serbest: EQUAL/EXACT bolusumde yuzde
-- diye bir sey yok, ve bu kolondan onceki satirlarda yuzde hic saklanmadi.
-- Tek bir satir icinde ifade edilebildigi icin CHECK yeterli; "toplam 10000
-- olmali" kurali coklu satir toplami oldugu icin burada DEGIL, uygulama
-- katmaninda (splitByPercentage) uygulanir.
ALTER TABLE "ExpenseParticipant"
    ADD CONSTRAINT "ExpenseParticipant_basisPoints_within_range"
    CHECK ("basisPoints" IS NULL OR ("basisPoints" >= 0 AND "basisPoints" <= 10000));
