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
    //
    // RateLimit hicbir kullaniciya bagli DEGIL, o yuzden CASCADE onu
    // goturmez. Bugun E2E'de hic satir yazilmiyor (hiz siniri yalnizca
    // production'da acik) ama burada durmasi ucuz: biri onu acarsa, bir
    // onceki kosudan kalan sayac yeni kosuyu 429'a dusururdu.
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
         "RateLimit",
         "User"
       CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Hiz siniri sayaclarini siler.
 *
 * NEDEN VAR: kurulum uc test kullanicisini ARKA ARKAYA yaratiyor ve
 * /sign-up/email'in siniri 10 saniyede 3 istek. Yani kurulum tavana TAM
 * OTURUYOR - olculdu, bir kosunun ardindan sayac 3'te kaldi. Dorduncu bir
 * test kullanicisi eklendigi gun kurulum 429 alir ve hata "kayit basarisiz"
 * gibi gorunur; hiz siniri gibi degil. Sebebini bulmak saatler alirdi.
 *
 * KURULUM, TESTLERIN BUTCESINI HARCAMAMALI. Hiz siniri testler boyunca TAM
 * OLARAK ACIK kaliyor; yalnizca hazirlik asamasinin biriktirdigi sayac
 * siliniyor. Bu bir guvenlik ayarini kapatmak DEGIL - uretim
 * yapilandirmasina dokunulmuyor, yalnizca test veritabanindaki bir sayac
 * sifirlaniyor.
 */
export async function clearRateLimits() {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString || connectionString === process.env.DATABASE_URL) {
    throw new Error("E2E_DATABASE_URL yok ya da DATABASE_URL ile ayni.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  try {
    await prisma.rateLimit.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}
