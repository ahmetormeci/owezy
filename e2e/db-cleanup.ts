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
    // RateLimit ve ApiRateLimit hicbir kullaniciya bagli DEGIL (ikisinde de
    // foreign key yok), o yuzden CASCADE onlari goturmez ve ELLE yazilmalari
    // sart. Bu satirlar bir zamanlar "ucuz bir onlem" diye durusuyordu -
    // artik degil: Faz 26.1 hiz sinirini HER ORTAMDA actu, yani E2E de bu
    // tablolara gercekten yaziyor. Temizlenmeseydi bir onceki kosudan kalan
    // sayac yeni kosuyu 429'a dusururdu.
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
         "ApiRateLimit",
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

/**
 * Bir kullaniciya GONDERILEN tek seferlik kodu veritabanindan okur.
 *
 * NEDEN GEREKLI: e-posta koduyla giris ve parola yenileme, testin OKUYAMADIGI
 * bir posta kutusundan geciyor. Uctan uca sinamanin baska yolu yok - ya kodu
 * buradan okuruz ya da o iki akis hic test edilmez. Ikincisi, parola
 * yenilemenin (2FA acan bir kullanicinin TEK kurtarma yolu) sessizce
 * bozulmasi demekti.
 *
 * BICIM KUTUPHANEDEN GELIYOR ve bu kirilgan bir bagimlilik: identifier
 * "<tur>-otp-<eposta>", deger ise "<kod>:<deneme sayisi>"
 * (email-otp/utils.mjs, routes.mjs). Better Auth bunu degistirirse test
 * duser - ama SESSIZCE yanlis gecmez, "kod bulunamadi" diye bagirir.
 *
 * KODUN DUZ METIN DURMASI DA BIR OLCUM: emailOTP eklentisinin storeOTP
 * varsayilani "plain". Bunu degistirmedik (o ayri bir karar, PROGRESS'te
 * duruyor) - ama degistirilirse burasi da degismek zorunda.
 */
export async function readOtpFromDatabase(type: string, email: string): Promise<string> {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString || connectionString === process.env.DATABASE_URL) {
    throw new Error("E2E_DATABASE_URL yok ya da DATABASE_URL ile ayni.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  try {
    const row = await prisma.verification.findFirst({
      where: { identifier: `${type}-otp-${email}` },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      throw new Error(`${email} icin "${type}" kodu bulunamadi.`);
    }
    // Son iki nokta ustusteye gore ayiriyoruz: kodun kendisi rakamlardan
    // olusuyor ama bicim degisirse ilk ":" yanlis yerde olabilir.
    const separator = row.value.lastIndexOf(":");
    return separator === -1 ? row.value : row.value.slice(0, separator);
  } finally {
    await prisma.$disconnect();
  }
}
