-- Odeme hatirlatmasi (ADR-050).
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- uretilmis kolonlari modelleyemedigi icin her seferinde "fazladan bir
-- varsayilan var" saniyor; alinsaydi arama katlamasi bozulurdu. Bu projede
-- YEDINCI kez ayni sekilde atiliyor.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REMINDED';

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentReminder_groupId_fromUserId_toUserId_createdAt_idx" ON "PaymentReminder"("groupId", "fromUserId", "toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentReminder_toUserId_idx" ON "PaymentReminder"("toUserId");

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ELLE EKLENEN KISITLAR (Prisma semasinda ifade edilemiyor).
--
-- Uygulama katmani ikisini de zaten kontrol ediyor; buradaki kopyalari
-- SON SAVUNMA HATTI. Bir gun baska bir yazma yolu acilirsa (bir betik, bir
-- goc) uygulama kontrolu o yoldan gecmez, bu kisitlar gecer.
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_distinct_parties" CHECK ("fromUserId" <> "toUserId");
