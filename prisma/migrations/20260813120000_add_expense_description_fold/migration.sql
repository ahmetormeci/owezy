-- Aramada karsilastirilan katlanmis aciklama.
--
-- ELLE YAZILDI (Prisma uretemez): GENERATED ALWAYS ... STORED.
--
-- NEDEN uretilmis kolon, uygulamanin yazdigi bir kolon degil:
--   1. Tek kaynak. Katlama kurali burada; createExpense/updateExpense'in
--      hatirlamasi gereken bir sey yok, unutulamaz.
--   2. Backfill gerekmiyor. Mevcut satirlarin degeri kolon eklenirken
--      hesaplaniyor; ayri bir betik ve uc veritabaninda ayri bir adim yok.
--
-- translate() TABLOSU src/lib/search-fold.ts'teki FOLD_FROM / FOLD_TO ile
-- BIREBIR AYNI olmak zorunda. Ayrisirlarsa arama sessizce eksik sonuc verir.
--   I İ ı  ->  i
--   Ş ş    ->  s
--   Ğ ğ    ->  g
--   Ü ü    ->  u
--   Ö ö    ->  o
--   Ç ç    ->  c
-- translate() ONCE calisiyor, lower() sonra: ters sirada olsaydi "İ" once
-- "i + birlesik nokta"ya donusur ve tablodaki karsiligini kaybederdi.
ALTER TABLE "Expense"
    ADD COLUMN "descriptionFold" TEXT
    GENERATED ALWAYS AS (
        lower(translate("description", 'IİıŞşĞğÜüÖöÇç', 'iiissgguuoocc'))
    ) STORED;

-- INDEX YOK ve bu bilinçli: arama "%metin%" kalibi kullaniyor, onu ancak
-- pg_trgm uzantisiyla bir GIN index hizlandirir. Bugunku veri buyuklugunde
-- sequential scan yeterli; uzanti eklemek gercek bir ihtiyac dogmadan
-- alinacak bir bagimlilik olurdu.
