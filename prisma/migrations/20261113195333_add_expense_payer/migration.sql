-- Birden fazla odeyen (ADR-067).
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Bu projede
-- ONUNCU kez ayni sekilde atiliyor.

-- CreateTable
CREATE TABLE "ExpensePayer" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpensePayer_userId_idx" ON "ExpensePayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayer_expenseId_userId_key" ON "ExpensePayer"("expenseId", "userId");

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- ELLE EKLENENLER
-- ============================================================

-- Odenen kisim POZITIF olmali: sifir odeyen, odeyen degil. Formda bos
-- birakilan bir odeyen satiri gonderilmiyor; sunucuya ulasirsa bu kisit
-- son savunma hatti.
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_amount_positive" CHECK ("amount" > 0);

-- VAR OLAN HER HARCAMAYA BIR ODEYEN SATIRI - silinmisler DAHIL. Silinmis
-- bir harcama geri yuklenebiliyor ve o an bakiyeye yeniden giriyor; satiri
-- olmasaydi geri yuklenen harcama "kimsenin odemedigi" bir harcama olurdu.
--
-- Var olan veri DEGISMIYOR, yalnizca ekleniyor. Tetikleyiciler BU KOPYADAN
-- SONRA kuruluyor: once kurulsalardi her satir icin ayri bir denetim
-- calisirdi (ertelenmis, yani commit aninda - ama yine de satir basina).
-- Kopya zaten tanim geregi dogru: tek odeyen, tutarin tamami.
--
-- gen_random_uuid() Postgres'in yerlesik fonksiyonu (13+). Prisma kimligi
-- normalde istemcide uretiyor; burada istemci yok.
INSERT INTO "ExpensePayer" ("id", "expenseId", "userId", "amount", "createdAt")
SELECT gen_random_uuid(), "id", "paidById", "amount", "createdAt"
FROM "Expense";

-- ------------------------------------------------------------
-- Odeyenlerin toplami = Expense.amount, ve ana odeyen (paidById)
-- odeyenlerden biri.
--
-- Katilimcilardaki kuralin (init migration, bolum 8) ikizi. Coklu satir
-- toplami CHECK ile yazilamiyor. DEFERRABLE INITIALLY DEFERRED: bir
-- harcamanin iki odeyeni tek tek yazilirken ilk satirda degil, COMMIT
-- aninda denetleniyor.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_expense_payers(target_expense_id UUID)
RETURNS VOID AS $$
DECLARE
    expected_amount INTEGER;
    primary_payer UUID;
    actual_sum INTEGER;
BEGIN
    SELECT "amount", "paidById" INTO expected_amount, primary_payer
        FROM "Expense" WHERE "id" = target_expense_id;

    -- Harcama yoksa denetlenecek bir sey yok (fiziksel silme zaten
    -- yasak; bu yalnizca savunma).
    IF expected_amount IS NULL THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM("amount"), 0) INTO actual_sum
        FROM "ExpensePayer" WHERE "expenseId" = target_expense_id;

    IF actual_sum <> expected_amount THEN
        RAISE EXCEPTION 'ExpensePayer toplami (%) Expense.amount (%) ile uyusmuyor (expenseId: %)',
            actual_sum, expected_amount, target_expense_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "ExpensePayer"
        WHERE "expenseId" = target_expense_id AND "userId" = primary_payer
    ) THEN
        RAISE EXCEPTION 'Expense.paidById (%) harcamanin odeyenlerinden biri degil (expenseId: %)',
            primary_payer, target_expense_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_expense_payer_rows()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_expense_payers(COALESCE(NEW."expenseId", OLD."expenseId"));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_expense_payer_sum_check
    AFTER INSERT OR UPDATE OR DELETE ON "ExpensePayer"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_expense_payer_rows();

-- ------------------------------------------------------------
-- HARCAMANIN KENDISI DEGISINCE DE denetle.
--
-- Satir tetikleyicileri (paylar icin init'teki, odeyenler icin yukaridaki)
-- yalnizca KENDI tablolarinda bir sey degisince calisiyor. Bir kod yolu
-- tutari degistirip paylari ya da odeyenleri yeniden yazmayi unutsaydi
-- hicbiri calismaz ve kural sessizce bozulurdu. Bugun guncelleme her
-- seferinde ikisini de silip yeniden yaziyor; bu tetikleyici o
-- disiplinin unutulmasini veritabanina yakalatiyor.
--
-- INSERT de dahil: paysiz ya da odeyensiz bir harcama artik commit
-- edilemiyor. paidById de dahil: ana odeyen degisirse odeyenlerden biri
-- olmaya devam etmeli (misafir sahiplenmesi ikisini AYNI islemde tasiyor).
--
-- Paylarin denetimi init'teki fonksiyonun govdesini tekrarlamiyor: o
-- fonksiyon bir TRIGGER fonksiyonu ve NEW/OLD bekliyor. Kural ayni,
-- kucuk ve burada acikca yazili.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_expense_totals()
RETURNS TRIGGER AS $$
DECLARE
    share_sum INTEGER;
BEGIN
    SELECT COALESCE(SUM("shareAmount"), 0) INTO share_sum
        FROM "ExpenseParticipant" WHERE "expenseId" = NEW."id";

    IF share_sum <> NEW."amount" THEN
        RAISE EXCEPTION 'ExpenseParticipant toplami (%) Expense.amount (%) ile uyusmuyor (expenseId: %)',
            share_sum, NEW."amount", NEW."id";
    END IF;

    PERFORM check_expense_payers(NEW."id");
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_expense_totals_check
    AFTER INSERT OR UPDATE OF "amount", "paidById" ON "Expense"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_expense_totals();
