import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * /api/v1'in YAZMA uclarinda kullanicinin dakikalik yazma butcesi.
 *
 * NEDEN VAR: Faz 26.1 /api/auth'u kapatti - giris denemesi artik sinirli. Ama
 * oturum acmis bir istemci /api/v1'e istedigi kadar yazabiliyordu. En olasi
 * olay kotu niyet degil, KACAK BIR ISTEMCI: bu kod tabaninin gercekten
 * yasadigi hata sonsuz bir render dongusuydu (CONVENTIONS.md, "Mobil").
 *
 * NEDEN KULLANICI, IP DEGIL: /api/v1'in butun yazma uclari oturum istiyor,
 * yani anonim sel diye bir tehdit yok. IP ise operatorler ve NAT arkasinda
 * PAYLASILIYOR - ayni kafedeki iki kullanici birbirinin butcesini yerdi.
 *
 * NEDEN TEK BUTCE, UC BASINA DEGIL: elimizde ayar yapacak veri yok. Iki sayi
 * ucuncuyu davet eder ve hicbiri olculmemis olur. Gercek bir olay bir ucu
 * isaret ederse o zaman ayrilir.
 *
 * BUNUN KAPATMADIGI IKI SEY, acikca:
 *   1. COK HESAPLI SALDIRGAN. Kullanici basina sinir bir hesabi kapar,
 *      toplami degil. Onun cevabi izleme ve barindirma kotalari.
 *   2. OKUMA DONGUSU. Yalnizca yazma uclari sinirli; grup sayfasi tek
 *      seferde bes paralel GET atiyor ve her birine bir veritabani turu
 *      eklemek sicak yolu bir istemci hatasi icin yavaslatirdi.
 */
const WINDOW_MS = 60_000;
const MAX_WRITES_PER_WINDOW = 60;

/**
 * Sayaci ARTIRIR ve butce asildiysa hazir bir 429 yaniti doner; asilmadiysa
 * null.
 *
 * TEK SORGU VE ATOMIK. "oku, karsilastir, yaz" uc ayri adim olsaydi ayni anda
 * gelen iki istek ikisi de esigin altini gorup ikisi de gecerdi - ve
 * sinirlamak istedigimiz sey zaten AYNI ANDA GELEN isteklerdi. Postgres'in
 * "INSERT ... ON CONFLICT DO UPDATE" yapisi artirmayi ve pencere sifirlamayi
 * tek islemde yapiyor.
 *
 * Prisma'nin upsert'i BURADA ISE YARAMIYOR: "pencere dolduysa 1'e dondur,
 * dolmadiysa artir" kosulu SQL tarafinda kalmali; upsert'te o karar
 * uygulamada verilir ve arada baska bir istek gecebilir.
 */
export async function enforceWriteLimit(userId: string): Promise<NextResponse | null> {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiRateLimit" ("id", "key", "count", "windowStart")
    VALUES (gen_random_uuid(), ${`write:${userId}`}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "ApiRateLimit"."windowStart" <= ${BigInt(cutoff)} THEN 1
        ELSE "ApiRateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "ApiRateLimit"."windowStart" <= ${BigInt(cutoff)} THEN ${BigInt(now)}
        ELSE "ApiRateLimit"."windowStart"
      END
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 0;
  if (count <= MAX_WRITES_PER_WINDOW) {
    return null;
  }

  // KOD DONULUYOR, METIN DEGIL (ADR-017): cumleyi gosteren taraf uretiyor.
  // Retry-After saniye cinsinden ve standart; istemci bir gun geri cekilme
  // uygulamak isterse okuyacagi yer burasi.
  return NextResponse.json(
    { ok: false, code: "server.too_many_requests" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) } },
  );
}
