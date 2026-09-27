-- IBAN ILE ODEME, ADR-059 - Faz 52a.
--
-- Kullanici ISTERSE kendi IBAN'ini ekliyor; ortak bir grupta oldugu herkes
-- ona odeme yaparken goruyor. Owezy para tasimiyor - bu yalnizca ODEYENIN
-- elini kolaylastiran bir bilgi.

ALTER TABLE "User" ADD COLUMN "iban" TEXT;

-- Son degisiklik ani. Odeyene "yakinda degisti" notu buradan cikiyor: hesabi
-- ele gecirilen birinin IBAN'i degistirilirse, parayi gonderecek kisi bunu
-- gorebilmeli.
ALTER TABLE "User" ADD COLUMN "ibanUpdatedAt" TIMESTAMP(3);

-- KAYIT BICIMI TEK: bosluksuz, buyuk harf, ulke kodu + iki kontrol hanesi +
-- en fazla 30 harf/rakam (toplam 15-34, ISO 13616). Kontrol hanesinin
-- HESABI uygulamada (src/lib/iban.ts); burasi o katman atlanirsa bile bozuk
-- bicimin girmesini engelliyor.
ALTER TABLE "User" ADD CONSTRAINT "User_iban_shape" CHECK (
    "iban" IS NULL OR "iban" ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
);

-- IBAN ve degisiklik ani BIRLIKTE yazilir, birlikte silinir.
ALTER TABLE "User" ADD CONSTRAINT "User_iban_updated_pair" CHECK (
    ("iban" IS NULL) = ("ibanUpdatedAt" IS NULL)
);

-- MISAFIRIN IBAN'I OLAMAZ: misafir giris yapamiyor (ADR-057). Baskasinin
-- onun adina IBAN girmesi, sahibinin bilmedigi bir banka bilgisini saklamak
-- olurdu.
ALTER TABLE "User" ADD CONSTRAINT "User_guest_no_iban" CHECK (
    "isGuest" = false OR "iban" IS NULL
);

-- SILINMIS HESABIN IBAN'I KALAMAZ. Hesap silme adi ve e-postayi siliyor;
-- IBAN unutulursa silinmis bir kisinin banka bilgisi saklanmaya devam ederdi.
-- deleteAccount ayni guncellemede temizliyor; bu kural unutulmasini imkansiz
-- kiliyor.
ALTER TABLE "User" ADD CONSTRAINT "User_deleted_no_iban" CHECK (
    "deletedAt" IS NULL OR "iban" IS NULL
);
