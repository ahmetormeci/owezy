-- Better Auth'un ihtiyac duydugu sema (Faz 25.1).
--
-- ELLE YAZILDI, "prisma migrate diff" ciktisi OLDUGU GIBI ALINMADI. Diff bir
-- satir fazladan uretiyor:
--     ALTER TABLE "Expense" ALTER COLUMN "descriptionFold" DROP DEFAULT;
-- Bu satir BU MIGRATION'IN ISI DEGIL ve alinmasi TEHLIKELI: descriptionFold
-- bir GENERATED ALWAYS ... STORED kolon (ADR-024, 20260813120000). Prisma
-- semasi uretilmis kolonu ifade edemedigi icin kolonu duz bir String?
-- saniyor ve aradaki farki "default kaldirilmali" diye yorumluyor. Yani bu
-- bir DRIFT DEGIL, Prisma'nin ifade edemedigi bir sey. Diff her calistiginda
-- yeniden cikacak; bundan sonraki migration'larda da ATILMALI.

-- Better Auth kullaniciyi kendi tablosunda degil BIZIM User tablomuzda
-- tutuyor. Bunun bedeli iki sutun degisikligi:
--
--   clerkId  NOT NULL -> NULL: Better Auth kullanici yarattiginda clerkId
--            yazmaz. Sutun 25.7'de tamamen kalkacak.
--   email    -> UNIQUE: Better Auth kimligi e-postadan cozuyor.
ALTER TABLE "User"
    ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    ALTER COLUMN "clerkId" DROP NOT NULL;

-- DIKKAT - BU KISIT MUKERRER SATIR VARSA DUSER.
-- Uygulanmadan once ucunde de kontrol edildi:
--   production : 0 kullanici (24 Agustos'ta sifirlandi)
--   development: 5 kullanici, mukerrer yok
--   E2E        : 6 kullanici, UC MUKERRER vardi ve temizlendi.
-- Mukerrerligin sebebi tam da kaldirdigimiz sey: kimlik e-postaya degil
-- clerkId'ye bagliydi; Clerk tarafinda kullanici yeniden yaratilinca
-- clerkId degisiyor ve "clerkId ile ara, yoksa olustur" ayni e-posta icin
-- ikinci bir satir aciyordu.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Better Auth'un yonettigi tablolar.
-- Tablo adlari PascalCase: semanin geri kalani oyle ve @@map hicbir yerde
-- kullanilmiyor. id ve FK sutunlari UUID: yine semanin geri kalani gibi, ve
-- Session.userId'nin User.id ile AYNI tipte olmasi zaten zorunlu.
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    -- Parolayla giriste parola HASH'i burada (providerId = "credential").
    "password" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Tek seferlik kodlar ve dogrulama kayitlari. KULLANICIYA BAGLI DEGIL:
-- kod, kimligi henuz kanitlanmamis birine gonderiliyor.
CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CASCADE bilerek: bunlar finansal kayit degil, oturum artifakti.
-- "Finansal kayitlar fiziksel olarak silinmez" kurali onlari baglamiyor.
-- Hesap silme zaten SOFT delete oldugu icin pratikte hic tetiklenmiyor.
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
