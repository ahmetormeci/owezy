# Gerçek OCR çıktıları

Bu dosyalar **uydurulmadı**. İkisi de Wikimedia Commons'taki açık lisanslı
gerçek fiş fotoğraflarının, **Apple Vision** ile okunmuş çıktısıdır —
uygulamanın iOS'ta kullandığı motorun aynısı (`modules/receipt-ocr`).

| Dosya | Kaynak | Fişin gerçek toplamı |
|---|---|---|
| `receipt-swiss.json` | [File:ReceiptSwiss.jpg](https://commons.wikimedia.org/wiki/File:ReceiptSwiss.jpg) | 54,50 CHF |
| `receipt-officeworks.json` | [File:Reciept.jpg](https://commons.wikimedia.org/wiki/File:Reciept.jpg) | 27,96 AUD |

**Neden gerçek veri şart oldu:** Faz 46'nın testleri etiketle tutarın
**aynı satırda** olduğunu varsayıyordu ("NAKİT 400,00"). Gerçek Vision
çıktısı onları ayrı gözlemlere bölüyor, yani `NOT_TOTAL` koruması hiç
ateşlenmiyordu. Bu, uydurma veriyle görülemeyecek bir kusurdu ve
ölçüldüğünde Officeworks fişinde 27,96 yerine 28,00 (ödenen nakit)
okunuyordu.

Koordinatlar Vision'ın kendi düzeninde: 0..1 aralığı, **orijin sol alt**,
yani `y` büyüdükçe yukarı çıkılıyor.
