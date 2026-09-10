import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  MAX_SPLIT_AMOUNT,
  inferBasisPoints,
  splitByItems,
  splitByPercentage,
  splitEqually,
  splitExactly,
  type SplitShare,
} from "@/lib/split";

describe("splitEqually", () => {
  it("10000 / 1 kisi", () => {
    expect(splitEqually({ amount: 10000, participantUserIds: ["a"] })).toEqual([
      { userId: "a", amount: 10000 },
    ]);
  });

  it("10000 / 2 kisi", () => {
    expect(splitEqually({ amount: 10000, participantUserIds: ["a", "b"] })).toEqual([
      { userId: "a", amount: 5000 },
      { userId: "b", amount: 5000 },
    ]);
  });

  it("10000 / 3 kisi - kalan kurus ilk kisiye gider", () => {
    expect(
      splitEqually({ amount: 10000, participantUserIds: ["a", "b", "c"] }),
    ).toEqual([
      { userId: "a", amount: 3334 },
      { userId: "b", amount: 3333 },
      { userId: "c", amount: 3333 },
    ]);
  });

  it("1 kurus / 3 kisi", () => {
    expect(splitEqually({ amount: 1, participantUserIds: ["a", "b", "c"] })).toEqual([
      { userId: "a", amount: 1 },
      { userId: "b", amount: 0 },
      { userId: "c", amount: 0 },
    ]);
  });

  it("izin verilen maksimum tutarda calisir", () => {
    const result = splitEqually({
      amount: MAX_SPLIT_AMOUNT,
      participantUserIds: ["a", "b", "c"],
    });
    expect(result.reduce((sum, share) => sum + share.amount, 0)).toBe(MAX_SPLIT_AMOUNT);
  });

  it("cok buyuk tutar (maksimumu asan) hata verir", () => {
    expect(() =>
      splitEqually({ amount: MAX_SPLIT_AMOUNT + 1, participantUserIds: ["a"] }),
    ).toThrow();
  });

  it("ayni katilimci iki kez verilirse hata verir", () => {
    expect(() => splitEqually({ amount: 10000, participantUserIds: ["a", "a"] })).toThrow();
  });

  it("bos katilimci listesi hata verir", () => {
    expect(() => splitEqually({ amount: 10000, participantUserIds: [] })).toThrow();
  });

  it("negatif amount hata verir", () => {
    expect(() => splitEqually({ amount: -100, participantUserIds: ["a"] })).toThrow();
  });

  it("sifir amount hata verir", () => {
    expect(() => splitEqually({ amount: 0, participantUserIds: ["a"] })).toThrow();
  });

  it("sonuclarin toplami her zaman amount'a esit (genis tarama)", () => {
    for (let amount = 1; amount <= 50; amount++) {
      for (let n = 1; n <= 7; n++) {
        const participants = Array.from({ length: n }, (_, i) => `u${i}`);
        const result = splitEqually({ amount, participantUserIds: participants });
        const total = result.reduce((sum, share) => sum + share.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("ayni girdi her zaman ayni sonucu uretir (deterministik)", () => {
    const input = { amount: 10007, participantUserIds: ["a", "b", "c", "d"] };
    expect(splitEqually(input)).toEqual(splitEqually(input));
  });
});

describe("splitExactly", () => {
  it("paylar amount'a esitse basarili", () => {
    expect(
      splitExactly({
        amount: 10000,
        shares: [
          { userId: "a", amount: 6000 },
          { userId: "b", amount: 4000 },
        ],
      }),
    ).toEqual([
      { userId: "a", amount: 6000 },
      { userId: "b", amount: 4000 },
    ]);
  });

  it("pay sifir olabilir", () => {
    expect(
      splitExactly({
        amount: 10000,
        shares: [
          { userId: "a", amount: 10000 },
          { userId: "b", amount: 0 },
        ],
      }),
    ).toEqual([
      { userId: "a", amount: 10000 },
      { userId: "b", amount: 0 },
    ]);
  });

  it("paylarin toplami amount'i tutmuyorsa hata verir", () => {
    expect(() =>
      splitExactly({
        amount: 10000,
        shares: [
          { userId: "a", amount: 6000 },
          { userId: "b", amount: 3000 },
        ],
      }),
    ).toThrow();
  });

  it("negatif pay hata verir", () => {
    expect(() =>
      splitExactly({
        amount: 10000,
        shares: [
          { userId: "a", amount: 12000 },
          { userId: "b", amount: -2000 },
        ],
      }),
    ).toThrow();
  });

  it("ayni katilimci iki kez verilirse hata verir", () => {
    expect(() =>
      splitExactly({
        amount: 10000,
        shares: [
          { userId: "a", amount: 5000 },
          { userId: "a", amount: 5000 },
        ],
      }),
    ).toThrow();
  });

  it("bos pay listesi hata verir", () => {
    expect(() => splitExactly({ amount: 10000, shares: [] })).toThrow();
  });

  it("cok buyuk tutar hata verir", () => {
    expect(() =>
      splitExactly({
        amount: MAX_SPLIT_AMOUNT + 1,
        shares: [{ userId: "a", amount: MAX_SPLIT_AMOUNT + 1 }],
      }),
    ).toThrow();
  });
});

describe("splitByPercentage", () => {
  it("yuzdeler tam bolunuyorsa (kalan yok)", () => {
    expect(
      splitByPercentage({
        amount: 10000,
        shares: [
          { userId: "a", basisPoints: 5000 },
          { userId: "b", basisPoints: 5000 },
        ],
      }),
    ).toEqual([
      { userId: "a", amount: 5000 },
      { userId: "b", amount: 5000 },
    ]);
  });

  it("kusurat olusan durumda en buyuk kalan yontemiyle dagitir", () => {
    // %33.34 / %33.33 / %33.33 -> 100 kurus uzerinde 34/33/33
    const result = splitByPercentage({
      amount: 100,
      shares: [
        { userId: "a", basisPoints: 3334 },
        { userId: "b", basisPoints: 3333 },
        { userId: "c", basisPoints: 3333 },
      ],
    });
    expect(result).toEqual([
      { userId: "a", amount: 34 },
      { userId: "b", amount: 33 },
      { userId: "c", amount: 33 },
    ]);
  });

  it("yuzdelerin toplami 100 degilse hata verir", () => {
    expect(() =>
      splitByPercentage({
        amount: 10000,
        shares: [
          { userId: "a", basisPoints: 5000 },
          { userId: "b", basisPoints: 4000 },
        ],
      }),
    ).toThrow();
  });

  it("negatif yuzde hata verir", () => {
    expect(() =>
      splitByPercentage({
        amount: 10000,
        shares: [
          { userId: "a", basisPoints: 11000 },
          { userId: "b", basisPoints: -1000 },
        ],
      }),
    ).toThrow();
  });

  it("tek bir payin yuzdesi %100'u asarsa hata verir", () => {
    expect(() =>
      splitByPercentage({
        amount: 10000,
        shares: [{ userId: "a", basisPoints: 10001 }],
      }),
    ).toThrow();
  });

  it("bos pay listesi hata verir", () => {
    expect(() => splitByPercentage({ amount: 10000, shares: [] })).toThrow();
  });

  it("ayni katilimci iki kez verilirse hata verir", () => {
    expect(() =>
      splitByPercentage({
        amount: 10000,
        shares: [
          { userId: "a", basisPoints: 5000 },
          { userId: "a", basisPoints: 5000 },
        ],
      }),
    ).toThrow();
  });

  it("izin verilen maksimum tutarda dogru bolunur", () => {
    const result = splitByPercentage({
      amount: MAX_SPLIT_AMOUNT,
      shares: [
        { userId: "a", basisPoints: 3334 },
        { userId: "b", basisPoints: 3333 },
        { userId: "c", basisPoints: 3333 },
      ],
    });
    expect(result.reduce((sum, share) => sum + share.amount, 0)).toBe(MAX_SPLIT_AMOUNT);
  });

  it("sonuclarin toplami her zaman amount'a esit (genis tarama)", () => {
    const basisPointCombos: number[][] = [
      [3334, 3333, 3333],
      [6667, 3333],
      [2500, 2500, 2500, 2500],
      [10000],
      [1, 9999],
      [9999, 1],
    ];

    for (const basisPointsList of basisPointCombos) {
      for (const amount of [1, 7, 100, 9999, 1_000_000]) {
        const shares = basisPointsList.map((basisPoints, index) => ({
          userId: `u${index}`,
          basisPoints,
        }));
        const result = splitByPercentage({ amount, shares });
        const total = result.reduce((sum, share) => sum + share.amount, 0);
        expect(total).toBe(amount);
      }
    }
  });

  it("ayni girdi her zaman ayni sonucu uretir (deterministik)", () => {
    const input = {
      amount: 10007,
      shares: [
        { userId: "a", basisPoints: 3334 },
        { userId: "b", basisPoints: 3333 },
        { userId: "c", basisPoints: 3333 },
      ],
    };
    expect(splitByPercentage(input)).toEqual(splitByPercentage(input));
  });
});

describe("inferBasisPoints", () => {
  const A = "user-a";
  const B = "user-b";
  const C = "user-c";

  it("yuvarlak yuzdeleri geri bulur (%50 / %50)", () => {
    expect(
      inferBasisPoints({
        amount: 10000,
        shares: [
          { userId: A, amount: 5000 },
          { userId: B, amount: 5000 },
        ],
      }),
    ).toEqual([
      { userId: A, basisPoints: 5000 },
      { userId: B, basisPoints: 5000 },
    ]);
  });

  it("esit olmayan yuvarlak yuzdeleri geri bulur (%30 / %70)", () => {
    expect(
      inferBasisPoints({
        amount: 10000,
        shares: [
          { userId: A, amount: 3000 },
          { userId: B, amount: 7000 },
        ],
      }),
    ).toEqual([
      { userId: A, basisPoints: 3000 },
      { userId: B, basisPoints: 7000 },
    ]);
  });

  it("kesirli yuzdeleri de bulur (%33,33 / %33,33 / %33,34)", () => {
    expect(
      inferBasisPoints({
        amount: 10000,
        shares: [
          { userId: A, amount: 3333 },
          { userId: B, amount: 3333 },
          { userId: C, amount: 3334 },
        ],
      }),
    ).toEqual([
      { userId: A, basisPoints: 3333 },
      { userId: B, basisPoints: 3333 },
      { userId: C, basisPoints: 3334 },
    ]);
  });

  // Bu, fonksiyonun ne YAPMADIGINI gosteren test: kullanicinin yazdigi yuzde
  // %33,33 olsa bile geri hesaplama %34 buluyor. Ikisi de ayni paylari
  // uretiyor - garanti edilen sey bu, "ayni metni geri getirmek" degil.
  it("girilen yuzdeyi degil, ayni paylari ureten yuzdeyi bulur", () => {
    const inferred = inferBasisPoints({
      amount: 100,
      shares: [
        { userId: A, amount: 34 },
        { userId: B, amount: 33 },
        { userId: C, amount: 33 },
      ],
    });

    expect(inferred).toEqual([
      { userId: A, basisPoints: 3400 },
      { userId: B, basisPoints: 3300 },
      { userId: C, basisPoints: 3300 },
    ]);

    // Asil onemli olan: bu yuzdeler kayitli paylari birebir geri veriyor.
    expect(splitByPercentage({ amount: 100, shares: inferred! })).toEqual([
      { userId: A, amount: 34 },
      { userId: B, amount: 33 },
      { userId: C, amount: 33 },
    ]);
  });

  it("yuzdeler tam 100'e toplanmiyorsa null doner", () => {
    // 3 kurus / 3 kisi: her pay %33,33'e yuvarlanir, toplam %99,99.
    expect(
      inferBasisPoints({
        amount: 3,
        shares: [
          { userId: A, amount: 1 },
          { userId: B, amount: 1 },
          { userId: C, amount: 1 },
        ],
      }),
    ).toBeNull();
  });

  it("bos katilimci listesi ve gecersiz tutar null doner", () => {
    expect(inferBasisPoints({ amount: 10000, shares: [] })).toBeNull();
    expect(
      inferBasisPoints({ amount: 0, shares: [{ userId: A, amount: 0 }] }),
    ).toBeNull();
  });

  it("bozuk kayitta (yinelenen katilimci) null doner, tahmin uretmez", () => {
    expect(
      inferBasisPoints({
        amount: 10000,
        shares: [
          { userId: A, amount: 5000 },
          { userId: A, amount: 5000 },
        ],
      }),
    ).toBeNull();
  });
});

describe("splitByItems", () => {
  const sum = (shares: SplitShare[]) => shares.reduce((t, s) => t + s.amount, 0);

  it("kalem toplami ile tutar AYNIYSA paylar ara toplamlarin AYNISI", () => {
    // Bahsissiz bir hesapta kimse "bir kurus oynadi" gormemeli.
    const shares = splitByItems({
      amount: 3000,
      items: [
        { amount: 1000, userIds: ["a"] },
        { amount: 2000, userIds: ["b"] },
      ],
    });
    expect(shares).toEqual([
      { userId: "a", amount: 1000 },
      { userId: "b", amount: 2000 },
    ]);
  });

  it("bir kalemi paylasanlar arasinda ESIT bolunuyor", () => {
    const shares = splitByItems({
      amount: 1000,
      items: [{ amount: 1000, userIds: ["a", "b", "c"] }],
    });
    expect(sum(shares)).toBe(1000);
    // 1000 / 3 = 333.33 -> kalan bir kurus ILK kisiye
    expect(shares).toEqual([
      { userId: "a", amount: 334 },
      { userId: "b", amount: 333 },
      { userId: "c", amount: 333 },
    ]);
  });

  it("BAHSIS herkesin yedigi kadar dagiliyor", () => {
    // Kalemler 3000, hesap 3300 (%10 bahsis).
    const shares = splitByItems({
      amount: 3300,
      items: [
        { amount: 1000, userIds: ["a"] },
        { amount: 2000, userIds: ["b"] },
      ],
    });
    expect(sum(shares)).toBe(3300);
    expect(shares).toEqual([
      { userId: "a", amount: 1100 },
      { userId: "b", amount: 2200 },
    ]);
  });

  it("INDIRIM de ayni kuralla dusuyor", () => {
    const shares = splitByItems({
      amount: 2700,
      items: [
        { amount: 1000, userIds: ["a"] },
        { amount: 2000, userIds: ["b"] },
      ],
    });
    expect(sum(shares)).toBe(2700);
    expect(shares).toEqual([
      { userId: "a", amount: 900 },
      { userId: "b", amount: 1800 },
    ]);
  });

  it("KUSURAT DEGISMEZI: her durumda toplam tam olarak amount", () => {
    // Kaba kuvvet: kirpmanin kacabilecegi tutarlar taraniyor.
    for (let amount = 1; amount <= 500; amount += 1) {
      const shares = splitByItems({
        amount,
        items: [
          { amount: 7, userIds: ["a", "b", "c"] },
          { amount: 11, userIds: ["b", "c"] },
          { amount: 13, userIds: ["a"] },
        ],
      });
      expect(sum(shares)).toBe(amount);
      expect(shares.every((s) => s.amount >= 0)).toBe(true);
    }
  });

  it("CARPIMIN Number'IN GUVENLI ARALIGINI ASTIGI BOLGEDE de dogru", () => {
    /**
     * BU TESTIN NE YAPTIGI - VE NE YAPMADIGI.
     *
     * YAPTIGI: girdiyi, ara carpimin (subtotal x amount) Number'in guvenli
     * tam sayi araligini ASTIGI bolgeye tasiyor ve sonucun hala tam
     * oldugunu gosteriyor. Asagidaki iddia o bolgede oldugumuzu KANITLIYOR;
     * yani biri gelip sayilari kucultursen test sessizce anlamsizlasmasin.
     *
     * YAPMADIGI: "BigInt kaldirilirsa duser" demiyor - CUNKU DUSMUYOR.
     * Olculdu: Number ile taban bazi girdilerde bir eksik cikiyor, ama o
     * kurusu en-buyuk-kalan adimi geri veriyor ve 600.000 rastgele girdide
     * uretilen paylar hic ayrismadi. BigInt burada dogrulugu bir tesadufe
     * bagli olmaktan cikariyor; gerekcesi split.ts'te yaziyor.
     */
    const a = 1_003_296_636;
    const b = 1_051_275_845;
    const total = a + b;

    expect(a * total).toBeGreaterThan(Number.MAX_SAFE_INTEGER);

    const shares = splitByItems({
      amount: total,
      items: [
        { amount: a, userIds: ["a"] },
        { amount: b, userIds: ["b"] },
      ],
    });

    // Oran 1: kirpma SIFIR olmali, paylar ara toplamlarin aynisi.
    expect(shares).toEqual([
      { userId: "a", amount: a },
      { userId: "b", amount: b },
    ]);
    expect(sum(shares)).toBe(total);
  });

  it("bos kalem listesi REDDEDILIYOR", () => {
    expect(() => splitByItems({ amount: 100, items: [] })).toThrow(ValidationError);
  });

  it("katilimcisiz kalem REDDEDILIYOR - VE KENDI KODUYLA", () => {
    /**
     * KOD DA SINANIYOR, yalnizca "firlatti mi" degil.
     *
     * splitEqually bos listeye zaten "split.no_participants" firlatiyor,
     * yani buradaki kontrol kaldirilsa da bir hata olusurdu ve
     * toThrow(ValidationError) GECERDI - test korudugunu sandigi seyi
     * korumuyordu. Ayrimi yapan sey kodun kendisi: kullanici "en az bir
     * katilimci gerekli" degil "her kalemi en az bir kisi paylasmali"
     * okumali; ilki hangi kalem oldugunu soylemiyor.
     */
    expect(() =>
      splitByItems({ amount: 100, items: [{ amount: 100, userIds: [] }] }),
    ).toThrowError(
      expect.objectContaining({ code: "split.item_no_participants" }),
    );
  });

  it("sifir ya da negatif kalem tutari REDDEDILIYOR", () => {
    expect(() =>
      splitByItems({ amount: 100, items: [{ amount: 0, userIds: ["a"] }] }),
    ).toThrow(ValidationError);
  });

  it("ayni kisi bir kalemde iki kez gecemiyor", () => {
    expect(() =>
      splitByItems({ amount: 100, items: [{ amount: 100, userIds: ["a", "a"] }] }),
    ).toThrow(ValidationError);
  });

  it("ayni kisi FARKLI kalemlerde gecebilir - ara toplamlar birikiyor", () => {
    const shares = splitByItems({
      amount: 300,
      items: [
        { amount: 100, userIds: ["a"] },
        { amount: 200, userIds: ["a", "b"] },
      ],
    });
    expect(shares).toEqual([
      { userId: "a", amount: 200 },
      { userId: "b", amount: 100 },
    ]);
  });
});
