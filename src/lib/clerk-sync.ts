import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Clerk webhook'undan gelen kullanici verisinin bize LAZIM OLAN kismi.
 * Clerk'in tam UserJSON tipi cok daha genis; burada dar bir tip tanimlamak
 * hem testlerde sahte veri uretmeyi kolaylastiriyor hem de bu modulun
 * gercekte neye bagimli oldugunu gorunur kiliyor.
 */
export type ClerkUserPayload = {
  id: string;
  email_addresses: { id: string; email_address: string }[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  /** Clerk'teki kaydin son guncellenme zamani (unix milisaniye). */
  updated_at: number;
};

const DELETED_DISPLAY_NAME = "Silinmiş kullanıcı";

function pickPrimaryEmail(payload: ClerkUserPayload): string | null {
  const primary = payload.email_addresses.find(
    (email) => email.id === payload.primary_email_address_id,
  );
  return primary?.email_address ?? payload.email_addresses[0]?.email_address ?? null;
}

function buildDisplayName(payload: ClerkUserPayload, email: string): string {
  return [payload.first_name, payload.last_name].filter(Boolean).join(" ") || email;
}

/**
 * user.created ve user.updated olaylarini isler.
 *
 * Webhook'lar "en az bir kez" teslim edilir: ayni olay birden fazla kez ve
 * SIRASIZ gelebilir. Bu yuzden islem tek bir kosullu UPDATE ile yapiliyor;
 * asagidaki where kosulu uc kurali birden ifade ediyor:
 *   - kayit silinmisse dokunma (silme kalicidir)
 *   - elimizdeki veri bu olaydan yeniyse dokunma (eski olay gec dusmus)
 *   - kayit yoksa (count = 0) olusturmaya gec
 * Tek ifadede yaptigimiz icin "once oku, sonra yaz" arasinda baska bir
 * istegin araya girmesi mumkun degil.
 */
export async function syncUserFromClerk(payload: ClerkUserPayload): Promise<void> {
  const email = pickPrimaryEmail(payload);
  if (!email) {
    // E-postasiz kullanici (orn. yalnizca telefonla kayit) bizim modelimize
    // uymuyor. Tekrar denemek de bir sey degistirmez, bu yuzden sessizce
    // geciyoruz; kullanici uygulamaya girerse lazy sync anlamli hata verir.
    return;
  }

  const clerkUpdatedAt = new Date(payload.updated_at);
  const data = {
    email,
    displayName: buildDisplayName(payload, email),
    avatarUrl: payload.image_url,
    clerkUpdatedAt,
  };

  const updated = await prisma.user.updateMany({
    where: {
      clerkId: payload.id,
      deletedAt: null,
      OR: [{ clerkUpdatedAt: null }, { clerkUpdatedAt: { lt: clerkUpdatedAt } }],
    },
    data,
  });

  if (updated.count > 0) {
    return;
  }

  // Buraya dusmenin uc sebebi olabilir: (a) kayit hic yok, (b) kayit silinmis,
  // (c) gelen olay elimizdekinden eski. (b) ve (c) durumunda hicbir sey
  // yapmamamiz gerekiyor, o yuzden once kaydin var olup olmadigina bakiyoruz.
  const existing = await prisma.user.findUnique({
    where: { clerkId: payload.id },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  try {
    await prisma.user.create({ data: { clerkId: payload.id, ...data } });
  } catch (error) {
    // P2002: bu arada baska bir istek (lazy sync ya da ayni olayin tekrari)
    // kaydi olusturdu. Yaris kaybedildi ama sonuc dogru: kayit var.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

/**
 * user.deleted olayini isler.
 *
 * Kaydi SILMIYORUZ: harcama, odeme ve bakiye gecmisi bu satira bagli. Bunun
 * yerine kisisel bilgileri temizleyip deletedAt isaretliyoruz. Boylece kisinin
 * verisi gidiyor ama grubun parasi tutmaya devam ediyor - ayrilmis ama borcu
 * duran uyeler bakiye listesinde kaliyor (bkz. balances.ts).
 */
export async function markUserDeletedFromClerk(clerkId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkId },
      select: { id: true, deletedAt: true },
    });

    // Hic gormedigimiz bir kullanici (uygulamaya hic girmemis olabilir) ya da
    // zaten islenmis bir silme olayinin tekrari: yapacak bir sey yok.
    if (!user || user.deletedAt) {
      return;
    }

    const deletedAt = new Date();

    // clerkId'yi KORUYORUZ: ayni olay tekrar gelirse satiri bulup "zaten
    // silinmis" diyebilmemiz buna bagli.
    // .invalid uzantisi RFC 2606 ile rezerve; gercek bir adresle cakisamaz.
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted+${user.id}@deleted.invalid`,
        displayName: DELETED_DISPLAY_NAME,
        avatarUrl: null,
        deletedAt,
      },
    });

    const memberships = await tx.groupMember.findMany({
      where: { userId: user.id, leftAt: null },
      select: { id: true, groupId: true, role: true },
    });

    for (const membership of memberships) {
      const otherActiveMembers = await tx.groupMember.findMany({
        where: {
          groupId: membership.groupId,
          leftAt: null,
          userId: { not: user.id },
        },
        // En eski uye devralir. id ile ikinci siralama sart: joinedAt esit
        // olursa secim rastgele kalmasin, ayni girdi hep ayni sonucu versin.
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });

      // Her grupta her zaman bir OWNER bulunmali (leaveGroup'taki kuralin
      // aynisi). Fark su: ayrilan kisi devredecegi uyeyi kendi secer, burada
      // secemez - kisi gitti - o yuzden en eski aktif uyeye otomatik geciyor.
      if (membership.role === "OWNER" && otherActiveMembers.length > 0) {
        await tx.groupMember.update({
          where: { id: otherActiveMembers[0].id },
          data: { role: "OWNER" },
        });
      }

      // Devir yapildiktan SONRA kendi uyeligini kapatiyoruz; once kapatsaydik
      // "diger aktif uyeler" listesi degismezdi ama sira karisirdi.
      await tx.groupMember.update({
        where: { id: membership.id },
        data: { leftAt: deletedAt },
      });

      // Gruptaki son aktif uye oysa gruba artik kimse erisemez; leaveGroup'ta
      // oldugu gibi arsivliyoruz. Kayitlar silinmiyor.
      if (otherActiveMembers.length === 0) {
        await tx.group.updateMany({
          where: { id: membership.groupId, deletedAt: null },
          data: { deletedAt },
        });
      }
    }
  });
}
