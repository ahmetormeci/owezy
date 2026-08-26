import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("kendi sitemizdeki yolu oldugu gibi doner", () => {
    expect(safeRedirectPath("/join/abc123")).toBe("/join/abc123");
    expect(safeRedirectPath("/groups")).toBe("/groups");
  });

  it("sorgu ve capa tasiyan yolu korur", () => {
    expect(safeRedirectPath("/groups?filter=food")).toBe("/groups?filter=food");
    expect(safeRedirectPath("/privacy#silme")).toBe("/privacy#silme");
  });

  it("bos ya da tanimsiz degerde koke doner", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  /**
   * BU TESTLERIN HEPSI AYNI SALDIRIYI ANLATIYOR: kullanici GERCEK owezy.net'te
   * giris yapar, sonra saldirganin sayfasina dusurulur ve oradaki sahte forma
   * bilgilerini yazar. Zincirin ilk halkasi gercek oldugu icin ikna edici.
   */
  describe("acik yonlendirmeyi reddeder", () => {
    const saldirilar = [
      // Tarayici bunu protokol-bagimsiz adres sayar: https://evil.com
      "//evil.com",
      "///evil.com",
      // Bazi tarayicilar ters boluyu bolu gibi okur.
      "/\\evil.com",
      "\\\\evil.com",
      // Ayni seyler yuzde kodlamasiyla gizlenmis.
      "/%2f%2fevil.com",
      "/%5c%5cevil.com",
      // Acikca disari.
      "https://evil.com",
      "http://evil.com",
      "//evil.com/join/abc",
      // Yonlendirme degil, kod calistirma.
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      // Basta "/" yok - goreli yol tarayicida beklenmedik yere cozulur.
      "evil.com",
      "join/abc",
    ];

    for (const saldiri of saldirilar) {
      it(`reddediyor: ${saldiri}`, () => {
        expect(safeRedirectPath(saldiri)).toBe("/");
      });
    }
  });
});
