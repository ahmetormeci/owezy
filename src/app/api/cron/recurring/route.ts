import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleApiError } from "@/lib/api";
import { runDueRecurringExpenses } from "@/lib/recurring";

/**
 * ZAMANLANMIS IS: vadesi gelmis tekrarlayan harcamalari uretir (ADR-051).
 *
 * /api/v1 ALTINDA DEGIL ve bu bilincli: v1 istemcilerin sozlesmesi - her ucu
 * bir oturum tasiyor ve mobil de web de ayni yolu kullaniyor. Burasi bir
 * istemci ucu degil, MAKINEDEN MAKINEYE bir tetikleyici. Ayni agacta durmasi,
 * bir gun v1'e uygulanacak bir kuralin (orn. oturum zorunlulugu) buraya da
 * uygulanmasi anlamina gelirdi.
 *
 * ZAMANLAMA vercel.json'da: her gun 06:00 UTC. Gunde bir kez YETIYOR - en
 * sik donem haftalik.
 */

/**
 * ONBELLEGE ALINMASI YASAK. Bu uc her cagrildiginda VERITABANINA YAZIYOR;
 * onbelleklenmis bir cevap, uretimin hic yapilmadigi anlamina gelirdi ve
 * belirtisi "cron calisiyor ama hicbir sey olmuyor" olurdu.
 */
export const dynamic = "force-dynamic";

/** Yakalama dongusu 12 donem donebiliyor; varsayilan 10 sn yetmeyebilir. */
export const maxDuration = 60;

/**
 * Sabit surede karsilastirma.
 *
 * Duz "===" ile karsilastirmak, sirri harf harf tahmin etmeye acik kapi
 * birakir (zamanlama saldirisi). Uzunluklar farkliysa timingSafeEqual
 * FIRLATIYOR, o yuzden once uzunluk kontrolu - ve o kontrol sizdirilebilir
 * tek bilgi olan UZUNLUGU sizdiriyor, ki o da onemsiz.
 */
function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;

    /**
     * SIR YOKSA CALISMIYOR - ACIK KAPI BIRAKMIYOR.
     *
     * Vercel, CRON_SECRET tanimliysa cagriya Authorization basligini kendisi
     * ekliyor; tanimli degilse bu adres KIMLIKSIZ cagrilabilir olurdu ve bu
     * uc FINANSAL KAYIT URETIYOR. "Yapilandirilmamissa serbest birak" demek,
     * guvenligi sonraya birakmakla ayni sey (AGENTS.md, degistirilemez
     * kural).
     *
     * 503: bu bizim tarafimizdaki bir EKSIK, cagiranin hatasi degil.
     */
    if (!secret) {
      return NextResponse.json({ ok: false, code: "cron.not_configured" }, { status: 503 });
    }

    if (!secretMatches(request.headers.get("authorization"), secret)) {
      return NextResponse.json({ ok: false, code: "auth.not_signed_in" }, { status: 401 });
    }

    const report = await runDueRecurringExpenses();

    /**
     * KOSUNUN NE YAPTIGI LOGA YAZILIYOR.
     *
     * NEDEN GEREKTI - OLCULDU (10 Eylul): cevabin GOVDESI hicbir yerde
     * gorunmuyor. Vercel'in Cron Jobs sekmesi yalnizca DURUM KODUNU
     * gosteriyor, Runtime Logs'a da bir sey dusmuyor cunku uc cevabi
     * donduruyor ama yazmiyordu. Yani basarili bir kosu arkasinda hicbir
     * kayit birakmiyordu: "bugun kac sablon islendi" sorusunun cevabi yoktu.
     *
     * Sonuclar dolayli gorunuyor (harcama beliriyor, bildirim gidiyor,
     * hata olursa 500) - ama dolayli gorunmek, bir zamanlanmis is icin
     * gorunmemekle ayni kapiya cikiyor: kimse bakmiyor.
     *
     * ICINDE KISISEL VERI YOK, yalnizca UC SAYI. Grup adi, kisi adi, tutar
     * hicbiri girmiyor - push'a koymadigimiz seyi (ADR-047) loga da
     * koymuyoruz. Log satirlari Vercel'de saklaniyor ve gizlilik
     * politikasinin anlattigi sinirlarin disina cikmamali.
     */
    console.log("[cron/recurring]", JSON.stringify(report));

    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    return handleApiError(error);
  }
}
