-- Harcamaya yazilan yorum (ADR-049).
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- uretilmis kolonlari modelleyemedigi icin her seferinde "fazladan bir
-- varsayilan var" saniyor; alinsaydi arama katlamasi bozulurdu. Bu projede
-- ALTINCI kez ayni sekilde atiliyor.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EXPENSE_COMMENTED';

-- CreateTable
CREATE TABLE "ExpenseComment" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseComment_expenseId_createdAt_idx" ON "ExpenseComment"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseComment_userId_idx" ON "ExpenseComment"("userId");

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
