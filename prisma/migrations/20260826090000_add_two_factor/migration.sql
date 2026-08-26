-- Iki adimli dogrulama (TOTP + yedek kod). Better Auth'un twoFactor eklentisi
-- yonetiyor; alan listesi getAuthTables() ile CALISMA ZAMANINDAN alindi.
--
-- User.twoFactorEnabled varsayilani FALSE: mevcut hesaplarin hicbiri bir sey
-- secmis sayilmamali. Sutun NOT NULL ama varsayilani oldugu icin mevcut
-- satirlar sorunsuz dolduruluyor.
--
-- TwoFactor.secret INDEXLI ve bunu kutuphane istiyor, biz eklemedik.
--
-- verified varsayilani TRUE ve bu tuhaf gorunuyor ama kutuphanenin kendi
-- varsayilani: kayit ancak dogrulama tamamlandiktan sonra yaziliyor.
--
-- failedVerificationCount + lockedUntil: ardarda yanlis kod girilirse hesap
-- bir sure kilitleniyor. Sayac BASARILI dogrulamada sifirlaniyor, yani
-- yalnizca ARDISIK hatalari sayiyor.
--
-- CASCADE: Session ve Account ile ayni gerekce - oturum artifakti, finansal
-- kayit degil.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");

-- CreateIndex
CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor"("secret");

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOT: "prisma migrate diff" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024).
