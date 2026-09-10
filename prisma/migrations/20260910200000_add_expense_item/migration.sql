-- Kalem kalem bolusum (ADR-052).
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Bu projede
-- DOKUZUNCU kez ayni sekilde atiliyor.

-- AlterEnum
ALTER TYPE "SplitType" ADD VALUE 'ITEMIZED';

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItemShare" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "ExpenseItemShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseItem_expenseId_position_idx" ON "ExpenseItem"("expenseId", "position");
CREATE UNIQUE INDEX "ExpenseItemShare_itemId_userId_key" ON "ExpenseItemShare"("itemId", "userId");
CREATE INDEX "ExpenseItemShare_userId_idx" ON "ExpenseItemShare"("userId");

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseItemShare" ADD CONSTRAINT "ExpenseItemShare_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ExpenseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseItemShare" ADD CONSTRAINT "ExpenseItemShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ELLE EKLENEN KISIT.
--
-- Kalem tutari POZITIF olmali: sifir bir kalem, oransal olceklemede paya
-- hicbir sey katmadigi halde listede yer kaplardi; negatif bir kalem ise
-- "indirim"i yanlis yerde ifade etmek olurdu (indirim, harcamanin
-- TOPLAMINI kalem toplamindan kucuk yazarak ifade ediliyor - ADR-052).
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_amount_positive" CHECK ("amount" > 0);
