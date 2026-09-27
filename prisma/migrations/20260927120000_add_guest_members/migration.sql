-- HESAPSIZ UYE (MISAFIR), ADR-057 - Faz 50a.
--
-- Misafir, isGuest isaretli ve TEK BIR GRUBA (guestGroupId) bagli bir
-- "User" satiri. Paraya dokunan hicbir tablo degismiyor: odeyen, paylar,
-- odemeler, kalemler zaten "User"a bagli ve misafir de bir "User".
--
-- BU DOSYANIN ASIL ISI SAVUNMA: misafir hicbir kosulda giris yapamamali ve
-- baska bir grubun uyesi ya da bir grubun sahibi olamamali. Uygulama da
-- ayni kurallari uyguluyor; buradakiler, uygulamada bir hata olsa bile
-- tutan son katman.

ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "guestGroupId" UUID;

ALTER TABLE "User" ADD CONSTRAINT "User_guestGroupId_fkey"
    FOREIGN KEY ("guestGroupId") REFERENCES "Group"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_guestGroupId_idx" ON "User"("guestGroupId");

-- MISAFIR SATIRININ SEKLI. Iki yon de sart:
--   misafir     -> grubu VAR ve e-postasi posta almayan bir adres
--                  (".invalid" RFC 2606: hicbir zaman cozulmeyen alan adi)
--   misafir DEGIL -> grubu YOK ve e-postasi o alan adinda DEGIL
-- Ikinci yon, gercek birinin "@guest.invalid" adresiyle kayit olup bir
-- misafirin adresine benzemesini engelliyor.
ALTER TABLE "User" ADD CONSTRAINT "User_guest_shape" CHECK (
    ("isGuest" = true
        AND "guestGroupId" IS NOT NULL
        AND "email" LIKE 'guest-%@guest.invalid')
    OR ("isGuest" = false
        AND "guestGroupId" IS NULL
        AND "email" NOT LIKE '%@guest.invalid')
);

-- MISAFIRE OTURUM ACILAMAZ, KIMLIK BILGISI BAGLANAMAZ.
-- Session: giris. Account: parola ya da dis saglayici baglantisi.
CREATE OR REPLACE FUNCTION reject_guest_auth_row()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."userId" AND "isGuest") THEN
        RAISE EXCEPTION 'Misafir kullanici icin % satiri yazilamaz (userId: %)',
            TG_TABLE_NAME, NEW."userId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_not_guest
    BEFORE INSERT OR UPDATE OF "userId" ON "Session"
    FOR EACH ROW EXECUTE FUNCTION reject_guest_auth_row();

CREATE TRIGGER trg_account_not_guest
    BEFORE INSERT OR UPDATE OF "userId" ON "Account"
    FOR EACH ROW EXECUTE FUNCTION reject_guest_auth_row();

-- MISAFIR YALNIZCA KENDI GRUBUNUN UYESI OLABILIR VE SAHIP OLAMAZ.
-- Sahiplik devri iki yerde kendiliginden oluyor (gruptan ayrilma, hesap
-- silme); ikisi de uygulamada misafiri atliyor. Bu, atlamayan bir hataya
-- karsi son katman.
CREATE OR REPLACE FUNCTION check_guest_membership()
RETURNS TRIGGER AS $$
DECLARE
    member_is_guest BOOLEAN;
    member_guest_group UUID;
BEGIN
    SELECT "isGuest", "guestGroupId" INTO member_is_guest, member_guest_group
        FROM "User" WHERE "id" = NEW."userId";
    IF member_is_guest THEN
        IF NEW."groupId" <> member_guest_group THEN
            RAISE EXCEPTION 'Misafir (%) yalnizca kendi grubunun (%) uyesi olabilir',
                NEW."userId", member_guest_group;
        END IF;
        IF NEW."role" = 'OWNER' THEN
            RAISE EXCEPTION 'Misafir (%) grup sahibi olamaz', NEW."userId";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guest_membership_check
    BEFORE INSERT OR UPDATE OF "userId", "groupId", "role" ON "GroupMember"
    FOR EACH ROW EXECUTE FUNCTION check_guest_membership();
