-- Faz 25.7: Clerk'in birakip gittigi iki sutun dusuyor.
--
-- clerkId       : ADR-007'nin tasidigi "Clerk kimligi -> bizim User.id"
--                 eslemesi. Better Auth'un oturumu DOGRUDAN bizim User.id'mizi
--                 verdigi icin eslemenin kendisi ortadan kalkti; gocun en
--                 somut kazanci bu satir.
-- clerkUpdatedAt: Clerk webhook'larinin sirasiz gelebilmesine karsi tutulan
--                 zaman damgasi. Webhook silindi, ihtiyaci da gitti.
--
-- VERI KAYBI DEGERLENDIRILDI: iki sutun da yalnizca Clerk'e giden bir isaret
-- tasiyor. Kullanicinin kendi verisi (e-posta, ad, dil, uyelikler, harcamalar)
-- baska kolonlarda ve hicbirine dokunulmuyor. "Finansal kayitlar fiziksel
-- olarak silinmez" kurali burayi baglamiyor - bunlar finansal kayit degil.
--
-- clerkId'nin UNIQUE indeksi sutunla birlikte dusuyor. E-postanin UNIQUE'i
-- KALIYOR ve asil kimlik kisiti artik o.

-- DropIndex
DROP INDEX "User_clerkId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "clerkId",
DROP COLUMN "clerkUpdatedAt";

-- NOT: "prisma migrate diff" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- semasi uretilmis kolonu ifade edemedigi icin farki "default kaldirilmali"
-- saniyor. Uygulansaydi arama katlamasi bozulurdu.
