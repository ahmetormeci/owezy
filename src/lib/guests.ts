import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { GuestNameInput } from "@/lib/guest-schemas";

/**
 * HESAPSIZ UYE - MISAFIR (ADR-057, Faz 50a).
 *
 * Misafir, isGuest isaretli ve tek bir gruba bagli bir "User" satiri. Bu
 * secimin butun sebebi paraya dokunmamak: odeyen, paylar, odemeler ve
 * kalemler zaten "User"a bagli; misafir de bir "User" oldugu icin bakiye
 * hesabi, bolusum ve veritabanindaki kurus kurallari AYNEN calisiyor.
 *
 * MISAFIR GIRIS YAPAMAZ ve bu uc katmanda tutuluyor - e-posta asagida,
 * oturum kancasi better-auth.ts'te, son katman veritabani trigger'larinda.
 */

/** Grupta ayni anda en fazla bu kadar aktif misafir. Kotuye kullanima tavan. */
export const MAX_GUESTS_PER_GROUP = 20;

/** Misafir e-postalarinin alan adi. Veritabanindaki CHECK ayni degeri bekliyor. */
export const GUEST_EMAIL_DOMAIN = "guest.invalid";

/**
 * Misafirin e-postasi.
 *
 * "User.email" zorunlu ve tekil (Better Auth), bos birakilamiyor. Adres bu
 * yuzden UYDURMA ama iki ozelligi bilincli:
 *
 *   - ".invalid" RFC 2606'ya gore HICBIR ZAMAN cozulmeyen bir alan adi:
 *     giris kodu gidecek bir posta kutusu YOK.
 *   - Rastgele bir UUID tasiyor: tahmin edilemiyor, yani kimse bu adresle
 *     "giris kodu gonder" bile diyemiyor.
 *
 * Silinen hesaplar ayni kalibi kullaniyor (account.ts, "@deleted.invalid").
 */
export function guestEmail(): string {
  return `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/**
 * Oturum acilmadan once: bu kullanici misafirse OTURUM ACILMAZ. Better
 * Auth'un session.create.before kancasi bunu cagiriyor (better-auth.ts);
 * false = olusturma. Burada duruyor cunku oradaki yapilandirmanin icinde
 * test edilemezdi.
 */
export async function mayOpenSession(userId: string): Promise<boolean> {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGuest: true },
  });
  return !owner?.isGuest;
}

/**
 * Gruba misafir ekler. HER AKTIF UYE ekleyebilir (kullanicinin karari,
 * 27 Eylul): harcama eklemek gibi, grubu kim tutuyorsa o. Cikarmak ise
 * bugunku uye kuraliyla yalnizca sahipte (removeGroupMember).
 *
 * invitedById EKLEYEN KISI: uye listesinde "kim ekledi" sorusunun cevabi
 * zaten bu alanda duruyordu, misafir icin ayri bir alan acilmadi.
 */
export async function addGuest(userId: string, groupId: string, input: GuestNameInput) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("group.not_member");
    }

    const activeGuests = await tx.groupMember.count({
      where: { groupId, leftAt: null, user: { isGuest: true } },
    });
    if (activeGuests >= MAX_GUESTS_PER_GROUP) {
      throw new ConflictError("guest.limit", { max: MAX_GUESTS_PER_GROUP });
    }

    const guest = await tx.user.create({
      data: {
        email: guestEmail(),
        displayName: input.displayName,
        isGuest: true,
        guestGroupId: groupId,
      },
      select: { id: true, displayName: true },
    });

    await tx.groupMember.create({
      data: { groupId, userId: guest.id, role: "MEMBER", invitedById: userId },
    });

    return { userId: guest.id, displayName: guest.displayName, isGuest: true as const };
  });
}

/**
 * Misafirin adini degistirir. Her aktif uye degistirebilir: misafirin
 * kendisi giris yapamiyor, yani adini ancak grup duzeltebilir.
 *
 * Yalnizca BU GRUBUN, HALA AKTIF misafiri: gruptan cikarilmis bir misafirin
 * adi degistirilmiyor - gecmis kayitlarda o adla gorunuyor ve oyle kalmali.
 * Baska bir grubun misafiri ya da gercek bir uye "bulunamadi" aliyor: hangi
 * kimliklerin var oldugu sizdirilmiyor.
 */
export async function renameGuest(
  userId: string,
  groupId: string,
  guestId: string,
  input: GuestNameInput,
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("group.not_member");
    }

    const guestMembership = await tx.groupMember.findFirst({
      where: {
        groupId,
        userId: guestId,
        leftAt: null,
        user: { isGuest: true, guestGroupId: groupId },
      },
      select: { id: true },
    });
    if (!guestMembership) {
      throw new NotFoundError("guest.not_found");
    }

    return tx.user.update({
      where: { id: guestId },
      data: { displayName: input.displayName },
      select: { id: true, displayName: true },
    });
  });
}

// ---------------------------------------------------------------------------
// SAHIPLENME (ADR-057, Faz 50b)
// ---------------------------------------------------------------------------

/** Misafire ozel linkin gecerlilik suresi. Normal davetle ayni. */
export const GUEST_INVITE_TTL_DAYS = 7;

/**
 * "User"a baglanan HER alanin misafir sahiplenildiginde ne olacagi.
 *
 *   move  - misafirde OLABILIR; sahiplenen hesaba TASINIR.
 *   keep  - bilerek misafiri gosteriyor; oyle KALIR (gecmis kaydi).
 *   never - misafirde OLAMAZ. Misafire ait bir satir cikarsa sahiplenme
 *           DURUR: yanlis siniflama sessiz veri kaybina donusmesin.
 *
 * BU LISTE KODUN KENDISI: tasima ve kontrol asagida bu listeden donerek
 * yapiliyor. "move" deyip tasimayi unutmak mumkun degil. Eksik bir alan da
 * mumkun degil: guests.test.ts semadaki butun "User" iliskilerini okuyor ve
 * bu listeyle birebir ayni olmasini istiyor - yeni bir tablo eklenip
 * siniflanmazsa test duser.
 */
export const GUEST_REFERENCE_POLICY = {
  "GroupMember.userId": "move",
  "Expense.paidById": "move",
  "ExpenseParticipant.userId": "move",
  "ExpenseItemShare.userId": "move",
  "Settlement.fromUserId": "move",
  "Settlement.toUserId": "move",
  "RecurringExpense.paidById": "move",
  "RecurringExpenseShare.userId": "move",

  "GroupInvite.guestUserId": "keep",

  "User.mergedIntoId": "never",
  "Group.createdById": "never",
  "GroupMember.invitedById": "never",
  "Expense.createdById": "never",
  "Expense.deletedById": "never",
  "Settlement.createdById": "never",
  "Settlement.cancelledById": "never",
  "ExpenseEdit.changedById": "never",
  "GroupInvite.invitedById": "never",
  "Notification.userId": "never",
  "PushToken.userId": "never",
  "ExpenseReceipt.uploadedById": "never",
  "ExpenseComment.userId": "never",
  "Session.userId": "never",
  "Account.userId": "never",
  "TwoFactor.userId": "never",
  "PaymentReminder.fromUserId": "never",
  "PaymentReminder.toUserId": "never",
  "RecurringExpense.createdById": "never",
} as const satisfies Record<string, "move" | "keep" | "never">;

type ReferenceKey = keyof typeof GUEST_REFERENCE_POLICY;

function referencesWith(policy: "move" | "keep" | "never"): ReferenceKey[] {
  return (Object.keys(GUEST_REFERENCE_POLICY) as ReferenceKey[]).filter(
    (key) => GUEST_REFERENCE_POLICY[key] === policy,
  );
}

/**
 * Prisma'nin modele gore uretilmis nesnesi ("GroupMember" -> tx.groupMember).
 * Tip burada genis tutuluyor cunku alan adi listeden geliyor; dogrulugu
 * birim testi (her alan icin dogru cagri) ve E2E (gercek veritabani)
 * tutuyor.
 */
type LooseDelegate = {
  updateMany(args: {
    where: Record<string, string>;
    data: Record<string, string>;
  }): Promise<{ count: number }>;
};

function delegateFor(tx: Prisma.TransactionClient, model: string): LooseDelegate {
  const name = model.charAt(0).toLowerCase() + model.slice(1);
  return (tx as unknown as Record<string, LooseDelegate>)[name];
}

/**
 * Misafire OZEL, tek kullanimlik davet linki uretir. Her aktif uye
 * uretebilir (misafiri eklemek gibi). Ham kod YALNIZCA bu cevapta doner;
 * veritabaninda yalnizca ozeti durur - normal davetle ayni kural.
 */
export async function createGuestInvite(userId: string, groupId: string, guestId: string) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      throw new NotFoundError("group.not_found");
    }

    const membership = await tx.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenError("group.not_member");
    }

    const guestMembership = await tx.groupMember.findFirst({
      where: {
        groupId,
        userId: guestId,
        leftAt: null,
        user: { isGuest: true, guestGroupId: groupId, mergedIntoId: null },
      },
      select: { id: true },
    });
    if (!guestMembership) {
      throw new NotFoundError("guest.not_found");
    }

    const rawToken = generateInviteToken();
    const invite = await tx.groupInvite.create({
      data: {
        groupId,
        invitedById: userId,
        tokenHash: hashInviteToken(rawToken),
        expiresAt: new Date(Date.now() + GUEST_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        maxUses: 1,
        guestUserId: guestId,
      },
    });

    return { inviteId: invite.id, token: rawToken, expiresAt: invite.expiresAt };
  });
}

/**
 * Davet kodu - normal ve misafir davetinin IKISI de buradan uretiyor ve
 * ozetliyor (groups.ts da bunlari kullaniyor). Iki kopya zamanla ayrisir ve
 * ayrisan bir ozet, gecerli bir linki "bulunamadi" yapardi.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * MISAFIRI SAHIPLENIR: misafirin kayitlari `userId`nin hesabina gecer.
 * Cagiran acceptGroupInvite; transaction ONUN. Burada ya hepsi olur ya
 * hicbiri.
 *
 * SIRA ONEMLI:
 *   1. Sahiplenen bu gruba DAHA ONCE HIC uye olmamis olmali. Olmussa ayni
 *      harcamada iki ayri payi olabilir ve tekil kisitlar (expenseId,
 *      userId) cakisir - acik bir hatayla reddediliyor.
 *   2. Misafir "henuz devredilmediyse devret" kosuluyla TEK ADIMDA
 *      isaretleniyor. Ayni anda iki kisi denerse ikincisinin kosulu tutmaz:
 *      yaris bu satirda kapaniyor.
 *   3. "never" alanlarinda misafire ait satir aranir; varsa DURULUR.
 *   4. "move" alanlari tasinir; misafirin dahil oldugu harcamalarin surum
 *      sayaci artirilir - acik kalmis bir duzenleme formu eski odeyenle
 *      sessizce kaydedemesin.
 */
export async function claimGuest(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  guestId: string,
) {
  const everMember = await tx.groupMember.findFirst({
    where: { groupId, userId },
    select: { id: true },
  });
  if (everMember) {
    throw new ConflictError("guest.claim_already_member");
  }

  const guestMembership = await tx.groupMember.findFirst({
    where: { groupId, userId: guestId, leftAt: null },
    select: { id: true },
  });
  if (!guestMembership) {
    throw new NotFoundError("guest.not_found");
  }

  const marked = await tx.user.updateMany({
    where: { id: guestId, isGuest: true, guestGroupId: groupId, mergedIntoId: null },
    data: { mergedIntoId: userId, mergedAt: new Date() },
  });
  if (marked.count === 0) {
    throw new ConflictError("guest.already_claimed");
  }

  /**
   * "never" alanlarinin HEPSI TEK SORGUDA. Ilk yazimda her alan icin ayri
   * bir count vardi - 19 gidis donus - ve E2E'de transaction'in 5 saniyelik
   * sinirini asti (P2028, olculdu: 5336 ms). Veritabani uzakta oldugunda her
   * sorgu ~120 ms tutuyor. Tablo ve sutun adlari listeden geliyor (kullanici
   * girdisi DEGIL) ve yine de harf disinda bir sey tasiyamiyor; deger
   * parametre olarak gidiyor.
   */
  const counts = referencesWith("never").map((key) => {
    const [model, field] = key.split(".");
    if (!/^[A-Za-z]+$/.test(model) || !/^[A-Za-z]+$/.test(field)) {
      throw new Error(`Gecersiz referans adi: ${key}`);
    }
    return `(SELECT COUNT(*) FROM "${model}" WHERE "${field}" = $1::uuid)::int AS "${key}"`;
  });
  const [found] = await tx.$queryRawUnsafe<Record<string, number>[]>(
    `SELECT ${counts.join(", ")}`,
    guestId,
  );
  const violations = Object.entries(found ?? {}).filter(([, count]) => Number(count) > 0);
  if (violations.length > 0) {
    // Bir kural bozulmus demek: siniflama yanlis ya da misafir bir yoldan
    // yapamayacagi bir seyi yapmis. Sessizce devam etmek, o satirlari
    // sahipsiz birakmak olurdu. Hata transaction'i geri aliyor.
    throw new Error(
      `Misafir ${guestId} icin beklenmeyen satirlar: ${violations
        .map(([key, count]) => `${key}=${count}`)
        .join(", ")}`,
    );
  }

  // Surum sayaci TASIMADAN ONCE ve tek sorguda: tasimadan sonra misafir
  // artik hicbir harcamada gorunmuyor, yani sonra aranamazdi.
  await tx.expense.updateMany({
    where: {
      groupId,
      OR: [{ paidById: guestId }, { participants: { some: { userId: guestId } } }],
    },
    data: { version: { increment: 1 } },
  });

  for (const key of referencesWith("move")) {
    const [model, field] = key.split(".");
    await delegateFor(tx, model).updateMany({
      where: { [field]: guestId },
      data: { [field]: userId },
    });
  }
}
