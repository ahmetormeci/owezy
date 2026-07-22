-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'TRANSPORT', 'ACCOMMODATION', 'SHOPPING', 'BILLS', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseEditAction" AS ENUM ('UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EXPENSE_ADDED', 'GROUP_INVITE', 'SETTLEMENT_RECORDED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" CHAR(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "invitedById" UUID,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "paidById" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "deletedById" UUID,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "splitType" "SplitType" NOT NULL,
    "expenseDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseParticipant" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shareAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "note" TEXT,
    "settledAt" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEdit" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "action" "ExpenseEditAction" NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Group_createdById_idx" ON "Group"("createdById");

-- CreateIndex
CREATE INDEX "Group_deletedAt_idx" ON "Group"("deletedAt");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "Expense_groupId_idx" ON "Expense"("groupId");

-- CreateIndex
CREATE INDEX "Expense_groupId_deletedAt_idx" ON "Expense"("groupId", "deletedAt");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");

-- CreateIndex
CREATE INDEX "ExpenseParticipant_expenseId_idx" ON "ExpenseParticipant"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseParticipant_userId_idx" ON "ExpenseParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseParticipant_expenseId_userId_key" ON "ExpenseParticipant"("expenseId", "userId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_idx" ON "Settlement"("groupId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_cancelledAt_idx" ON "Settlement"("groupId", "cancelledAt");

-- CreateIndex
CREATE INDEX "Settlement_fromUserId_idx" ON "Settlement"("fromUserId");

-- CreateIndex
CREATE INDEX "Settlement_toUserId_idx" ON "Settlement"("toUserId");

-- CreateIndex
CREATE INDEX "ExpenseEdit_expenseId_idx" ON "ExpenseEdit"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseEdit_changedById_idx" ON "ExpenseEdit"("changedById");

-- CreateIndex
CREATE INDEX "GroupInvite_groupId_idx" ON "GroupInvite"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvite_tokenHash_key" ON "GroupInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEdit" ADD CONSTRAINT "ExpenseEdit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEdit" ADD CONSTRAINT "ExpenseEdit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- OZEL KURALLAR (Prisma schema'da ifade edilemeyen, elle eklenen kurallar)
-- Bu blok "prisma migrate dev --create-only" ile OTOMATIK URETILMEDI.
-- Veritabani tasarimi asamasinda belirledigimiz veri butunlugu kurallarini
-- uyguluyor. schema.prisma icindeki ilgili modellerin yanindaki yorumlarla
-- birebir eslesir.
-- ============================================================

-- 1) GroupMember: bir kullanicinin bir grupta AYNI ANDA yalnizca bir aktif
--    (leftAt IS NULL) uyeligi olabilir. Zaman icinde ayrilip tekrar katilirsa
--    birden fazla satir olusabilir, bu istenen davranistir.
CREATE UNIQUE INDEX "GroupMember_active_unique"
    ON "GroupMember"("groupId", "userId")
    WHERE "leftAt" IS NULL;

-- 2) Bir harcama tutari asla sifir veya negatif olamaz.
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);

-- 3) Bir katilimci payi negatif olamaz (sifir olabilir).
ALTER TABLE "ExpenseParticipant"
    ADD CONSTRAINT "ExpenseParticipant_shareAmount_non_negative" CHECK ("shareAmount" >= 0);

-- 4) Bir odeme (settlement) tutari asla sifir veya negatif olamaz.
ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_amount_positive" CHECK ("amount" > 0);

-- 5) Bir kullanici kendine odeme kaydi giremez.
ALTER TABLE "Settlement"
    ADD CONSTRAINT "Settlement_from_to_different" CHECK ("fromUserId" <> "toUserId");

-- 6) Bir davet linki, izin verilen maksimum kullanim sayisini asamaz.
ALTER TABLE "GroupInvite"
    ADD CONSTRAINT "GroupInvite_useCount_within_maxUses" CHECK ("useCount" <= "maxUses");

-- ============================================================
-- 7) Cross-table kural: Expense.currency ve Settlement.currency, bagli
--    olduklari Group.currency ile ayni olmalidir. Bu, tek satir icinde
--    ifade edilemeyen (cross-table) bir kural oldugu icin CHECK yerine
--    trigger ile uygulaniyor.
-- ============================================================

CREATE OR REPLACE FUNCTION check_expense_currency_matches_group()
RETURNS TRIGGER AS $$
DECLARE
    group_currency CHAR(3);
BEGIN
    SELECT "currency" INTO group_currency FROM "Group" WHERE "id" = NEW."groupId";
    IF NEW."currency" <> group_currency THEN
        RAISE EXCEPTION 'Expense.currency (%) grubun currency (%) ile uyusmuyor', NEW."currency", group_currency;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expense_currency_check
    BEFORE INSERT OR UPDATE OF "currency", "groupId" ON "Expense"
    FOR EACH ROW EXECUTE FUNCTION check_expense_currency_matches_group();

CREATE OR REPLACE FUNCTION check_settlement_currency_matches_group()
RETURNS TRIGGER AS $$
DECLARE
    group_currency CHAR(3);
BEGIN
    SELECT "currency" INTO group_currency FROM "Group" WHERE "id" = NEW."groupId";
    IF NEW."currency" <> group_currency THEN
        RAISE EXCEPTION 'Settlement.currency (%) grubun currency (%) ile uyusmuyor', NEW."currency", group_currency;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_settlement_currency_check
    BEFORE INSERT OR UPDATE OF "currency", "groupId" ON "Settlement"
    FOR EACH ROW EXECUTE FUNCTION check_settlement_currency_matches_group();

-- ============================================================
-- 8) Cross-row kural: bir harcamanin tum ExpenseParticipant paylarinin
--    toplami, Expense.amount'a HER ZAMAN tam esit olmalidir. Coklu satir
--    toplami gerektirdigi icin CHECK ile yazilamaz. DEFERRABLE INITIALLY
--    DEFERRED kullaniyoruz ki bir harcamanin 3 payi tek tek INSERT edilirken
--    ilk pay eklendigi an degil, transaction COMMIT olurken kontrol edilsin.
-- ============================================================

CREATE OR REPLACE FUNCTION check_expense_participant_sum()
RETURNS TRIGGER AS $$
DECLARE
    target_expense_id UUID := COALESCE(NEW."expenseId", OLD."expenseId");
    expected_amount INTEGER;
    actual_sum INTEGER;
BEGIN
    SELECT "amount" INTO expected_amount FROM "Expense" WHERE "id" = target_expense_id;
    SELECT COALESCE(SUM("shareAmount"), 0) INTO actual_sum
        FROM "ExpenseParticipant" WHERE "expenseId" = target_expense_id;

    IF actual_sum <> expected_amount THEN
        RAISE EXCEPTION 'ExpenseParticipant toplami (%) Expense.amount (%) ile uyusmuyor (expenseId: %)',
            actual_sum, expected_amount, target_expense_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_expense_participant_sum_check
    AFTER INSERT OR UPDATE OR DELETE ON "ExpenseParticipant"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_expense_participant_sum();
