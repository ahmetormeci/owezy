import { describe, expect, it } from "vitest";
import { filenameFromContentDisposition } from "./content-disposition";

/**
 * BU DOSYA NEYI KORUYOR: telefondan inen CSV'nin ADINI.
 *
 * Yanlis okumanin belirtisi sessiz: dosya iniyor, paylasim sayfasi aciliyor,
 * ama adi "undefined.csv" ya da bozuk bir Turkce oluyor. Kimse hata gormuyor.
 *
 * Buradaki girdiler UYDURULMADI: ucun gercekten urettigi bicim
 * (src/app/api/v1/groups/[groupId]/expenses/export/route.ts,
 * contentDisposition fonksiyonu).
 */
describe("filenameFromContentDisposition", () => {
  it("YILDIZLI bicimi tercih ediyor - gercek adi yalnizca o tasiyor", () => {
    // ASCII yedegi Turkce harfleri "_" yapmis; dogru olan yildizli olan.
    const header =
      'attachment; filename="Deniz_in evi - 2026-09-04.csv"; ' +
      "filename*=UTF-8''Deniz%27in%20evi%20-%202026-09-04.csv";

    // AD OLDUGU GIBI KALIYOR. Bu modulun varlik sebebi web ile ayni adi
    // uretmek; bosluk, tire ve kesme isaretini "_" yapmak tam da kacinilmak
    // istenen ayrismayi uretirdi.
    expect(filenameFromContentDisposition(header)).toBe("Deniz'in evi - 2026-09-04.csv");
  });

  it("yalnizca duz filename varsa onu alir", () => {
    const header = 'attachment; filename="Ev.csv"';

    expect(filenameFromContentDisposition(header)).toBe("Ev.csv");
  });

  it("tirnaksiz duz bicimi de okur", () => {
    expect(filenameFromContentDisposition("attachment; filename=Ev.csv")).toBe("Ev.csv");
  });

  it("BOZUK yuzde kodlamasinda duz bicime duser", () => {
    /**
     * decodeURIComponent yarim bir "%" gorunce FIRLATIYOR. Yakalamasaydik
     * disa aktarma butun bir hatayla dururdu - oysa elimizde kullanilabilir
     * bir ad var.
     */
    const header = 'attachment; filename="yedek.csv"; ' + "filename*=UTF-8''%E0%A4%A";

    expect(filenameFromContentDisposition(header)).toBe("yedek.csv");
  });

  it("baslik yoksa null doner", () => {
    // Cagiran taraf kendi yedek adini koyuyor; burada patlamak akisi
    // gereksiz yere bitirirdi.
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition("")).toBeNull();
  });

  it("filename tasimayan baslikta null doner", () => {
    expect(filenameFromContentDisposition("attachment")).toBeNull();
  });

  it("adi bos olan basligi AD SAYMAZ", () => {
    // filename="" -> temizlendiginde bos kaliyor. Bos ad bir dosya adi
    // degil; cagiran taraf yedege dusmeli.
    expect(filenameFromContentDisposition('attachment; filename=""')).toBeNull();
  });

  it("YALNIZCA yol ayiracini temizler", () => {
    // Grup adini KULLANICI yaziyor: "A/B" dosyayi baska bir dizine yazmak
    // olurdu. Iki nokta ve yildiz iOS'ta sorun degil, dokunulmuyor.
    const header = 'attachment; filename="A/B:C*D.csv"';

    expect(filenameFromContentDisposition(header)).toBe("A_B:C*D.csv");
  });

  it("ters bolu de temizleniyor", () => {
    expect(filenameFromContentDisposition('attachment; filename="A\\B.csv"')).toBe(
      "A_B.csv",
    );
  });
});
