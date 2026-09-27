-- MISAFIRI SAHIPLENME, ADR-057 - Faz 50b.
--
-- Bir misafire OZEL davet linki uretilebiliyor; kabul eden kisi misafirin
-- kayitlarini devraliyor. Misafir satiri SILINMIYOR: degisiklik gecmisindeki
-- (ExpenseEdit) eski kayitlar onu gosteriyor ve oyle kalmali - o anda
-- harcamayi odeyen gercekten misafirdi.

-- Linkin HANGI MISAFIR icin oldugu. NULL = normal grup daveti.
ALTER TABLE "GroupInvite" ADD COLUMN "guestUserId" UUID;

ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_guestUserId_fkey"
    FOREIGN KEY ("guestUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "GroupInvite_guestUserId_idx" ON "GroupInvite"("guestUserId");

-- MISAFIRE OZEL LINK TEK KULLANIMLIK OLMAK ZORUNDA. Birden fazla kullanim,
-- ayni misafiri iki kisinin sahiplenmeye calismasi demekti.
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_guest_single_use"
    CHECK ("guestUserId" IS NULL OR "maxUses" = 1);

-- Misafirin KIME ve NE ZAMAN devredildigi.
ALTER TABLE "User" ADD COLUMN "mergedIntoId" UUID;
ALTER TABLE "User" ADD COLUMN "mergedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD CONSTRAINT "User_mergedIntoId_fkey"
    FOREIGN KEY ("mergedIntoId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_mergedIntoId_idx" ON "User"("mergedIntoId");

-- YALNIZCA MISAFIR DEVREDILIR, ve devir IKI ALANIYLA BIRLIKTE yazilir:
-- kime (mergedIntoId) ve ne zaman (mergedAt) - biri olup digeri olmamaz.
-- Kendine devir de imkansiz.
ALTER TABLE "User" ADD CONSTRAINT "User_merge_shape" CHECK (
    ("mergedIntoId" IS NULL AND "mergedAt" IS NULL)
    OR ("isGuest" = true
        AND "mergedIntoId" IS NOT NULL
        AND "mergedAt" IS NOT NULL
        AND "mergedIntoId" <> "id")
);
