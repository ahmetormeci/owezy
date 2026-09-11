import ExpoModulesCore
import Vision

/**
 * FISTEN METIN OKUR - VE HER PARCANIN KONUMUNU DA DONDURUR.
 *
 * NEDEN KENDI MODULUMUZ (ADR-055): expo-text-extractor ayni motoru
 * (Apple Vision) kullaniyordu ama `observation.boundingBox`'i ATIYOR,
 * yalnizca metni donduruyordu. O tek satirlik kayip iki seyi birden
 * imkansiz kiliyor:
 *
 *   1. KALEM CIKARMA. Gercek bir fiste ad, birim fiyat ve satir toplami
 *      AYNI Y'DE ama FARKLI X'TE duruyor; Vision bunlari ayri gozlemler
 *      olarak veriyor. Modulun dondurdugu ham SIRA ise satira gore degil
 *      SUTUNA gore gruplaniyor - once butun adlar, sonra butun fiyatlar,
 *      ustelik baska sirada. Hangi fiyatin hangi ada ait oldugu bilgisi
 *      bize ulasmadan yok oluyor.
 *
 *   2. TOPLAMI DOGRU OKUMA. "TOPLAM" etiketi ile tutari da ayri
 *      gozlemler. Etiket eslesmesi bu yuzden hic calismiyordu ve is
 *      "en buyuk kuruslu sayi" yedegine kaliyordu. Olculdu: gercek bir
 *      fiste TOPLAM 27,96 iken odenen nakit 28,00 okundu.
 *
 * Konum gelince ikisi de basit bir isleme donusuyor: ayni y'dekileri
 * grupla, en soldaki ad, en sagdaki tutar.
 *
 * YALNIZCA iOS (ADR-030 "once iOS"). Android'de modul bagli olmadigi
 * icin yukleme basarisiz olur ve cagiran taraf sessizce OCR'siz devam
 * eder - bu davranis bilerek boyle (bkz. new.tsx'teki tembel yukleme).
 */
public class ReceiptOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")

    Constants([
      "isSupported": true
    ])

    AsyncFunction("readBlocks") { (url: URL, promise: Promise) in
      do {
        let data = try Data(contentsOf: url)
        guard let image = UIImage(data: data), let cgImage = image.cgImage else {
          throw Exception(name: "ReceiptOcrError", description: "Gorsel okunamadi")
        }

        let request = VNRecognizeTextRequest { request, _ in
          guard let observations = request.results as? [VNRecognizedTextObservation] else {
            return promise.resolve([])
          }

          let blocks: [[String: Any]] = observations.compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            /**
             * KOORDINATLAR 0..1 ARALIGINDA ve Vision'in kendi duzeninde:
             * ORIJIN SOL ALTTA, yani y BUYUDUKCE YUKARI cikiyor.
             * Cevrimi burada YAPMIYORUZ - saf modulun sinanabilmesi icin
             * ham degerler geciyor ve donusum orada, testli bir yerde
             * oluyor (lib/receipt-blocks.ts).
             */
            return [
              "text": candidate.string,
              "x": box.minX,
              "y": box.midY,
              "width": box.width,
              "height": box.height,
            ]
          }
          promise.resolve(blocks)
        }

        /**
         * accurate + dil duzeltmesi KAPALI.
         *
         * expo-text-extractor ikisini de AYARLAMIYORDU, yani Vision'in
         * varsayilanlariyla calisiyordu. Dil duzeltmesi bir fiste zarar
         * veriyor: "KDV" gibi kisaltmalari ve urun adlarini sozluge
         * uydurmaya calisiyor.
         */
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["tr-TR", "en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])
      } catch {
        promise.reject(error)
      }
    }
  }
}
