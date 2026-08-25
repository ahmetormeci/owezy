-- Optimistic locking sayaci (ADR-032).
--
-- DEFAULT 1: mevcut satirlarin hepsi 1'den baslar. Istemciler sayaci okuyup
-- geri gonderdigi icin bu deger tutarli - kimse "surumu olmayan" bir harcama
-- gormez.
--
-- NOT NULL: sayacin bos olabildigi bir satir, kontrolun atlanabildigi bir
-- satir demek olurdu. Kontrolun kacamagi olmamali.
ALTER TABLE "Expense" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
