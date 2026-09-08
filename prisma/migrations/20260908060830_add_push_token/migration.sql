-- Telefona push bildirimi gonderebilmek icin cihaz adresleri.
--
-- NOT: "prisma migrate dev" bu dosyayi uretirken FAZLADAN su satiri da
-- yaziyor ve HER SEFERINDE ATILMALI:
--
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
--
-- descriptionFold bir GENERATED ALWAYS ... STORED kolon (ADR-024). Prisma
-- uretilmis kolonlari modelleyemedigi icin her seferinde "burada fazladan bir
-- varsayilan var" saniyor; alinsaydi arama katlamasi bozulurdu. Bu, bu
-- projede ucuncu kez ayni sekilde atiliyor.

-- CreateTable
CREATE TABLE "PushToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
