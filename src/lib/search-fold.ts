// Arama icin metin katlama - saf.
//
// NEDEN VAR (13.3a'da olculdu): veritabani collation'i C.UTF-8 ve buyuk "I"
// kucultuldugunde "i" oluyor, "ı" degil. Yani "Isik" yazan bir harcama "ışık"
// aramasiyla BULUNMUYORDU. Sorun yalnizca I/ı degil: "kahvalti" yazan biri
// "kahvaltı"yi da bulamiyordu.
//
// Cozum iki tarafi da ayni sekilde katlamak: hem kayit (Expense.descriptionFold
// kolonu) hem de aranan metin. Kolon veritabaninda GENERATED ALWAYS, yani
// katlamanin SQL tarafi tek kaynak - uygulama unutamaz, eski kayitlar icin
// backfill gerekmez.
//
// Bu dosyadaki tablo, migration'daki translate() cagrisiyla BIREBIR ayni
// olmak zorunda. Ikisi ayrisirsa arama sessizce eksik sonuc verir - bir test
// tablolarin ayni uzunlukta oldugunu ve bilinen ciftleri dogruluyor.

/** Kaynak karakterler. Migration'daki translate()'in ilk argumaniyla ayni. */
export const FOLD_FROM = "IİıŞşĞğÜüÖöÇç";

/** Hedef karakterler. Migration'daki translate()'in ikinci argumaniyla ayni. */
export const FOLD_TO = "iiissgguuoocc";

/**
 * Aramada karsilastirilacak bicime cevirir.
 *
 * Turkce harfleri ASCII karsiligina indiriyor, sonra kucultuyor. Yan etkisi
 * ISTENEN bir sey: "sac" ile "saç" ayni kumeye dusuyor, yani arama aksana da
 * duyarsiz hale geliyor. Bir arama kutusunda fazla eslesmek, hic eslesmemekten
 * iyidir.
 *
 * Turkce harfler ONCE cevriliyor, sonra toLowerCase cagriliyor. Ters sirada
 * olsaydi "İ" once "i + birlesik nokta"ya donusur (JS'in Unicode kurali) ve
 * tablodaki karsiligini kaybederdi.
 */
export function foldForSearch(value: string): string {
  let folded = "";

  for (const character of value) {
    const index = FOLD_FROM.indexOf(character);
    folded += index >= 0 ? FOLD_TO[index] : character;
  }

  return folded.toLowerCase();
}
