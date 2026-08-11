import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { markUserDeletedFromClerk, syncUserFromClerk } from "@/lib/clerk-sync";

// Clerk, kullanici olaylarini (kayit / guncelleme / silme) buraya POST eder.
//
// Bu adres internete acik: oturum yok, cerez yok. Tek savunmasi imza
// dogrulamasi. Onsuz, adresi bilen herkes {"type":"user.deleted"} gonderip
// istedigi kullaniciyi silebilirdi.
//
// /api/v1 altinda DEGIL: orasi kendi istemcilerimizin (web + ileride mobil)
// kullandigi, bizim versiyonladigimiz API. Burasi disaridan cagrilan,
// sozlesmesini Clerk'in belirledigi ayri bir yuzey.
export async function POST(request: NextRequest) {
  let event;

  try {
    // Govdeyi kendimiz OKUMUYORUZ: imza ham govde uzerinden hesaplandigi icin
    // dogrulamayi yapan fonksiyonun onu ilk okuyan olmasi gerekiyor.
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook imzasi dogrulanamadi", error);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await syncUserFromClerk(event.data);
        break;

      case "user.deleted":
        // Silme olayinin govdesinde yalnizca id var; yine de opsiyonel.
        if (event.data.id) {
          await markUserDeletedFromClerk(event.data.id);
        }
        break;

      default:
        // Ilgilenmedigimiz olay tipleri (oturum, e-posta, organizasyon...).
        // 200 donmek ZORUNLU: 2xx disindaki her cevabi Clerk "basarisiz"
        // sayar ve olayi tekrar tekrar gonderir.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Buraya dusen hata gecici olabilir (orn. veritabanina ulasilamiyor).
    // 500 donuyoruz ki Clerk olayi daha sonra tekrar gondersin - burada
    // durum kodu bir hata mesaji degil, "tekrar dene" sinyali.
    console.error("Clerk webhook islenemedi", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
