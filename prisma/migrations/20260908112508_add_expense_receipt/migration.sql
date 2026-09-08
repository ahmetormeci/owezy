-- Harcamaya ekli fis fotografi. Baytlar depoda (R2); burada yalnizca anahtar.
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- uretilmis kolonlari modelleyemedigi icin her seferinde "fazladan bir
-- varsayilan var" saniyor; alinsaydi arama katlamasi bozulurdu. Bu projede
-- BESINCI kez ayni sekilde atiliyor.

-- CreateTable
CREATE TABLE "ExpenseReceipt" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReceipt_expenseId_key" ON "ExpenseReceipt"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReceipt_storageKey_key" ON "ExpenseReceipt"("storageKey");

-- CreateIndex
CREATE INDEX "ExpenseReceipt_uploadedById_idx" ON "ExpenseReceipt"("uploadedById");

-- AddForeignKey
ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
