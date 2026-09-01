/**
 * Harcama listesinin CIZIM KURALLARI - web ile mobilin ortak aklı.
 *
 * NEDEN VAR: bir grup ekraninda dokuz harcamanin ikincil satiri OLCULDU
 * (simulator, iPhone 17). 43 karakterin 37'si dokuz satirda da birebir
 * ayniydi - ayni tarih, ayni odeyen. Degisen tek alan kategoriydi ve o da
 * cumlenin ortasinda kaliyordu. Liste uzadikca oran DUZELMIYOR: her yeni
 * satir ayni tekrari getiriyor. Yani okumayi zorlastiran sey satir sayisi
 * degil, bilgi tasimayan murekkep.
 *
 * NEDEN PAYLASILAN BIR MODUL: kural web ile mobilde ayni olmak zorunda. Iki
 * yerde ayri ayri yazilsaydi biri degisirken oteki kalir ve ayni fis iki
 * platformda iki turlu okunurdu. Modul saf - React'e de Prisma'ya da
 * dokunmuyor - o yuzden mobil agac da import edebiliyor (ADR-042'nin
 * "saf moduller siniri gecer" kurali).
 */

/**
 * Yuklenmis harcamalari aya boler.
 *
 * expenseDate ISO metni ve sunucudaki monthKey ile AYNI dilim aliniyor (ilk 7
 * karakter, UTC). Date'e cevirip getMonth() kullansaydik, UTC'nin gerisindeki
 * bir saat diliminde ayin ilk gunu bir onceki basligin altina duserdi ve o
 * ayin toplami satirlariyla celisirdi.
 *
 * Liste zaten tarihe gore azalan sirali geldigi icin tek gecis yetiyor.
 *
 * BURADA, cunku mobildeki arama sonuclari da aya bolunuyor. Ikinci bir kopya
 * yazilsaydi ustteki UTC gerekcesi kopyalanmaz ve bir gun sessizce ayrisirdi.
 */
export function groupByMonth<T extends { expenseDate: string }>(expenses: T[]) {
  const groups: { month: string; expenses: T[] }[] = [];

  for (const expense of expenses) {
    const month = expense.expenseDate.slice(0, 7);
    const current = groups[groups.length - 1];

    if (current?.month === month) {
      current.expenses.push(expense);
    } else {
      groups.push({ month, expenses: [expense] });
    }
  }

  return groups;
}

/**
 * Bir satirin ikincil alanlari. UCU DE ZATEN BICIMLENMIS metin; bu modul
 * bicimlendirme yapmiyor, yalnizca hangisinin yazilacagina karar veriyor.
 */
export type SecondaryFields = {
  date: string;
  category: string;
  payer: string;
};

/**
 * Bir onceki satirda AYNI METINLE yazilmis alanlari eler.
 *
 * KARSILASTIRMA BICIMLENMIS METIN UZERINDE, ham deger uzerinde DEGIL.
 * Fark onemli ve sessizce yanlis sonuc uretebilirdi: iki harcamanin
 * expenseDate'i UTC'de ayni gune dusup yerel saatte AYRI gunlere dusebiliyor
 * (23:00Z ile 01:00Z, UTC+3'te 30 ve 29 Agustos). Ham gune bakip tarihi
 * gizleseydik okuyan kisi gizlenen satiri ustteki tarihe ait sanardi - yani
 * YANLIS BIR GUN okurdu. Yazilacak metin karsilastirilinca boyle bir durum
 * kalmiyor: bir alan ancak ustteki satirla harfi harfine ayni yazilacaksa
 * eleniyor.
 *
 * KATEGORI HER ZAMAN YAZILIYOR, tekrar etse bile. Iki sebep: satirin kendi
 * siniflandirmasi o, ve olculen ekranda degisken olan tek alan da oydu.
 * Ustelik ucu birden elenebilseydi ikincil satir BOS kalirdi - satir bozuk
 * gorunurdu.
 *
 * previous, EKRANDA BIR USTTE DURAN satir olmali; veri sirasindaki degil.
 * Ay sinirlarinda null gecilmesi bu yuzden dogru: yeni bir bolumun ilk
 * satiri kendi tarihini yazmali.
 */
export function visibleSecondaryFields(
  current: SecondaryFields,
  previous: SecondaryFields | null,
): string[] {
  const parts: string[] = [];

  if (!previous || previous.date !== current.date) {
    parts.push(current.date);
  }

  parts.push(current.category);

  if (!previous || previous.payer !== current.payer) {
    parts.push(current.payer);
  }

  return parts;
}

/**
 * "Senin payin" yazilacak mi.
 *
 * PAY TUTARIN AYNISIYSA YAZILMIYOR. Satirin sag ucunda zaten o sayi duruyor;
 * iki santim solunda "senin payin {ayni sayi}" yazmak, ekranda olan bir seyi
 * ikinci kez soylemek demek. Tek uyeli bir grupta - ya da yalnizca senin
 * katildigin bir harcamada - BUTUN satirlarda oluyordu (simulatorde
 * goruldu): tam da tekrari temizledigimiz yerde yeni bir tekrar.
 *
 * Kural tutarlarin TAM SAYI olmasina guveniyor: para kurus cinsinden tam
 * sayi (degistirilemez kural), o yuzden "!==" burada guvenli. Float olsaydi
 * karsilastirma sessizce yanlis cevap verebilirdi.
 */
export function shouldShowShare(
  shareAmount: number | undefined,
  amount: number,
): shareAmount is number {
  return shareAmount !== undefined && shareAmount !== amount;
}

/**
 * E-posta bicimindeki bir metnin "@" oncesi. Digerleri oldugu gibi doner.
 *
 * KISALTMA YALNIZCA GERCEKTEN E-POSTAYSA yapiliyor: "Ali @ Ev" gibi bir ad
 * "@" tasiyor ama e-posta degil, ve duz bir indexOf("@") onu "Ali " yapardi.
 */
const EMAIL_SHAPED = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fis satirinda gosterilecek ad.
 *
 * E-POSTA KODUYLA GIREN ama kayit formunu doldurmamis kullaniciya gorunen ad
 * olarak E-POSTANIN TAMAMI yaziliyor (better-auth.ts, databaseHooks.user).
 * O karar BURADA DEGISMIYOR - saklanan deger aynen duruyor. Degisen yalnizca
 * TEKRAR EDEN LISTE SATIRI: orada 20 karakterlik bir adres, kategoriyi ve
 * payi ekranin disina itiyordu.
 *
 * KIMLIGIN ONEMLI OLDUGU YERLER KISALTMIYOR: uye listesi, bakiyeler ve
 * odesme plani tam adresi gosteriyor. Ayni gruptaki iki kisiyi ayirt etmek
 * gerektiginde tam deger bir dokunus otede duruyor.
 */
export function displayNameForLine(displayName: string): string {
  return EMAIL_SHAPED.test(displayName)
    ? displayName.slice(0, displayName.indexOf("@"))
    : displayName;
}
