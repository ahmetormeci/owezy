import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";

/**
 * Oturumdaki kullanicinin kaydini okur. Yoksa null.
 *
 * UYGULAMANIN TEK KIMLIK KAPISI. Doksanin uzerinde cagri noktasi buradan
 * geciyor ve hicbiri oturumun nasil tasindigini bilmiyor.
 *
 * session.user.id DOGRUDAN bizim User.id'miz - arada esleme YOK. Better Auth
 * kendi kullanici tablosunu acmiyor, bizimkini kullaniyor
 * (bkz. src/lib/better-auth.ts). Faz 25'in butun mesele ettigi sey buydu:
 * Clerk doneminde tasidigimiz "clerkId -> User.id" eslemesi (ADR-007) artik
 * hic olusmuyor.
 *
 * SATIRI YINE DE CEKIYORUZ: Better Auth'un dondurdugu kullanici nesnesi
 * yalnizca kendi bildigi alanlari tasiyor (id, email, name, image,
 * emailVerified). Bize locale, hasImage, deletedAt de gerekiyor.
 *
 * MOBIL ICIN AYRI DAL YOK: bearer eklentisi sayesinde getSession hem cerezi
 * hem "Authorization: Bearer ..." basligini okuyor (ADR-029).
 *
 * cache() ile sarili: React ayni istek icinde ikinci cagriyi tekrar
 * calistirmiyor. Bu sayede getLocale() ile (app) layout ayni istekte ayni
 * satiri iki kez cekmiyor - dil tercihini okumanin net maliyeti sifir.
 *
 * BURADA BIR ZAMANLAR "getOrCreateCurrentUser" ADINDA bir fonksiyon vardi ve
 * otuz satir daha uzundu: Clerk'in kullanicisini ilk goruste bizim tablomuza yaziyordu
 * ("lazy sync", ADR-011), P2002'yi yaris sinyali olarak ele aliyordu, iki
 * ayri benzersizlik ihlalini birbirinden ayiriyordu. Hepsi Clerk'in kendi
 * kullanici tablosunu tutmasindan doguyordu. Better Auth bizim tablomuza
 * yazdigi icin "oturum var ama satir yok" durumu OLUSAMAZ - yaratacak bir
 * sey kalmadi, o yuzden ad da durusu da sadelesti.
 */
export const findCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return null;
  }
  return prisma.user.findUnique({ where: { id: session.user.id } });
});
