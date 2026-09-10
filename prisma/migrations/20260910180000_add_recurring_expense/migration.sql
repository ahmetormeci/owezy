-- Tekrarlayan harcama (ADR-051).
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Bu projede
-- SEKIZINCI kez ayni sekilde atiliyor.

-- CreateEnum
CREATE TYPE "RecurrenceInterval" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EXPENSE_RECURRED';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_PAUSED';

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "paidById" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "splitType" "SplitType" NOT NULL,
    "interval" "RecurrenceInterval" NOT NULL,
    "startsOn" DATE NOT NULL,
    "nextRunOn" DATE NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpenseShare" (
    "id" UUID NOT NULL,
    "recurringExpenseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shareAmount" INTEGER NOT NULL,
    "basisPoints" INTEGER,

    CONSTRAINT "RecurringExpenseShare_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "recurringExpenseId" UUID;

-- CreateIndex
CREATE INDEX "RecurringExpense_nextRunOn_pausedAt_deletedAt_idx" ON "RecurringExpense"("nextRunOn", "pausedAt", "deletedAt");
CREATE INDEX "RecurringExpense_groupId_deletedAt_idx" ON "RecurringExpense"("groupId", "deletedAt");
CREATE UNIQUE INDEX "RecurringExpenseShare_recurringExpenseId_userId_key" ON "RecurringExpenseShare"("recurringExpenseId", "userId");
CREATE INDEX "RecurringExpenseShare_userId_idx" ON "RecurringExpenseShare"("userId");
CREATE INDEX "Expense_recurringExpenseId_idx" ON "Expense"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseShare" ADD CONSTRAINT "RecurringExpenseShare_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseShare" ADD CONSTRAINT "RecurringExpenseShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- ELLE EKLENEN KISITLAR
-- ============================================================

ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "RecurringExpenseShare" ADD CONSTRAINT "RecurringExpenseShare_share_nonnegative" CHECK ("shareAmount" >= 0);

-- Cross-row kural: bir sablonun butun paylarinin toplami sablonun tutarina
-- HER ZAMAN tam esit olmalidir. ExpenseParticipant'taki kuralin (init
-- migration, 8 numara) aynisi ve ayni gerekceyle DEFERRABLE INITIALLY
-- DEFERRED: paylar tek tek INSERT edilirken ilki eklendigi an degil,
-- transaction COMMIT olurken kontrol edilsin.
--
-- NEDEN UYGULAMA KATMANI YETMIYOR: paylari split.ts uretiyor ve toplami
-- kurulusu geregi tutuyor. Bu kisit o kurulusun BOZULDUGUNU yakalamak icin -
-- bir betik, bir goc ya da yarin yazilacak baska bir yazma yolu uygulama
-- kontrolunden gecmez, bu kisitten gecer.
CREATE OR REPLACE FUNCTION check_recurring_share_sum()
RETURNS TRIGGER AS $$
DECLARE
    target_id UUID := COALESCE(NEW."recurringExpenseId", OLD."recurringExpenseId");
    expected_amount INTEGER;
    actual_sum INTEGER;
BEGIN
    -- Sablonun kendisi silinmisse kontrol edilecek bir sey yok: paylar
    -- Cascade ile birlikte gidiyor ve bu tetikleyici o silmede de calisiyor.
    SELECT "amount" INTO expected_amount FROM "RecurringExpense" WHERE "id" = target_id;
    IF expected_amount IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM("shareAmount"), 0) INTO actual_sum
        FROM "RecurringExpenseShare" WHERE "recurringExpenseId" = target_id;

    IF actual_sum <> expected_amount THEN
        RAISE EXCEPTION 'RecurringExpenseShare toplami (%) RecurringExpense.amount (%) ile uyusmuyor (id: %)',
            actual_sum, expected_amount, target_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_recurring_share_sum_check
    AFTER INSERT OR UPDATE OR DELETE ON "RecurringExpenseShare"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_recurring_share_sum();

-- Cross-table kural: sablonun para birimi grubun para birimiyle ayni olmali.
-- Expense ve Settlement icin ayni tetikleyici zaten var (init migration).
CREATE OR REPLACE FUNCTION check_recurring_currency_matches_group()
RETURNS TRIGGER AS $$
DECLARE
    group_currency CHAR(3);
BEGIN
    SELECT "currency" INTO group_currency FROM "Group" WHERE "id" = NEW."groupId";
    IF NEW."currency" <> group_currency THEN
        RAISE EXCEPTION 'RecurringExpense.currency (%) Group.currency (%) ile uyusmuyor',
            NEW."currency", group_currency;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recurring_currency_check
    BEFORE INSERT OR UPDATE OF "currency", "groupId" ON "RecurringExpense"
    FOR EACH ROW EXECUTE FUNCTION check_recurring_currency_matches_group();
