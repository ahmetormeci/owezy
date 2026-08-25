import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Her kosu E2E veritabanina yeni grup, harcama ve davet birakiyor. Birikince
// hem sorgular yavasliyor hem de "hangi kayit hangi kosudan kaldi" belirsizlesiyor.
//
// Temizligi kosunun BASINDA yapiyoruz, sonunda degil: bir test patladiginda
// geride veriyi birakmak istiyoruz ki neyin yanlis gittigine bakabilelim.
export async function resetE2EDatabase() {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) {
    throw new Error("E2E_DATABASE_URL tanimli degil; temizlik yapilamaz.");
  }

  // Bu projedeki en tehlikeli tek satir burasi: yanlis baglanti dizesiyle
  // calisirsa gercek verini siler. .env.local'da bu iki degeri bir kez
  // karistirmistik; o yuzden esitlerse calismayi tamamen reddediyoruz.
  if (connectionString === process.env.DATABASE_URL) {
    throw new Error(
      "E2E_DATABASE_URL ile DATABASE_URL ayni! Testler gelistirme veritabanina " +
        "yazacakti. .env.local dosyasini duzeltmeden devam etme.",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

  try {
    // TRUNCATE ... CASCADE tek islemde bosaltir ve satir trigger'larini
    // calistirmaz. Tek tek deleteMany yapsaydik ExpenseParticipant uzerindeki
    // "paylarin toplami = tutar" trigger'i DELETE'te de calistigi icin patlardik.
    //
    // USER DA SILINIYOR (Faz 25.8). Eskiden korunuyordu cunku test
    // kullanicilari asil olarak CLERK'te duruyordu ve buradaki satirlar
    // yalnizca onlarin kopyasiydi; silmek eslesmeyi bozardi. Artik kimligin
    // kaynagi bu veritabani ve kullanicilari global.setup.ts her kosuda
    // yeniden yaratiyor.
    //
    // Kazanci somut: E2E veritabani ELLE HAZIRLIK ISTEMIYOR ve yarim kalmis
    // bir kullanici satiri (25.1'de bir migration'i durdurmustu) kosuyu
    // engelleyemiyor.
    //
    // Session/Account/Verification'i ayrica yazmaya gerek yok - CASCADE
    // onlari User uzerinden goturuyor. Yine de yaziliyorlar: TRUNCATE'in
    // hangi tablolara dokundugu, okuyan icin acikta durmali.
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE
         "ExpenseEdit",
         "ExpenseParticipant",
         "Expense",
         "Settlement",
         "Notification",
         "GroupInvite",
         "GroupMember",
         "Group",
         "Session",
         "Account",
         "Verification",
         "User"
       CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
