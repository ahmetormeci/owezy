-- better-auth 1.7.18'E YUKSELTME, ADR-063.
--
-- "issuer" alanini yalnizca better-auth 1.7.0-1.7.2 yaziyordu; 1.7.3 onu
-- birakti. Sutun NOT NULL kaldikca yeni surumle her kayit "Argument issuer is
-- missing" ile duser.
--
-- YALNIZCA ZORUNLULUK KALKIYOR, sutun ve icindeki veri duruyor. Bu yuzden
-- yayin sirasi guvenli: Vercel gocu yeni koddan ONCE uyguluyor
-- (vercel-build), o arada calisan eski kod (1.7.1) "issuer" yazmaya devam
-- eder ve nullable sutun bunu da kabul eder.
--
-- better-auth'un yukseltme rehberi bir de "issuer + accountId" benzersiz
-- indeksini dusurmeyi soyluyor. Bizde o indeks HIC OLUSTURULMADI
-- (20260825200000_add_account_issuer yalnizca sutunu ekledi).

ALTER TABLE "Account" ALTER COLUMN "issuer" DROP NOT NULL;
