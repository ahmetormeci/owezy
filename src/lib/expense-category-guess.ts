import type { ExpenseCategory } from "@prisma/client";
import { foldForSearch } from "@/lib/search-fold";

/**
 * Aciklamadan kategori tahmini - saf.
 *
 * NEDEN VAR: kategori alani vardi ama kimse doldurmuyordu. Form varsayilan
 * olarak "Diger"i secili getiriyor, kullanici dokunmuyor; sonucta "nereye
 * gitti" kirilimi tek cubuk "Diger" cikiyor ve var olan bir ozellik hicbir
 * sey anlatmiyordu (Faz 13'ten beri yazili bir urun riski).
 *
 * NEDEN ZORUNLU ALAN DEGIL: kategoriyi zorunlu kilmak her harcamada bir
 * karar daha demek. Insanlar en usttekini secer, veri yine cop olur - ustelik
 * bu sefer surtunme de eklenmis olur.
 *
 * TAHMIN ACIK BIR SECIMI ASLA EZMEZ. Yalnizca kategori HIC gonderilmediginde
 * calisiyor (bkz. createExpense). Yanlis tahminin bedeli de ucuz: harcama
 * duzenlenip degistiriliyor.
 *
 * TURKCE: karsilastirma foldForSearch uzerinden yapiliyor, yani buyuk/kucuk
 * harf ve aksan farki yok. "IŞIK", "ışık" ve "isik" ayni kumeye duser.
 * Anahtarlar bu yuzden KATLANMIS bicimde yaziliyor (ASCII, kucuk harf).
 */

/**
 * Kategori -> anahtar kelimeler. Anahtarlar katlanmis bicimde.
 *
 * ESLESME KURALI iki turlu:
 *   - 4 harf ve uzunu: kelimenin BASI eslesirse yeter ("faturasi" -> "fatura",
 *     "otelde" -> "otel"). Turkce eklerle buyuyen kelimeleri boyle
 *     yakaliyoruz - sinir once 5'ti ve "otel" gibi cok yaygin bir kelimeyi
 *     ekli halleriyle kaciriyordu.
 *   - 3 harf ve kisasi: TAM eslesme sart. "sok" bas eslesmesi olsaydi
 *     "sokak" da market sayilirdi; "gaz" da "gazete"yi yakalardi.
 *
 * Cakisma olursa EN UZUN anahtar kazanir (bkz. guessCategory): daha uzun
 * anahtar daha ozgul bir ipucudur.
 */
const KEYWORDS: Record<Exclude<ExpenseCategory, "OTHER">, readonly string[]> = {
  FOOD: [
    "yemek", "restoran", "restaurant", "lokanta", "kahvalti", "brunch",
    "kafe", "cafe", "kahve", "starbucks", "gloria", "espressolab",
    "pizza", "burger", "doner", "kebap", "kebab", "lahmacun", "pide",
    "corba", "manti", "sushi", "susi", "tatli", "dondurma", "pastane",
    "firin", "simit", "borek", "meyhane", "ocakbasi", "yemeksepeti",
    "getiryemek", "trendyolyemek", "mcdonalds", "dominos", "bk",
  ],
  TRANSPORT: [
    "taksi", "taxi", "uber", "bitaksi", "marti", "scooter", "otobus",
    "metro", "metrobus", "tramvay", "vapur", "dolmus", "minibus",
    "benzin", "mazot", "yakit", "otoyol", "hgs", "ogs", "otopark",
    "ucak", "ucus", "thy", "pegasus", "ajet", "tren", "tcdd",
    "istanbulkart", "akbil", "transfer",
  ],
  ACCOMMODATION: [
    "otel", "hotel", "airbnb", "booking", "pansiyon", "hostel",
    "konaklama", "villa", "bungalov", "resort", "devremulk",
  ],
  SHOPPING: [
    "market", "alisveris", "migros", "carrefour", "a101", "bim", "sok",
    "macrocenter", "manav", "kasap", "sarkuteri",
    "getir", "banabi", "istegelsin",
    "magaza", "carsi", "giyim", "ayakkabi", "zara", "lcwaikiki", "lcw",
    "defacto", "koton", "bershka", "trendyol",
    "hepsiburada", "amazon", "n11", "ikea", "bauhaus", "koctas",
    "kozmetik", "gratis", "watsons", "rossmann", "eczane",
    "teknosa", "mediamarkt", "apple",
  ],
  BILLS: [
    "fatura", "elektrik", "dogalgaz", "gaz", "aidat", "kira",
    "internet", "telefon", "turkcell", "vodafone", "turktelekom",
    "superonline", "kablonet", "millenicom",
    "iski", "aski", "bedas", "igdas", "tedas", "sedas",
    "vergi", "sigorta",
  ],
  ENTERTAINMENT: [
    "sinema", "tiyatro", "konser", "festival", "mac", "bilet",
    "oyun", "playstation", "steam", "xbox", "nintendo",
    "netflix", "spotify", "disney", "mubi", "blutv", "exxen",
    "bowling", "bilardo", "karaoke", "muze", "sergi", "parti",
    "eglence", "bar", "pub", "kulup", "tatil",
  ],
};

/**
 * BILEREK LISTEDE OLMAYANLAR: "mango" (meyve de olabilir), "vatan"
 * ("vatandas"i yakalardi), "apart" ("apartman aidati"ni konaklama sayardi),
 * "abonelik" ("Netflix abonelik"te eglenceyi ezerdi - daha uzun anahtar
 * kazaniyor), "pull", "gain", "tarim", "site". Genis liste demek, her
 * markayi eklemek demek degil; bir anahtar yaygin bir kelimeyle
 * cakisiyorsa yokluğu varligindan iyidir.
 */

/** Kisa anahtarlarda tam eslesme isteyen sinir. */
const EXACT_MATCH_MAX_LENGTH = 3;

/** Katlanmis metni kelimelere boler. Rakamlar korunuyor ("a101"). */
function tokenize(folded: string): string[] {
  return folded.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * UNSUZ YUMUSAMASI. Turkce'de sonu k/p/t ile biten bir kelime unlu ile
 * baslayan ek aldiginda son harf yumusuyor: "yemek" -> "yemegi",
 * "kebap" -> "kebabi", "simit" -> "simidi". Bas eslesmesi bu yuzden tek
 * basina yetmiyordu - "yemegi" kelimesi "yemek" ile baslamiyor.
 *
 * Istisnalari tek tek listelemek yerine kurali yaziyoruz: her anahtarin
 * yumusamis bir ikizi de uretiliyor. Bir kural, N istisnadan iyidir.
 * (Katlama zaten "ğ"yi "g"ye indiriyor, o yuzden hedef harf "g".)
 */
function softenedVariant(keyword: string): string | null {
  const soft = { k: "g", p: "b", t: "d" }[keyword.at(-1) ?? ""];
  return soft ? keyword.slice(0, -1) + soft : null;
}

function matchLength(tokens: string[], keyword: string): number {
  const exactOnly = keyword.length <= EXACT_MATCH_MAX_LENGTH;
  // Yumusamis ikiz yalnizca ek almis hallerde anlamli, yani tam eslesmede
  // aranmiyor: "yemeg" diye bir kelime yok.
  const forms = exactOnly ? [keyword] : [keyword, softenedVariant(keyword)];

  for (const token of tokens) {
    for (const form of forms) {
      if (form && (exactOnly ? token === form : token.startsWith(form))) {
        // Uzunluk her zaman ASIL anahtarinki: yumusamis ikiz ayni ipucunun
        // baska bir yazilisi, daha zayif ya da guclu bir ipucu degil.
        return keyword.length;
      }
    }
  }

  return 0;
}

/**
 * Aciklamaya bakip bir kategori onerir. Hicbir ipucu yoksa null doner -
 * "OTHER" DEGIL. Cagiran taraf varsayilana kendisi karar versin diye:
 * null "bilmiyorum", OTHER ise "biliyorum, digeri" demek.
 */
export function guessCategory(description: string): ExpenseCategory | null {
  const tokens = tokenize(foldForSearch(description));
  if (tokens.length === 0) {
    return null;
  }

  let best: { category: ExpenseCategory; length: number } | null = null;

  // Object.entries siralamasi tanim sirasi; esitlikte ilk tanimlanan kazaniyor
  // cunku yalnizca KESIN buyukse degistiriyoruz.
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      const length = matchLength(tokens, keyword);
      if (length > (best?.length ?? 0)) {
        best = { category: category as ExpenseCategory, length };
      }
    }
  }

  return best?.category ?? null;
}
